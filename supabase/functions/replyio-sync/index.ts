import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Declare EdgeRuntime global for Supabase Edge Functions
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REPLYIO_BASE_URL = 'https://api.reply.io';
const REPLYIO_V1_URL = 'https://api.reply.io/v1';
const REPLYIO_V2_URL = 'https://api.reply.io/v2';
const REPLYIO_V3_URL = 'https://api.reply.io/v3';

// Reply.io Rate Limit: 10 seconds between API calls (strict!), 15,000 requests/month
const RATE_LIMIT_DELAY_LIST = 3000;
const RATE_LIMIT_DELAY_STATS = 10500;
const RATE_LIMIT_DELAY_CONTACTS = 3500;
const TIME_BUDGET_MS = 50000;
const MAX_BATCHES = 250; // Increased to handle large accounts (649+ sequences)

function mapSequenceStatus(status: string): string {
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function extractPersonalizationVars(content: string): string[] {
  const varPatterns = [
    /\{\{([^}]+)\}\}/g,
    /\{([^}]+)\}/g,
    /\[\[([^\]]+)\]\]/g,
  ];
  
  const vars = new Set<string>();
  for (const pattern of varPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      vars.add(match[1].trim());
    }
  }
  return Array.from(vars);
}

async function replyioRequest(
  endpoint: string, 
  apiKey: string, 
  options: { retries?: number; allow404?: boolean; delayMs?: number; useV1?: boolean; useV2?: boolean } = {}
): Promise<any> {
  const { retries = 3, allow404 = false, delayMs = RATE_LIMIT_DELAY_LIST, useV1 = false, useV2 = false } = options;
  const baseUrl = useV1 ? REPLYIO_V1_URL : (useV2 ? REPLYIO_V2_URL : REPLYIO_V3_URL);
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await delay(delayMs);
      const url = `${baseUrl}${endpoint}`;
      console.log(`Fetching: ${url}`);
      const response = await fetch(url, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      });
      
      if (response.status === 429) {
        console.log(`Rate limited, waiting ${(attempt + 1) * 10} seconds...`);
        await delay(10000 * (attempt + 1));
        continue;
      }
      
      if (response.status === 404 && allow404) {
        console.log(`  404 - no data available for ${endpoint}`);
        return null;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Reply.io API error ${response.status}: ${errorText}`);
      }
      
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      console.log(`Retry ${attempt + 1}/${retries}:`, error);
      await delay(2000 * (attempt + 1));
    }
  }
}

// ==========================================================
// FIX #2: Self-continuation with SERVICE ROLE KEY (not user token)
// This prevents 401 errors when user token expires during long syncs
// ==========================================================
async function triggerNextBatch(
  supabaseUrl: string,
  serviceKey: string,
  workspaceId: string,
  batchNumber: number
) {
  console.log(`Triggering next Reply.io batch (${batchNumber}) via self-continuation with SERVICE KEY...`);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/replyio-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        reset: false,
        batch_number: batchNumber,
        auto_continue: true,
        internal_continuation: true, // Flag to skip user auth check
      }),
    });
    console.log(`Next batch triggered with service key, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger next batch:', error);
  }
}

async function triggerAnalysis(
  supabaseUrl: string,
  serviceKey: string,
  workspaceId: string
) {
  console.log('Sync complete - triggering analysis functions...');
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/backfill-features`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
    console.log(`backfill-features triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger backfill-features:', error);
  }
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/compute-patterns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
    console.log(`compute-patterns triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger compute-patterns:', error);
  }
}

// ==========================================================
// FIX #5: Aggregate ALL historical dates, not just today
// ==========================================================
async function aggregateWorkspaceMetrics(
  supabase: any,
  workspaceId: string
) {
  console.log('=== Aggregating metrics to workspace level (all dates) ===');
  
  try {
    // Get all distinct dates from campaign metrics (last 90 days for efficiency)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0];
    
    const { data: distinctDates, error: datesErr } = await supabase
      .from('replyio_daily_metrics')
      .select('metric_date')
      .eq('workspace_id', workspaceId)
      .gte('metric_date', cutoffDate)
      .order('metric_date', { ascending: false });
    
    if (datesErr) {
      console.error('Error fetching distinct dates:', datesErr.message);
      return;
    }
    
    // Get unique dates
    const uniqueDates = [...new Set((distinctDates || []).map((d: any) => d.metric_date))];
    console.log(`Found ${uniqueDates.length} unique dates to aggregate`);
    
    for (const metricDate of uniqueDates) {
      const { data: campaignMetrics } = await supabase
        .from('replyio_daily_metrics')
        .select('sent_count, opened_count, clicked_count, replied_count, positive_reply_count, bounced_count')
        .eq('workspace_id', workspaceId)
        .eq('metric_date', metricDate);
      
      if (campaignMetrics && campaignMetrics.length > 0) {
        const aggregated = campaignMetrics.reduce((acc: any, m: any) => ({
          sent_count: acc.sent_count + (m.sent_count || 0),
          opened_count: acc.opened_count + (m.opened_count || 0),
          clicked_count: acc.clicked_count + (m.clicked_count || 0),
          replied_count: acc.replied_count + (m.replied_count || 0),
          positive_reply_count: acc.positive_reply_count + (m.positive_reply_count || 0),
          bounced_count: acc.bounced_count + (m.bounced_count || 0),
        }), { sent_count: 0, opened_count: 0, clicked_count: 0, replied_count: 0, positive_reply_count: 0, bounced_count: 0 });
        
        await supabase.from('replyio_workspace_daily_metrics').upsert({
          workspace_id: workspaceId,
          metric_date: metricDate,
          ...aggregated,
        }, { onConflict: 'workspace_id,metric_date' });
      }
    }
    
    console.log(`✓ Aggregated ${uniqueDates.length} dates to workspace level`);
  } catch (e) {
    console.error('Error aggregating workspace metrics:', e);
  }
}

Deno.serve(async (req) => {
  console.log('replyio-sync: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { 
      workspace_id, 
      reset = false, 
      batch_number = 1, 
      auto_continue = false,
      full_backfill = false,
      triggered_by = null,
      internal_continuation = false, // NEW: Flag for service-role auth
    } = body;

    // ==========================================================
    // FIX #2: Allow service-role continuation without user auth
    // ==========================================================
    const authHeader = req.headers.get('Authorization');
    
    if (!internal_continuation) {
      // Normal user auth check for initial request
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing authorization header' }), 
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: { user } } = await createClient(
        supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      ).auth.getUser();
      
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), 
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
      // For internal continuations, just verify service key was used (implicit via edge function infra)
      console.log(`Internal continuation batch ${batch_number} - using service role auth`);
    }
    
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (batch_number > MAX_BATCHES) {
      console.error(`Max batch limit (${MAX_BATCHES}) reached. Stopping sync.`);
      
      // Update connection status to indicate batch limit hit
      await supabase.from('api_connections').update({
        sync_status: 'error',
        sync_progress: {
          batch_limit_reached: true,
          error_message: `Sync stopped after ${MAX_BATCHES} batches. Some data may be missing.`,
          stopped_at: new Date().toISOString(),
          final_batch: batch_number,
        },
        updated_at: new Date().toISOString(),
      }).eq('workspace_id', workspace_id).eq('platform', 'replyio');
      
      return new Response(JSON.stringify({ 
        error: 'Max batch limit reached',
        batch_number,
        batch_limit_reached: true,
        message: 'Sync stopped after too many batches. Some data may be missing.'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Starting batch ${batch_number}, auto_continue=${auto_continue}, full_backfill=${full_backfill}, triggered_by=${triggered_by}, internal=${internal_continuation}`);

    const { data: connection } = await supabase.from('api_connections').select('*')
      .eq('workspace_id', workspace_id).eq('platform', 'replyio').eq('is_active', true).single();
    
    if (!connection) {
      return new Response(JSON.stringify({ error: 'No Reply.io connection found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = connection.api_key_encrypted;
    const existingProgress = (connection.sync_progress as any) || {};

    // Handle reset
    if (reset) {
      console.log('Resetting Reply.io sync data for workspace:', workspace_id);
      const { data: campaigns } = await supabase.from('replyio_campaigns').select('id').eq('workspace_id', workspace_id);
      const campaignIds = campaigns?.map((c: any) => c.id) || [];
      
      if (campaignIds.length > 0) {
        await supabase.from('replyio_daily_metrics').delete().eq('workspace_id', workspace_id);
        await supabase.from('replyio_variants').delete().in('campaign_id', campaignIds);
        await supabase.from('replyio_sequence_steps').delete().in('campaign_id', campaignIds);
        await supabase.from('replyio_campaigns').delete().eq('workspace_id', workspace_id);
      }
      
      // Also reset cumulative metrics
      await supabase.from('replyio_campaign_cumulative').delete().eq('workspace_id', workspace_id);
      await supabase.from('replyio_workspace_daily_metrics').delete().eq('workspace_id', workspace_id);
      
      console.log('Reset complete');
    }

    await supabase.from('api_connections').update({ 
      sync_status: 'syncing',
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id);

    const progress = {
      sequences_synced: 0,
      metrics_created: 0,
      variants_synced: 0,
      replies_synced: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;

    // Use cached sequence list if available and not reset
    let allSequences: any[] = existingProgress.cached_sequences || [];
    
    if (allSequences.length === 0 || reset) {
      console.log('Fetching all sequences...');
      allSequences = [];
      let skip = 0;
      
      while (!isTimeBudgetExceeded()) {
        const response = await replyioRequest(
          `/sequences?top=100&skip=${skip}`, 
          apiKey, 
          { delayMs: RATE_LIMIT_DELAY_LIST }
        );
        const sequences = Array.isArray(response) ? response : (response?.sequences || response?.items || []);
        
        if (sequences.length === 0) break;
        
        allSequences = allSequences.concat(sequences);
        skip += sequences.length;
        console.log(`Fetched ${allSequences.length} sequences so far...`);
        
        if (sequences.length < 100) break;
      }
      
      console.log(`Found ${allSequences.length} total sequences`);
      
      await supabase.from('api_connections').update({
        sync_progress: { 
          ...existingProgress,
          cached_sequences: allSequences.map((s: any) => ({ id: s.id, name: s.name, status: s.status })),
          sequence_index: 0,
          total_sequences: allSequences.length,
          batch_number: batch_number,
        },
      }).eq('id', connection.id);
    } else {
      console.log(`Using cached sequence list: ${allSequences.length} sequences`);
    }

    let startIndex = reset ? 0 : (existingProgress.sequence_index || 0);
    
    // Track debug info for troubleshooting
    let debugInfo: any = {};

    for (let i = startIndex; i < allSequences.length; i++) {
      // ==========================================================
      // FIX: Add heartbeat every 5 sequences to prevent stuck detection
      // ==========================================================
      if (i > 0 && i % 5 === 0) {
        await supabase.from('api_connections').update({
          sync_progress: { 
            cached_sequences: allSequences,
            sequence_index: i, 
            total_sequences: allSequences.length,
            batch_number: batch_number,
            heartbeat: new Date().toISOString(),
            debug_info: debugInfo,
          },
          updated_at: new Date().toISOString(),
        }).eq('id', connection.id);
      }
      
      if (isTimeBudgetExceeded()) {
        console.log(`Time budget exceeded at sequence ${i}/${allSequences.length}. Triggering continuation...`);
        
        // Aggregate metrics before exiting batch (just today for speed)
        const today = new Date().toISOString().split('T')[0];
        try {
          const { data: batchMetrics } = await supabase
            .from('replyio_daily_metrics')
            .select('sent_count, opened_count, clicked_count, replied_count, positive_reply_count, bounced_count')
            .eq('workspace_id', workspace_id)
            .eq('metric_date', today);
          
          if (batchMetrics && batchMetrics.length > 0) {
            const aggregated = batchMetrics.reduce((acc: any, m: any) => ({
              sent_count: acc.sent_count + (m.sent_count || 0),
              opened_count: acc.opened_count + (m.opened_count || 0),
              clicked_count: acc.clicked_count + (m.clicked_count || 0),
              replied_count: acc.replied_count + (m.replied_count || 0),
              positive_reply_count: acc.positive_reply_count + (m.positive_reply_count || 0),
              bounced_count: acc.bounced_count + (m.bounced_count || 0),
            }), { sent_count: 0, opened_count: 0, clicked_count: 0, replied_count: 0, positive_reply_count: 0, bounced_count: 0 });
            
            await supabase.from('replyio_workspace_daily_metrics').upsert({
              workspace_id,
              metric_date: today,
              ...aggregated,
            }, { onConflict: 'workspace_id,metric_date' });
          }
        } catch (e) {
          console.error('Error aggregating batch metrics:', e);
        }
        
      // ============================================================
      // FIX: Update last_sync_at on each batch to prevent "stuck" detection
      // ============================================================
      await supabase.from('api_connections').update({
        sync_progress: { 
          cached_sequences: allSequences,
          sequence_index: i, 
          total_sequences: allSequences.length,
          batch_number: batch_number,
          heartbeat: new Date().toISOString(),
          debug_info: debugInfo,
        },
        sync_status: 'partial',
        last_sync_at: new Date().toISOString(), // Update per batch!
        updated_at: new Date().toISOString(),
      }).eq('id', connection.id);

        const shouldContinue = auto_continue || batch_number === 1 || triggered_by === 'smartlead-complete';
        if (shouldContinue) {
          // FIX #2: Use service key for continuation, not user token
          EdgeRuntime.waitUntil(
            triggerNextBatch(supabaseUrl, supabaseServiceKey, workspace_id, batch_number + 1)
          );
        }

        return new Response(JSON.stringify({
          success: true,
          complete: false,
          progress,
          current: i,
          total: allSequences.length,
          batch_number,
          message: `Processed ${i}/${allSequences.length} sequences. ${shouldContinue ? 'Auto-continuing...' : 'Run again to continue.'}`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const sequence = allSequences[i];
      console.log(`[${i + 1}/${allSequences.length}] Processing: ${sequence.name} (${sequence.status})`);

      try {
        // Upsert sequence as campaign
        const { data: campaign, error: campError } = await supabase
          .from('replyio_campaigns')
          .upsert({
            workspace_id,
            platform_id: String(sequence.id),
            name: sequence.name,
            status: mapSequenceStatus(sequence.status),
          }, { onConflict: 'workspace_id,platform_id' })
          .select('id')
          .single();

        if (campError) {
          console.error(`Failed to upsert sequence ${sequence.name}:`, campError.message);
          progress.errors.push(`Sequence ${sequence.name}: ${campError.message}`);
          continue;
        }

        const campaignId = campaign.id;
        progress.sequences_synced++;

        let metricsStored = false;
        let variantsStored = false;

        const extractSteps = (resp: any): any[] => {
          if (!resp) return [];
          if (Array.isArray(resp)) return resp;
          if (Array.isArray(resp.steps)) return resp.steps;
          if (Array.isArray(resp.emails)) return resp.emails;
          if (Array.isArray(resp.items)) return resp.items;
          if (Array.isArray(resp.data)) return resp.data;
          if (resp.data && Array.isArray(resp.data.steps)) return resp.data.steps;
          if (resp.data && Array.isArray(resp.data.emails)) return resp.data.emails;
          // Check for sequence object that has emails
          if (resp.sequence && Array.isArray(resp.sequence.emails)) return resp.sequence.emails;
          return [];
        };
        
        // Store debug info for first sequence only
        const shouldDebug = i === startIndex;

        // ==========================================================
        // FIX #1: Completely rewritten variant extraction
        // Properly handles v3 nested templates array and skips non-email steps
        // ==========================================================
        const upsertStepsAsVariants = async (steps: any[], source: string) => {
          if (!steps.length) return false;
          console.log(`  ${source} Found ${steps.length} step(s)`);
          
          // Log first step structure for debugging
          if (steps[0]) {
            console.log(`  ${source} Step 0 keys:`, Object.keys(steps[0]).join(', '));
            if (steps[0].templates) {
              console.log(`  ${source} Step 0 has templates array with ${steps[0].templates.length} item(s)`);
              if (steps[0].templates[0]) {
                console.log(`  ${source} Template 0 keys:`, Object.keys(steps[0].templates[0]).join(', '));
              }
            }
          }

          let storedAny = false;
          for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
            const step = steps[stepIdx];
            
            // ==========================================================
            // FIX #1a: Skip non-email steps (LinkedIn, calls, tasks, etc.)
            // ==========================================================
            const stepType = (step.type || step.stepType || step.channelType || '').toLowerCase();
            if (stepType && !['email', 'e-mail', 'manual_email', ''].includes(stepType)) {
              console.log(`  Skipping non-email step ${stepIdx + 1} (type: ${stepType})`);
              continue;
            }
            
            // ==========================================================
            // FIX #1b: v3 API nests templates inside step.templates[]
            // Format: [{ id, type, templates: [{id, subject, body}], ... }]
            // Must check templates FIRST, then emails, then step itself
            // ==========================================================
            let templates: any[] = [];
            
            if (step.templates && Array.isArray(step.templates) && step.templates.length > 0) {
              templates = step.templates;
              console.log(`  Step ${stepIdx + 1}: Found ${templates.length} nested templates`);
            } else if (step.emails && Array.isArray(step.emails) && step.emails.length > 0) {
              templates = step.emails;
              console.log(`  Step ${stepIdx + 1}: Found ${templates.length} nested emails`);
            } else if (step.subject || step.body || step.emailSubject || step.emailBody) {
              // Step itself is the template (v1/v2 format)
              templates = [step];
              console.log(`  Step ${stepIdx + 1}: Using step as template (flat format)`);
            } else {
              console.log(`  Skipping step ${stepIdx + 1}: no templates/subject/body found`);
              console.log(`    Step fields: ${Object.keys(step).join(', ')}`);
              continue;
            }
            
            for (let tplIdx = 0; tplIdx < templates.length; tplIdx++) {
              const tpl = templates[tplIdx];
              
              if (!tpl) {
                console.log(`  Skipping null template at index ${tplIdx}`);
                continue;
              }
              
              // Log template structure for first one
              if (stepIdx === 0 && tplIdx === 0) {
                console.log(`  First template all keys:`, Object.keys(tpl).join(', '));
                console.log(`  First template sample:`, JSON.stringify(tpl).substring(0, 300));
              }

              // Extract subject - try all possible field names
              const subject = tpl.subject 
                || tpl.emailSubject 
                || tpl.title 
                || tpl.subjectLine 
                || tpl.email_subject
                || (typeof tpl === 'string' ? '' : '');
                
              // Extract body - try all possible field names
              const body = tpl.body 
                || tpl.emailBody 
                || tpl.text 
                || tpl.content 
                || tpl.template 
                || tpl.html
                || tpl.email_body
                || (typeof tpl === 'string' ? tpl : '');
              
              // Skip if truly no content
              if (!subject && !body) {
                console.log(`  Skipping step ${stepIdx + 1} template ${tplIdx + 1}: empty subject AND body`);
                continue;
              }

              const vars = extractPersonalizationVars(`${subject} ${body}`);
              const wordCount = String(body).split(/\s+/).filter(Boolean).length;
              
              // Build unique platform variant ID
              const templateId = tpl.id || tpl.templateId || tpl.template_id;
              const stepId = step.id || step.stepId || step.step_id;
              const platformVariantId = templateId 
                ? `tpl-${templateId}` 
                : stepId 
                  ? `step-${stepId}-${tplIdx}` 
                  : `step-${stepIdx + 1}-tpl-${tplIdx + 1}`;

              const { error: varErr } = await supabase
                .from('replyio_variants')
                .upsert({
                  campaign_id: campaignId,
                  platform_variant_id: platformVariantId,
                  name: tpl.name || step.name || step.title || `Step ${stepIdx + 1}${templates.length > 1 ? ` Variant ${tplIdx + 1}` : ''}`,
                  variant_type: 'email',
                  subject_line: String(subject).substring(0, 500),
                  body_preview: String(body).substring(0, 500),
                  email_body: String(body),
                  word_count: wordCount,
                  personalization_vars: vars,
                  is_control: tplIdx === 0,
                }, { onConflict: 'campaign_id,platform_variant_id' });

              if (varErr) {
                console.error(`    Failed to upsert variant ${platformVariantId}:`, varErr.message);
              } else {
                progress.variants_synced++;
                storedAny = true;
                console.log(`    ✓ Stored: ${platformVariantId} - "${String(subject).substring(0, 40)}..."`);
              }
            }
          }

          if (storedAny) {
            variantsStored = true;
            console.log(`  ✓ ${source} Variants complete (batch total: ${progress.variants_synced})`);
          }

          return storedAny;
        };

        // Try v3 templates endpoints first (best data quality)
        try {
          const tryEndpoints = [
            { endpoint: `/sequences/${sequence.id}/steps`, label: 'v3 /sequences/{id}/steps' },
            { endpoint: `/sequences/${sequence.id}/templates`, label: 'v3 /sequences/{id}/templates' },
            { endpoint: `/sequences/${sequence.id}`, label: 'v3 /sequences/{id}' },
          ];

          for (const t of tryEndpoints) {
            try {
              const resp = await replyioRequest(t.endpoint, apiKey, { retries: 1, allow404: true, delayMs: RATE_LIMIT_DELAY_LIST });
              
              // Store debug info for first sequence
              if (shouldDebug && resp && !variantsStored) {
                debugInfo[t.label] = {
                  response_keys: Object.keys(resp || {}),
                  response_sample: JSON.stringify(resp).substring(0, 800),
                  is_array: Array.isArray(resp),
                };
                const respStr = JSON.stringify(resp).substring(0, 600);
                console.log(`  ${t.label} response sample:`, respStr);
              }
              
              const steps = extractSteps(resp);
              if (steps.length) {
                if (shouldDebug) {
                  debugInfo[`${t.label}_steps`] = {
                    count: steps.length,
                    first_step_keys: steps[0] ? Object.keys(steps[0]) : [],
                    first_step_has_templates: !!(steps[0]?.templates),
                    first_step_templates_count: steps[0]?.templates?.length || 0,
                  };
                }
                const stored = await upsertStepsAsVariants(steps, t.label);
                if (stored) break;
              }
            } catch (e) {
              console.log(`  ${t.label} failed:`, (e as Error).message);
              if (shouldDebug) {
                debugInfo[`${t.label}_error`] = (e as Error).message;
              }
            }
          }
        } catch (e) {
          console.error('  v3 templates fetch error:', (e as Error).message);
        }

        // Try v2 API if v3 didn't yield variants
        if (!variantsStored) {
          try {
            const seqDetails = await replyioRequest(
              `/sequences/${sequence.id}`,
              apiKey,
              { retries: 2, allow404: true, delayMs: RATE_LIMIT_DELAY_STATS, useV2: true }
            );

            if (seqDetails) {
              if (i === startIndex) {
                const fullResp = JSON.stringify(seqDetails).substring(0, 800);
                console.log(`  v2 API response:`, fullResp);
              }

              const steps = extractSteps(seqDetails);
              if (steps.length > 0) {
                await upsertStepsAsVariants(steps, 'v2 /sequences/{id}');
              }
            }
          } catch (e) {
            console.error(`  v2 API error:`, (e as Error).message);
          }
        }

        // ==========================================================
        // FIX #3: Store CUMULATIVE metrics + calculate daily deltas
        // Reply.io v1 returns lifetime totals, not daily
        // ==========================================================
        try {
          const seqDetailsRaw = await replyioRequest(
            `/campaigns?id=${sequence.id}`,
            apiKey,
            { retries: 2, allow404: true, delayMs: RATE_LIMIT_DELAY_STATS, useV1: true }
          );
          
          const seqDetails = Array.isArray(seqDetailsRaw) ? seqDetailsRaw[0] : seqDetailsRaw;
          
          if (seqDetails) {
            const today = new Date().toISOString().split('T')[0];
            const stats = seqDetails.stats || seqDetails.statistics || seqDetails.counters || {};
            
            // Extract lifetime totals (current cumulative values)
            const totalSent = Number(stats.deliveredContacts ?? stats.delivered ?? seqDetails.deliveredContacts ?? seqDetails.delivered ?? 0);
            const totalOpened = Number(stats.openedContacts ?? stats.opened ?? seqDetails.openedContacts ?? seqDetails.opened ?? 0);
            const totalClicked = Number(stats.clickedContacts ?? stats.clicked ?? seqDetails.clickedContacts ?? seqDetails.clicked ?? 0);
            const totalReplied = Number(stats.repliedContacts ?? stats.replied ?? seqDetails.repliedContacts ?? seqDetails.replied ?? 0);
            const totalBounced = Number(stats.bouncedContacts ?? stats.bounced ?? seqDetails.bouncedContacts ?? seqDetails.bounced ?? 0);
            const totalInterested = Number(stats.interestedContacts ?? stats.interested ?? seqDetails.interestedContacts ?? seqDetails.interested ?? 0);
            
            console.log(`  v1 Lifetime totals: sent=${totalSent}, opens=${totalOpened}, replies=${totalReplied}`);
            
            // Get previous cumulative values to calculate delta
            const { data: prevCumulative } = await supabase
              .from('replyio_campaign_cumulative')
              .select('*')
              .eq('campaign_id', campaignId)
              .single();
            
            // Calculate daily delta (new activity since last sync)
            const deltaSent = Math.max(0, totalSent - (prevCumulative?.total_sent || 0));
            const deltaOpened = Math.max(0, totalOpened - (prevCumulative?.total_opened || 0));
            const deltaClicked = Math.max(0, totalClicked - (prevCumulative?.total_clicked || 0));
            const deltaReplied = Math.max(0, totalReplied - (prevCumulative?.total_replied || 0));
            const deltaBounced = Math.max(0, totalBounced - (prevCumulative?.total_bounced || 0));
            const deltaInterested = Math.max(0, totalInterested - (prevCumulative?.total_interested || 0));
            
            console.log(`  Daily delta: sent=${deltaSent}, opens=${deltaOpened}, replies=${deltaReplied}`);
            
            // Store cumulative values for next comparison
            await supabase.from('replyio_campaign_cumulative').upsert({
              campaign_id: campaignId,
              workspace_id,
              total_sent: totalSent,
              total_opened: totalOpened,
              total_clicked: totalClicked,
              total_replied: totalReplied,
              total_bounced: totalBounced,
              total_interested: totalInterested,
              last_synced_at: new Date().toISOString(),
            }, { onConflict: 'campaign_id' });
            
            // Store daily delta (or full amount on first sync)
            const isFirstSync = !prevCumulative;
            const { error: metricsErr } = await supabase.from('replyio_daily_metrics').upsert({
              workspace_id,
              campaign_id: campaignId,
              metric_date: today,
              sent_count: isFirstSync ? totalSent : deltaSent,
              opened_count: isFirstSync ? totalOpened : deltaOpened,
              clicked_count: isFirstSync ? totalClicked : deltaClicked,
              replied_count: isFirstSync ? totalReplied : deltaReplied,
              positive_reply_count: isFirstSync ? totalInterested : deltaInterested,
              bounced_count: isFirstSync ? totalBounced : deltaBounced,
            }, { onConflict: 'campaign_id,metric_date' });

            if (!metricsErr) {
              progress.metrics_created++;
              metricsStored = true;
              console.log(`  ✓ Metrics stored (${isFirstSync ? 'first sync - full totals' : 'delta'})`);
            }

            // Also try v1 email templates if we still don't have variants
            if (!variantsStored) {
              // Check multiple possible locations for email templates
              const emailsFromEmails = seqDetails.emails || [];
              const emailsFromSteps = seqDetails.steps || [];
              const emailsFromSequence = seqDetails.sequence?.emails || [];
              
              const steps = emailsFromEmails.length > 0 
                ? emailsFromEmails 
                : emailsFromSteps.length > 0 
                  ? emailsFromSteps 
                  : emailsFromSequence;
                  
              if (shouldDebug) {
                debugInfo['v1_emails'] = {
                  has_emails: emailsFromEmails.length > 0,
                  has_steps: emailsFromSteps.length > 0,
                  has_sequence_emails: emailsFromSequence.length > 0,
                  selected_count: steps.length,
                  first_email_keys: steps[0] ? Object.keys(steps[0]) : [],
                };
              }
              
              if (steps.length > 0) {
                console.log(`  v1 Found ${steps.length} email templates`);
                await upsertStepsAsVariants(steps, 'v1 /campaigns');
              } else {
                console.log(`  v1 No email templates found. Response keys: ${Object.keys(seqDetails).join(', ')}`);
              }
            }
          }
        } catch (e) {
          console.error(`  v1 API error:`, (e as Error).message);
          if (shouldDebug) {
            debugInfo['v1_error'] = (e as Error).message;
          }
        }

        // Fallback to v3 statistics endpoint
        if (!metricsStored) {
          try {
            const stats = await replyioRequest(
              `/statistics/sequences/${sequence.id}`, 
              apiKey, 
              { retries: 2, allow404: true, delayMs: RATE_LIMIT_DELAY_STATS }
            );
            
            if (stats) {
              const today = new Date().toISOString().split('T')[0];
              const sentCount = stats.deliveredContacts ?? stats.delivered ?? stats.sent ?? 0;
              const repliedCount = stats.repliedContacts ?? stats.replied ?? stats.replies ?? 0;
              
              if (sentCount > 0 || repliedCount > 0) {
                await supabase.from('replyio_daily_metrics').upsert({
                  workspace_id,
                  campaign_id: campaignId,
                  metric_date: today,
                  sent_count: sentCount,
                  opened_count: stats.openedContacts ?? stats.opened ?? 0,
                  clicked_count: stats.clickedContacts ?? stats.clicked ?? 0,
                  replied_count: repliedCount,
                  positive_reply_count: stats.interestedContacts ?? stats.interested ?? 0,
                  bounced_count: stats.bouncedContacts ?? stats.bounced ?? 0,
                }, { onConflict: 'campaign_id,metric_date' });
                progress.metrics_created++;
              }
            }
          } catch (e) {
            console.error(`  v3 Stats error:`, (e as Error).message);
          }
        }

        // Fetch contacts with replies
        if (!isTimeBudgetExceeded()) {
          try {
            let contactsSkip = 0;
            let hasMoreContacts = true;
            let repliesForSequence = 0;
            
            while (hasMoreContacts && !isTimeBudgetExceeded() && contactsSkip < 500) {
              const contactsResponse = await replyioRequest(
                `/sequences/${sequence.id}/contacts/extended?top=100&skip=${contactsSkip}&additionalColumns=CurrentStep,LastStepCompletedAt,Status`,
                apiKey,
                { delayMs: RATE_LIMIT_DELAY_CONTACTS, allow404: true }
              );
              
              if (!contactsResponse || !contactsResponse.items || contactsResponse.items.length === 0) {
                hasMoreContacts = false;
                break;
              }
              
              const contacts = contactsResponse.items;
              const repliedContacts = contacts.filter((c: any) => c.status?.replied === true);
              
              if (repliedContacts.length > 0) {
                for (const contact of repliedContacts) {
                  const messageId = `reply-${sequence.id}-${contact.email}-${contact.lastStepCompletedAt || contact.addedAt}`;
                  
                  let eventType = 'replied';
                  let sentiment = 'neutral';
                  if (contact.status?.interested) {
                    eventType = 'positive_reply';
                    sentiment = 'positive';
                  } else if (contact.status?.notInterested) {
                    eventType = 'negative_reply';
                    sentiment = 'negative';
                  }
                  
                  const { error: eventErr } = await supabase
                    .from('replyio_message_events')
                    .upsert({
                      workspace_id,
                      campaign_id: campaignId,
                      event_type: eventType,
                      message_id: messageId,
                      reply_sentiment: sentiment,
                      event_timestamp: contact.lastStepCompletedAt || contact.addedAt || new Date().toISOString(),
                    }, { onConflict: 'workspace_id,campaign_id,message_id' });
                  
                  if (!eventErr) {
                    repliesForSequence++;
                    progress.replies_synced++;
                  }
                }
              }
              
              hasMoreContacts = contactsResponse.info?.hasMore === true;
              contactsSkip += contacts.length;
              
              if (contacts.length < 100) hasMoreContacts = false;
            }
            
            if (repliesForSequence > 0) {
              console.log(`  ✓ Synced ${repliesForSequence} reply events`);
            }
          } catch (e) {
            console.error(`  Error fetching contacts:`, (e as Error).message);
          }
        }

      } catch (e) {
        console.error(`Error processing sequence ${sequence.name}:`, e);
        progress.errors.push(`Sequence ${sequence.name}: ${(e as Error).message}`);
      }
    }

    // ==========================================================
    // FIX #5: Full workspace aggregation for all dates
    // ==========================================================
    await aggregateWorkspaceMetrics(supabase, workspace_id);

    // Sync complete
    console.log('=== Reply.io sync complete ===');
    console.log(`Final stats: ${progress.sequences_synced} sequences, ${progress.metrics_created} metrics, ${progress.variants_synced} variants, ${progress.replies_synced} replies`);
    
    await supabase.from('api_connections').update({
      sync_status: 'idle', // Use 'idle' to stop frontend polling
      sync_progress: { 
        complete: true,
        sequences_synced: progress.sequences_synced,
        metrics_created: progress.metrics_created,
        variants_synced: progress.variants_synced,
        replies_synced: progress.replies_synced,
        debug_info: debugInfo, // Store debug info for troubleshooting
        completed_at: new Date().toISOString(),
      },
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id);

    // Trigger analysis with service key
    EdgeRuntime.waitUntil(triggerAnalysis(supabaseUrl, supabaseServiceKey, workspace_id));

    return new Response(JSON.stringify({
      success: true,
      complete: true,
      progress,
      message: `Synced ${progress.sequences_synced} sequences, ${progress.metrics_created} metrics, ${progress.variants_synced} variants, ${progress.replies_synced} replies`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('replyio-sync error:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message,
      stack: (error as Error).stack,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
