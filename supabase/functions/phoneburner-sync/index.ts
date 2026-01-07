import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PHONEBURNER_BASE_URL = 'https://www.phoneburner.com/rest/1';
const RATE_LIMIT_DELAY = 500;
const TIME_BUDGET_MS = 45000;
const SYNC_LOCK_TIMEOUT_MS = 30000;
const FUNCTION_VERSION = '2026-01-07.v6';
const ACTIVITIES_PAGE_SIZE = 100;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function phoneburnerRequest(endpoint: string, apiKey: string, retries = 3): Promise<any> {
  const url = `${PHONEBURNER_BASE_URL}${endpoint}`;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`PhoneBurner API request: ${endpoint}`);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      });
      
      if (response.status === 429) {
        console.log('Rate limited, waiting 2s...');
        await delay(2000);
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`PhoneBurner API error ${response.status}: ${errorText}`);
        throw new Error(`PhoneBurner API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Request attempt ${attempt + 1} failed:`, error);
      if (attempt === retries - 1) throw error;
      await delay(1000);
    }
  }
}

interface PhoneBurnerContact {
  contact_user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  category_id?: string;
  date_added?: string;
}

interface PhoneBurnerActivity {
  user_activity_id: string;
  activity_id: string;
  activity: string;
  date: string;
  notes?: string;
  duration?: number;
  disposition?: string;
  disposition_id?: string;
  phone_dialed?: string;
  recording_url?: string;
}

// Helper to extract activities array from various response shapes
function extractActivities(response: any): PhoneBurnerActivity[] {
  if (!response) return [];
  
  const contactActivities = response.contact_activities;
  
  // If it's already an array, return it
  if (Array.isArray(contactActivities)) {
    return contactActivities;
  }
  
  // If it's an object, try common nested patterns
  if (contactActivities && typeof contactActivities === 'object') {
    // Try nested .contact_activities
    if (Array.isArray(contactActivities.contact_activities)) {
      return contactActivities.contact_activities;
    }
    // Try singular .contact_activity (might be array or single object)
    if (contactActivities.contact_activity) {
      const activity = contactActivities.contact_activity;
      return Array.isArray(activity) ? activity : [activity];
    }
    // Try .activities
    if (Array.isArray(contactActivities.activities)) {
      return contactActivities.activities;
    }
    // Log unexpected shape for debugging
    console.log('Unexpected contact_activities shape:', Object.keys(contactActivities));
  }
  
  // Try top-level .activities
  if (Array.isArray(response.activities)) {
    return response.activities;
  }
  
  console.log('Could not extract activities. Response keys:', Object.keys(response));
  return [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[phoneburner-sync] boot ${FUNCTION_VERSION}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { workspaceId, reset = false, diagnostic = false } = await req.json();

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'workspaceId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: connection, error: connError } = await supabase
      .from('api_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('platform', 'phoneburner')
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'PhoneBurner not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = connection.api_key_encrypted;

    // ============= DIAGNOSTIC MODE =============
    if (diagnostic) {
      console.log('Running PhoneBurner diagnostics...');
      
      const diagnosticResults: any = {
        diagnostic: true,
        timestamp: new Date().toISOString(),
        tests: {}
      };

      // Test 1: Get members
      try {
        const membersResponse = await phoneburnerRequest('/members', apiKey);
        let members: any[] = [];
        const rawMembers = membersResponse.members?.members;
        if (rawMembers && Array.isArray(rawMembers)) {
          members = Array.isArray(rawMembers[0]) ? rawMembers[0] : rawMembers;
        } else if (membersResponse.members && Array.isArray(membersResponse.members)) {
          members = membersResponse.members;
        }
        
        diagnosticResults.tests.members = {
          success: true,
          count: members.length,
          data: members.slice(0, 3).map((m: any) => ({
            user_id: m.user_id || m.member_user_id,
            name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
          })),
        };
      } catch (e: any) {
        diagnosticResults.tests.members = { success: false, error: e.message };
      }

      await delay(RATE_LIMIT_DELAY);

      // Test 2: Contacts endpoint (PRIMARY data source for call history)
      try {
        const contactsResponse = await phoneburnerRequest('/contacts?page=1&page_size=5', apiKey);
        console.log('Raw /contacts response:', JSON.stringify(contactsResponse, null, 2));
        
        const contactsData = contactsResponse.contacts || {};
        const contacts = contactsData.contacts || [];
        
        diagnosticResults.tests.contacts = {
          success: true,
          total_contacts: contactsData.total_results || contacts.length,
          total_pages: contactsData.total_pages || 1,
          sample: contacts.slice(0, 2).map((c: any) => ({
            contact_user_id: c.contact_user_id,
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
            email: c.email,
            phone: c.phone,
          })),
        };

        // Test 3: Contact activities for first contact (if available) - WITH PAGINATION
        if (contacts.length > 0) {
          await delay(RATE_LIMIT_DELAY);
          try {
            const contactId = contacts[0].contact_user_id;
            // Request with explicit pagination params
            const activitiesResponse = await phoneburnerRequest(
              `/contacts/${contactId}/activities?days=180&page=1&page_size=${ACTIVITIES_PAGE_SIZE}`,
              apiKey
            );
            console.log('Raw /contacts/activities response keys:', Object.keys(activitiesResponse));
            
            // Log pagination info from response
            const contactActivitiesWrapper = activitiesResponse.contact_activities;
            let totalPages = 1;
            let totalResults = 0;
            
            if (contactActivitiesWrapper && typeof contactActivitiesWrapper === 'object' && !Array.isArray(contactActivitiesWrapper)) {
              console.log('contact_activities keys:', Object.keys(contactActivitiesWrapper));
              totalPages = contactActivitiesWrapper.total_pages || 1;
              totalResults = contactActivitiesWrapper.total_results || 0;
              console.log(`Pagination: page 1/${totalPages}, total_results: ${totalResults}`);
            }
            
            const activities = extractActivities(activitiesResponse);
            const callActivities = activities.filter((a: any) => 
              a.activity?.toLowerCase().includes('call') || 
              a.activity_id === '41' ||
              a.activity_id === '42' ||
              a.duration !== undefined ||
              a.disposition !== undefined ||
              a.recording_url !== undefined
            );
            
            diagnosticResults.tests.contact_activities = {
              success: true,
              contact_id: contactId,
              total_activities: activities.length,
              total_pages: totalPages,
              total_results: totalResults,
              call_activities: callActivities.length,
              sample: activities.slice(0, 5),
              raw_response_keys: Object.keys(activitiesResponse),
            };
          } catch (e: any) {
            diagnosticResults.tests.contact_activities = { success: false, error: e.message };
          }
        }
      } catch (e: any) {
        diagnosticResults.tests.contacts = { success: false, error: e.message };
      }

      await delay(RATE_LIMIT_DELAY);

      // Test 4: Usage stats (for aggregate metrics)
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        
        const usageResponse = await phoneburnerRequest(
          `/dialsession/usage?date_start=${startDate.toISOString().split('T')[0]}&date_end=${endDate.toISOString().split('T')[0]}`,
          apiKey
        );
        
        const usage = usageResponse.usage || {};
        const memberIds = Object.keys(usage);
        let totalCalls = 0;
        let totalSessions = 0;
        
        for (const id of memberIds) {
          totalCalls += usage[id].calls || 0;
          totalSessions += usage[id].sessions || 0;
        }
        
        diagnosticResults.tests.usage = {
          success: true,
          member_count: memberIds.length,
          total_calls: totalCalls,
          total_sessions: totalSessions,
        };
      } catch (e: any) {
        diagnosticResults.tests.usage = { success: false, error: e.message };
      }

      await delay(RATE_LIMIT_DELAY);

      // Test 5: Dial session endpoints (to pull full call logs when contact activities are empty)
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const dateStart = startDate.toISOString().split('T')[0];
        const dateEnd = endDate.toISOString().split('T')[0];

        // Try both "current user" sessions and explicit member sessions (if supported)
        const firstMemberId = diagnosticResults.tests.members?.data?.[0]?.user_id;

        const candidates = [
          // No filters (lets API choose defaults)
          `/dialsession?page=1&page_size=5`,
          // Days filter variants
          `/dialsession?days=7&page=1&page_size=5`,
          `/dialsession?days=30&page=1&page_size=5`,
          // Date filter variants
          `/dialsession?date_start=${dateStart}&date_end=${dateEnd}&page=1&page_size=5`,
          `/dialsession?start_date=${dateStart}&end_date=${dateEnd}&page=1&page_size=5`,
          // Explicit member filter variants
          firstMemberId ? `/dialsession?member_user_id=${firstMemberId}&page=1&page_size=5` : null,
          firstMemberId ? `/dialsession?member_user_id=${firstMemberId}&days=30&page=1&page_size=5` : null,
          firstMemberId ? `/dialsession?member_user_id=${firstMemberId}&date_start=${dateStart}&date_end=${dateEnd}&page=1&page_size=5` : null,
        ].filter(Boolean) as string[];

        const results: any[] = [];
        for (const endpoint of candidates) {
          try {
            const res = await phoneburnerRequest(endpoint, apiKey);
            const dsWrapper = res?.dialsessions;
            const dsArr = Array.isArray(dsWrapper?.dialsessions)
              ? (Array.isArray(dsWrapper.dialsessions[0]) ? dsWrapper.dialsessions[0] : dsWrapper.dialsessions)
              : [];

            results.push({
              endpoint,
              success: true,
              keys: Object.keys(res || {}),
              dialsessions_keys: dsWrapper && typeof dsWrapper === 'object' ? Object.keys(dsWrapper) : null,
              page: dsWrapper?.page,
              total_pages: dsWrapper?.total_pages,
              total_results: dsWrapper?.total_results,
              count_on_page: dsArr.length,
              sample_item_keys: dsArr[0] ? Object.keys(dsArr[0]) : [],
            });
          } catch (e: any) {
            results.push({ endpoint, success: false, error: e.message });
          }
          await delay(RATE_LIMIT_DELAY);
        }

        diagnosticResults.tests.dial_sessions = {
          success: results.some(r => r.success),
          attempted: results,
        };
      } catch (e: any) {
        diagnosticResults.tests.dial_sessions = { success: false, error: e.message };
      }

      // Generate recommendation
      const contactsTest = diagnosticResults.tests.contacts;
      const activitiesTest = diagnosticResults.tests.contact_activities;
      const usageTest = diagnosticResults.tests.usage;
      const dialSessionsTest = diagnosticResults.tests.dial_sessions;

      if (contactsTest?.success && contactsTest.total_contacts > 0) {
        diagnosticResults.recommendation = `Found ${contactsTest.total_contacts} contacts. `;

        const callCount = activitiesTest?.success ? (activitiesTest.call_activities || 0) : 0;
        const activityCount = activitiesTest?.success ? (activitiesTest.total_activities || 0) : 0;
        const usageCalls = usageTest?.success ? (usageTest.total_calls || 0) : 0;

        if (activityCount === 0 && usageCalls > 0) {
          diagnosticResults.recommendation += `However, contact activities returned 0 results while usage shows ${usageCalls} calls. This usually means call logs are not available via the contact activities endpoint for this API key/account. `;
          diagnosticResults.recommendation += dialSessionsTest?.success
            ? 'Dial session endpoints appear available; we should switch the sync to ingest dial sessions/calls instead of contact activities.'
            : 'Dial session endpoints were not found with our candidate paths; next step is to confirm the correct endpoint paths supported by your PhoneBurner account/API permissions.';
        } else {
          diagnosticResults.recommendation += `Sample contact has ${activityCount} activities (${callCount} calls). Ready to sync call history via activities.`;
        }
      } else {
        diagnosticResults.recommendation = 'No contacts found. Ensure your PhoneBurner account has contact data.';
      }

      return new Response(JSON.stringify(diagnosticResults), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============= SYNC MODE =============
    
    // Check sync lock
    const syncProgress = (connection.sync_progress as any) || {};
    const lastHeartbeat = syncProgress.heartbeat ? new Date(syncProgress.heartbeat).getTime() : 0;
    const now = Date.now();

    if (connection.sync_status === 'syncing' && (now - lastHeartbeat) < SYNC_LOCK_TIMEOUT_MS) {
      return new Response(JSON.stringify({ 
        status: 'already_syncing',
        message: 'Sync already in progress',
        progress: syncProgress,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reset data if requested
    if (reset) {
      console.log('Resetting PhoneBurner data...');
      await supabase.from('phoneburner_calls').delete().eq('workspace_id', workspaceId);
      await supabase.from('phoneburner_dial_sessions').delete().eq('workspace_id', workspaceId);
      await supabase.from('phoneburner_daily_metrics').delete().eq('workspace_id', workspaceId);
      await supabase.from('phoneburner_contacts').delete().eq('workspace_id', workspaceId);
      
      await supabase.from('api_connections').update({
        sync_status: null,
        sync_progress: null,
      }).eq('id', connection.id);
    }

    // Initialize sync state
    let currentPhase = syncProgress.phase || 'contacts';
    let contactsPage = syncProgress.contacts_page || 1;
    let contactOffset = syncProgress.contact_offset || 0;
    let activityPage = syncProgress.activity_page || 1;
    let totalContactsSynced = syncProgress.contacts_synced || 0;
    let totalCallsSynced = syncProgress.calls_synced || 0;

    // Update sync status
    await supabase
      .from('api_connections')
      .update({
        sync_status: 'syncing',
        sync_progress: {
          ...syncProgress,
          heartbeat: new Date().toISOString(),
          phase: currentPhase,
        }
      })
      .eq('id', connection.id);

    console.log(`Starting PhoneBurner sync, phase: ${currentPhase}`);

    // ============= PHASE 1: SYNC CONTACTS =============
    if (currentPhase === 'contacts') {
      console.log(`Syncing contacts starting from page ${contactsPage}...`);
      
      let hasMorePages = true;
      while (hasMorePages && (Date.now() - startTime) < TIME_BUDGET_MS) {
        try {
          const contactsResponse = await phoneburnerRequest(
            `/contacts?page=${contactsPage}&page_size=100`,
            apiKey
          );
          await delay(RATE_LIMIT_DELAY);

          const contactsData = contactsResponse.contacts || {};
          const contacts: PhoneBurnerContact[] = contactsData.contacts || [];
          const totalPages = contactsData.total_pages || 1;

          console.log(`Contacts page ${contactsPage}/${totalPages}: ${contacts.length} contacts`);

          if (contacts.length > 0) {
            const contactRecords = contacts.map(contact => ({
              workspace_id: workspaceId,
              external_contact_id: contact.contact_user_id,
              first_name: contact.first_name || null,
              last_name: contact.last_name || null,
              email: contact.email || null,
              phone: contact.phone || null,
              company: contact.company || null,
              category_id: contact.category_id || null,
              date_added: contact.date_added ? new Date(contact.date_added).toISOString() : null,
            }));

            const { error: upsertError } = await supabase
              .from('phoneburner_contacts')
              .upsert(contactRecords, { 
                onConflict: 'workspace_id,external_contact_id',
              });

            if (upsertError) {
              console.error('Contact upsert error:', upsertError);
            } else {
              totalContactsSynced += contacts.length;
            }
          }

          // Update progress
          await supabase.from('api_connections').update({
            sync_progress: {
              heartbeat: new Date().toISOString(),
              phase: 'contacts',
              contacts_page: contactsPage,
              total_pages: totalPages,
              contacts_synced: totalContactsSynced,
              calls_synced: totalCallsSynced,
            },
          }).eq('id', connection.id);

          contactsPage++;
          hasMorePages = contactsPage <= totalPages;
        } catch (e) {
          console.error('Error fetching contacts:', e);
          hasMorePages = false;
        }
      }

      // If all contacts synced, move to activities phase
      if (!hasMorePages) {
        currentPhase = 'activities';
        contactOffset = 0;
        
        await supabase.from('api_connections').update({
          sync_progress: {
            heartbeat: new Date().toISOString(),
            phase: 'activities',
            contact_offset: 0,
            contacts_synced: totalContactsSynced,
            calls_synced: totalCallsSynced,
          },
        }).eq('id', connection.id);
      }
    }

    // ============= PHASE 2: SYNC ACTIVITIES PER CONTACT (WITH PAGINATION) =============
    if (currentPhase === 'activities' && (Date.now() - startTime) < TIME_BUDGET_MS) {
      console.log(`Syncing activities starting from offset ${contactOffset}, activity page ${activityPage}...`);
      
      // Fetch total contacts count
      const { count: totalContacts } = await supabase
        .from('phoneburner_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);
      
      const contactTotal = totalContacts || 0;
      
      // Fetch current contact to process
      const { data: contactsToProcess, error: fetchError } = await supabase
        .from('phoneburner_contacts')
        .select('id, external_contact_id, first_name, last_name')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })
        .range(contactOffset, contactOffset);

      if (fetchError) {
        console.error('Error fetching contacts for activities:', fetchError);
      } else if (contactsToProcess && contactsToProcess.length > 0) {
        const contact = contactsToProcess[0];
        console.log(`Processing contact ${contactOffset + 1}/${contactTotal}: ${contact.external_contact_id}`);
        
        let hasMorePages = true;
        
        while (hasMorePages && (Date.now() - startTime) < TIME_BUDGET_MS) {
          try {
            const activitiesResponse = await phoneburnerRequest(
              `/contacts/${contact.external_contact_id}/activities?days=180&page=${activityPage}&page_size=${ACTIVITIES_PAGE_SIZE}`,
              apiKey
            );
            await delay(RATE_LIMIT_DELAY);

            // Get pagination info
            const wrapper = activitiesResponse.contact_activities;
            let totalPages = 1;
            if (wrapper && typeof wrapper === 'object' && !Array.isArray(wrapper)) {
              totalPages = wrapper.total_pages || 1;
            }
            
            if (activityPage === 1 && contactOffset === 0) {
              console.log(`[activities] Contact ${contact.external_contact_id}: total_pages=${totalPages}`);
            }

            const activities: PhoneBurnerActivity[] = extractActivities(activitiesResponse);
            
            // Filter for call-related activities
            const callActivities = activities.filter(a => 
              a.activity?.toLowerCase().includes('call') || 
              a.activity_id === '41' || // Called a Prospect
              a.activity_id === '42' || // Received Call
              a.duration !== undefined ||
              a.disposition !== undefined ||
              a.recording_url !== undefined
            );

            if (callActivities.length > 0) {
              const callRecords = callActivities.map(activity => ({
                workspace_id: workspaceId,
                external_call_id: `${contact.external_contact_id}_${activity.user_activity_id}`,
                external_contact_id: contact.external_contact_id,
                contact_id: null,
                dial_session_id: null,
                disposition: activity.disposition || activity.activity,
                disposition_id: activity.disposition_id || activity.activity_id,
                duration_seconds: activity.duration || 0,
                notes: activity.notes || null,
                recording_url: activity.recording_url || null,
                phone_number: activity.phone_dialed || null,
                activity_date: activity.date ? new Date(activity.date).toISOString() : null,
                start_at: activity.date ? new Date(activity.date).toISOString() : null,
                is_connected: (activity.duration || 0) > 0,
                is_voicemail: activity.activity?.toLowerCase().includes('voicemail') || false,
                email_sent: false,
              }));

              const { error: callUpsertError } = await supabase
                .from('phoneburner_calls')
                .upsert(callRecords, {
                  onConflict: 'workspace_id,external_call_id',
                });

              if (callUpsertError) {
                console.error('Call upsert error:', callUpsertError);
              } else {
                totalCallsSynced += callRecords.length;
                console.log(`[activities] Page ${activityPage}/${totalPages}: ${callRecords.length} calls saved (total: ${totalCallsSynced})`);
              }
            }

            // Check if more pages for this contact
            if (activityPage >= totalPages) {
              // Done with this contact, move to next
              hasMorePages = false;
              activityPage = 1;
              contactOffset++;
            } else {
              activityPage++;
            }

            // Update progress after each page
            await supabase.from('api_connections').update({
              sync_progress: {
                heartbeat: new Date().toISOString(),
                phase: 'activities',
                contact_offset: contactOffset,
                activity_page: activityPage,
                total_contacts: contactTotal,
                contacts_synced: totalContactsSynced,
                calls_synced: totalCallsSynced,
              },
            }).eq('id', connection.id);

          } catch (activityError) {
            console.error(`Error fetching activities for contact ${contact.external_contact_id} page ${activityPage}:`, activityError);
            // Skip to next contact on error
            hasMorePages = false;
            activityPage = 1;
            contactOffset++;
          }
        }

        // Check if all contacts processed
        if (contactOffset >= contactTotal) {
          currentPhase = 'metrics';
        }
      } else {
        // No more contacts
        currentPhase = 'metrics';
      }
    }

    // ============= PHASE 3: SYNC AGGREGATE METRICS =============
    if (currentPhase === 'metrics' && (Date.now() - startTime) < TIME_BUDGET_MS) {
      console.log('Syncing aggregate metrics from /dialsession/usage...');
      
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        
        const usageResponse = await phoneburnerRequest(
          `/dialsession/usage?date_start=${startDate.toISOString().split('T')[0]}&date_end=${endDate.toISOString().split('T')[0]}`,
          apiKey
        );
        
        const usage = usageResponse.usage || {};
        const memberIds = Object.keys(usage);
        
        console.log(`Usage stats found for ${memberIds.length} members`);
        
        for (const memberId of memberIds) {
          const stats = usage[memberId];
          
          const { error: metricsError } = await supabase
            .from('phoneburner_daily_metrics')
            .upsert({
              workspace_id: workspaceId,
              date: endDate.toISOString().split('T')[0],
              member_id: memberId,
              total_sessions: stats.sessions || 0,
              total_calls: stats.calls || 0,
              calls_connected: stats.connected || 0,
              voicemails_left: stats.voicemail || 0,
              emails_sent: stats.emails || 0,
              total_talk_time_seconds: (stats.talktime || 0) * 60,
            }, {
              onConflict: 'workspace_id,date,member_id'
            });
            
          if (metricsError) {
            console.error('Metrics upsert error:', metricsError);
          }
        }
      } catch (e) {
        console.error('Failed to fetch usage stats:', e);
      }

      currentPhase = 'linking';
    }

    // ============= PHASE 4: LINK CONTACTS TO LEADS =============
    if (currentPhase === 'linking' && (Date.now() - startTime) < TIME_BUDGET_MS) {
      console.log('Linking PhoneBurner contacts to leads...');
      
      try {
        // Link by email match
        const { data: pbContacts } = await supabase
          .from('phoneburner_contacts')
          .select('id, external_contact_id, email, phone')
          .eq('workspace_id', workspaceId)
          .not('email', 'is', null);

        if (pbContacts && pbContacts.length > 0) {
          for (const pbContact of pbContacts) {
            if (pbContact.email) {
              // Update leads that match this email
              await supabase
                .from('leads')
                .update({ phoneburner_contact_id: pbContact.external_contact_id })
                .eq('workspace_id', workspaceId)
                .eq('email', pbContact.email);
            }
          }
        }
      } catch (e) {
        console.error('Error linking contacts to leads:', e);
      }

      currentPhase = 'complete';
    }

    // ============= FINALIZE =============
    const isComplete = currentPhase === 'complete';

    await supabase
      .from('api_connections')
      .update({
        sync_status: isComplete ? 'complete' : 'syncing',
        last_sync_at: new Date().toISOString(),
        last_full_sync_at: isComplete ? new Date().toISOString() : connection.last_full_sync_at,
        sync_progress: isComplete ? {
          contacts_synced: totalContactsSynced,
          calls_synced: totalCallsSynced,
          completed_at: new Date().toISOString(),
        } : {
          heartbeat: new Date().toISOString(),
          phase: currentPhase,
          contact_offset: contactOffset,
          contacts_synced: totalContactsSynced,
          calls_synced: totalCallsSynced,
        }
      })
      .eq('id', connection.id);

    console.log(`Sync ${isComplete ? 'complete' : 'in progress'}. Phase: ${currentPhase}, Contacts: ${totalContactsSynced}, Calls: ${totalCallsSynced}`);

    return new Response(JSON.stringify({
      status: isComplete ? 'complete' : 'in_progress',
      phase: currentPhase,
      contacts_synced: totalContactsSynced,
      calls_synced: totalCallsSynced,
      needsContinuation: !isComplete,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('PhoneBurner sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
