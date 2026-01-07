import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PhoneBurner API Configuration
const PHONEBURNER_BASE_URL = 'https://www.phoneburner.com/rest/1';
const RATE_LIMIT_DELAY = 500; // 500ms between requests
const BATCH_SIZE = 100; // Contacts per page
const TIME_BUDGET_MS = 50000; // 50 seconds

interface PhoneBurnerContact {
  id: number;
  user_id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_work?: string;
  phone_mobile?: string;
  phone_home?: string;
  company?: string;
  title?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  notes?: string;
  date_created?: string;
  date_modified?: string;
  category_id?: number;
  category_name?: string;
  custom_fields?: Record<string, string>;
}

interface PhoneBurnerDialSession {
  id: number;
  user_id: number;
  start_time: string;
  end_time?: string;
  total_calls: number;
  total_duration: number;
  live_answers: number;
  voicemails: number;
}

interface PhoneBurnerCall {
  id: number;
  contact_id: number;
  user_id: number;
  dial_session_id?: number;
  phone_number: string;
  call_type: string; // 'live_answer', 'voicemail', 'no_answer', 'busy', 'failed'
  duration: number;
  disposition?: string;
  notes?: string;
  recording_url?: string;
  date_created: string;
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
    console.log(`Fetching: ${endpoint}`);

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (response.status === 429) {
        console.log(`Rate limited, waiting ${(i + 1) * 3} seconds...`);
        await delay((i + 1) * 3000);
        continue;
      }

      if (response.status === 401) {
        throw new Error('PhoneBurner authentication failed - check your access token');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error ${response.status}: ${errorText}`);
        if (i === retries - 1) throw new Error(`PhoneBurner API error (${response.status}): ${errorText}`);
        continue;
      }

      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retry ${i + 1}/${retries} after error:`, error);
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
      console.error('phoneburner-sync: Missing authorization header');
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

    const { workspace_id, sync_type = 'full', reset = false } = await req.json();
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
    const existingSyncProgress = connection.sync_progress as any || {};

    // Handle reset
    if (reset) {
      console.log('Resetting PhoneBurner sync data for workspace:', workspace_id);

      // Delete PhoneBurner-specific data
      await supabase.from('message_events').delete()
        .eq('workspace_id', workspace_id)
        .eq('platform', 'phoneburner');
      await supabase.from('leads').delete()
        .eq('workspace_id', workspace_id)
        .eq('platform', 'phoneburner');

      await supabase.from('api_connections').update({
        sync_status: 'syncing',
        sync_progress: { page: 1, step: 'contacts' },
      }).eq('id', connection.id);

      console.log('Reset complete');
    }

    // Update status to syncing
    await supabase.from('api_connections').update({
      sync_status: 'syncing',
      sync_progress: {
        ...existingSyncProgress,
        last_heartbeat: new Date().toISOString(),
      },
    }).eq('id', connection.id);

    const progress = {
      contacts_synced: 0,
      calls_synced: 0,
      dial_sessions_synced: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;

    let currentPage = reset ? 1 : (existingSyncProgress.page || 1);
    let hasMoreContacts = true;

    try {
      // ========== SYNC CONTACTS ==========
      console.log('Fetching PhoneBurner contacts...');

      while (hasMoreContacts && !isTimeBudgetExceeded()) {
        await supabase.from('api_connections').update({
          sync_progress: {
            page: currentPage,
            step: 'contacts',
            progress: Math.min(50, currentPage * 5),
            ...progress,
          },
        }).eq('id', connection.id);

        // PhoneBurner contacts endpoint with pagination
        const contactsResponse = await phoneBurnerRequest(
          `/contacts?page=${currentPage}&page_size=${BATCH_SIZE}`,
          accessToken
        );

        const contacts: PhoneBurnerContact[] = contactsResponse?.contacts || contactsResponse?.data || [];

        if (!Array.isArray(contacts) || contacts.length === 0) {
          console.log(`No more contacts at page ${currentPage}`);
          hasMoreContacts = false;
          break;
        }

        console.log(`Fetched ${contacts.length} contacts from page ${currentPage}`);

        // Process contacts
        for (const contact of contacts) {
          const email = contact.email?.toLowerCase();
          const phone = contact.phone_work || contact.phone_mobile || contact.phone_home;

          if (!email && !phone) continue;

          const leadPayload = {
            workspace_id,
            platform: 'phoneburner',
            platform_lead_id: String(contact.id),
            email: email || null,
            first_name: contact.first_name || null,
            last_name: contact.last_name || null,
            company: contact.company || null,
            title: contact.title || null,
            phone: phone || null,
            city: contact.city || null,
            state: contact.state || null,
            status: 'active',
            metadata: {
              category_name: contact.category_name,
              custom_fields: contact.custom_fields,
              address1: contact.address1,
              address2: contact.address2,
              zip: contact.zip,
              country: contact.country,
            },
          };

          const { error: leadError } = await supabase
            .from('leads')
            .upsert(leadPayload, {
              onConflict: 'workspace_id,platform,platform_lead_id',
            });

          if (leadError) {
            console.error(`Failed to upsert contact ${contact.id}:`, leadError.message);
            progress.errors.push(`Contact ${contact.id}: ${leadError.message}`);
          } else {
            progress.contacts_synced++;
          }
        }

        // Check if there are more pages
        hasMoreContacts = contacts.length === BATCH_SIZE;
        currentPage++;
      }

      // Check time budget before dial sessions
      if (isTimeBudgetExceeded()) {
        console.log('Time budget exceeded during contacts sync');
        await supabase.from('api_connections').update({
          sync_progress: {
            page: currentPage,
            step: 'contacts',
            progress: 50,
            time_budget_exit: true,
            ...progress,
          },
        }).eq('id', connection.id);

        return new Response(JSON.stringify({
          success: true,
          done: false,
          message: `Synced ${progress.contacts_synced} contacts. Call again to continue.`,
          ...progress,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ========== SYNC DIAL SESSIONS & CALLS ==========
      console.log('Fetching PhoneBurner dial sessions...');

      await supabase.from('api_connections').update({
        sync_progress: {
          page: 1,
          step: 'dial_sessions',
          progress: 60,
          ...progress,
        },
      }).eq('id', connection.id);

      // Fetch dial sessions
      const sessionsResponse = await phoneBurnerRequest(
        '/dialsession?page=1&page_size=100',
        accessToken
      );

      const dialSessions: PhoneBurnerDialSession[] = sessionsResponse?.dial_sessions ||
        sessionsResponse?.data || [];

      console.log(`Found ${dialSessions.length} dial sessions`);

      // Get all leads for mapping
      const { data: allLeads } = await supabase
        .from('leads')
        .select('id, platform_lead_id')
        .eq('workspace_id', workspace_id)
        .eq('platform', 'phoneburner');

      const leadIdMap = new Map<string, string>();
      for (const lead of allLeads || []) {
        leadIdMap.set(lead.platform_lead_id, lead.id);
      }

      // Process dial sessions and their calls
      for (const session of dialSessions) {
        if (isTimeBudgetExceeded()) break;

        progress.dial_sessions_synced++;

        // Fetch calls for this dial session
        try {
          const callsResponse = await phoneBurnerRequest(
            `/dialsession/${session.id}/calls`,
            accessToken
          );

          const calls: PhoneBurnerCall[] = callsResponse?.calls || callsResponse?.data || [];

          for (const call of calls) {
            const leadDbId = leadIdMap.get(String(call.contact_id));

            // Map PhoneBurner call types to event types
            let eventType = 'call_attempted';
            if (call.call_type === 'live_answer') {
              eventType = 'call_connected';
            } else if (call.call_type === 'voicemail') {
              eventType = 'voicemail_left';
            } else if (call.call_type === 'no_answer') {
              eventType = 'call_no_answer';
            }

            const eventPayload = {
              workspace_id,
              platform: 'phoneburner',
              platform_event_id: String(call.id),
              lead_id: leadDbId || null,
              event_type: eventType,
              occurred_at: call.date_created,
              lead_email: null, // Calls don't have email directly
              metadata: {
                phone_number: call.phone_number,
                duration: call.duration,
                disposition: call.disposition,
                notes: call.notes,
                recording_url: call.recording_url,
                dial_session_id: call.dial_session_id,
                call_type: call.call_type,
              },
            };

            const { error: eventError } = await supabase
              .from('message_events')
              .upsert(eventPayload, {
                onConflict: 'workspace_id,platform,platform_event_id',
              });

            if (!eventError) {
              progress.calls_synced++;
            } else if (eventError.code !== '23505') {
              console.error(`Failed to upsert call ${call.id}:`, eventError.message);
            }
          }
        } catch (callError) {
          console.error(`Failed to fetch calls for session ${session.id}:`, callError);
          progress.errors.push(`Session ${session.id} calls: ${String(callError)}`);
        }
      }

      // Mark sync as complete
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
        sync_progress: {
          step: 'error',
          error: String(syncError),
          ...progress
        },
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
