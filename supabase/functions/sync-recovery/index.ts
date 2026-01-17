import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Consider a sync stuck if no heartbeat for 5 minutes
const STUCK_THRESHOLD_MS = 5 * 60 * 1000;
// Consider a partial sync stuck if no progress for 10 minutes
const PARTIAL_STUCK_THRESHOLD_MS = 10 * 60 * 1000;
// Max time before forcing a reset (30 minutes)
const FORCE_RESET_THRESHOLD_MS = 30 * 60 * 1000;
// Max recovery attempts before giving up
const MAX_RECOVERY_ATTEMPTS = 3;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface RecoveryAttempt {
  timestamp: string;
  action: 'resume' | 'reset';
  success: boolean;
  message: string;
}

interface StuckSync {
  id: string;
  platform: string;
  workspace_id: string;
  sync_status: string;
  sync_progress: any;
  last_heartbeat: Date | null;
  last_updated: Date | null;
  stuck_duration_minutes: number;
  recovery_attempts: RecoveryAttempt[];
}

// Detect stuck syncs across all platforms
async function detectStuckSyncs(): Promise<StuckSync[]> {
  const stuckSyncs: StuckSync[] = [];
  const now = Date.now();

  const { data: connections, error } = await supabaseAdmin
    .from("api_connections")
    .select("*")
    .eq("is_active", true)
    .in("sync_status", ["syncing", "partial", "paused"]);

  if (error || !connections) {
    console.error("[Recovery] Error fetching connections:", error);
    return [];
  }

  for (const conn of connections) {
    const progress = conn.sync_progress || {};
    const heartbeat = progress.heartbeat ? new Date(progress.heartbeat).getTime() : null;
    const updatedAt = conn.updated_at ? new Date(conn.updated_at).getTime() : null;
    
    const lastActivity = heartbeat || updatedAt || 0;
    const timeSinceActivity = now - lastActivity;

    let isStuck = false;
    let threshold = 0;

    // Check if heartbeat is old but updated_at is recent (sync is slow but active)
    const heartbeatAge = heartbeat ? now - heartbeat : Infinity;
    const updatedAge = updatedAt ? now - updatedAt : Infinity;
    
    // If updated_at is within 2 minutes, sync is probably still active
    if (updatedAge < 120000) {
      console.log(`[Recovery] ${conn.platform}: Updated recently (${Math.round(updatedAge / 1000)}s ago), not stuck`);
      continue;
    }

    if (conn.sync_status === "syncing") {
      threshold = STUCK_THRESHOLD_MS;
      isStuck = timeSinceActivity > threshold;
    } else if (conn.sync_status === "partial" || conn.sync_status === "paused") {
      threshold = PARTIAL_STUCK_THRESHOLD_MS;
      isStuck = timeSinceActivity > threshold;
    }

    if (isStuck) {
      stuckSyncs.push({
        id: conn.id,
        platform: conn.platform,
        workspace_id: conn.workspace_id,
        sync_status: conn.sync_status,
        sync_progress: progress,
        last_heartbeat: heartbeat ? new Date(heartbeat) : null,
        last_updated: updatedAt ? new Date(updatedAt) : null,
        stuck_duration_minutes: Math.round(timeSinceActivity / 60000),
        recovery_attempts: progress.recovery_attempts || [],
      });
    }
  }

  return stuckSyncs;
}

// Resume a stuck sync with exponential backoff
async function resumeSync(stuckSync: StuckSync): Promise<{ success: boolean; message: string }> {
  const { platform, workspace_id, sync_progress, recovery_attempts } = stuckSync;
  
  // Check if we've exceeded max recovery attempts
  const recentAttempts = recovery_attempts.filter(a => {
    const attemptTime = new Date(a.timestamp).getTime();
    const hourAgo = Date.now() - 3600000;
    return attemptTime > hourAgo;
  });
  
  if (recentAttempts.length >= MAX_RECOVERY_ATTEMPTS) {
    console.log(`[Recovery] ${platform}: Too many recovery attempts (${recentAttempts.length}), will reset instead`);
    return { 
      success: false, 
      message: `Exceeded ${MAX_RECOVERY_ATTEMPTS} recovery attempts in the last hour` 
    };
  }
  
  console.log(`[Recovery] Attempting to resume ${platform} sync for workspace ${workspace_id}`);

  // Determine the appropriate edge function to call
  const functionName = `${platform}-sync`;
  
  // Build continuation payload based on platform
  let payload: any = { 
    workspace_id,
    internal_continuation: true, // Use service role auth
  };
  
  if (platform === "smartlead") {
    if (sync_progress?.phase === "historical") {
      payload.full_backfill = true;
      payload.continue_from_chunk = sync_progress.historical_chunk_index || 0;
    } else if (sync_progress?.phase === "campaigns") {
      payload.continue_from_offset = sync_progress.campaign_offset || 0;
    }
    payload.is_continuation = true;
  } else if (platform === "replyio") {
    payload.batch_number = (sync_progress?.batch_number || 0) + 1;
    payload.auto_continue = true;
  } else if (platform === "nocodb") {
    payload.continue_from_offset = sync_progress?.current_offset || 0;
    payload.is_continuation = true;
  } else if (platform === "phoneburner") {
    payload.is_continuation = true;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      // Log successful recovery attempt
      await logRecoveryAttempt(stuckSync, 'resume', true, 'Successfully resumed');
      return { 
        success: true, 
        message: `Successfully resumed ${platform} sync` 
      };
    } else {
      const errorText = await response.text();
      await logRecoveryAttempt(stuckSync, 'resume', false, `HTTP ${response.status}: ${errorText}`);
      return { 
        success: false, 
        message: `Failed to resume: ${response.status} ${errorText}` 
      };
    }
  } catch (error) {
    await logRecoveryAttempt(stuckSync, 'resume', false, String(error));
    return { 
      success: false, 
      message: `Error resuming: ${String(error)}` 
    };
  }
}

// Log recovery attempt to sync_progress
async function logRecoveryAttempt(
  stuckSync: StuckSync, 
  action: 'resume' | 'reset',
  success: boolean,
  message: string
) {
  const newAttempt: RecoveryAttempt = {
    timestamp: new Date().toISOString(),
    action,
    success,
    message,
  };
  
  const existingAttempts = stuckSync.sync_progress?.recovery_attempts || [];
  const updatedAttempts = [...existingAttempts, newAttempt].slice(-10); // Keep last 10
  
  await supabaseAdmin
    .from("api_connections")
    .update({
      sync_progress: {
        ...stuckSync.sync_progress,
        recovery_attempts: updatedAttempts,
        last_recovery_at: new Date().toISOString(),
      },
    })
    .eq("id", stuckSync.id);
}

// Reset a stuck sync (mark as failed)
async function resetStuckSync(stuckSync: StuckSync): Promise<void> {
  console.log(`[Recovery] Resetting stuck ${stuckSync.platform} sync`);
  
  await logRecoveryAttempt(stuckSync, 'reset', true, `Reset after ${stuckSync.stuck_duration_minutes} minutes`);
  
  await supabaseAdmin
    .from("api_connections")
    .update({
      sync_status: "failed",
      sync_progress: {
        ...stuckSync.sync_progress,
        failed_at: new Date().toISOString(),
        failure_reason: `Sync stuck for ${stuckSync.stuck_duration_minutes} minutes with no progress`,
        recovery_attempted: true,
        can_retry: true,
      },
    })
    .eq("id", stuckSync.id);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse optional request body
    let requestBody: any = {};
    try {
      requestBody = await req.json();
    } catch {
      requestBody = {};
    }

    const { 
      action = "auto",           // "auto", "detect", "resume", "reset"
      platform,                   // Optional: specific platform to recover
      workspace_id,              // Optional: specific workspace
      force_resume = false,      // Force resume even if recently stuck
    } = requestBody;

    console.log(`[Recovery] Starting recovery - action: ${action}, platform: ${platform || "all"}, workspace: ${workspace_id || "all"}`);

    // Detect stuck syncs
    let stuckSyncs = await detectStuckSyncs();
    
    // Filter by platform/workspace if specified
    if (platform) {
      stuckSyncs = stuckSyncs.filter(s => s.platform === platform);
    }
    if (workspace_id) {
      stuckSyncs = stuckSyncs.filter(s => s.workspace_id === workspace_id);
    }

    console.log(`[Recovery] Found ${stuckSyncs.length} stuck syncs`);

    if (action === "detect") {
      // Just return detection results
      return new Response(
        JSON.stringify({ 
          success: true, 
          stuck_syncs: stuckSyncs.map(s => ({
            platform: s.platform,
            workspace_id: s.workspace_id,
            status: s.sync_status,
            stuck_minutes: s.stuck_duration_minutes,
            last_heartbeat: s.last_heartbeat?.toISOString(),
            last_updated: s.last_updated?.toISOString(),
            progress: {
              sequence_index: s.sync_progress?.sequence_index,
              total_sequences: s.sync_progress?.total_sequences,
              batch_number: s.sync_progress?.batch_number,
            },
            recovery_attempts: s.recovery_attempts.length,
          }))
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const stuckSync of stuckSyncs) {
      let result: { success: boolean; message: string };
      let actionTaken: string;

      if (action === "reset") {
        // Force reset
        await resetStuckSync(stuckSync);
        result = { success: true, message: "Reset to failed status" };
        actionTaken = "reset";
      } else if (action === "resume" || force_resume) {
        // Force resume
        result = await resumeSync(stuckSync);
        actionTaken = "resume";
        
        // If resume failed, reset
        if (!result.success) {
          await resetStuckSync(stuckSync);
          result = { success: true, message: `Resume failed, reset instead: ${result.message}` };
          actionTaken = "reset_after_failed_resume";
        }
      } else {
        // Auto mode: intelligent decision based on stuck duration and attempts
        const stuckTooLong = stuckSync.stuck_duration_minutes * 60000 > FORCE_RESET_THRESHOLD_MS;
        const tooManyAttempts = stuckSync.recovery_attempts.filter(a => {
          const attemptTime = new Date(a.timestamp).getTime();
          return attemptTime > Date.now() - 3600000; // Last hour
        }).length >= MAX_RECOVERY_ATTEMPTS;
        
        if (stuckTooLong || tooManyAttempts) {
          // Stuck for too long or too many failed attempts, reset
          await resetStuckSync(stuckSync);
          result = { 
            success: true, 
            message: stuckTooLong 
              ? `Reset after being stuck for ${stuckSync.stuck_duration_minutes}+ minutes`
              : `Reset after ${MAX_RECOVERY_ATTEMPTS} failed recovery attempts`
          };
          actionTaken = "reset";
        } else {
          // Try to resume
          result = await resumeSync(stuckSync);
          actionTaken = "resume";
          
          // If resume failed, reset
          if (!result.success) {
            await resetStuckSync(stuckSync);
            result = { success: true, message: `Resume failed, reset instead: ${result.message}` };
            actionTaken = "reset_after_failed_resume";
          }
        }
      }

      console.log(`[Recovery] ${actionTaken} ${stuckSync.platform}: ${result.message}`);

      results.push({
        platform: stuckSync.platform,
        workspace_id: stuckSync.workspace_id,
        action: actionTaken,
        stuck_duration_minutes: stuckSync.stuck_duration_minutes,
        ...result,
      });
    }

    console.log(`[Recovery] ✅ Recovery complete: ${results.length} syncs processed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        stuck_count: stuckSyncs.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Recovery] Error:", error);
    
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
