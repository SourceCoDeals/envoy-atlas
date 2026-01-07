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
const FUNCTION_VERSION = '2026-01-07.v7-dialsessions';
const DIALSESSION_PAGE_SIZE = 50;

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

interface PhoneBurnerDialSession {
  dialsession_id: string;
  callerid?: string;
  start_when?: string;
  end_when?: string;
  connected_when?: string;
  disconnected_when?: string;
  call_count?: number;
  member_user_id?: string;
}

interface PhoneBurnerCall {
  call_id: string;
  phone?: string;
  start_when?: string;
  end_when?: string;
  connected?: string;
  voicemail?: string;
  voicemail_sent?: string;
  email_sent?: string;
  hangup_status?: string;
  note?: string;
  disposition?: string;
  recording_url?: string;
  contact_user_id?: string;
}

// Helper to extract dial sessions from response
function extractDialSessions(response: any): PhoneBurnerDialSession[] {
  if (!response) return [];
  
  const wrapper = response.dialsessions;
  if (!wrapper) return [];
  
  // Handle array or nested structure
  let sessions = wrapper.dialsessions;
  if (!sessions) return [];
  
  if (Array.isArray(sessions)) {
    // Sometimes it's [[{...}]] double-nested
    if (sessions.length > 0 && Array.isArray(sessions[0])) {
      sessions = sessions[0];
    }
    return sessions;
  }
  
  // Single session object
  if (typeof sessions === 'object') {
    return [sessions];
  }
  
  return [];
}

// Helper to extract calls from a single dial session response
function extractCallsFromSession(response: any): PhoneBurnerCall[] {
  if (!response) return [];
  
  const wrapper = response.dialsessions;
  if (!wrapper) return [];
  
  const session = wrapper.dialsessions;
  if (!session) return [];
  
  const calls = session.calls;
  if (Array.isArray(calls)) {
    return calls;
  }
  
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
      try {
        const contactsResponse = await phoneburnerRequest('/contacts?page=1&page_size=5', apiKey);
        const contactsData = contactsResponse.contacts || {};
        const contacts = contactsData.contacts || [];
        
        diagnosticResults.tests.contacts = {
          success: true,
          total_contacts: contactsData.total_results || contacts.length,
          total_pages: contactsData.total_pages || 1,
          sample: contacts.slice(0, 2).map((c: any) => ({
            contact_user_id: c.contact_user_id,
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
          })),
        };
      } catch (e: any) {
        diagnosticResults.tests.contacts = { success: false, error: e.message };
      }

      await delay(RATE_LIMIT_DELAY);

      // Test 3: Dial sessions endpoint (THE KEY TEST)
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const dateStart = startDate.toISOString().split('T')[0];
        const dateEnd = endDate.toISOString().split('T')[0];

        const sessionsResponse = await phoneburnerRequest(
          `/dialsession?page=1&page_size=${DIALSESSION_PAGE_SIZE}&date_start=${dateStart}&date_end=${dateEnd}`,
          apiKey
        );
        
        const wrapper = sessionsResponse.dialsessions || {};
        const sessions = extractDialSessions(sessionsResponse);
        
        diagnosticResults.tests.dial_sessions_list = {
          success: true,
          total_results: wrapper.total_results || sessions.length,
          total_pages: wrapper.total_pages || 1,
          sessions_on_page: sessions.length,
          sample: sessions.slice(0, 2).map((s: any) => ({
            dialsession_id: s.dialsession_id,
            start_when: s.start_when,
            call_count: s.call_count,
          })),
        };

        // Test 4: Fetch a single session with calls
        if (sessions.length > 0) {
          await delay(RATE_LIMIT_DELAY);
          
          const sessionId = sessions[0].dialsession_id;
          const sessionDetail = await phoneburnerRequest(
            `/dialsession/${sessionId}?include_recording=1`,
            apiKey
          );
          
          const calls = extractCallsFromSession(sessionDetail);
          
          diagnosticResults.tests.dial_session_detail = {
            success: true,
            session_id: sessionId,
            calls_count: calls.length,
            sample_calls: calls.slice(0, 3).map((c: any) => ({
              call_id: c.call_id,
              phone: c.phone,
              disposition: c.disposition,
              connected: c.connected,
              recording_url: c.recording_url ? 'present' : 'none',
            })),
          };
        }
      } catch (e: any) {
        diagnosticResults.tests.dial_sessions_list = { success: false, error: e.message };
      }

      await delay(RATE_LIMIT_DELAY);

      // Test 5: Usage stats
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
      const sessionsTest = diagnosticResults.tests.dial_sessions_list;
      const detailTest = diagnosticResults.tests.dial_session_detail;
      const usageTest = diagnosticResults.tests.usage;

      if (sessionsTest?.success && sessionsTest.sessions_on_page > 0) {
        diagnosticResults.recommendation = `Found ${sessionsTest.total_results} dial sessions. `;
        if (detailTest?.success && detailTest.calls_count > 0) {
          diagnosticResults.recommendation += `Successfully fetched ${detailTest.calls_count} calls from session ${detailTest.session_id}. Ready to sync!`;
        } else {
          diagnosticResults.recommendation += `Could not fetch call details from session. Check API permissions.`;
        }
      } else if (usageTest?.success && usageTest.total_calls > 0) {
        diagnosticResults.recommendation = `Usage shows ${usageTest.total_calls} calls but dial sessions list is empty. This may be a permissions issue - the API key may not have access to dial session details.`;
      } else {
        diagnosticResults.recommendation = 'No dial sessions found. Ensure calling has occurred in PhoneBurner.';
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
    let sessionsPage = syncProgress.sessions_page || 1;
    let sessionOffset = syncProgress.session_offset || 0;
    let totalContactsSynced = syncProgress.contacts_synced || 0;
    let totalSessionsSynced = syncProgress.sessions_synced || 0;
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
              sessions_synced: totalSessionsSynced,
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

      // If all contacts synced, move to dial sessions phase
      if (!hasMorePages) {
        currentPhase = 'dialsessions';
        sessionsPage = 1;
        
        await supabase.from('api_connections').update({
          sync_progress: {
            heartbeat: new Date().toISOString(),
            phase: 'dialsessions',
            sessions_page: 1,
            session_offset: 0,
            contacts_synced: totalContactsSynced,
            sessions_synced: totalSessionsSynced,
            calls_synced: totalCallsSynced,
          },
        }).eq('id', connection.id);
      }
    }

    // ============= PHASE 2: SYNC DIAL SESSIONS + CALLS =============
    if (currentPhase === 'dialsessions' && (Date.now() - startTime) < TIME_BUDGET_MS) {
      console.log(`Syncing dial sessions starting from page ${sessionsPage}...`);
      
      // Calculate date range (90 days back)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      const dateStart = startDate.toISOString().split('T')[0];
      const dateEnd = endDate.toISOString().split('T')[0];
      
      let hasMorePages = true;
      
      while (hasMorePages && (Date.now() - startTime) < TIME_BUDGET_MS) {
        try {
          // Fetch page of dial sessions
          const sessionsResponse = await phoneburnerRequest(
            `/dialsession?page=${sessionsPage}&page_size=${DIALSESSION_PAGE_SIZE}&date_start=${dateStart}&date_end=${dateEnd}`,
            apiKey
          );
          await delay(RATE_LIMIT_DELAY);
          
          const wrapper = sessionsResponse.dialsessions || {};
          const sessions = extractDialSessions(sessionsResponse);
          const totalPages = wrapper.total_pages || 1;
          const totalResults = wrapper.total_results || sessions.length;
          
          console.log(`Dial sessions page ${sessionsPage}/${totalPages}: ${sessions.length} sessions (total: ${totalResults})`);
          
          // Process each session on this page
          for (const session of sessions) {
            if ((Date.now() - startTime) >= TIME_BUDGET_MS) {
              console.log('Time budget exceeded, will continue on next invocation');
              break;
            }
            
            // Save the dial session
            const sessionRecord = {
              workspace_id: workspaceId,
              external_session_id: session.dialsession_id,
              caller_id: session.callerid || null,
              start_at: session.start_when ? new Date(session.start_when).toISOString() : null,
              end_at: session.end_when ? new Date(session.end_when).toISOString() : null,
              call_count: session.call_count || 0,
              member_id: session.member_user_id || null,
            };
            
            const { data: upsertedSession, error: sessionUpsertError } = await supabase
              .from('phoneburner_dial_sessions')
              .upsert(sessionRecord, { 
                onConflict: 'workspace_id,external_session_id',
              })
              .select('id')
              .single();
            
            if (sessionUpsertError) {
              console.error(`Session upsert error for ${session.dialsession_id}:`, sessionUpsertError);
              continue;
            }
            
            totalSessionsSynced++;
            const internalSessionId = upsertedSession?.id;
            
            // Fetch call details for this session
            if (session.call_count && session.call_count > 0) {
              try {
                const detailResponse = await phoneburnerRequest(
                  `/dialsession/${session.dialsession_id}?include_recording=1`,
                  apiKey
                );
                await delay(RATE_LIMIT_DELAY);
                
                const calls = extractCallsFromSession(detailResponse);
                console.log(`  Session ${session.dialsession_id}: ${calls.length} calls`);
                
                if (calls.length > 0) {
                  const callRecords = calls.map(call => ({
                    workspace_id: workspaceId,
                    external_call_id: call.call_id,
                    external_contact_id: call.contact_user_id || null,
                    dial_session_id: internalSessionId || null,
                    phone_number: call.phone || null,
                    start_at: call.start_when ? new Date(call.start_when).toISOString() : null,
                    end_at: call.end_when ? new Date(call.end_when).toISOString() : null,
                    is_connected: call.connected === '1',
                    is_voicemail: call.voicemail === '1',
                    voicemail_sent: call.voicemail_sent || null,
                    email_sent: !!call.email_sent,
                    disposition: call.disposition || null,
                    notes: call.note || null,
                    recording_url: call.recording_url || null,
                    activity_date: call.start_when ? new Date(call.start_when).toISOString() : null,
                    duration_seconds: call.start_when && call.end_when 
                      ? Math.round((new Date(call.end_when).getTime() - new Date(call.start_when).getTime()) / 1000)
                      : null,
                  }));
                  
                  const { error: callsUpsertError } = await supabase
                    .from('phoneburner_calls')
                    .upsert(callRecords, {
                      onConflict: 'workspace_id,external_call_id',
                    });
                  
                  if (callsUpsertError) {
                    console.error(`Calls upsert error for session ${session.dialsession_id}:`, callsUpsertError);
                  } else {
                    totalCallsSynced += callRecords.length;
                  }
                }
              } catch (detailError) {
                console.error(`Error fetching details for session ${session.dialsession_id}:`, detailError);
              }
            }
            
            sessionOffset++;
          }
          
          // Update progress after each page
          await supabase.from('api_connections').update({
            sync_progress: {
              heartbeat: new Date().toISOString(),
              phase: 'dialsessions',
              sessions_page: sessionsPage,
              session_offset: sessionOffset,
              total_sessions: totalResults,
              total_pages: totalPages,
              contacts_synced: totalContactsSynced,
              sessions_synced: totalSessionsSynced,
              calls_synced: totalCallsSynced,
            },
          }).eq('id', connection.id);
          
          // Check if more pages
          sessionsPage++;
          hasMorePages = sessionsPage <= totalPages;
          
        } catch (e) {
          console.error('Error fetching dial sessions:', e);
          hasMorePages = false;
        }
      }
      
      // If all sessions processed, move to metrics phase
      if (!hasMorePages) {
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

    // ============= PHASE 4: LINK CALLS TO CONTACTS =============
    if (currentPhase === 'linking' && (Date.now() - startTime) < TIME_BUDGET_MS) {
      console.log('Linking PhoneBurner calls to contacts and leads...');
      
      try {
        // Link calls to their contacts via external_contact_id
        const { data: callsWithContacts } = await supabase
          .from('phoneburner_calls')
          .select('id, external_contact_id')
          .eq('workspace_id', workspaceId)
          .not('external_contact_id', 'is', null)
          .is('contact_id', null)
          .limit(500);
        
        if (callsWithContacts && callsWithContacts.length > 0) {
          for (const call of callsWithContacts) {
            // Find the internal contact ID
            const { data: contact } = await supabase
              .from('phoneburner_contacts')
              .select('id')
              .eq('workspace_id', workspaceId)
              .eq('external_contact_id', call.external_contact_id)
              .single();
            
            if (contact) {
              await supabase
                .from('phoneburner_calls')
                .update({ contact_id: contact.id })
                .eq('id', call.id);
            }
          }
        }

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
          sessions_synced: totalSessionsSynced,
          calls_synced: totalCallsSynced,
          completed_at: new Date().toISOString(),
        } : {
          heartbeat: new Date().toISOString(),
          phase: currentPhase,
          sessions_page: sessionsPage,
          session_offset: sessionOffset,
          contacts_synced: totalContactsSynced,
          sessions_synced: totalSessionsSynced,
          calls_synced: totalCallsSynced,
        }
      })
      .eq('id', connection.id);

    console.log(`Sync ${isComplete ? 'complete' : 'in progress'}. Phase: ${currentPhase}, Contacts: ${totalContactsSynced}, Sessions: ${totalSessionsSynced}, Calls: ${totalCallsSynced}`);

    return new Response(JSON.stringify({
      status: isComplete ? 'complete' : 'in_progress',
      phase: currentPhase,
      contacts_synced: totalContactsSynced,
      sessions_synced: totalSessionsSynced,
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
