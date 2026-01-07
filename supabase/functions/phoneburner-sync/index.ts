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

    const { workspaceId, reset = false } = await req.json();

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

    // Determine date range - last 90 days or from last sync
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    const dateStart = startDate.toISOString().split('T')[0];
    const dateEnd = endDate.toISOString().split('T')[0];

    let currentPage = syncProgress.currentPage || 1;
    let sessionsProcessed = syncProgress.sessionsProcessed || 0;
    let callsProcessed = syncProgress.callsProcessed || 0;
    let hasMorePages = true;
    let totalSessions = 0;

    console.log(`Starting PhoneBurner sync from page ${currentPage}`);

    while (hasMorePages && (Date.now() - startTime) < TIME_BUDGET_MS) {
      // Update heartbeat
      await supabase
        .from('api_connections')
        .update({
          sync_progress: {
            heartbeat: new Date().toISOString(),
            currentPage,
            sessionsProcessed,
            callsProcessed,
          }
        })
        .eq('id', connection.id);

      // Fetch dial sessions
      const sessionsResponse = await phoneburnerRequest(
        `/dialsession?date_start=${dateStart}&date_end=${dateEnd}&page=${currentPage}&items_per_page=50`,
        apiKey
      );

      await delay(RATE_LIMIT_DELAY);

      // PhoneBurner returns nested structure: { dialsessions: { dialsessions: [...], total_results: N } }
      const sessionsData = sessionsResponse.dialsessions || {};
      const sessions: DialSession[] = Array.isArray(sessionsData.dialsessions) 
        ? sessionsData.dialsessions 
        : (Array.isArray(sessionsData) ? sessionsData : []);
      totalSessions = sessionsData.total_results || sessions.length;
      
      console.log(`PhoneBurner response structure: ${JSON.stringify(Object.keys(sessionsResponse))}, sessions count: ${sessions.length}`);
      
      if (sessions.length === 0) {
        hasMorePages = false;
        break;
      }

      console.log(`Processing page ${currentPage}, ${sessions.length} sessions`);

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
            member_id: session.member_user_id?.toString(),
            member_name: session.member_name || null,
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

      // Check if more pages - use total_pages from API if available
      const totalPages = sessionsData.total_pages || Math.ceil(totalSessions / 50);
      if (currentPage >= totalPages || sessions.length < 50) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    // Aggregate daily metrics
    if (!hasMorePages) {
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
        const { data: sessions } = await supabase
          .from('phoneburner_dial_sessions')
          .select('start_at')
          .eq('workspace_id', workspaceId);

        const sessionsByDate: Record<string, number> = {};
        for (const session of (sessions || [])) {
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
    const isComplete = !hasMorePages;
    await supabase
      .from('api_connections')
      .update({
        sync_status: isComplete ? 'complete' : 'syncing',
        last_sync_at: new Date().toISOString(),
        last_full_sync_at: isComplete ? new Date().toISOString() : connection.last_full_sync_at,
        sync_progress: isComplete ? {
          sessionsProcessed,
          callsProcessed,
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
      currentPage,
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
