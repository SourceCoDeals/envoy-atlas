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
  sync_status: string;
  additional_config: any;
  last_heartbeat: Date | null;
  last_updated: Date | null;
  stuck_duration_minutes: number;
  recovery_attempts: RecoveryAttempt[];
}

// Detect stuck syncs across all platforms
async function detectStuckSyncs(): Promise<StuckSync[]> {
  const stuckSyncs: StuckSync[] = [];
  const now = Date.now();

  // Query unified data_sources table
  const { data: dataSources, error } = await supabaseAdmin
    .from("data_sources")
    .select("*")
    .eq("status", "active")
    .in("last_sync_status", ["syncing", "partial"]);

  if (error || !dataSources) {
    console.error("[Recovery] Error fetching data sources:", error);
    return [];
  }

  for (const ds of dataSources) {
    const config = ds.additional_config || {};
    const heartbeat = config.heartbeat ? new Date(config.heartbeat).getTime() : null;
    const updatedAt = ds.updated_at ? new Date(ds.updated_at).getTime() : null;
    
    const lastActivity = heartbeat || updatedAt || 0;
    const timeSinceActivity = now - lastActivity;

    let isStuck = false;
    let threshold = 0;

    // If updated_at is within 2 minutes, sync is probably still active
    const updatedAge = updatedAt ? now - updatedAt : Infinity;
    if (updatedAge < 120000) {
      console.log(`[Recovery] ${ds.source_type}: Updated recently (${Math.round(updatedAge / 1000)}s ago), not stuck`);
      continue;
    }

    if (ds.last_sync_status === "syncing") {
      threshold = STUCK_THRESHOLD_MS;
      isStuck = timeSinceActivity > threshold;
    } else if (ds.last_sync_status === "partial") {
      threshold = PARTIAL_STUCK_THRESHOLD_MS;
      isStuck = timeSinceActivity > threshold;
    }

    if (isStuck) {
      stuckSyncs.push({
        id: ds.id,
        platform: ds.source_type,
        sync_status: ds.last_sync_status,
        additional_config: config,
        last_heartbeat: heartbeat ? new Date(heartbeat) : null,
        last_updated: updatedAt ? new Date(updatedAt) : null,
        stuck_duration_minutes: Math.round(timeSinceActivity / 60000),
        recovery_attempts: config.recovery_attempts || [],
      });
    }
  }

  return stuckSyncs;
}

// Resume a stuck sync
async function resumeSync(stuckSync: StuckSync): Promise<{ success: boolean; message: string }> {
  const { platform, additional_config, recovery_attempts } = stuckSync;
  
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
  
  console.log(`[Recovery] Attempting to resume ${platform} sync`);

  const functionName = `${platform}-sync`;
  
  // Build continuation payload
  let payload: any = { 
    internal_continuation: true,
  };
  
  if (platform === "smartlead") {
    if (additional_config?.phase === "historical") {
      payload.full_backfill = true;
      payload.continue_from_chunk = additional_config.historical_chunk_index || 0;
    } else if (additional_config?.phase === "campaigns") {
      payload.continue_from_offset = additional_config.campaign_offset || 0;
    }
    payload.is_continuation = true;
  } else if (platform === "replyio") {
    payload.batch_number = (additional_config?.batch_number || 0) + 1;
    payload.auto_continue = true;
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

// Log recovery attempt to additional_config
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
  
  const existingAttempts = stuckSync.additional_config?.recovery_attempts || [];
  const updatedAttempts = [...existingAttempts, newAttempt].slice(-10);
  
  await supabaseAdmin
    .from("data_sources")
    .update({
      additional_config: {
        ...stuckSync.additional_config,
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
    .from("data_sources")
    .update({
      last_sync_status: "error",
      last_sync_error: `Sync stuck for ${stuckSync.stuck_duration_minutes} minutes with no progress`,
      additional_config: {
        ...stuckSync.additional_config,
        failed_at: new Date().toISOString(),
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
    let requestBody: any = {};
    try {
      requestBody = await req.json();
    } catch {
      requestBody = {};
    }

    const { 
      action = "auto",
      platform,
      force_resume = false,
    } = requestBody;

    console.log(`[Recovery] Starting recovery - action: ${action}, platform: ${platform || "all"}`);

    // Detect stuck syncs
    let stuckSyncs = await detectStuckSyncs();
    
    if (platform) {
      stuckSyncs = stuckSyncs.filter(s => s.platform === platform);
    }

    console.log(`[Recovery] Found ${stuckSyncs.length} stuck syncs`);

    if (action === "detect") {
      return new Response(
        JSON.stringify({ 
          success: true, 
          stuck_syncs: stuckSyncs.map(s => ({
            platform: s.platform,
            status: s.sync_status,
            stuck_minutes: s.stuck_duration_minutes,
            last_heartbeat: s.last_heartbeat?.toISOString(),
            last_updated: s.last_updated?.toISOString(),
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
        await resetStuckSync(stuckSync);
        result = { success: true, message: "Reset to failed status" };
        actionTaken = "reset";
      } else if (action === "resume" || force_resume) {
        result = await resumeSync(stuckSync);
        actionTaken = "resume";
        
        if (!result.success) {
          await resetStuckSync(stuckSync);
          result = { success: true, message: `Resume failed, reset instead: ${result.message}` };
          actionTaken = "reset_after_failed_resume";
        }
      } else {
        const stuckTooLong = stuckSync.stuck_duration_minutes * 60000 > FORCE_RESET_THRESHOLD_MS;
        const tooManyAttempts = stuckSync.recovery_attempts.filter(a => {
          const attemptTime = new Date(a.timestamp).getTime();
          return attemptTime > Date.now() - 3600000;
        }).length >= MAX_RECOVERY_ATTEMPTS;
        
        if (stuckTooLong || tooManyAttempts) {
          await resetStuckSync(stuckSync);
          result = { 
            success: true, 
            message: stuckTooLong 
              ? `Reset after being stuck for ${stuckSync.stuck_duration_minutes}+ minutes`
              : `Reset after ${MAX_RECOVERY_ATTEMPTS} failed recovery attempts`
          };
          actionTaken = "reset";
        } else {
          result = await resumeSync(stuckSync);
          actionTaken = "resume";
          
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
