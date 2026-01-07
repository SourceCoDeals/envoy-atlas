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
const TIME_BUDGET_MS = 45000;
const SYNC_LOCK_TIMEOUT_MS = 30000;
const FUNCTION_VERSION = '2026-01-07.v10-fixed';
const CONTACT_PAGE_SIZE = 100;
const ACTIVITIES_DAYS = 180;
const MAX_USAGE_RANGE_DAYS = 90; // PhoneBurner API limit for dialsession/usage

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to format date as YYYY-MM-DD
function formatDateYMD(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get date ranges for syncing (splits into 90-day chunks for API limit)
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

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - ACTIVITIES_DAYS);
      const dateRanges = getDateRanges(ACTIVITIES_DAYS, MAX_USAGE_RANGE_DAYS);

      const diagnosticResults: any = {
        diagnostic: true,
        timestamp: new Date().toISOString(),
        version: FUNCTION_VERSION,
        date_range: {
          sync_from: formatDateYMD(startDate),
          sync_to: formatDateYMD(endDate),
          total_days: ACTIVITIES_DAYS,
          usage_ranges: dateRanges,
        },
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
            contact_user_id: c.contact_user_id || c.user_id,
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
          })),
        };
      } catch (e: any) {
        diagnosticResults.tests.contacts = { success: false, error: e.message };
      }

      await delay(RATE_LIMIT_DELAY);

      // Test 3: Dial Sessions endpoint with date filtering
      try {
        const sessionsResponse = await phoneburnerRequest(
          `/dialsession?date_start=${formatDateYMD(startDate)}&date_end=${formatDateYMD(endDate)}&page=1&page_size=5`,
          apiKey
        );

        console.log('Dial sessions response:', JSON.stringify(sessionsResponse).slice(0, 500));

        const sessionsData = sessionsResponse.dialsessions || {};
        const sessions = sessionsData.dialsessions || [];

        diagnosticResults.tests.dial_sessions = {
          success: true,
          total_results: sessionsData.total_results || sessions.length,
          total_pages: sessionsData.total_pages || 1,
          sessions_on_page: sessions.length,
          sample: sessions.slice(0, 2).map((s: any) => ({
            dialsession_id: s.dialsession_id,
            start_when: s.start_when,
            call_count: s.calls?.length || 0,
          })),
        };
      } catch (e: any) {
        diagnosticResults.tests.dial_sessions = { success: false, error: e.message };
      }

      await delay(RATE_LIMIT_DELAY);

      // Test 4: Usage stats - use 90-day range (API limit)
      try {
        const usageRange = dateRanges[0]; // Most recent 90 days
        const usageResponse = await phoneburnerRequest(
          `/dialsession/usage?date_start=${usageRange.start}&date_end=${usageRange.end}`,
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
          date_range: usageRange,
          member_count: memberIds.length,
          total_calls: totalCalls,
          total_sessions: totalSessions,
        };
      } catch (e: any) {
        diagnosticResults.tests.usage = { success: false, error: e.message };
      }

      // Generate recommendation
      const dialSessionsTest = diagnosticResults.tests.dial_sessions;
      const usageTest = diagnosticResults.tests.usage;

      if (dialSessionsTest?.success && dialSessionsTest.sessions_on_page > 0) {
        diagnosticResults.recommendation = `Found ${dialSessionsTest.total_results || dialSessionsTest.sessions_on_page} dial sessions! Will sync individual calls from session data.`;
      } else if (dialSessionsTest?.success && dialSessionsTest.sessions_on_page === 0) {
        diagnosticResults.recommendation = `No dial sessions found for authenticated user (PAT limitation). Will use aggregate metrics from /dialsession/usage.`;
      } else if (usageTest?.success && usageTest.total_calls > 0) {
        diagnosticResults.recommendation = `Usage shows ${usageTest.total_calls} calls across team. Dial sessions not accessible with PAT. Syncing aggregate metrics.`;
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
    let currentPhase = syncProgress.phase || 'dialsessions';
    let sessionPage = syncProgress.session_page || 1;
    let contactsPage = syncProgress.contacts_page || 1;
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

    // Calculate date range for 180 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - ACTIVITIES_DAYS);

    // ============= PHASE 1: SYNC DIAL SESSIONS =============
    if (currentPhase === 'dialsessions') {
      console.log(`Syncing dial sessions from ${formatDateYMD(startDate)} to ${formatDateYMD(endDate)}, starting page ${sessionPage}...`);

      let hasMorePages = true;
      let foundSessions = false;

      while (hasMorePages && (Date.now() - startTime) < TIME_BUDGET_MS) {
        try {
          const sessionsResponse = await phoneburnerRequest(
            `/dialsession?date_start=${formatDateYMD(startDate)}&date_end=${formatDateYMD(endDate)}&page=${sessionPage}&page_size=25`,
            apiKey
          );
          await delay(RATE_LIMIT_DELAY);

          const sessionsData = sessionsResponse.dialsessions || {};
          const sessions = sessionsData.dialsessions || [];
          const totalPages = sessionsData.total_pages || 1;

          console.log(`Dial sessions page ${sessionPage}/${totalPages}: ${sessions.length} sessions`);

          if (sessions.length > 0) {
            foundSessions = true;

            for (const session of sessions) {
              if ((Date.now() - startTime) >= TIME_BUDGET_MS) break;

              const sessionId = String(session.dialsession_id || session.id);

              // Store the session
              const { error: sessionError } = await supabase
                .from('phoneburner_dial_sessions')
                .upsert({
                  workspace_id: workspaceId,
                  external_session_id: sessionId,
                  member_id: session.member_user_id || session.user_id || null,
                  member_name: session.member_name || null,
                  caller_id: session.caller_id || null,
                  start_at: session.start_when ? new Date(session.start_when).toISOString() : null,
                  end_at: session.end_when ? new Date(session.end_when).toISOString() : null,
                  call_count: session.calls?.length || session.call_count || 0,
                }, {
                  onConflict: 'workspace_id,external_session_id',
                });

              if (sessionError) {
                console.error('Session upsert error:', sessionError);
              } else {
                totalSessionsSynced++;
              }

              // Fetch full session details to get calls if not included
              let calls = session.calls || [];
              if (calls.length === 0 && sessionId) {
                try {
                  const detailResponse = await phoneburnerRequest(`/dialsession/${sessionId}`, apiKey);
                  await delay(RATE_LIMIT_DELAY);
                  calls = detailResponse.dialsession?.calls || [];
                } catch (e) {
                  console.log(`Could not fetch session ${sessionId} details:`, e);
                }
              }

              // Process calls from this session
              if (calls.length > 0) {
                const callRecords = calls.map((call: any) => ({
                  workspace_id: workspaceId,
                  external_call_id: String(call.call_id || call.id || `${sessionId}-${call.phone || Date.now()}`),
                  external_contact_id: call.contact_user_id ? String(call.contact_user_id) : null,
                  phone_number: call.phone || call.phone_number || null,
                  start_at: call.start_when ? new Date(call.start_when).toISOString() : null,
                  end_at: call.end_when ? new Date(call.end_when).toISOString() : null,
                  duration_seconds: call.duration || call.talk_time || 0,
                  disposition: call.disposition || call.result || null,
                  disposition_id: call.disposition_id ? String(call.disposition_id) : null,
                  is_connected: call.connected === true || call.connected === 1 || call.connected === '1',
                  is_voicemail: call.voicemail === true || call.voicemail === 1 || call.voicemail === '1' ||
                               (call.disposition || '').toLowerCase().includes('voicemail'),
                  recording_url: call.recording_url || call.recording || null,
                  notes: call.notes || call.note || null,
                  activity_date: call.start_when ? new Date(call.start_when).toISOString() : null,
                }));

                const { error: callsError } = await supabase
                  .from('phoneburner_calls')
                  .upsert(callRecords, {
                    onConflict: 'workspace_id,external_call_id',
                  });

                if (callsError) {
                  console.error('Calls upsert error:', callsError);
                } else {
                  totalCallsSynced += callRecords.length;
                }
              }
            }
          }

          // Update progress
          await supabase.from('api_connections').update({
            sync_progress: {
              heartbeat: new Date().toISOString(),
              phase: 'dialsessions',
              session_page: sessionPage,
              total_session_pages: totalPages,
              sessions_synced: totalSessionsSynced,
              calls_synced: totalCallsSynced,
            },
          }).eq('id', connection.id);

          sessionPage++;
          hasMorePages = sessionPage <= totalPages && sessions.length > 0;
        } catch (e) {
          console.error('Error fetching dial sessions:', e);
          hasMorePages = false;
        }
      }

      // Move to contacts phase if done with sessions
      if (!hasMorePages) {
        currentPhase = 'contacts';
        console.log(`Dial sessions phase complete. Found: ${foundSessions}, Sessions: ${totalSessionsSynced}, Calls: ${totalCallsSynced}`);

        await supabase.from('api_connections').update({
          sync_progress: {
            heartbeat: new Date().toISOString(),
            phase: 'contacts',
            contacts_page: 1,
            sessions_synced: totalSessionsSynced,
            calls_synced: totalCallsSynced,
          },
        }).eq('id', connection.id);
      }
    }

    // ============= PHASE 2: SYNC CONTACTS =============
    if (currentPhase === 'contacts' && (Date.now() - startTime) < TIME_BUDGET_MS) {
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

      // Move to metrics phase if all contacts synced
      if (!hasMorePages) {
        currentPhase = 'metrics';

        await supabase.from('api_connections').update({
          sync_progress: {
            heartbeat: new Date().toISOString(),
            phase: 'metrics',
            contacts_synced: totalContactsSynced,
            sessions_synced: totalSessionsSynced,
            calls_synced: totalCallsSynced,
          },
        }).eq('id', connection.id);
      }
    }

    // ============= PHASE 3: SYNC AGGREGATE METRICS =============
    if (currentPhase === 'metrics' && (Date.now() - startTime) < TIME_BUDGET_MS) {
      console.log('Syncing aggregate metrics from /dialsession/usage...');

      try {
        // Split 180 days into 90-day chunks (API limit)
        const dateRanges = getDateRanges(ACTIVITIES_DAYS, MAX_USAGE_RANGE_DAYS);
        console.log(`Fetching usage for ${dateRanges.length} date ranges...`);

        for (const range of dateRanges) {
          try {
            const usageResponse = await phoneburnerRequest(
              `/dialsession/usage?date_start=${range.start}&date_end=${range.end}`,
              apiKey
            );
            await delay(RATE_LIMIT_DELAY);

            const usage = usageResponse.usage || {};
            const memberIds = Object.keys(usage);

            console.log(`Usage for ${range.start} to ${range.end}: ${memberIds.length} members`);

            for (const memberId of memberIds) {
              const stats = usage[memberId];

              const { error: metricsError } = await supabase
                .from('phoneburner_daily_metrics')
                .upsert({
                  workspace_id: workspaceId,
                  date: range.end,
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
          } catch (rangeError) {
            console.error(`Failed to fetch usage for ${range.start} to ${range.end}:`, rangeError);
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
          session_page: sessionPage,
          contacts_page: contactsPage,
          contacts_synced: totalContactsSynced,
          sessions_synced: totalSessionsSynced,
          calls_synced: totalCallsSynced,
        }
      })
      .eq('id', connection.id);

    console.log(`Sync ${isComplete ? 'complete' : 'in progress'}. Phase: ${currentPhase}, Sessions: ${totalSessionsSynced}, Contacts: ${totalContactsSynced}, Calls: ${totalCallsSynced}`);

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
