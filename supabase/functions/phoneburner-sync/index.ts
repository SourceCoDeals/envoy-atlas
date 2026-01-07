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

interface DialSession {
  dialsession_id: string;
  member_user_id?: string;
  callerid?: string;
  start_when?: string;
  end_when?: string;
  call_count?: number;
  member_name?: string;
}

interface Call {
  call_id?: string;
  dialsession_id?: string;
  contact_id?: string;
  phone?: string;
  disposition?: string;
  duration?: number;
  connected?: string; // "0" or "1" string
  voicemail_sent?: string;
  email_sent?: string; // "0" or "1" string
  notes?: string;
  recording_url?: string;
  start_when?: string;
  end_when?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user
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

    // Get PhoneBurner connection
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

      // Test 1: Get account/member info
      try {
        const membersResponse = await phoneburnerRequest('/members', apiKey);
        const members = membersResponse.members?.members || membersResponse.members || [];
        diagnosticResults.tests.members = {
          success: true,
          count: Array.isArray(members) ? members.length : 0,
          data: Array.isArray(members) ? members.slice(0, 3).map((m: any) => ({
            user_id: m.user_id,
            name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
            email: m.email,
          })) : [],
        };
      } catch (e: any) {
        diagnosticResults.tests.members = {
          success: false,
          error: e.message,
        };
      }

      // Test 2: Fetch sessions WITHOUT date filter for the global endpoint
      try {
        const noFilterResponse = await phoneburnerRequest('/dialsession?page=1&items_per_page=10', apiKey);
        const sessionsData = noFilterResponse.dialsessions || {};
        const sessions = Array.isArray(sessionsData.dialsessions) ? sessionsData.dialsessions : [];
        diagnosticResults.tests.sessions_global_endpoint = {
          success: true,
          total_results: sessionsData.total_results || 0,
          total_pages: sessionsData.total_pages || 0,
          returned_count: sessions.length,
          note: 'Global endpoint - may only show your sessions, not all team members',
        };
      } catch (e: any) {
        diagnosticResults.tests.sessions_global_endpoint = {
          success: false,
          error: e.message,
        };
      }

      // Test 3: Fetch sessions per member (for company-wide API keys)
      const memberIds = diagnosticResults.tests.members?.data?.map((m: any) => m.user_id).filter(Boolean) || [];
      diagnosticResults.tests.sessions_per_member = [];
      
      for (const memberId of memberIds.slice(0, 5)) { // Test first 5 members
        try {
          const memberSessionsResponse = await phoneburnerRequest(
            `/dialsession?member_user_id=${memberId}&page=1&items_per_page=10`,
            apiKey
          );
          const sessionsData = memberSessionsResponse.dialsessions || {};
          const sessions = Array.isArray(sessionsData.dialsessions) ? sessionsData.dialsessions : [];
          diagnosticResults.tests.sessions_per_member.push({
            member_id: memberId,
            success: true,
            total_results: sessionsData.total_results || 0,
            first_session: sessions.length > 0 ? {
              dialsession_id: sessions[0].dialsession_id,
              start_when: sessions[0].start_when,
            } : null,
          });
          await delay(300);
        } catch (e: any) {
          diagnosticResults.tests.sessions_per_member.push({
            member_id: memberId,
            success: false,
            error: e.message,
          });
        }
      }

      // Generate recommendation
      const globalEndpoint = diagnosticResults.tests.sessions_global_endpoint;
      const perMemberResults = diagnosticResults.tests.sessions_per_member || [];
      const totalMemberSessions = perMemberResults.reduce((sum: number, m: any) => sum + (m.total_results || 0), 0);
      
      if (!globalEndpoint?.success) {
        diagnosticResults.recommendation = 'API key may not have access to dial sessions. Check API permissions.';
      } else if (globalEndpoint.total_results === 0 && totalMemberSessions === 0) {
        diagnosticResults.recommendation = 'No dial sessions found for any team member. Make sure your team has dial session history in PhoneBurner.';
      } else if (globalEndpoint.total_results === 0 && totalMemberSessions > 0) {
        diagnosticResults.recommendation = `Global endpoint shows 0, but found ${totalMemberSessions} sessions across team members. Sync will iterate over each member.`;
      } else {
        diagnosticResults.recommendation = `Found ${globalEndpoint.total_results} sessions via global endpoint and ${totalMemberSessions} across members. Sync should work correctly.`;
      }
      
      diagnosticResults.summary = {
        total_members: diagnosticResults.tests.members?.count || 0,
        global_sessions: globalEndpoint?.total_results || 0,
        member_sessions_total: totalMemberSessions,
      };

      console.log('Diagnostic results:', JSON.stringify(diagnosticResults, null, 2));

      return new Response(JSON.stringify(diagnosticResults), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check sync lock
    const syncProgress = (connection.sync_progress as any) || {};
    const lastHeartbeat = syncProgress.heartbeat ? new Date(syncProgress.heartbeat).getTime() : 0;
    const now = Date.now();

    if (connection.sync_status === 'syncing' && (now - lastHeartbeat) < SYNC_LOCK_TIMEOUT_MS) {
      return new Response(JSON.stringify({ 
        status: 'already_syncing',
        message: 'Sync already in progress'
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
    }

    // Update sync status
    await supabase
      .from('api_connections')
      .update({
        sync_status: 'syncing',
        sync_progress: {
          heartbeat: new Date().toISOString(),
          currentPage: syncProgress.currentPage || 1,
          sessionsProcessed: syncProgress.sessionsProcessed || 0,
          callsProcessed: syncProgress.callsProcessed || 0,
        }
      })
      .eq('id', connection.id);

    // Determine date range - last 90 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    const dateStart = startDate.toISOString().split('T')[0];
    const dateEnd = endDate.toISOString().split('T')[0];

    let sessionsProcessed = syncProgress.sessionsProcessed || 0;
    let callsProcessed = syncProgress.callsProcessed || 0;

    console.log(`Starting PhoneBurner sync for date range ${dateStart} to ${dateEnd}`);

    // STEP 1: Fetch all members (for company-wide API keys)
    let allMembers: { user_id: string; name: string }[] = [];
    try {
      const membersResponse = await phoneburnerRequest('/members', apiKey);
      const members = membersResponse.members?.members || membersResponse.members || [];
      allMembers = Array.isArray(members) ? members.map((m: any) => ({
        user_id: m.user_id?.toString(),
        name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
      })).filter((m: any) => m.user_id) : [];
      console.log(`Found ${allMembers.length} team members`);
    } catch (e) {
      console.error('Failed to fetch members, falling back to global endpoint:', e);
    }

    // STEP 2: Fetch sessions - either per-member or global
    const memberIdsToSync = allMembers.length > 0 ? allMembers.map(m => m.user_id) : [null];
    let totalSessions = 0;

    for (const memberId of memberIdsToSync) {
      if ((Date.now() - startTime) >= TIME_BUDGET_MS) {
        console.log('Time budget reached, will resume on next sync');
        break;
      }

      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages && (Date.now() - startTime) < TIME_BUDGET_MS) {
        // Update heartbeat
        await supabase
          .from('api_connections')
          .update({
            sync_progress: {
              heartbeat: new Date().toISOString(),
              currentMember: memberId,
              currentPage,
              sessionsProcessed,
              callsProcessed,
            }
          })
          .eq('id', connection.id);

        // Fetch dial sessions - with member filter if available
        const endpoint = memberId
          ? `/dialsession?member_user_id=${memberId}&date_start=${dateStart}&date_end=${dateEnd}&page=${currentPage}&items_per_page=50`
          : `/dialsession?date_start=${dateStart}&date_end=${dateEnd}&page=${currentPage}&items_per_page=50`;
        
        const sessionsResponse = await phoneburnerRequest(endpoint, apiKey);
        await delay(RATE_LIMIT_DELAY);

        const sessionsData = sessionsResponse.dialsessions || {};
        const sessions: DialSession[] = Array.isArray(sessionsData.dialsessions) 
          ? sessionsData.dialsessions 
          : (Array.isArray(sessionsData) ? sessionsData : []);
        
        const memberName = allMembers.find(m => m.user_id === memberId)?.name || 'Unknown';
        console.log(`Member ${memberId || 'global'} (${memberName}): page ${currentPage}, ${sessions.length} sessions, total_results: ${sessionsData.total_results || 0}`);
        
        if (sessions.length === 0) {
          hasMorePages = false;
          break;
        }

        totalSessions += sessions.length;

        for (const session of sessions) {
          if ((Date.now() - startTime) >= TIME_BUDGET_MS) {
            console.log('Time budget reached, pausing sync');
            break;
          }

          // Upsert dial session - use correct field names from API
          const { error: sessionError } = await supabase
            .from('phoneburner_dial_sessions')
            .upsert({
              workspace_id: workspaceId,
              external_session_id: session.dialsession_id.toString(),
              member_id: session.member_user_id?.toString() || memberId,
              member_name: session.member_name || allMembers.find(m => m.user_id === memberId)?.name || null,
              caller_id: session.callerid,
              start_at: session.start_when,
              end_at: session.end_when,
              call_count: session.call_count || 0,
            }, {
              onConflict: 'workspace_id,external_session_id'
            });

          if (sessionError) {
            console.error('Session upsert error:', sessionError);
          }

          // Fetch calls for this session
          try {
            const sessionDetailResponse = await phoneburnerRequest(
              `/dialsession/${session.dialsession_id}`,
              apiKey
            );
            await delay(RATE_LIMIT_DELAY);

            // Get the session ID from our database
            const { data: dbSession } = await supabase
              .from('phoneburner_dial_sessions')
              .select('id')
              .eq('workspace_id', workspaceId)
              .eq('external_session_id', session.dialsession_id.toString())
              .single();

            // Session detail also has nested structure
            const sessionDetail = sessionDetailResponse.dialsessions?.dialsessions || sessionDetailResponse.dialsessions || {};
            const calls: Call[] = sessionDetail.calls || [];
            
            for (const call of calls) {
              // Parse connected field - API may return "0"/"1" string or number
              const isConnected = String(call.connected) === '1';
              const emailSent = String(call.email_sent) === '1';
              
              const { error: callError } = await supabase
                .from('phoneburner_calls')
                .upsert({
                  workspace_id: workspaceId,
                  dial_session_id: dbSession?.id,
                  external_call_id: call.call_id?.toString() || `${session.dialsession_id}-${callsProcessed}`,
                  phone_number: call.phone,
                  disposition: call.disposition,
                  duration_seconds: call.duration || 0,
                  is_connected: isConnected,
                  is_voicemail: call.disposition?.toLowerCase().includes('voicemail') || false,
                  voicemail_sent: call.voicemail_sent,
                  email_sent: emailSent,
                  notes: call.notes,
                  recording_url: call.recording_url,
                  start_at: call.start_when,
                  end_at: call.end_when,
                }, {
                  onConflict: 'workspace_id,external_call_id'
                });

              if (callError) {
                console.error('Call upsert error:', callError);
              }
              callsProcessed++;
            }
          } catch (detailError) {
            console.error(`Error fetching session ${session.dialsession_id} details:`, detailError);
          }

          sessionsProcessed++;
        }

        // Check if more pages
        const totalPages = sessionsData.total_pages || Math.ceil((sessionsData.total_results || sessions.length) / 50);
        if (currentPage >= totalPages || sessions.length < 50) {
          hasMorePages = false;
        } else {
          currentPage++;
        }
      }
    }

    // Determine if sync is complete (all members processed within time budget)
    const isComplete = (Date.now() - startTime) < TIME_BUDGET_MS;

    // Aggregate daily metrics only if sync is complete
    if (isComplete) {
      console.log('Aggregating daily metrics...');
      
      const { data: calls } = await supabase
        .from('phoneburner_calls')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (calls && calls.length > 0) {
        const dailyData: Record<string, any> = {};

        for (const call of calls) {
          const date = call.start_at ? call.start_at.split('T')[0] : new Date().toISOString().split('T')[0];
          
          if (!dailyData[date]) {
            dailyData[date] = {
              total_calls: 0,
              calls_connected: 0,
              voicemails_left: 0,
              emails_sent: 0,
              total_talk_time_seconds: 0,
              interested_count: 0,
              not_interested_count: 0,
            };
          }

          dailyData[date].total_calls++;
          if (call.is_connected) dailyData[date].calls_connected++;
          if (call.is_voicemail) dailyData[date].voicemails_left++;
          if (call.email_sent) dailyData[date].emails_sent++;
          dailyData[date].total_talk_time_seconds += call.duration_seconds || 0;

          const dispLower = (call.disposition || '').toLowerCase();
          if (dispLower.includes('interested') && !dispLower.includes('not interested')) {
            dailyData[date].interested_count++;
          } else if (dispLower.includes('not interested')) {
            dailyData[date].not_interested_count++;
          }
        }

        // Get session counts per day
        const { data: sessionsData } = await supabase
          .from('phoneburner_dial_sessions')
          .select('start_at')
          .eq('workspace_id', workspaceId);

        const sessionsByDate: Record<string, number> = {};
        for (const session of (sessionsData || [])) {
          const date = session.start_at ? session.start_at.split('T')[0] : null;
          if (date) {
            sessionsByDate[date] = (sessionsByDate[date] || 0) + 1;
          }
        }

        // Upsert daily metrics
        for (const [date, metrics] of Object.entries(dailyData)) {
          await supabase
            .from('phoneburner_daily_metrics')
            .upsert({
              workspace_id: workspaceId,
              date,
              total_sessions: sessionsByDate[date] || 0,
              ...metrics,
            }, {
              onConflict: 'workspace_id,date'
            });
        }
      }
    }

    // Update final sync status
    await supabase
      .from('api_connections')
      .update({
        sync_status: isComplete ? 'complete' : 'syncing',
        last_sync_at: new Date().toISOString(),
        last_full_sync_at: isComplete ? new Date().toISOString() : connection.last_full_sync_at,
        sync_progress: isComplete ? {
          sessionsProcessed,
          callsProcessed,
          totalSessions,
          completedAt: new Date().toISOString(),
        } : {
          heartbeat: new Date().toISOString(),
          sessionsProcessed,
          callsProcessed,
        }
      })
      .eq('id', connection.id);

    console.log(`Sync ${isComplete ? 'complete' : 'paused'}. Sessions: ${sessionsProcessed}, Calls: ${callsProcessed}`);

    return new Response(JSON.stringify({
      status: isComplete ? 'complete' : 'in_progress',
      sessionsProcessed,
      callsProcessed,
      totalSessions,
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
