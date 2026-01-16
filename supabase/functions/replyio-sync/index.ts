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
// Reply.io v1 API for certain endpoints, v3 for others
const REPLYIO_V1_URL = 'https://api.reply.io/v1';
const REPLYIO_V2_URL = 'https://api.reply.io/v2';
const REPLYIO_V3_URL = 'https://api.reply.io/v3';

// Reply.io Rate Limit: 10 seconds between API calls, 15,000 requests/month
const RATE_LIMIT_DELAY_LIST = 2000;  // 2 seconds for listing endpoints
const RATE_LIMIT_DELAY_STATS = 1000; // 1 second for stats
const TIME_BUDGET_MS = 50000;
const MAX_BATCHES = 50;

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

// Extract personalization variables from email content
function extractPersonalizationVars(content: string): string[] {
  const varPatterns = [
    /\{\{([^}]+)\}\}/g,  // {{variable}}
    /\{([^}]+)\}/g,       // {variable}
    /\[\[([^\]]+)\]\]/g,  // [[variable]]
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

// Self-continuation function
async function triggerNextBatch(
  supabaseUrl: string,
  authToken: string,
  workspaceId: string,
  batchNumber: number
) {
  console.log(`Triggering next Reply.io batch (${batchNumber}) via self-continuation...`);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/replyio-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        reset: false,
        batch_number: batchNumber,
        auto_continue: true,
      }),
    });
    console.log(`Next batch triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger next batch:', error);
  }
}

// Trigger analysis functions when sync completes
async function triggerAnalysis(
  supabaseUrl: string,
  authToken: string,
  workspaceId: string
) {
  console.log('Sync complete - triggering analysis functions...');
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/backfill-features`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken,
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
        'Authorization': authToken,
      },
      body: JSON.stringify({ workspace_id: workspaceId }),
    });
    console.log(`compute-patterns triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger compute-patterns:', error);
  }
}

Deno.serve(async (req) => {
  console.log('replyio-sync: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await createClient(
      supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { 
      workspace_id, 
      reset = false, 
      batch_number = 1, 
      auto_continue = false,
      triggered_by = null 
    } = await req.json();
    
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (batch_number > MAX_BATCHES) {
      console.error(`Max batch limit (${MAX_BATCHES}) reached. Stopping sync.`);
      return new Response(JSON.stringify({ 
        error: 'Max batch limit reached',
        batch_number,
        message: 'Sync stopped after too many batches. Please check for issues.'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Starting batch ${batch_number}, auto_continue=${auto_continue}, triggered_by=${triggered_by}`);

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
      const campaignIds = campaigns?.map(c => c.id) || [];
      
      if (campaignIds.length > 0) {
        await supabase.from('replyio_daily_metrics').delete().eq('workspace_id', workspace_id);
        await supabase.from('replyio_variants').delete().in('campaign_id', campaignIds);
        await supabase.from('replyio_sequence_steps').delete().in('campaign_id', campaignIds);
        await supabase.from('replyio_campaigns').delete().eq('workspace_id', workspace_id);
      }
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
          cached_sequences: allSequences.map(s => ({ id: s.id, name: s.name, status: s.status })),
          sequence_index: 0,
          total_sequences: allSequences.length,
          batch_number: batch_number,
        },
      }).eq('id', connection.id);
    } else {
      console.log(`Using cached sequence list: ${allSequences.length} sequences`);
    }

    let startIndex = reset ? 0 : (existingProgress.sequence_index || 0);

    for (let i = startIndex; i < allSequences.length; i++) {
      if (isTimeBudgetExceeded()) {
        console.log(`Time budget exceeded at sequence ${i}/${allSequences.length}. Triggering continuation...`);
        
        await supabase.from('api_connections').update({
          sync_progress: { 
            cached_sequences: allSequences,
            sequence_index: i, 
            total_sequences: allSequences.length,
            batch_number: batch_number,
          },
          sync_status: 'partial',
          updated_at: new Date().toISOString(),
        }).eq('id', connection.id);

        const shouldContinue = auto_continue || batch_number === 1 || triggered_by === 'smartlead-complete';
        if (shouldContinue) {
          EdgeRuntime.waitUntil(
            triggerNextBatch(supabaseUrl, authHeader, workspace_id, batch_number + 1)
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

        // ==============================================
        // Try v2 API for sequence details (includes steps)
        // ==============================================
        let metricsStored = false;
        let variantsStored = false;
        
        try {
          const seqDetails = await replyioRequest(
            `/sequences/${sequence.id}`,
            apiKey,
            { retries: 2, allow404: true, delayMs: RATE_LIMIT_DELAY_STATS, useV2: true }
          );
          
          if (seqDetails) {
            console.log(`  v2 API response keys:`, Object.keys(seqDetails).join(', '));
            
            // v2 API returns steps directly in the sequence object
            const steps = seqDetails.steps || seqDetails.emails || [];
            console.log(`  v2 Found ${steps.length} steps/templates`);
            
            if (steps.length > 0) {
              for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
                const step = steps[stepIdx];
                console.log(`    Step ${stepIdx + 1} keys:`, Object.keys(step).join(', '));
                
                // v2 step structure
                const subject = step.subject || step.emailSubject || step.title || '';
                const body = step.body || step.emailBody || step.text || step.content || '';
                const vars = extractPersonalizationVars(subject + ' ' + body);
                const wordCount = body.split(/\s+/).filter(Boolean).length;
                
                const variantData = {
                  campaign_id: campaignId,
                  platform_variant_id: `step-${step.id || step.stepId || stepIdx + 1}`,
                  name: step.name || `Step ${stepIdx + 1}`,
                  variant_type: step.type || 'email',
                  subject_line: subject,
                  body_preview: body.substring(0, 500),
                  email_body: body,
                  word_count: wordCount,
                  personalization_vars: vars,
                  is_control: true,
                };
                
                const { error: varErr } = await supabase.from('replyio_variants')
                  .upsert(variantData, { onConflict: 'campaign_id,platform_variant_id' });
                
                if (varErr) {
                  console.error(`    Failed to upsert variant step ${stepIdx + 1}:`, varErr.message);
                } else {
                  progress.variants_synced++;
                  variantsStored = true;
                }
              }
            }
          }
        } catch (e) {
          console.error(`  v2 API error for ${sequence.name}:`, (e as Error).message);
        }

        // ==============================================
        // Try v1 API for metrics (more reliable for stats)
        // v1 /campaigns?id=X returns an ARRAY with one object, not the object directly!
        // ==============================================
        try {
          const seqDetailsRaw = await replyioRequest(
            `/campaigns?id=${sequence.id}`,
            apiKey,
            { retries: 2, allow404: true, delayMs: RATE_LIMIT_DELAY_STATS, useV1: true }
          );
          
          // Handle v1 response format - it returns an array!
          const seqDetails = Array.isArray(seqDetailsRaw) ? seqDetailsRaw[0] : seqDetailsRaw;
          
          if (seqDetails) {
            // Log ALL fields to understand the response format
            console.log(`  v1 API response type: ${Array.isArray(seqDetailsRaw) ? 'array' : 'object'}`);
            console.log(`  v1 API full response:`, JSON.stringify(seqDetails).substring(0, 800));
            
            const today = new Date().toISOString().split('T')[0];
            
            // Reply.io v1 API field names from actual documentation
            // The API returns fields like: id, name, emails (array), stats (object), etc.
            const stats = seqDetails.stats || seqDetails.statistics || seqDetails;
            
            // Try nested stats object first, then flat fields
            const sentCount = stats.deliveredContacts ?? stats.deliveriesCount ?? stats.delivered ?? 
                              seqDetails.deliveriesCount ?? seqDetails.delivered ?? 
                              seqDetails.totalDelivered ?? seqDetails.emails_sent ?? 
                              seqDetails.sentCount ?? seqDetails.sent ?? 0;
            const repliedCount = stats.repliedContacts ?? stats.repliesCount ?? stats.replied ?? 
                                 seqDetails.repliesCount ?? seqDetails.replied ?? 
                                 seqDetails.totalReplies ?? seqDetails.replies ?? 0;
            const openedCount = stats.openedContacts ?? stats.opensCount ?? stats.opened ?? 
                                seqDetails.opensCount ?? seqDetails.opened ?? 
                                seqDetails.totalOpened ?? seqDetails.opens ?? 0;
            const bouncedCount = stats.bouncedContacts ?? stats.bouncesCount ?? stats.bounced ?? 
                                 seqDetails.bouncesCount ?? seqDetails.bounced ?? 
                                 seqDetails.totalBounced ?? seqDetails.bounces ?? 0;
            const clickedCount = stats.clickedContacts ?? stats.clicksCount ?? stats.clicked ?? 
                                 seqDetails.clicksCount ?? seqDetails.clicked ?? 
                                 seqDetails.totalClicked ?? seqDetails.clicks ?? 0;
            const interestedCount = stats.interestedContacts ?? stats.interestedCount ?? stats.interested ?? 
                                    seqDetails.interestedCount ?? seqDetails.interested ?? 
                                    seqDetails.totalInterested ?? 0;
            
            console.log(`  v1 Extracted metrics: sent=${sentCount}, opens=${openedCount}, replies=${repliedCount}, bounces=${bouncedCount}`);
            
            // ALWAYS store metrics even if zeros - we need the record
            const { error: metricsErr } = await supabase.from('replyio_daily_metrics').upsert({
              workspace_id,
              campaign_id: campaignId,
              metric_date: today,
              sent_count: sentCount,
              opened_count: openedCount,
              clicked_count: clickedCount,
              replied_count: repliedCount,
              positive_reply_count: interestedCount,
              bounced_count: bouncedCount,
            }, { onConflict: 'campaign_id,metric_date' });

            if (metricsErr) {
              console.error(`  Failed to upsert metrics:`, metricsErr.message);
            } else {
              progress.metrics_created++;
              metricsStored = true;
              console.log(`  ✓ v1 Stats stored: sent=${sentCount}, opens=${openedCount}, replies=${repliedCount}`);
            }

            // Try to get steps/templates from v1 response if v2 failed
            if (!variantsStored) {
              // v1 API returns "emails" array with step templates
              const steps = seqDetails.emails || seqDetails.steps || [];
              if (steps.length > 0) {
                console.log(`  v1 Found ${steps.length} email templates`);
                console.log(`  v1 First email keys:`, Object.keys(steps[0]).join(', '));
                
                for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
                  const step = steps[stepIdx];
                  // v1 email template structure
                  const subject = step.subject || step.emailSubject || step.title || '';
                  const body = step.body || step.emailBody || step.text || step.content || step.template || '';
                  const vars = extractPersonalizationVars(subject + ' ' + body);
                  const wordCount = body.split(/\s+/).filter(Boolean).length;
                  
                  if (subject || body) {
                    const { error: varErr } = await supabase.from('replyio_variants').upsert({
                      campaign_id: campaignId,
                      platform_variant_id: `email-${step.id || step.stepId || stepIdx}`,
                      name: step.name || `Email ${stepIdx + 1}`,
                      variant_type: step.type || 'email',
                      subject_line: subject,
                      body_preview: body.substring(0, 500),
                      email_body: body,
                      word_count: wordCount,
                      personalization_vars: vars,
                      is_control: true,
                    }, { onConflict: 'campaign_id,platform_variant_id' });
                    
                    if (varErr) {
                      console.error(`  Failed to upsert v1 variant:`, varErr.message);
                    } else {
                      progress.variants_synced++;
                      variantsStored = true;
                      console.log(`  ✓ v1 Variant stored: ${step.name || `Email ${stepIdx + 1}`}`);
                    }
                  }
                }
              }
            }
          } else {
            console.log(`  v1 API returned no data for sequence ${sequence.id}`);
          }
        } catch (e) {
          console.error(`  v1 API error for ${sequence.name}:`, (e as Error).message);
        }

        // ==============================================
        // Fallback to v3 statistics endpoint for metrics
        // ==============================================
        if (!metricsStored) {
          try {
            const stats = await replyioRequest(
              `/statistics/sequences/${sequence.id}`, 
              apiKey, 
              { retries: 2, allow404: true, delayMs: RATE_LIMIT_DELAY_STATS }
            );
            
            if (stats) {
              console.log(`  v3 Stats response keys:`, Object.keys(stats).join(', '));
              
              const today = new Date().toISOString().split('T')[0];
              const sentCount = stats.deliveredContacts ?? stats.delivered ?? stats.sent ?? 0;
              const repliedCount = stats.repliedContacts ?? stats.replied ?? stats.replies ?? 0;
              const openedCount = stats.openedContacts ?? stats.opened ?? stats.opens ?? 0;
              
              if (sentCount > 0 || repliedCount > 0) {
                const { error: metricsErr } = await supabase.from('replyio_daily_metrics').upsert({
                  workspace_id,
                  campaign_id: campaignId,
                  metric_date: today,
                  sent_count: sentCount,
                  opened_count: openedCount,
                  clicked_count: stats.clickedContacts ?? stats.clicked ?? 0,
                  replied_count: repliedCount,
                  positive_reply_count: stats.interestedContacts ?? stats.interested ?? 0,
                  bounced_count: stats.bouncedContacts ?? stats.bounced ?? 0,
                }, { onConflict: 'campaign_id,metric_date' });

                if (!metricsErr) {
                  progress.metrics_created++;
                  console.log(`  ✓ v3 Stats stored: sent=${sentCount}, replies=${repliedCount}`);
                }
              }
            }
          } catch (e) {
            console.error(`  v3 Stats error for ${sequence.name}:`, (e as Error).message);
          }
        }

      } catch (e) {
        console.error(`Error processing sequence ${sequence.name}:`, e);
        progress.errors.push(`Sequence ${sequence.name}: ${(e as Error).message}`);
      }
    }

    // ==============================================
    // Aggregate daily metrics to workspace level
    // ==============================================
    console.log('=== Aggregating metrics to workspace level ===');
    
    try {
      // Get today's metrics grouped by workspace
      const today = new Date().toISOString().split('T')[0];
      
      const { data: campaignMetrics, error: metricsQueryErr } = await supabase
        .from('replyio_daily_metrics')
        .select('sent_count, opened_count, clicked_count, replied_count, positive_reply_count, bounced_count')
        .eq('workspace_id', workspace_id)
        .eq('metric_date', today);
      
      if (!metricsQueryErr && campaignMetrics && campaignMetrics.length > 0) {
        // Aggregate all campaign metrics
        const aggregated = campaignMetrics.reduce((acc, m) => ({
          sent_count: acc.sent_count + (m.sent_count || 0),
          opened_count: acc.opened_count + (m.opened_count || 0),
          clicked_count: acc.clicked_count + (m.clicked_count || 0),
          replied_count: acc.replied_count + (m.replied_count || 0),
          positive_reply_count: acc.positive_reply_count + (m.positive_reply_count || 0),
          bounced_count: acc.bounced_count + (m.bounced_count || 0),
        }), { sent_count: 0, opened_count: 0, clicked_count: 0, replied_count: 0, positive_reply_count: 0, bounced_count: 0 });
        
        // Upsert to workspace-level metrics
        const { error: wsMetricsErr } = await supabase
          .from('replyio_workspace_daily_metrics')
          .upsert({
            workspace_id,
            metric_date: today,
            ...aggregated,
          }, { onConflict: 'workspace_id,metric_date' });
        
        if (wsMetricsErr) {
          console.error('Failed to upsert workspace metrics:', wsMetricsErr.message);
        } else {
          console.log(`✓ Workspace metrics aggregated: sent=${aggregated.sent_count}, replies=${aggregated.replied_count}`);
        }
      }
    } catch (e) {
      console.error('Error aggregating workspace metrics:', e);
    }

    // All sequences processed - sync complete
    console.log('=== Reply.io sync complete ===');
    console.log(`Final stats: ${progress.sequences_synced} sequences, ${progress.metrics_created} metrics, ${progress.variants_synced} variants`);
    
    await supabase.from('api_connections').update({
      sync_status: 'success',
      sync_progress: { 
        complete: true,
        sequences_synced: progress.sequences_synced,
        metrics_created: progress.metrics_created,
        variants_synced: progress.variants_synced,
      },
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id);

    // Trigger analysis functions
    EdgeRuntime.waitUntil(triggerAnalysis(supabaseUrl, authHeader, workspace_id));

    return new Response(JSON.stringify({
      success: true,
      complete: true,
      progress,
      message: `Synced ${progress.sequences_synced} sequences, ${progress.metrics_created} metrics, ${progress.variants_synced} variants`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('replyio-sync error:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message,
      stack: (error as Error).stack,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
