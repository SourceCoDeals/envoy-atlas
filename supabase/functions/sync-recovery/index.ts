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

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface StuckSync {
  id: string;
  platform: string;
  workspace_id: string;
  sync_status: string;
  sync_progress: any;
  last_heartbeat: Date | null;
  stuck_duration_minutes: number;
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
    const updatedAt = progress.updated_at ? new Date(progress.updated_at).getTime() : null;
    
    const lastActivity = heartbeat || updatedAt || 0;
    const timeSinceActivity = now - lastActivity;

    let isStuck = false;
    let threshold = 0;

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
        last_heartbeat: lastActivity ? new Date(lastActivity) : null,
        stuck_duration_minutes: Math.round(timeSinceActivity / 60000),
      });
    }
  }

  return stuckSyncs;
}

// Resume a stuck sync
async function resumeSync(stuckSync: StuckSync): Promise<{ success: boolean; message: string }> {
  const { platform, workspace_id, sync_progress } = stuckSync;
  
  console.log(`[Recovery] Attempting to resume ${platform} sync for workspace ${workspace_id}`);

  // Determine the appropriate edge function to call
  const functionName = `${platform}-sync`;
  
  // Build continuation payload based on platform
  let payload: any = { workspace_id };
  
  if (platform === "smartlead") {
    if (sync_progress?.phase === "historical") {
      payload.full_backfill = true;
      payload.continue_from_chunk = sync_progress.historical_chunk_index || 0;
    } else if (sync_progress?.phase === "campaigns") {
      payload.continue_from_offset = sync_progress.campaign_offset || 0;
    }
    payload.is_continuation = true;
  } else if (platform === "replyio") {
    payload.continue_from_batch = sync_progress?.current_batch || 0;
    payload.is_continuation = true;
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
      return { 
        success: true, 
        message: `Successfully resumed ${platform} sync` 
      };
    } else {
      const errorText = await response.text();
      return { 
        success: false, 
        message: `Failed to resume: ${response.status} ${errorText}` 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Error resuming: ${String(error)}` 
    };
  }
}

// Reset a stuck sync (mark as failed)
async function resetStuckSync(stuckSync: StuckSync): Promise<void> {
  console.log(`[Recovery] Resetting stuck ${stuckSync.platform} sync`);
  
  await supabaseAdmin
    .from("api_connections")
    .update({
      sync_status: "failed",
      sync_progress: {
        ...stuckSync.sync_progress,
        failed_at: new Date().toISOString(),
        failure_reason: `Sync stuck for ${stuckSync.stuck_duration_minutes} minutes with no progress`,
        recovery_attempted: true,
      },
    })
    .eq("id", stuckSync.id);
}

// Log recovery action
async function logRecoveryAction(
  stuckSync: StuckSync, 
  action: string, 
  result: { success: boolean; message: string }
) {
  console.log(`[Recovery] ${action} ${stuckSync.platform}: ${result.message}`);
  
  // Could store in a sync_errors table if it exists
  // For now, just log to console
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

    console.log(`[Recovery] Starting recovery - action: ${action}, platform: ${platform || "all"}`);

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
            progress: s.sync_progress,
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
      } else {
        // Auto mode: try to resume, reset if stuck too long
        if (stuckSync.stuck_duration_minutes > 30) {
          // Stuck for too long, reset instead of trying to resume
          await resetStuckSync(stuckSync);
          result = { success: true, message: "Reset after being stuck for 30+ minutes" };
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

      await logRecoveryAction(stuckSync, actionTaken, result);

      results.push({
        platform: stuckSync.platform,
        workspace_id: stuckSync.workspace_id,
        action: actionTaken,
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
