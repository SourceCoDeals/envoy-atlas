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
  connected?: string;
  voicemail_sent?: string;
  email_sent?: string;
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

    // Calculate date range - last 90 days (max allowed by usage endpoint)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    const dateStart = startDate.toISOString().split('T')[0];
    const dateEnd = endDate.toISOString().split('T')[0];

    // ============= DIAGNOSTIC MODE =============
    if (diagnostic) {
      console.log('Running PhoneBurner diagnostics...');
      
      const diagnosticResults: any = {
        diagnostic: true,
        timestamp: new Date().toISOString(),
        dateRange: { dateStart, dateEnd },
        tests: {}
      };

      // Test 1: Get members
      try {
        const membersResponse = await phoneburnerRequest('/members', apiKey);
        console.log('Raw /members response:', JSON.stringify(membersResponse, null, 2));
        
        let members: any[] = [];
        const rawMembers = membersResponse.members?.members;
        if (rawMembers && Array.isArray(rawMembers)) {
          if (rawMembers.length > 0 && Array.isArray(rawMembers[0])) {
            members = rawMembers[0];
          } else {
            members = rawMembers;
          }
        } else if (membersResponse.members && Array.isArray(membersResponse.members)) {
          members = membersResponse.members;
        }
        
        diagnosticResults.tests.members = {
          success: true,
          count: members.length,
          data: members.slice(0, 7).map((m: any) => ({
            user_id: m.user_id || m.member_user_id,
            name: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
            email: m.email_address || m.email,
          })),
        };
      } catch (e: any) {
        diagnosticResults.tests.members = { success: false, error: e.message };
      }

      // Test 2: Try /dialsession/usage (the KEY endpoint for team-wide stats)
      try {
        const usageResponse = await phoneburnerRequest(
          `/dialsession/usage?date_start=${dateStart}&date_end=${dateEnd}`,
          apiKey
        );
        console.log('Raw /dialsession/usage response:', JSON.stringify(usageResponse, null, 2));
        
        const usage = usageResponse.usage || {};
        const memberIds = Object.keys(usage);
        
        diagnosticResults.tests.dialsession_usage = {
          success: true,
          memberCount: memberIds.length,
          memberStats: memberIds.map(id => ({
            member_id: id,
            ...usage[id]
          })),
          note: 'This endpoint returns team-wide aggregate stats',
        };
      } catch (e: any) {
        diagnosticResults.tests.dialsession_usage = { success: false, error: e.message };
      }

      // Test 3: Get dialsessions (will only return sessions for authenticated user)
      try {
        const sessionsResponse = await phoneburnerRequest(
          `/dialsession?date_start=${dateStart}&date_end=${dateEnd}&page=1&page_size=10`,
          apiKey
        );
        console.log('Raw /dialsession response:', JSON.stringify(sessionsResponse, null, 2));
        
        const sessionsData = sessionsResponse.dialsessions || {};
        let sessions: any[] = [];
        if (sessionsData.dialsessions) {
          if (Array.isArray(sessionsData.dialsessions)) {
            sessions = sessionsData.dialsessions;
          }
        }
        
        diagnosticResults.tests.dialsession = {
          success: true,
          total_results: sessionsData.total_results || 0,
          total_pages: sessionsData.total_pages || 0,
          returned_count: sessions.length,
          sample_session: sessions[0] || null,
          note: 'This endpoint only returns sessions for the API key owner, not all team members',
        };
      } catch (e: any) {
        diagnosticResults.tests.dialsession = { success: false, error: e.message };
      }

      // Generate recommendation
      const usageTest = diagnosticResults.tests.dialsession_usage;
      const sessionsTest = diagnosticResults.tests.dialsession;
      
      if (usageTest?.success && usageTest.memberCount > 0) {
        const totalCalls = usageTest.memberStats.reduce((sum: number, m: any) => sum + (m.calls || 0), 0);
        const totalSessions = usageTest.memberStats.reduce((sum: number, m: any) => sum + (m.sessions || 0), 0);
        diagnosticResults.recommendation = `SUCCESS! Found ${totalSessions} sessions and ${totalCalls} calls across ${usageTest.memberCount} team members via /dialsession/usage endpoint.`;
      } else if (sessionsTest?.success && sessionsTest.total_results > 0) {
        diagnosticResults.recommendation = `Found ${sessionsTest.total_results} sessions via /dialsession (owner only). Team-wide data requires /dialsession/usage.`;
      } else {
        diagnosticResults.recommendation = 'No data found. Please ensure team members have dial session history in the specified date range.';
      }
      
      console.log('Diagnostic results:', JSON.stringify(diagnosticResults, null, 2));

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
          phase: 'starting',
        }
      })
      .eq('id', connection.id);

    let sessionsProcessed = 0;
    let callsProcessed = 0;
    let totalSessions = 0;

    console.log(`Starting PhoneBurner sync for date range ${dateStart} to ${dateEnd}`);

    // STEP 1: Fetch all team members for name lookup
    let memberMap: Record<string, string> = {};
    try {
      const membersResponse = await phoneburnerRequest('/members', apiKey);
      let members: any[] = [];
      const rawMembers = membersResponse.members?.members;
      if (rawMembers && Array.isArray(rawMembers)) {
        if (rawMembers.length > 0 && Array.isArray(rawMembers[0])) {
          members = rawMembers[0];
        } else {
          members = rawMembers;
        }
      } else if (membersResponse.members && Array.isArray(membersResponse.members)) {
        members = membersResponse.members;
      }
      
      for (const m of members) {
        const id = (m.user_id || m.member_user_id)?.toString();
        const name = `${m.first_name || ''} ${m.last_name || ''}`.trim();
        if (id) memberMap[id] = name;
      }
      console.log(`Found ${Object.keys(memberMap).length} team members`);
    } catch (e) {
      console.error('Failed to fetch members:', e);
    }

    // STEP 2: Get team-wide usage stats from /dialsession/usage
    try {
      await supabase.from('api_connections').update({
        sync_progress: { heartbeat: new Date().toISOString(), phase: 'fetching_usage' }
      }).eq('id', connection.id);

      const usageResponse = await phoneburnerRequest(
        `/dialsession/usage?date_start=${dateStart}&date_end=${dateEnd}`,
        apiKey
      );
      
      const usage = usageResponse.usage || {};
      const memberIds = Object.keys(usage);
      
      console.log(`Usage stats found for ${memberIds.length} members`);
      
      // Store aggregate daily metrics from usage (we'll use date_end as the date since usage is aggregate)
      for (const memberId of memberIds) {
        const stats = usage[memberId];
        const memberName = memberMap[memberId] || `Member ${memberId}`;
        
        console.log(`Member ${memberName}: ${stats.sessions} sessions, ${stats.calls} calls, ${stats.connected} connected`);
        
        // For now, store as a single aggregate entry for the date range
        // In the future, we could break this down by fetching individual sessions
        const { error: metricsError } = await supabase
          .from('phoneburner_daily_metrics')
          .upsert({
            workspace_id: workspaceId,
            date: dateEnd, // Use end date for this aggregate
            member_id: memberId,
            total_sessions: stats.sessions || 0,
            total_calls: stats.calls || 0,
            calls_connected: stats.connected || 0,
            voicemails_left: stats.voicemail || 0,
            emails_sent: stats.emails || 0,
            total_talk_time_seconds: (stats.talktime || 0) * 60, // Convert minutes to seconds
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

    // STEP 3: Fetch individual dial sessions (will only get sessions for API key owner)
    await supabase.from('api_connections').update({
      sync_progress: { heartbeat: new Date().toISOString(), phase: 'fetching_sessions' }
    }).eq('id', connection.id);

    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages && (Date.now() - startTime) < TIME_BUDGET_MS) {
      const sessionsResponse = await phoneburnerRequest(
        `/dialsession?date_start=${dateStart}&date_end=${dateEnd}&page=${currentPage}&page_size=50`,
        apiKey
      );
      await delay(RATE_LIMIT_DELAY);

      const sessionsData = sessionsResponse.dialsessions || {};
      const sessions: DialSession[] = Array.isArray(sessionsData.dialsessions) 
        ? sessionsData.dialsessions 
        : [];
      
      console.log(`Page ${currentPage}: ${sessions.length} sessions, total_results: ${sessionsData.total_results || 0}`);
      
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

        // Upsert dial session
        const { error: sessionError } = await supabase
          .from('phoneburner_dial_sessions')
          .upsert({
            workspace_id: workspaceId,
            external_session_id: session.dialsession_id.toString(),
            member_id: session.member_user_id?.toString() || null,
            member_name: memberMap[session.member_user_id || ''] || null,
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
            `/dialsession/${session.dialsession_id}?include_recording=1`,
            apiKey
          );
          await delay(RATE_LIMIT_DELAY);

          const { data: dbSession } = await supabase
            .from('phoneburner_dial_sessions')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('external_session_id', session.dialsession_id.toString())
            .single();

          const sessionDetail = sessionDetailResponse.dialsessions?.dialsessions || sessionDetailResponse.dialsessions || {};
          const calls: Call[] = sessionDetail.calls || [];
          
          for (const call of calls) {
            const isConnected = String(call.connected) === '1';
            const emailSent = String(call.email_sent) === '1';

            const { error: callError } = await supabase
              .from('phoneburner_calls')
              .upsert({
                workspace_id: workspaceId,
                external_call_id: call.call_id?.toString() || `${session.dialsession_id}-${callsProcessed}`,
                dial_session_id: dbSession?.id,
                contact_id: null,
                phone_number: call.phone,
                disposition: call.disposition,
                disposition_id: null,
                duration_seconds: call.duration || 0,
                is_connected: isConnected,
                is_voicemail: call.voicemail_sent ? true : false,
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
            } else {
              callsProcessed++;
            }
          }

          sessionsProcessed++;
        } catch (e) {
          console.error(`Failed to fetch calls for session ${session.dialsession_id}:`, e);
        }
      }

      currentPage++;
      const totalPages = sessionsData.total_pages || 1;
      if (currentPage > totalPages) {
        hasMorePages = false;
      }
    }

    const isComplete = (Date.now() - startTime) < TIME_BUDGET_MS && !hasMorePages;

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
          currentPage,
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
