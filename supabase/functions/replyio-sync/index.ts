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
  };
  return statusMap[status] || status.toLowerCase();
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
  options: { retries?: number; allow404?: boolean; delayMs?: number; useV1?: boolean } = {}
): Promise<any> {
  const { retries = 3, allow404 = false, delayMs = RATE_LIMIT_DELAY_LIST, useV1 = false } = options;
  const baseUrl = useV1 ? REPLYIO_V1_URL : REPLYIO_V3_URL;
  
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

        // Try to get detailed sequence info including steps (v1 API)
        try {
          const seqDetails = await replyioRequest(
            `/campaigns?id=${sequence.id}`,
            apiKey,
            { retries: 2, allow404: true, delayMs: RATE_LIMIT_DELAY_STATS, useV1: true }
          );
          
          console.log(`  v1 API response for seq ${sequence.id}:`, JSON.stringify(seqDetails).substring(0, 200));
          
          if (seqDetails) {
            // Store metrics from v1 API (these fields are typically populated)
            const today = new Date().toISOString().split('T')[0];
            const sentCount = seqDetails.deliveriesCount || seqDetails.delivered || 0;
            const repliedCount = seqDetails.repliesCount || seqDetails.replied || 0;
            const openedCount = seqDetails.opensCount || seqDetails.opened || 0;
            const bouncedCount = seqDetails.bouncesCount || seqDetails.bounced || 0;
            const clickedCount = seqDetails.clicksCount || seqDetails.clicked || 0;
            
            if (sentCount > 0 || repliedCount > 0 || openedCount > 0) {
              await supabase.from('replyio_daily_metrics').upsert({
                workspace_id,
                campaign_id: campaignId,
                metric_date: today,
                sent_count: sentCount,
                opened_count: openedCount,
                clicked_count: clickedCount,
                replied_count: repliedCount,
                positive_reply_count: seqDetails.interestedCount || 0,
                bounced_count: bouncedCount,
              }, { onConflict: 'campaign_id,metric_date' });

              progress.metrics_created++;
              console.log(`  v1 Stats synced: sent=${sentCount}, opens=${openedCount}, replies=${repliedCount}`);
            } else {
              console.log(`  No meaningful metrics from v1 API for ${sequence.name}`);
            }

            // Try to get email templates/steps from v1 details
            const steps = seqDetails.steps || seqDetails.emails || [];
            if (steps.length > 0) {
              console.log(`  Found ${steps.length} steps/templates`);
              
              for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
                const step = steps[stepIdx];
                const subject = step.subject || step.emailSubject || '';
                const body = step.body || step.emailBody || step.text || '';
                const vars = extractPersonalizationVars(subject + ' ' + body);
                const wordCount = body.split(/\s+/).filter(Boolean).length;
                
                await supabase.from('replyio_variants').upsert({
                  campaign_id: campaignId,
                  platform_variant_id: `step-${step.id || stepIdx}`,
                  name: `Step ${stepIdx + 1}`,
                  subject_line: subject,
                  body_preview: body.substring(0, 500),
                  email_body: body,
                  word_count: wordCount,
                  personalization_vars: vars,
                  step_number: stepIdx + 1,
                  is_control: true,
                }, { onConflict: 'campaign_id,platform_variant_id' });
                
                progress.variants_synced++;
              }
            }
          }
        } catch (e) {
          console.error(`  v1 API error for ${sequence.name}:`, (e as Error).message);
        }

        // Fallback: If no metrics from v1, try v3 statistics endpoint
        if (progress.metrics_created === 0 || !existingProgress.has_v1_metrics) {
          try {
            const stats = await replyioRequest(
              `/statistics/sequences/${sequence.id}`, 
              apiKey, 
              { retries: 2, allow404: true, delayMs: RATE_LIMIT_DELAY_STATS }
            );
            
            if (stats) {
              const today = new Date().toISOString().split('T')[0];
              const sentCount = stats.deliveredContacts || stats.delivered || 0;
              const repliedCount = stats.repliedContacts || stats.replied || 0;
              
              if (sentCount > 0 || repliedCount > 0) {
                await supabase.from('replyio_daily_metrics').upsert({
                  workspace_id,
                  campaign_id: campaignId,
                  metric_date: today,
                  sent_count: sentCount,
                  opened_count: stats.openedContacts || stats.opened || 0,
                  clicked_count: stats.clickedContacts || stats.clicked || 0,
                  replied_count: repliedCount,
                  positive_reply_count: stats.interestedContacts || stats.interested || 0,
                  bounced_count: stats.bouncedContacts || stats.bounced || 0,
                }, { onConflict: 'campaign_id,metric_date' });

                progress.metrics_created++;
                console.log(`  v3 Stats synced: sent=${sentCount}, replies=${repliedCount}`);
              }
            }
          } catch (e) {
            console.error(`  v3 Stats error for ${sequence.name}:`, (e as Error).message);
          }
        }

      } catch (e) {
        console.error(`Error processing sequence ${sequence.name}:`, e);
        progress.errors.push(`${sequence.name}: ${(e as Error).message}`);
      }
    }

    // Sync complete
    await supabase.from('api_connections').update({
      sync_status: 'success',
      sync_progress: { completed: true, total_sequences: allSequences.length },
      last_sync_at: new Date().toISOString(),
      last_full_sync_at: new Date().toISOString(),
    }).eq('id', connection.id);

    console.log('Reply.io sync complete:', progress);

    if (auto_continue || triggered_by === 'smartlead-complete') {
      EdgeRuntime.waitUntil(
        triggerAnalysis(supabaseUrl, authHeader, workspace_id)
      );
    }

    return new Response(JSON.stringify({
      success: true,
      complete: true,
      progress,
      message: `Synced ${progress.sequences_synced} sequences, ${progress.variants_synced} variants, ${progress.metrics_created} metrics`,
      next: 'Triggering analysis functions...',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('replyio-sync error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
