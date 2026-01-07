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
const FUNCTION_VERSION = '2026-01-07.v8-contact-activities';
const CONTACT_PAGE_SIZE = 100;
const ACTIVITIES_DAYS = 180; // Fetch up to 6 months of activities

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
  primary_phone?: {
    raw_phone?: string;
    phone?: string;
  };
  primary_email?: {
    email_address?: string;
  };
}

interface ContactActivity {
  user_activity_id: string;
  activity_id: string;
  activity: string;
  date: string;
  // Additional fields we'll try to extract
  call_id?: string;
  duration?: number;
  disposition?: string;
  recording_url?: string;
  connected?: boolean;
  voicemail?: boolean;
  note?: string;
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
        version: FUNCTION_VERSION,
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

      // Test 2: Contacts endpoint
      let sampleContactId: string | null = null;
      try {
        const contactsResponse = await phoneburnerRequest('/contacts?page=1&page_size=5', apiKey);
        const contactsData = contactsResponse.contacts || {};
        const contacts = contactsData.contacts || [];
        
        if (contacts.length > 0) {
          sampleContactId = contacts[0].contact_user_id || contacts[0].user_id;
        }
        
        diagnosticResults.tests.contacts = {
          success: true,
          total_contacts: contactsData.total_results || contacts.length,
          total_pages: contactsData.total_pages || 1,
          sample: contacts.slice(0, 2).map((c: any) => ({
            contact_user_id: c.contact_user_id || c.user_id,
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
          })),
        };
      } catch (e: any) {
        diagnosticResults.tests.contacts = { success: false, error: e.message };
      }

      await delay(RATE_LIMIT_DELAY);

      // Test 3: Contact activities endpoint (KEY TEST)
      if (sampleContactId) {
        try {
          const activitiesResponse = await phoneburnerRequest(
            `/contacts/${sampleContactId}/activities?days=${ACTIVITIES_DAYS}&page=1&page_size=25`,
            apiKey
          );
          
          console.log('Activities response keys:', Object.keys(activitiesResponse));
          
          const activitiesData = activitiesResponse.contact_activities || {};
          const activities = activitiesData.contact_activities || [];
          
          // Count call-related activities
          const callActivities = activities.filter((a: any) => 
            a.activity?.toLowerCase().includes('call') || 
            a.activity_id === '41' ||
            a.activity_id === '42' ||
            a.activity_id === '43'
          );
          
          diagnosticResults.tests.contact_activities = {
            success: true,
            contact_id: sampleContactId,
            total_activities: activitiesData.total_results || activities.length,
            activities_on_page: activities.length,
            call_activities_count: callActivities.length,
            sample: activities.slice(0, 5).map((a: any) => ({
              activity_id: a.activity_id,
              activity: a.activity,
              date: a.date,
            })),
          };
        } catch (e: any) {
          diagnosticResults.tests.contact_activities = { 
            success: false, 
            error: e.message,
            contact_id: sampleContactId,
          };
        }
      }

      await delay(RATE_LIMIT_DELAY);

      // Test 4: Usage stats (aggregate)
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

      // Generate recommendation
      const activitiesTest = diagnosticResults.tests.contact_activities;
      const usageTest = diagnosticResults.tests.usage;

      if (activitiesTest?.success && activitiesTest.call_activities_count > 0) {
        diagnosticResults.recommendation = `Contact activities working! Found ${activitiesTest.call_activities_count} call activities for sample contact. Ready to sync via contact-based approach.`;
      } else if (activitiesTest?.success && activitiesTest.activities_on_page > 0) {
        diagnosticResults.recommendation = `Found ${activitiesTest.activities_on_page} activities but no calls yet. May need to iterate through more contacts.`;
      } else if (usageTest?.success && usageTest.total_calls > 0) {
        diagnosticResults.recommendation = `Usage shows ${usageTest.total_calls} calls. Activities endpoint returned ${activitiesTest?.activities_on_page || 0} items. Will sync what's available.`;
      } else {
        diagnosticResults.recommendation = 'Limited data available. Will sync contacts and available metrics.';
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
    let totalContactsSynced = syncProgress.contacts_synced || 0;
    let totalActivitiesSynced = syncProgress.activities_synced || 0;
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
            `/contacts?page=${contactsPage}&page_size=${CONTACT_PAGE_SIZE}`,
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
              email: contact.primary_email?.email_address || contact.email || null,
              phone: contact.primary_phone?.raw_phone || contact.phone || null,
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
              activities_synced: totalActivitiesSynced,
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
            activities_synced: totalActivitiesSynced,
            calls_synced: totalCallsSynced,
          },
        }).eq('id', connection.id);
      }
    }

    // ============= PHASE 2: FETCH ACTIVITIES FOR EACH CONTACT =============
    if (currentPhase === 'activities' && (Date.now() - startTime) < TIME_BUDGET_MS) {
      console.log(`Fetching contact activities starting from offset ${contactOffset}...`);
      
      // Get list of synced contacts
      const { data: dbContacts, error: contactsError } = await supabase
        .from('phoneburner_contacts')
        .select('id, external_contact_id, phone, email')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })
        .range(contactOffset, contactOffset + 49); // Process 50 contacts per invocation
      
      if (contactsError) {
        console.error('Error fetching contacts from DB:', contactsError);
      } else if (dbContacts && dbContacts.length > 0) {
        console.log(`Processing activities for ${dbContacts.length} contacts`);
        
        for (const contact of dbContacts) {
          if ((Date.now() - startTime) >= TIME_BUDGET_MS) {
            console.log('Time budget exceeded, will continue on next invocation');
            break;
          }
          
          try {
            // Paginate through activities (calls may not be on page 1)
            let page = 1;
            let totalPages = 1;
            let contactActivitiesCount = 0;
            let contactCallsCount = 0;

            while (page <= totalPages && (Date.now() - startTime) < TIME_BUDGET_MS) {
              const activitiesResponse = await phoneburnerRequest(
                `/contacts/${contact.external_contact_id}/activities?days=${ACTIVITIES_DAYS}&page=${page}&page_size=100`,
                apiKey
              );
              await delay(RATE_LIMIT_DELAY);

              const activitiesData = activitiesResponse.contact_activities || {};
              const activities: ContactActivity[] = activitiesData.contact_activities || [];
              totalPages = Number(activitiesData.total_pages || totalPages || 1);

              contactActivitiesCount += activities.length;

              // Filter for call-related activities
              // Per docs: activity_id is a type (e.g., 41 = "Called a Prospect")
              const callActivities = activities.filter((a: any) => {
                const activityId = String(a.activity_id ?? '');
                const activityText = String(a.activity ?? '').toLowerCase();
                return (
                  activityId === '41' ||
                  activityId === '42' ||
                  activityId === '43' ||
                  activityId === '44' ||
                  activityText.includes('call')
                );
              });

              if (callActivities.length > 0) {
                // Create call records from activities
                const callRecords = callActivities.map((activity: any) => ({
                  workspace_id: workspaceId,
                  external_call_id: String(activity.user_activity_id), // unique per activity per docs
                  external_contact_id: String(contact.external_contact_id),
                  contact_id: contact.id, // Link directly to our contact
                  phone_number: contact.phone || null,
                  activity_date: activity.date ? new Date(activity.date).toISOString() : null,
                  start_at: activity.date ? new Date(activity.date).toISOString() : null,
                  disposition: activity.activity || 'Called a Prospect',
                  notes: activity.activity || null,
                  is_connected:
                    String(activity.activity || '').toLowerCase().includes('interested') ||
                    String(activity.activity || '').toLowerCase().includes('connected') ||
                    String(activity.activity || '').toLowerCase().includes('spoke') ||
                    false,
                  is_voicemail:
                    String(activity.activity || '').toLowerCase().includes('voicemail') ||
                    String(activity.activity || '').toLowerCase().includes('message') ||
                    false,
                }));

                const { error: callsError } = await supabase
                  .from('phoneburner_calls')
                  .upsert(callRecords, {
                    onConflict: 'workspace_id,external_call_id',
                  });

                if (callsError) {
                  console.error(`Calls upsert error for contact ${contact.external_contact_id} (page ${page}):`, callsError);
                } else {
                  contactCallsCount += callRecords.length;
                  totalCallsSynced += callRecords.length;
                }
              }

              page++;
            }

            if (contactCallsCount > 0) {
              console.log(
                `  Contact ${contact.external_contact_id}: activities=${contactActivitiesCount}, calls=${contactCallsCount}`
              );
            }

            totalActivitiesSynced += contactActivitiesCount;
            contactOffset++;

          } catch (e) {
            console.error(`Error fetching activities for contact ${contact.external_contact_id}:`, e);
            contactOffset++; // Skip to next contact
          }
          
          // Update progress periodically
          if (contactOffset % 10 === 0) {
            await supabase.from('api_connections').update({
              sync_progress: {
                heartbeat: new Date().toISOString(),
                phase: 'activities',
                contact_offset: contactOffset,
                contacts_synced: totalContactsSynced,
                activities_synced: totalActivitiesSynced,
                calls_synced: totalCallsSynced,
              },
            }).eq('id', connection.id);
          }
        }
        
        // Update progress after batch
        await supabase.from('api_connections').update({
          sync_progress: {
            heartbeat: new Date().toISOString(),
            phase: 'activities',
            contact_offset: contactOffset,
            contacts_synced: totalContactsSynced,
            activities_synced: totalActivitiesSynced,
            calls_synced: totalCallsSynced,
          },
        }).eq('id', connection.id);
        
        // Check if we're done with all contacts
        if (dbContacts.length < 50) {
          currentPhase = 'metrics';
        }
      } else {
        // No more contacts to process
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
        // Link contacts to leads by email
        const { data: pbContacts } = await supabase
          .from('phoneburner_contacts')
          .select('id, external_contact_id, email')
          .eq('workspace_id', workspaceId)
          .not('email', 'is', null);

        if (pbContacts && pbContacts.length > 0) {
          for (const pbContact of pbContacts) {
            if (pbContact.email) {
              await supabase
                .from('leads')
                .update({ phoneburner_contact_id: pbContact.external_contact_id })
                .eq('workspace_id', workspaceId)
                .eq('email', pbContact.email);
            }
          }
        }
      } catch (e) {
        console.error('Error linking data:', e);
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
          activities_synced: totalActivitiesSynced,
          calls_synced: totalCallsSynced,
          completed_at: new Date().toISOString(),
        } : {
          heartbeat: new Date().toISOString(),
          phase: currentPhase,
          contact_offset: contactOffset,
          contacts_synced: totalContactsSynced,
          activities_synced: totalActivitiesSynced,
          calls_synced: totalCallsSynced,
        }
      })
      .eq('id', connection.id);

    console.log(`Sync ${isComplete ? 'complete' : 'in progress'}. Phase: ${currentPhase}, Contacts: ${totalContactsSynced}, Activities: ${totalActivitiesSynced}, Calls: ${totalCallsSynced}`);

    return new Response(JSON.stringify({
      status: isComplete ? 'complete' : 'in_progress',
      phase: currentPhase,
      contacts_synced: totalContactsSynced,
      activities_synced: totalActivitiesSynced,
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
