import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PhoneBurner API Configuration
const PHONEBURNER_BASE_URL = 'https://www.phoneburner.com/rest/1';
const RATE_LIMIT_DELAY = 500;
const BATCH_SIZE = 100;
const TIME_BUDGET_MS = 50000;
const DAYS_TO_SYNC = 180; // Pull last 180 days of data
const MAX_USAGE_RANGE_DAYS = 90; // PhoneBurner API limit for dialsession/usage

// Helper function to format date as YYYY-MM-DD
function formatDateYMD(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper function to format date as ISO string for API
function formatDateISO(date: Date): string {
  return date.toISOString();
}

// Get date ranges for syncing
function getDateRanges(totalDays: number, maxRangePerCall: number): Array<{ start: string; end: string }> {
  const ranges: Array<{ start: string; end: string }> = [];
  const now = new Date();

  let daysRemaining = totalDays;
  let endDate = new Date(now);

  while (daysRemaining > 0) {
    const daysInThisRange = Math.min(daysRemaining, maxRangePerCall);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - daysInThisRange);

    ranges.push({
      start: formatDateYMD(startDate),
      end: formatDateYMD(endDate),
    });

    endDate = new Date(startDate);
    daysRemaining -= daysInThisRange;
  }

  return ranges;
}

// Get the date from X days ago
function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

interface PhoneBurnerContact {
  contact_id?: number;
  id?: number;
  user_id?: number;
  contact_user_id?: number;
  owner_id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  primary_email?: string;
  primary_phone?: string;
  phone_work?: string;
  phone_mobile?: string;
  phone_home?: string;
  company?: string;
  title?: string;
  job_title?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  notes?: string;
  date_created?: string;
  date_added?: string;
  date_modified?: string;
  category_id?: number;
  category_name?: string;
  custom_fields?: Record<string, string>;
}

interface PhoneBurnerMember {
  user_id: number;
  email: string;
  first_name?: string;
  last_name?: string;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function phoneBurnerRequest(
  endpoint: string,
  accessToken: string,
  retries = 3
): Promise<any> {
  for (let i = 0; i < retries; i++) {
    await delay(RATE_LIMIT_DELAY);
    const url = `${PHONEBURNER_BASE_URL}${endpoint}`;
    console.log(`Fetching: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log(`Response status: ${response.status}`);

      if (response.status === 429) {
        console.log(`Rate limited, waiting ${(i + 1) * 3} seconds...`);
        await delay((i + 1) * 3000);
        continue;
      }

      if (response.status === 401) {
        const errorText = await response.text();
        console.error('Auth error response:', errorText);
        throw new Error('PhoneBurner authentication failed - check your access token');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error ${response.status}: ${errorText}`);
        if (i === retries - 1) throw new Error(`PhoneBurner API error (${response.status}): ${errorText}`);
        continue;
      }

      const data = await response.json();
      console.log(`Response keys: ${Object.keys(data || {}).join(', ')}`);
      return data;
    } catch (error) {
      console.error(`Request error:`, error);
      if (i === retries - 1) throw error;
      console.log(`Retry ${i + 1}/${retries} after error`);
      await delay(1000 * (i + 1));
    }
  }
}

serve(async (req) => {
  console.log('phoneburner-sync: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const { workspace_id, sync_type = 'full', reset = false, diagnostic = false } = body;

    if (!workspace_id) throw new Error('workspace_id is required');

    // Verify workspace membership
    const { data: membership, error: memberError } = await supabase
      .from('workspace_members').select('role')
      .eq('workspace_id', workspace_id).eq('user_id', user.id).single();
    if (memberError || !membership) throw new Error('Access denied to workspace');

    // Get PhoneBurner connection
    const { data: connection, error: connError } = await supabase
      .from('api_connections').select('id, api_key_encrypted, sync_progress, sync_status')
      .eq('workspace_id', workspace_id).eq('platform', 'phoneburner').eq('is_active', true).single();
    if (connError || !connection) {
      throw new Error('No active PhoneBurner connection found. Please add your PhoneBurner access token in Connections.');
    }

    const accessToken = connection.api_key_encrypted;

    // ========== DIAGNOSTIC MODE ==========
    if (diagnostic) {
      console.log('Running PhoneBurner diagnostics...');

      // Calculate date ranges for testing
      const syncFromDate = getDaysAgo(DAYS_TO_SYNC);
      const dateRanges = getDateRanges(DAYS_TO_SYNC, MAX_USAGE_RANGE_DAYS);
      const today = formatDateYMD(new Date());
      const dateFrom180Days = formatDateYMD(syncFromDate);

      const results: any = {
        token_prefix: accessToken.substring(0, 10) + '...',
        date_range: {
          sync_from: dateFrom180Days,
          sync_to: today,
          total_days: DAYS_TO_SYNC,
          usage_ranges: dateRanges, // Shows how we split for 90-day max
        },
        endpoints_tested: [],
      };

      // Test 1: Get members with entire_team=1 (to see all team members)
      try {
        const membersResponse = await phoneBurnerRequest('/members?entire_team=1', accessToken);
        const membersList = membersResponse?.members || membersResponse?.data || [];
        results.members = {
          success: true,
          response_keys: Object.keys(membersResponse || {}),
          member_count: Array.isArray(membersList) ? membersList.length : 'unknown',
          data: membersResponse,
        };
        results.endpoints_tested.push('/members?entire_team=1');
      } catch (e: any) {
        results.members = { success: false, error: e.message };
      }

      // Test 2: Get contacts with updated_from date filter (180 days)
      try {
        const updatedFrom = formatDateISO(syncFromDate);
        const contactsUrl = `/contacts?page=1&page_size=5&updated_from=${encodeURIComponent(updatedFrom)}`;
        console.log(`Testing contacts with date filter: ${contactsUrl}`);

        const contactsResponse = await phoneBurnerRequest(contactsUrl, accessToken);

        let contacts: any[] = [];
        if (contactsResponse?.contacts && Array.isArray(contactsResponse.contacts)) {
          contacts = contactsResponse.contacts;
        } else if (contactsResponse?.data && Array.isArray(contactsResponse.data)) {
          contacts = contactsResponse.data;
        } else if (Array.isArray(contactsResponse)) {
          contacts = contactsResponse;
        }

        results.contacts = {
          success: true,
          url_tested: contactsUrl,
          response_keys: Object.keys(contactsResponse || {}),
          contact_count: contacts.length,
          total_available: contactsResponse?.total || contactsResponse?.total_count || 'unknown',
          sample_contact: contacts[0] ? Object.keys(contacts[0]) : 'none',
          data: contactsResponse,
        };
        results.endpoints_tested.push(contactsUrl);
      } catch (e: any) {
        results.contacts = { success: false, error: e.message };
      }

      // Test 2b: Also test contacts WITHOUT date filter to compare
      try {
        const contactsNoFilterResponse = await phoneBurnerRequest('/contacts?page=1&page_size=5', accessToken);
        let contacts: any[] = [];
        if (contactsNoFilterResponse?.contacts && Array.isArray(contactsNoFilterResponse.contacts)) {
          contacts = contactsNoFilterResponse.contacts;
        } else if (contactsNoFilterResponse?.data && Array.isArray(contactsNoFilterResponse.data)) {
          contacts = contactsNoFilterResponse.data;
        } else if (Array.isArray(contactsNoFilterResponse)) {
          contacts = contactsNoFilterResponse;
        }

        results.contacts_no_filter = {
          success: true,
          contact_count: contacts.length,
          total_available: contactsNoFilterResponse?.total || contactsNoFilterResponse?.total_count || 'unknown',
          data: contactsNoFilterResponse,
        };
        results.endpoints_tested.push('/contacts?page=1&page_size=5');
      } catch (e: any) {
        results.contacts_no_filter = { success: false, error: e.message };
      }

      // Test 3: Get dial sessions with date_start/date_end
      try {
        const sessionsUrl = `/dialsession?page=1&page_size=5&date_start=${dateFrom180Days}&date_end=${today}`;
        console.log(`Testing dialsession with date filter: ${sessionsUrl}`);

        const sessionsResponse = await phoneBurnerRequest(sessionsUrl, accessToken);

        let sessions: any[] = [];
        if (sessionsResponse?.dial_sessions && Array.isArray(sessionsResponse.dial_sessions)) {
          sessions = sessionsResponse.dial_sessions;
        } else if (sessionsResponse?.dialsessions && Array.isArray(sessionsResponse.dialsessions)) {
          sessions = sessionsResponse.dialsessions;
        } else if (sessionsResponse?.data && Array.isArray(sessionsResponse.data)) {
          sessions = sessionsResponse.data;
        } else if (Array.isArray(sessionsResponse)) {
          sessions = sessionsResponse;
        }

        results.dial_sessions = {
          success: true,
          url_tested: sessionsUrl,
          response_keys: Object.keys(sessionsResponse || {}),
          session_count: sessions.length,
          sample_session: sessions[0] ? Object.keys(sessions[0]) : 'none',
          data: sessionsResponse,
        };
        results.endpoints_tested.push(sessionsUrl);
      } catch (e: any) {
        results.dial_sessions = { success: false, error: e.message };
      }

      // Test 4: Get dial session usage (requires date_start and date_end, max 90 days)
      try {
        // Use first 90-day range for testing
        const usageRange = dateRanges[0];
        const usageUrl = `/dialsession/usage?date_start=${usageRange.start}&date_end=${usageRange.end}`;
        console.log(`Testing dialsession/usage with required date filter: ${usageUrl}`);

        const usageResponse = await phoneBurnerRequest(usageUrl, accessToken);
        results.dial_usage = {
          success: true,
          url_tested: usageUrl,
          response_keys: Object.keys(usageResponse || {}),
          data: usageResponse,
        };
        results.endpoints_tested.push(usageUrl);
      } catch (e: any) {
        results.dial_usage = { success: false, error: e.message };
      }

      // Test 5: Try the /user endpoint to see current user info
      try {
        const userResponse = await phoneBurnerRequest('/user', accessToken);
        results.current_user = {
          success: true,
          data: userResponse,
        };
        results.endpoints_tested.push('/user');
      } catch (e: any) {
        results.current_user = { success: false, error: e.message };
      }

      return new Response(JSON.stringify({ diagnostic: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========== NORMAL SYNC MODE ==========
    const existingSyncProgress = connection.sync_progress as any || {};

    // Handle reset
    if (reset) {
      console.log('Resetting PhoneBurner sync data for workspace:', workspace_id);
      await supabase.from('message_events').delete()
        .eq('workspace_id', workspace_id).eq('platform', 'phoneburner');
      await supabase.from('leads').delete()
        .eq('workspace_id', workspace_id).eq('platform', 'phoneburner');
      await supabase.from('api_connections').update({
        sync_status: 'syncing',
        sync_progress: { page: 1, step: 'contacts' },
      }).eq('id', connection.id);
    }

    await supabase.from('api_connections').update({
      sync_status: 'syncing',
      sync_progress: { ...existingSyncProgress, last_heartbeat: new Date().toISOString() },
    }).eq('id', connection.id);

    const progress = {
      contacts_synced: 0,
      calls_synced: 0,
      dial_sessions_synced: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;

    // Calculate date range for 180 days of data
    const syncFromDate = getDaysAgo(DAYS_TO_SYNC);
    const syncFromDateISO = formatDateISO(syncFromDate);
    const syncFromDateYMD = formatDateYMD(syncFromDate);
    const todayYMD = formatDateYMD(new Date());
    const dateRanges = getDateRanges(DAYS_TO_SYNC, MAX_USAGE_RANGE_DAYS);

    console.log(`Syncing PhoneBurner data from ${syncFromDateYMD} to ${todayYMD} (${DAYS_TO_SYNC} days)`);

    let currentPage = reset ? 1 : (existingSyncProgress.page || 1);
    let hasMoreContacts = true;

    try {
      // ========== SYNC CONTACTS ==========
      console.log('Fetching PhoneBurner contacts with updated_from filter...');

      while (hasMoreContacts && !isTimeBudgetExceeded()) {
        await supabase.from('api_connections').update({
          sync_progress: { page: currentPage, step: 'contacts', progress: Math.min(50, currentPage * 5), ...progress },
        }).eq('id', connection.id);

        // PhoneBurner API - use updated_from for date filtering
        const contactsUrl = `/contacts?page=${currentPage}&page_size=${BATCH_SIZE}&updated_from=${encodeURIComponent(syncFromDateISO)}`;
        console.log(`Fetching: ${contactsUrl}`);
        const contactsResponse = await phoneBurnerRequest(contactsUrl, accessToken);

        // Handle various response formats
        let contacts: PhoneBurnerContact[] = [];
        if (contactsResponse?.contacts && Array.isArray(contactsResponse.contacts)) {
          contacts = contactsResponse.contacts;
        } else if (contactsResponse?.data && Array.isArray(contactsResponse.data)) {
          contacts = contactsResponse.data;
        } else if (Array.isArray(contactsResponse)) {
          contacts = contactsResponse;
        }

        console.log(`Page ${currentPage}: Found ${contacts.length} contacts`);
        console.log(`Sample contact keys: ${contacts[0] ? Object.keys(contacts[0]).join(', ') : 'none'}`);

        if (contacts.length === 0) {
          console.log('No more contacts');
          hasMoreContacts = false;
          break;
        }

        for (const contact of contacts) {
          // Handle various field names PhoneBurner might use
          const contactId = contact.contact_id || contact.id;
          const email = (contact.primary_email || contact.email)?.toLowerCase();
          const phone = contact.primary_phone || contact.phone_work || contact.phone_mobile || contact.phone_home;
          const firstName = contact.first_name;
          const lastName = contact.last_name;
          const company = contact.company;
          const title = contact.job_title || contact.title;

          if (!contactId) {
            console.log('Skipping contact without ID:', JSON.stringify(contact).substring(0, 200));
            continue;
          }

          const leadPayload = {
            workspace_id,
            platform: 'phoneburner',
            platform_lead_id: String(contactId),
            email: email || null,
            first_name: firstName || null,
            last_name: lastName || null,
            company: company || null,
            title: title || null,
            phone: phone || null,
            city: contact.city || null,
            state: contact.state || null,
            status: 'active',
            metadata: {
              owner_id: contact.owner_id || contact.user_id || contact.contact_user_id,
              category_name: contact.category_name,
              custom_fields: contact.custom_fields,
              raw_data: contact,
            },
          };

          const { error: leadError } = await supabase
            .from('leads')
            .upsert(leadPayload, { onConflict: 'workspace_id,platform,platform_lead_id' });

          if (leadError) {
            console.error(`Lead upsert error for ${contactId}:`, leadError.message);
            progress.errors.push(`Contact ${contactId}: ${leadError.message}`);
          } else {
            progress.contacts_synced++;
          }
        }

        hasMoreContacts = contacts.length === BATCH_SIZE;
        currentPage++;
      }

      if (isTimeBudgetExceeded()) {
        console.log('Time budget exceeded during contacts sync');
        await supabase.from('api_connections').update({
          sync_progress: { page: currentPage, step: 'contacts', progress: 50, ...progress },
        }).eq('id', connection.id);

        return new Response(JSON.stringify({
          success: true, done: false,
          message: `Synced ${progress.contacts_synced} contacts. Call again to continue.`,
          ...progress,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ========== SYNC DIAL SESSIONS & CALLS ==========
      console.log('Fetching PhoneBurner dial sessions with date filtering...');

      await supabase.from('api_connections').update({
        sync_progress: { page: 1, step: 'dial_sessions', progress: 60, ...progress },
      }).eq('id', connection.id);

      // Fetch dial session usage for each 90-day range (API limit)
      // This gives us an overview of session activity
      console.log(`Fetching dial session usage for ${dateRanges.length} date ranges (90-day max each)...`);
      for (const range of dateRanges) {
        try {
          const usageUrl = `/dialsession/usage?date_start=${range.start}&date_end=${range.end}`;
          console.log(`Fetching usage: ${usageUrl}`);
          const usageResponse = await phoneBurnerRequest(usageUrl, accessToken);
          console.log(`Usage for ${range.start} to ${range.end}:`, JSON.stringify(usageResponse).substring(0, 200));
        } catch (usageError) {
          console.error(`Failed to fetch usage for range ${range.start}-${range.end}:`, usageError);
        }
      }

      // Fetch dial sessions with date filtering - paginate through all
      let dialSessions: any[] = [];
      let sessionPage = 1;
      let hasMoreSessions = true;

      while (hasMoreSessions && !isTimeBudgetExceeded()) {
        const sessionsUrl = `/dialsession?page=${sessionPage}&page_size=${BATCH_SIZE}&date_start=${syncFromDateYMD}&date_end=${todayYMD}`;
        console.log(`Fetching dial sessions: ${sessionsUrl}`);

        const sessionsResponse = await phoneBurnerRequest(sessionsUrl, accessToken);

        let pageSessions: any[] = [];
        if (sessionsResponse?.dial_sessions && Array.isArray(sessionsResponse.dial_sessions)) {
          pageSessions = sessionsResponse.dial_sessions;
        } else if (sessionsResponse?.dialsessions && Array.isArray(sessionsResponse.dialsessions)) {
          pageSessions = sessionsResponse.dialsessions;
        } else if (sessionsResponse?.data && Array.isArray(sessionsResponse.data)) {
          pageSessions = sessionsResponse.data;
        } else if (Array.isArray(sessionsResponse)) {
          pageSessions = sessionsResponse;
        }

        console.log(`Dial sessions page ${sessionPage}: found ${pageSessions.length} sessions`);

        if (pageSessions.length === 0) {
          hasMoreSessions = false;
        } else {
          dialSessions = dialSessions.concat(pageSessions);
          hasMoreSessions = pageSessions.length === BATCH_SIZE;
          sessionPage++;
        }
      }

      console.log(`Total dial sessions found: ${dialSessions.length}`);

      // Get leads for mapping
      const { data: allLeads } = await supabase
        .from('leads')
        .select('id, platform_lead_id')
        .eq('workspace_id', workspace_id)
        .eq('platform', 'phoneburner');

      const leadIdMap = new Map<string, string>();
      for (const lead of allLeads || []) {
        leadIdMap.set(lead.platform_lead_id, lead.id);
      }

      for (const session of dialSessions) {
        if (isTimeBudgetExceeded()) break;

        const sessionId = session.dial_session_id || session.id;
        if (!sessionId) continue;

        progress.dial_sessions_synced++;

        // Get session details with calls - use correct API endpoint format
        // Per API docs: GET /dialsession/{dialsession_id} returns session with calls array
        try {
          const sessionDetailsUrl = `/dialsession/${sessionId}?include_recording=1`;
          console.log(`Fetching session details: ${sessionDetailsUrl}`);
          const sessionDetailsResponse = await phoneBurnerRequest(sessionDetailsUrl, accessToken);

          // Extract calls from session details response
          let calls: any[] = [];
          if (sessionDetailsResponse?.dial_session?.calls && Array.isArray(sessionDetailsResponse.dial_session.calls)) {
            calls = sessionDetailsResponse.dial_session.calls;
          } else if (sessionDetailsResponse?.calls && Array.isArray(sessionDetailsResponse.calls)) {
            calls = sessionDetailsResponse.calls;
          } else if (sessionDetailsResponse?.data?.calls && Array.isArray(sessionDetailsResponse.data.calls)) {
            calls = sessionDetailsResponse.data.calls;
          } else if (Array.isArray(sessionDetailsResponse?.data)) {
            calls = sessionDetailsResponse.data;
          } else if (Array.isArray(sessionDetailsResponse)) {
            calls = sessionDetailsResponse;
          }

          console.log(`Session ${sessionId}: ${calls.length} calls`);

          for (const call of calls) {
            const callId = call.call_id || call.id;
            const contactId = call.contact_id;
            const leadDbId = contactId ? leadIdMap.get(String(contactId)) : null;

            // Map call disposition to event type
            let eventType = 'call_attempted';
            const disposition = (call.disposition || call.call_result || '').toLowerCase();
            if (disposition.includes('live') || disposition.includes('answer') || disposition.includes('connected')) {
              eventType = 'call_connected';
            } else if (disposition.includes('voicemail') || disposition.includes('vm')) {
              eventType = 'voicemail_left';
            } else if (disposition.includes('no answer') || disposition.includes('noanswer')) {
              eventType = 'call_no_answer';
            }

            const eventPayload = {
              workspace_id,
              platform: 'phoneburner',
              platform_event_id: String(callId || `${sessionId}-${call.phone_number}-${call.call_time || Date.now()}`),
              lead_id: leadDbId || null,
              event_type: eventType,
              occurred_at: call.call_time || call.date_created || call.created_at || new Date().toISOString(),
              lead_email: null,
              metadata: {
                phone_number: call.phone_number || call.phone,
                duration: call.duration || call.call_duration,
                disposition: call.disposition || call.call_result,
                notes: call.notes,
                recording_url: call.recording_url || call.recording,
                dial_session_id: sessionId,
                raw_data: call,
              },
            };

            const { error: eventError } = await supabase
              .from('message_events')
              .upsert(eventPayload, { onConflict: 'workspace_id,platform,platform_event_id' });

            if (!eventError) {
              progress.calls_synced++;
            } else if (eventError.code !== '23505') {
              console.error(`Call upsert error:`, eventError.message);
            }
          }
        } catch (callError) {
          console.error(`Failed to fetch calls for session ${sessionId}:`, callError);
          progress.errors.push(`Session ${sessionId}: ${String(callError)}`);
        }
      }

      // Mark sync complete
      const isComplete = !hasMoreContacts && !isTimeBudgetExceeded();

      await supabase.from('api_connections').update({
        sync_status: isComplete ? 'success' : 'syncing',
        last_sync_at: isComplete ? new Date().toISOString() : undefined,
        sync_progress: {
          page: currentPage,
          step: isComplete ? 'complete' : 'dial_sessions',
          progress: isComplete ? 100 : 80,
          completed: isComplete,
          ...progress,
        },
      }).eq('id', connection.id);

      console.log('PhoneBurner sync progress:', { isComplete, ...progress });

      return new Response(JSON.stringify({
        success: true,
        done: isComplete,
        message: isComplete
          ? 'PhoneBurner sync completed successfully'
          : 'Sync in progress. Call again to continue.',
        ...progress,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (syncError) {
      console.error('PhoneBurner sync error:', syncError);
      await supabase.from('api_connections').update({
        sync_status: 'error',
        sync_progress: { step: 'error', error: String(syncError), ...progress },
      }).eq('id', connection.id);
      throw syncError;
    }

  } catch (error: unknown) {
    console.error('Error in phoneburner-sync:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
