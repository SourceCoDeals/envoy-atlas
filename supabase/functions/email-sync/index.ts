import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// API Base URLs
const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';
const REPLYIO_V1_URL = 'https://api.reply.io/v1';
const REPLYIO_V3_URL = 'https://api.reply.io/v3';

// Rate limiting
const SMARTLEAD_DELAY = 250;
const REPLYIO_DELAY_LIST = 3000;
const REPLYIO_DELAY_STATS = 10500;
const TIME_BUDGET_MS = 55000;
const MAX_BATCHES = 100;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// =============================================================================
// API REQUEST HELPERS
// =============================================================================

async function smartleadRequest(endpoint: string, apiKey: string, method = 'GET', body?: any, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    await delay(SMARTLEAD_DELAY);
    const url = `${SMARTLEAD_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}`;
    console.log(`SmartLead ${method}: ${endpoint}`);
    
    try {
      const options: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
      if (body && method !== 'GET') options.body = JSON.stringify(body);
      
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        console.log(`Rate limited, waiting ${(i + 1) * 2}s...`);
        await delay((i + 1) * 2000);
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        if (i === retries - 1) throw new Error(`Smartlead API ${response.status}: ${errorText}`);
        continue;
      }
      
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(1000 * (i + 1));
    }
  }
}

async function replyioRequest(
  endpoint: string, 
  apiKey: string, 
  options: { retries?: number; allow404?: boolean; delayMs?: number; useV1?: boolean } = {}
): Promise<any> {
  const { retries = 3, allow404 = false, delayMs = REPLYIO_DELAY_LIST, useV1 = false } = options;
  const baseUrl = useV1 ? REPLYIO_V1_URL : REPLYIO_V3_URL;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await delay(delayMs);
      const url = `${baseUrl}${endpoint}`;
      console.log(`Reply.io: ${url}`);
      const response = await fetch(url, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      });
      
      if (response.status === 429) {
        console.log(`Rate limited, waiting ${(attempt + 1) * 10}s...`);
        await delay(10000 * (attempt + 1));
        continue;
      }
      
      if (response.status === 404 && allow404) return null;
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Reply.io API ${response.status}: ${errorText}`);
      }
      
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await delay(2000 * (attempt + 1));
    }
  }
}

// =============================================================================
// SMARTLEAD SYNC
// =============================================================================

async function syncSmartlead(
  supabase: any,
  workspaceId: string,
  apiKey: string,
  progress: any,
  startTime: number
): Promise<{ complete: boolean; continueAt?: number }> {
  console.log('=== SMARTLEAD SYNC ===');
  
  const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;
  
  // Fetch all campaigns
  const campaigns = await smartleadRequest('/campaigns', apiKey);
  console.log(`Found ${campaigns.length} SmartLead campaigns`);
  
  for (let i = 0; i < campaigns.length; i++) {
    if (isTimeBudgetExceeded()) {
      console.log(`Time budget exceeded at campaign ${i}/${campaigns.length}`);
      return { complete: false, continueAt: i };
    }
    
    const campaign = campaigns[i];
    const platformId = String(campaign.id);
    
    // Upsert campaign to unified_campaigns
    const { data: campaignRecord, error: campErr } = await supabase
      .from('unified_campaigns')
      .upsert({
        workspace_id: workspaceId,
        platform: 'smartlead',
        platform_id: platformId,
        name: campaign.name,
        status: campaign.status?.toLowerCase() || 'active',
      }, { onConflict: 'workspace_id,platform,platform_id' })
      .select('id')
      .single();
    
    if (campErr) {
      console.error(`Failed to upsert campaign ${campaign.name}: ${campErr.message}`);
      progress.errors.push(`Campaign ${campaign.name}: ${campErr.message}`);
      continue;
    }
    
    const campaignId = campaignRecord.id;
    progress.campaigns_synced++;
    
    // Fetch campaign analytics (lifetime totals)
    try {
      const analytics = await smartleadRequest(`/campaigns/${campaign.id}/analytics`, apiKey);
      
      const totalSent = Number(analytics?.sent_count || analytics?.unique_sent_count || 0);
      const totalOpened = Number(analytics?.unique_open_count || analytics?.open_count || 0);
      const totalClicked = Number(analytics?.unique_click_count || analytics?.click_count || 0);
      const totalReplied = Number(analytics?.reply_count || 0);
      const totalBounced = Number(analytics?.bounce_count || 0);
      
      // Get previous cumulative for delta calculation
      const { data: prevCum } = await supabase
        .from('campaign_cumulative')
        .select('*')
        .eq('campaign_id', campaignId)
        .single();
      
      const today = new Date().toISOString().split('T')[0];
      const isFirstSync = !prevCum;
      
      // Calculate deltas
      const deltaSent = Math.max(0, totalSent - (prevCum?.total_sent || 0));
      const deltaOpened = Math.max(0, totalOpened - (prevCum?.total_opened || 0));
      const deltaClicked = Math.max(0, totalClicked - (prevCum?.total_clicked || 0));
      const deltaReplied = Math.max(0, totalReplied - (prevCum?.total_replied || 0));
      const deltaBounced = Math.max(0, totalBounced - (prevCum?.total_bounced || 0));
      
      console.log(`  ${campaign.name}: sent=${totalSent}, delta=${deltaSent}`);
      
      // Store cumulative
      await supabase.from('campaign_cumulative').upsert({
        campaign_id: campaignId,
        workspace_id: workspaceId,
        total_sent: totalSent,
        total_opened: totalOpened,
        total_clicked: totalClicked,
        total_replied: totalReplied,
        total_bounced: totalBounced,
        baseline_sent: isFirstSync ? totalSent : (prevCum?.baseline_sent || 0),
        baseline_opened: isFirstSync ? totalOpened : (prevCum?.baseline_opened || 0),
        first_synced_at: isFirstSync ? new Date().toISOString() : prevCum?.first_synced_at,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'campaign_id' });
      
      // Store daily metrics
      if (isFirstSync && totalSent > 0) {
        // First sync: use campaign creation date as baseline
        const baselineDate = campaign.created_at 
          ? new Date(campaign.created_at).toISOString().split('T')[0]
          : today;
        
        await supabase.from('campaign_metrics').upsert({
          workspace_id: workspaceId,
          campaign_id: campaignId,
          metric_date: baselineDate,
          sent_count: totalSent,
          opened_count: totalOpened,
          clicked_count: totalClicked,
          replied_count: totalReplied,
          bounced_count: totalBounced,
        }, { onConflict: 'campaign_id,metric_date' });
        
        progress.metrics_created++;
      } else if (!isFirstSync && (deltaSent > 0 || deltaOpened > 0 || deltaReplied > 0)) {
        await supabase.from('campaign_metrics').upsert({
          workspace_id: workspaceId,
          campaign_id: campaignId,
          metric_date: today,
          sent_count: deltaSent,
          opened_count: deltaOpened,
          clicked_count: deltaClicked,
          replied_count: deltaReplied,
          bounced_count: deltaBounced,
        }, { onConflict: 'campaign_id,metric_date' });
        
        progress.metrics_created++;
      }
    } catch (e) {
      console.error(`Analytics error for ${campaign.name}: ${(e as Error).message}`);
      progress.errors.push(`Analytics ${campaign.name}: ${(e as Error).message}`);
    }
    
    // Fetch sequence steps/variants
    try {
      const sequenceResp = await smartleadRequest(`/campaigns/${campaign.id}/sequences`, apiKey);
      const sequences = sequenceResp?.data || sequenceResp?.sequences || sequenceResp?.steps || sequenceResp?.emails || (Array.isArray(sequenceResp) ? sequenceResp : []);
      
      for (const seq of sequences) {
        const stepNumber = Number(seq.seq_number || seq.step_number || seq.order || 1);
        
        await supabase.from('unified_campaign_variants').upsert({
          campaign_id: campaignId,
          workspace_id: workspaceId,
          platform: 'smartlead',
          platform_variant_id: String(seq.seq_id || seq.id || stepNumber),
          step_number: stepNumber,
          name: seq.name || `Step ${stepNumber}`,
          subject_line: seq.subject || null,
          email_body: seq.email_body || seq.body || null,
          body_preview: (seq.email_body || seq.body || '').substring(0, 200),
          delay_days: Number(seq.seq_delay_details?.delay_in_days || seq.delay || 0),
        }, { onConflict: 'campaign_id,step_number' });
        
        progress.variants_synced++;
      }
    } catch (e) {
      console.error(`Sequence error for ${campaign.name}: ${(e as Error).message}`);
    }
  }
  
  return { complete: true };
}

// =============================================================================
// REPLY.IO SYNC
// =============================================================================

async function syncReplyio(
  supabase: any,
  workspaceId: string,
  apiKey: string,
  progress: any,
  startTime: number,
  startIndex: number = 0
): Promise<{ complete: boolean; continueAt?: number }> {
  console.log('=== REPLY.IO SYNC ===');
  
  const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;
  
  // Fetch all sequences (campaigns in Reply.io)
  const sequencesResp = await replyioRequest('/sequences', apiKey);
  const sequences = sequencesResp?.sequences || sequencesResp || [];
  console.log(`Found ${sequences.length} Reply.io sequences`);
  
  for (let i = startIndex; i < sequences.length; i++) {
    if (isTimeBudgetExceeded()) {
      console.log(`Time budget exceeded at sequence ${i}/${sequences.length}`);
      return { complete: false, continueAt: i };
    }
    
    const sequence = sequences[i];
    const platformId = String(sequence.id);
    
    // Upsert campaign
    const { data: campaignRecord, error: campErr } = await supabase
      .from('unified_campaigns')
      .upsert({
        workspace_id: workspaceId,
        platform: 'replyio',
        platform_id: platformId,
        name: sequence.name,
        status: mapReplyioStatus(sequence.status),
      }, { onConflict: 'workspace_id,platform,platform_id' })
      .select('id')
      .single();
    
    if (campErr) {
      console.error(`Failed to upsert sequence ${sequence.name}: ${campErr.message}`);
      progress.errors.push(`Sequence ${sequence.name}: ${campErr.message}`);
      continue;
    }
    
    const campaignId = campaignRecord.id;
    progress.campaigns_synced++;
    
    // ==========================================================================
    // FIX: Correct field mapping for Reply.io v1 API
    // The API returns: deliveriesCount, opensCount, repliesCount, bouncesCount
    // NOT: peopleContacted, openedContacts, etc.
    // ==========================================================================
    try {
      const seqDetailsRaw = await replyioRequest(
        `/campaigns?id=${sequence.id}`,
        apiKey,
        { retries: 2, allow404: true, delayMs: REPLYIO_DELAY_STATS, useV1: true }
      );
      
      const seqDetails = Array.isArray(seqDetailsRaw) ? seqDetailsRaw[0] : seqDetailsRaw;
      
      if (seqDetails) {
        const stats = seqDetails.stats || seqDetails.statistics || seqDetails.counters || {};
        
        // Log available fields for debugging
        if (i === startIndex) {
          console.log(`Reply.io stats fields: ${JSON.stringify(Object.keys(stats))}`);
          console.log(`Reply.io seqDetails fields: ${JSON.stringify(Object.keys(seqDetails))}`);
        }
        
        // CORRECT FIELD MAPPING - check deliveriesCount first!
        const totalSent = Number(
          seqDetails.deliveriesCount ?? stats.deliveriesCount ??
          seqDetails.peopleContacted ?? stats.peopleContacted ??
          seqDetails.contactedPeople ?? stats.contactedPeople ??
          seqDetails.sentCount ?? stats.sentCount ??
          seqDetails.peopleInSequence ?? seqDetails.contactCount ??
          0
        );
        const totalOpened = Number(
          seqDetails.opensCount ?? stats.opensCount ??
          seqDetails.openedContacts ?? stats.openedContacts ??
          seqDetails.opened ?? stats.opened ?? 0
        );
        const totalClicked = Number(
          seqDetails.clicksCount ?? stats.clicksCount ??
          seqDetails.clickedContacts ?? stats.clickedContacts ??
          seqDetails.clicked ?? stats.clicked ?? 0
        );
        const totalReplied = Number(
          seqDetails.repliesCount ?? stats.repliesCount ??
          seqDetails.repliedContacts ?? stats.repliedContacts ??
          seqDetails.replied ?? stats.replied ?? 0
        );
        const totalBounced = Number(
          seqDetails.bouncesCount ?? stats.bouncesCount ??
          seqDetails.bouncedContacts ?? stats.bouncedContacts ??
          seqDetails.bounced ?? stats.bounced ?? 0
        );
        const totalPositive = Number(
          seqDetails.interestedCount ?? stats.interestedCount ??
          seqDetails.interestedContacts ?? stats.interestedContacts ??
          seqDetails.interested ?? stats.interested ?? 0
        );
        
        console.log(`  ${sequence.name}: sent=${totalSent}, opened=${totalOpened}, replied=${totalReplied}`);
        
        // Get previous cumulative
        const { data: prevCum } = await supabase
          .from('campaign_cumulative')
          .select('*')
          .eq('campaign_id', campaignId)
          .single();
        
        const today = new Date().toISOString().split('T')[0];
        const isFirstSync = !prevCum;
        
        // Calculate deltas
        const deltaSent = Math.max(0, totalSent - (prevCum?.total_sent || 0));
        const deltaOpened = Math.max(0, totalOpened - (prevCum?.total_opened || 0));
        const deltaClicked = Math.max(0, totalClicked - (prevCum?.total_clicked || 0));
        const deltaReplied = Math.max(0, totalReplied - (prevCum?.total_replied || 0));
        const deltaBounced = Math.max(0, totalBounced - (prevCum?.total_bounced || 0));
        const deltaPositive = Math.max(0, totalPositive - (prevCum?.total_positive_replies || 0));
        
        // Store cumulative
        await supabase.from('campaign_cumulative').upsert({
          campaign_id: campaignId,
          workspace_id: workspaceId,
          total_sent: totalSent,
          total_opened: totalOpened,
          total_clicked: totalClicked,
          total_replied: totalReplied,
          total_bounced: totalBounced,
          total_positive_replies: totalPositive,
          baseline_sent: isFirstSync ? totalSent : (prevCum?.baseline_sent || 0),
          first_synced_at: isFirstSync ? new Date().toISOString() : prevCum?.first_synced_at,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'campaign_id' });
        
        // Store daily metrics
        if (isFirstSync && totalSent > 0) {
          const baselineDate = seqDetails.createdAt 
            ? new Date(seqDetails.createdAt).toISOString().split('T')[0]
            : today;
          
          await supabase.from('campaign_metrics').upsert({
            workspace_id: workspaceId,
            campaign_id: campaignId,
            metric_date: baselineDate,
            sent_count: totalSent,
            opened_count: totalOpened,
            clicked_count: totalClicked,
            replied_count: totalReplied,
            positive_reply_count: totalPositive,
            bounced_count: totalBounced,
          }, { onConflict: 'campaign_id,metric_date' });
          
          progress.metrics_created++;
        } else if (!isFirstSync && (deltaSent > 0 || deltaOpened > 0 || deltaReplied > 0)) {
          await supabase.from('campaign_metrics').upsert({
            workspace_id: workspaceId,
            campaign_id: campaignId,
            metric_date: today,
            sent_count: deltaSent,
            opened_count: deltaOpened,
            clicked_count: deltaClicked,
            replied_count: deltaReplied,
            positive_reply_count: deltaPositive,
            bounced_count: deltaBounced,
          }, { onConflict: 'campaign_id,metric_date' });
          
          progress.metrics_created++;
        }
      }
    } catch (e) {
      console.error(`Stats error for ${sequence.name}: ${(e as Error).message}`);
      progress.errors.push(`Stats ${sequence.name}: ${(e as Error).message}`);
    }
    
    // Fetch steps/variants
    try {
      const stepsResp = await replyioRequest(
        `/sequences/${sequence.id}/steps`,
        apiKey,
        { retries: 2, allow404: true }
      );
      
      const steps = stepsResp?.steps || stepsResp || [];
      
      for (let s = 0; s < steps.length; s++) {
        const step = steps[s];
        const stepNumber = Number(step.stepNumber || step.number || s + 1);
        
        await supabase.from('unified_campaign_variants').upsert({
          campaign_id: campaignId,
          workspace_id: workspaceId,
          platform: 'replyio',
          platform_variant_id: String(step.id || stepNumber),
          step_number: stepNumber,
          name: step.name || `Step ${stepNumber}`,
          subject_line: step.subject || step.emailSubject || null,
          email_body: step.body || step.emailBody || step.template?.body || null,
          body_preview: (step.body || step.emailBody || step.template?.body || '').substring(0, 200),
          delay_days: Number(step.delayDays || step.delay || 0),
        }, { onConflict: 'campaign_id,step_number' });
        
        progress.variants_synced++;
      }
    } catch (e) {
      console.error(`Steps error for ${sequence.name}: ${(e as Error).message}`);
    }
  }
  
  return { complete: true };
}

function mapReplyioStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'Active': 'active',
    'Paused': 'paused',
    'Stopped': 'stopped',
    'Draft': 'draft',
    'Archived': 'archived',
    'New': 'draft',
  };
  return statusMap[status] || status?.toLowerCase() || 'unknown';
}

// =============================================================================
// WORKSPACE METRICS AGGREGATION
// =============================================================================

async function aggregateWorkspaceMetrics(supabase: any, workspaceId: string) {
  console.log('=== Aggregating workspace metrics ===');
  
  // Get all dates with metrics in last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0];
  
  const { data: metrics } = await supabase
    .from('campaign_metrics')
    .select('*, campaign:unified_campaigns!inner(platform)')
    .eq('workspace_id', workspaceId)
    .gte('metric_date', cutoffDate);
  
  if (!metrics?.length) {
    console.log('No metrics to aggregate');
    return;
  }
  
  // Group by date and platform
  const grouped: Record<string, Record<string, any>> = {};
  
  for (const m of metrics) {
    const key = `${m.metric_date}-${m.campaign.platform}`;
    if (!grouped[key]) {
      grouped[key] = {
        workspace_id: workspaceId,
        platform: m.campaign.platform,
        metric_date: m.metric_date,
        sent_count: 0,
        opened_count: 0,
        clicked_count: 0,
        replied_count: 0,
        positive_reply_count: 0,
        bounced_count: 0,
        active_campaigns: 0,
      };
    }
    grouped[key].sent_count += m.sent_count || 0;
    grouped[key].opened_count += m.opened_count || 0;
    grouped[key].clicked_count += m.clicked_count || 0;
    grouped[key].replied_count += m.replied_count || 0;
    grouped[key].positive_reply_count += m.positive_reply_count || 0;
    grouped[key].bounced_count += m.bounced_count || 0;
    grouped[key].active_campaigns++;
  }
  
  // Upsert aggregated metrics
  const records = Object.values(grouped);
  if (records.length > 0) {
    const { error } = await supabase
      .from('workspace_metrics')
      .upsert(records, { onConflict: 'workspace_id,platform,metric_date' });
    
    if (error) {
      console.error('Workspace metrics aggregation error:', error.message);
    } else {
      console.log(`Aggregated ${records.length} workspace metric records`);
    }
  }
}

// =============================================================================
// SELF-CONTINUATION
// =============================================================================

async function triggerNextBatch(
  supabaseUrl: string,
  serviceKey: string,
  workspaceId: string,
  platform: string,
  continueAt: number
) {
  console.log(`Triggering continuation for ${platform} at index ${continueAt}...`);
  try {
    await fetch(`${supabaseUrl}/functions/v1/email-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        platform,
        continue_at: continueAt,
        internal_continuation: true,
      }),
    });
    console.log('Continuation triggered');
  } catch (error) {
    console.error('Failed to trigger continuation:', error);
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { 
      workspace_id, 
      platform, 
      reset = false, 
      continue_at = 0,
      internal_continuation = false 
    } = body;

    console.log(`[email-sync] workspace=${workspace_id}, platform=${platform || 'all'}, reset=${reset}`);

    // Auth check (skip for internal continuations)
    let workspaceId = workspace_id;
    if (!internal_continuation) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) throw new Error('No authorization header');

      const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (authError || !user) throw new Error('Authentication failed');

      if (!workspaceId) {
        const { data: membership } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        workspaceId = membership?.workspace_id;
      }

      if (!workspaceId) throw new Error('No workspace found');

      const { data: access } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .single();
      if (!access) throw new Error('Access denied');
    }

    // Reset data if requested
    if (reset) {
      console.log('Resetting unified tables for workspace...');
      await supabase.from('campaign_metrics').delete().eq('workspace_id', workspaceId);
      await supabase.from('campaign_cumulative').delete().eq('workspace_id', workspaceId);
      await supabase.from('unified_campaign_variants').delete().eq('workspace_id', workspaceId);
      await supabase.from('workspace_metrics').delete().eq('workspace_id', workspaceId);
      await supabase.from('unified_campaigns').delete().eq('workspace_id', workspaceId);
      console.log('Reset complete');
    }

    const progress = {
      campaigns_synced: 0,
      metrics_created: 0,
      variants_synced: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const platformsToSync = platform ? [platform] : ['smartlead', 'replyio'];
    
    // Log sync start
    for (const p of platformsToSync) {
      await supabase.from('sync_status').insert({
        workspace_id: workspaceId,
        platform: p,
        sync_type: reset ? 'full' : 'incremental',
        status: 'running',
        started_at: new Date().toISOString(),
      });
    }

    // Sync each platform
    for (const p of platformsToSync) {
      // Get API key
      const { data: connection } = await supabase
        .from('api_connections')
        .select('api_key_encrypted')
        .eq('workspace_id', workspaceId)
        .eq('platform', p)
        .eq('is_active', true)
        .single();

      if (!connection) {
        console.log(`No active ${p} connection found, skipping`);
        continue;
      }

      const apiKey = connection.api_key_encrypted;
      
      try {
        let result;
        if (p === 'smartlead') {
          result = await syncSmartlead(supabase, workspaceId, apiKey, progress, startTime);
        } else if (p === 'replyio') {
          result = await syncReplyio(supabase, workspaceId, apiKey, progress, startTime, continue_at);
        }

        if (result && !result.complete && result.continueAt !== undefined) {
          // Trigger continuation
          EdgeRuntime.waitUntil(
            triggerNextBatch(supabaseUrl, supabaseServiceKey, workspaceId, p, result.continueAt)
          );
        }
      } catch (e) {
        console.error(`${p} sync error:`, (e as Error).message);
        progress.errors.push(`${p}: ${(e as Error).message}`);
      }
    }

    // Aggregate workspace metrics
    await aggregateWorkspaceMetrics(supabase, workspaceId);

    // Update sync status
    for (const p of platformsToSync) {
      await supabase
        .from('sync_status')
        .update({
          status: progress.errors.length > 0 ? 'completed_with_errors' : 'completed',
          completed_at: new Date().toISOString(),
          records_processed: progress.campaigns_synced,
          records_created: progress.metrics_created,
          error_message: progress.errors.length > 0 ? progress.errors.join('; ') : null,
        })
        .eq('workspace_id', workspaceId)
        .eq('platform', p)
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1);
    }

    // Update api_connections sync status
    await supabase
      .from('api_connections')
      .update({ 
        sync_status: 'success',
        last_sync_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .in('platform', platformsToSync);

    return new Response(JSON.stringify({
      success: true,
      progress,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('email-sync error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
