import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime global for Supabase Edge Functions
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';
// SmartLead Rate Limit: 10 requests per 2 seconds = 5 req/s
// Using 250ms delay = 4 req/s to stay safely within limits
const RATE_LIMIT_DELAY = 250;
const BATCH_SIZE = 20;
const TIME_BUDGET_MS = 55000;
const MAX_BATCHES = 25; // Safety limit to prevent infinite loops
const MAX_HISTORICAL_DAYS = 730; // 2 years max lookback
const HISTORICAL_CHUNK_DAYS = 90; // Process history in 90-day chunks

interface SmartleadCampaign {
  id: number;
  name: string;
  status: string;
  created_at: string;
}

interface SmartleadAnalytics {
  sent_count: number;
  unique_sent_count: number;
  open_count: number;
  unique_open_count: number;
  click_count: number;
  unique_click_count: number;
  reply_count: number;
  bounce_count: number;
  unsubscribe_count: number;
}

interface SmartleadEmailAccount {
  id: number;
  from_email: string;
  from_name: string;
  message_per_day: number;
  warmup_details?: { status: string };
}

interface SmartleadSequence {
  seq_id: number;
  seq_number: number;
  subject: string;
  email_body: string;
  seq_delay_details?: { delay_in_days: number };
  sequence_variants?: Array<{
    variant_id: string;
    subject: string;
    email_body: string;
  }>;
}

// Day-wise analytics response from SmartLead
interface SmartleadDailyAnalytics {
  date: string;
  sent: number;
  unique_sent?: number;
  open: number;
  unique_open?: number;
  click: number;
  unique_click?: number;
  reply: number;
  bounce: number;
  unsubscribe?: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function smartleadRequest(endpoint: string, apiKey: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    await delay(RATE_LIMIT_DELAY);
    const url = `${SMARTLEAD_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}`;
    console.log(`Fetching: ${endpoint}`);
    
    try {
      const response = await fetch(url);
      
      if (response.status === 429) {
        console.log(`Rate limited, waiting ${(i + 1) * 2} seconds...`);
        await delay((i + 1) * 2000);
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error ${response.status}: ${errorText}`);
        if (i === retries - 1) throw new Error(`Smartlead API error (${response.status}): ${errorText}`);
        continue;
      }
      
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retry ${i + 1}/${retries} after error:`, error);
      await delay(1000 * (i + 1));
    }
  }
}

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

// Self-continuation function using EdgeRuntime.waitUntil
async function triggerNextBatch(
  supabaseUrl: string,
  anonKey: string,
  authToken: string,
  workspaceId: string,
  batchNumber: number
) {
  console.log(`Triggering next batch (${batchNumber}) via self-continuation...`);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/smartlead-sync`, {
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

// Chain to Reply.io sync when SmartLead completes
async function triggerReplyioSync(
  supabaseUrl: string,
  anonKey: string,
  authToken: string,
  workspaceId: string
) {
  console.log('SmartLead sync complete - triggering Reply.io sync...');
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
        triggered_by: 'smartlead-complete',
        auto_continue: true,
      }),
    });
    console.log(`Reply.io sync triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger Reply.io sync:', error);
  }
}

// Continue historical backfill in a new invocation
async function triggerHistoricalContinuation(
  supabaseUrl: string,
  authToken: string,
  workspaceId: string,
  chunkIndex: number,
  totalChunks: number
) {
  console.log(`Triggering historical chunk ${chunkIndex + 1}/${totalChunks}...`);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/smartlead-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        reset: false,
        backfill_historical: true,
        historical_chunk_index: chunkIndex,
        auto_continue: true,
      }),
    });
    console.log(`Historical continuation triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger historical continuation:', error);
  }
}

// Generate date chunks for historical backfill
function generateDateChunks(startDate: Date, endDate: Date, chunkDays: number): Array<{start: string, end: string}> {
  const chunks: Array<{start: string, end: string}> = [];
  let chunkStart = new Date(startDate);
  
  while (chunkStart < endDate) {
    const chunkEnd = new Date(Math.min(
      chunkStart.getTime() + chunkDays * 24 * 60 * 60 * 1000,
      endDate.getTime()
    ));
    
    chunks.push({
      start: chunkStart.toISOString().split('T')[0],
      end: chunkEnd.toISOString().split('T')[0]
    });
    
    // Move to next day after chunk end
    chunkStart = new Date(chunkEnd.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return chunks;
}

serve(async (req) => {
  console.log('smartlead-sync: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('smartlead-sync: Missing authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await createClient(
      supabaseUrl, anonKey,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) throw new Error('Unauthorized');

    const { 
      workspace_id, 
      reset = false, 
      batch_number = 1, 
      auto_continue = false,
      backfill_historical = false,  // Flag to only fetch historical data
      full_backfill = false,        // Fetch ALL historical data (up to 2 years)
      historical_chunk_index = 0,   // Which chunk of historical data to process
    } = await req.json();
    if (!workspace_id) throw new Error('workspace_id is required');

    // Safety check for max batches
    if (batch_number > MAX_BATCHES) {
      console.error(`Max batch limit (${MAX_BATCHES}) reached. Stopping sync.`);
      return new Response(JSON.stringify({ 
        error: 'Max batch limit reached',
        batch_number,
        message: 'Sync stopped after too many batches. Please check for issues.'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Starting batch ${batch_number}, auto_continue=${auto_continue}, backfill_historical=${backfill_historical}, full_backfill=${full_backfill}, chunk=${historical_chunk_index}`);

    const { data: membership } = await supabase
      .from('workspace_members').select('role')
      .eq('workspace_id', workspace_id).eq('user_id', user.id).single();
    if (!membership) throw new Error('Access denied to workspace');

    const { data: connection, error: connError } = await supabase
      .from('api_connections').select('id, api_key_encrypted, sync_progress, sync_status')
      .eq('workspace_id', workspace_id).eq('platform', 'smartlead').eq('is_active', true).single();
    if (connError || !connection) throw new Error('No active Smartlead connection found');

    const apiKey = connection.api_key_encrypted;

    // Handle reset - clear all synced data
    if (reset) {
      console.log('Resetting SmartLead sync data for workspace:', workspace_id);
      const { data: campaigns } = await supabase.from('smartlead_campaigns').select('id').eq('workspace_id', workspace_id);
      const campaignIds = campaigns?.map(c => c.id) || [];
      
      if (campaignIds.length > 0) {
        await supabase.from('smartlead_daily_metrics').delete().eq('workspace_id', workspace_id);
        await supabase.from('smartlead_variants').delete().in('campaign_id', campaignIds);
        await supabase.from('smartlead_sequence_steps').delete().in('campaign_id', campaignIds);
        await supabase.from('smartlead_campaigns').delete().eq('workspace_id', workspace_id);
      }
      await supabase.from('email_accounts').delete().eq('workspace_id', workspace_id).eq('platform', 'smartlead');
      // Also clear workspace-level historical metrics
      await supabase.from('smartlead_workspace_daily_metrics').delete().eq('workspace_id', workspace_id);
      console.log('Reset complete');
    }

    await supabase.from('api_connections').update({ 
      sync_status: 'syncing',
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id);

    const progress = {
      campaigns_synced: 0,
      email_accounts_synced: 0,
      metrics_created: 0,
      variants_synced: 0,
      historical_days: 0,
      historical_chunks_processed: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;

    // ============================================
    // PHASE 1: Fetch Historical Day-Wise Statistics
    // ============================================
    const existingProgress = (connection.sync_progress as any) || {};
    const shouldFetchHistorical = batch_number === 1 || backfill_historical || full_backfill || !existingProgress.historical_complete;
    
    if (shouldFetchHistorical) {
      console.log('=== PHASE 1: Fetching historical day-wise statistics ===');
      
      // First, get all campaign IDs from the API
      const allCampaigns: SmartleadCampaign[] = await smartleadRequest('/campaigns', apiKey);
      console.log(`Found ${allCampaigns.length} campaigns for historical fetch`);
      
      if (allCampaigns.length === 0) {
        console.log('No campaigns found - skipping historical fetch');
      } else {
        const campaignPlatformIds = allCampaigns.map(c => c.id);
        
        // Calculate date range based on earliest campaign or max lookback
        const endDate = new Date();
        let historicalStartDate: Date;
        
        if (full_backfill || backfill_historical) {
          // Find the earliest campaign created_at
          const earliestCampaign = allCampaigns.reduce((earliest, c) => {
            if (!c.created_at) return earliest;
            const cDate = new Date(c.created_at);
            return cDate < earliest ? cDate : earliest;
          }, new Date());
          
          // Use earliest campaign date or 2 years ago (whichever is more recent)
          const twoYearsAgo = new Date(Date.now() - MAX_HISTORICAL_DAYS * 24 * 60 * 60 * 1000);
          historicalStartDate = earliestCampaign < twoYearsAgo ? twoYearsAgo : earliestCampaign;
          
          console.log(`Full backfill mode: earliest campaign is ${earliestCampaign.toISOString()}`);
          console.log(`Using start date: ${historicalStartDate.toISOString()} (max 2 years)`);
        } else {
          // Default: last 90 days for regular syncs
          historicalStartDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        }
        
        // Generate date chunks
        const dateChunks = generateDateChunks(historicalStartDate, endDate, HISTORICAL_CHUNK_DAYS);
        console.log(`Processing ${dateChunks.length} date chunks (${HISTORICAL_CHUNK_DAYS} days each)`);
        
        // Determine which chunk to process
        const startChunk = historical_chunk_index || 0;
        
        // Store chunks info for continuation
        if (dateChunks.length > 1) {
          await supabase.from('api_connections').update({
            sync_progress: {
              ...existingProgress,
              historical_chunks: dateChunks.length,
              historical_chunk_index: startChunk,
              historical_start_date: historicalStartDate.toISOString(),
            },
          }).eq('id', connection.id);
        }
        
        // Process chunks sequentially until time budget exceeded
        for (let chunkIdx = startChunk; chunkIdx < dateChunks.length; chunkIdx++) {
          if (isTimeBudgetExceeded()) {
            console.log(`Time budget exceeded at chunk ${chunkIdx}/${dateChunks.length}. Will continue in next invocation.`);
            
            // Update progress and trigger continuation
            await supabase.from('api_connections').update({
              sync_status: 'syncing',
              sync_progress: {
                ...existingProgress,
                historical_chunks: dateChunks.length,
                historical_chunk_index: chunkIdx,
                historical_days: progress.historical_days,
                historical_complete: false,
              },
            }).eq('id', connection.id);
            
            // Trigger continuation
            EdgeRuntime.waitUntil(
              triggerHistoricalContinuation(supabaseUrl, authHeader, workspace_id, chunkIdx, dateChunks.length)
            );
            
            return new Response(JSON.stringify({
              success: true,
              complete: false,
              progress,
              message: `Processing historical chunk ${chunkIdx + 1}/${dateChunks.length}. Continuing...`,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          
          const chunk = dateChunks[chunkIdx];
          console.log(`Processing chunk ${chunkIdx + 1}/${dateChunks.length}: ${chunk.start} to ${chunk.end}`);
          
          // Batch campaign IDs in groups of 100 (API limit)
          const BATCH_SIZE_HISTORY = 100;
          
          for (let i = 0; i < campaignPlatformIds.length; i += BATCH_SIZE_HISTORY) {
            const batchIds = campaignPlatformIds.slice(i, i + BATCH_SIZE_HISTORY);
            const idsParam = batchIds.join(',');
            
            try {
              // Fetch day-wise stats for this batch of campaigns
              console.log(`  Fetching campaign batch ${Math.floor(i / BATCH_SIZE_HISTORY) + 1}/${Math.ceil(campaignPlatformIds.length / BATCH_SIZE_HISTORY)} for date range ${chunk.start} to ${chunk.end}...`);
              
              const dayWiseResponse = await smartleadRequest(
                `/analytics/day-wise-overall-stats?start_date=${chunk.start}&end_date=${chunk.end}&campaign_ids=${idsParam}`,
                apiKey
              );
              
              // Log full response structure for debugging
              console.log(`  API Response type: ${typeof dayWiseResponse}`);
              console.log(`  API Response keys: ${dayWiseResponse ? Object.keys(dayWiseResponse).join(', ') : 'null'}`);
              
              // Try multiple response formats SmartLead might use
              let dailyStats: SmartleadDailyAnalytics[] = [];
              
              if (Array.isArray(dayWiseResponse)) {
                dailyStats = dayWiseResponse;
              } else if (dayWiseResponse?.data?.daily_stats) {
                dailyStats = dayWiseResponse.data.daily_stats;
              } else if (dayWiseResponse?.daily_stats) {
                dailyStats = dayWiseResponse.daily_stats;
              } else if (dayWiseResponse?.data && Array.isArray(dayWiseResponse.data)) {
                dailyStats = dayWiseResponse.data;
              } else if (dayWiseResponse?.stats) {
                dailyStats = dayWiseResponse.stats;
              } else {
                console.log(`  Unexpected response format. Full response: ${JSON.stringify(dayWiseResponse).substring(0, 1000)}`);
              }
              
              console.log(`  Found ${dailyStats.length} daily records in response`);
              
              if (dailyStats.length === 0) {
                console.log(`  No daily stats in response - this date range may have no data`);
              }
              
              // Upsert each day's data into workspace-level metrics
              for (const stat of dailyStats) {
                if (!stat.date) {
                  console.log(`  Skipping stat with no date:`, JSON.stringify(stat).substring(0, 200));
                  continue;
                }
                
                // Parse the date - handle various formats
                let metricDate = String(stat.date);
                if (metricDate.includes('T')) {
                  metricDate = metricDate.split('T')[0];
                }
                
                const { error: upsertError } = await supabase
                  .from('smartlead_workspace_daily_metrics')
                  .upsert({
                    workspace_id,
                    metric_date: metricDate,
                    sent_count: stat.sent || 0,
                    opened_count: stat.open || 0,
                    clicked_count: stat.click || 0,
                    replied_count: stat.reply || 0,
                    bounced_count: stat.bounce || 0,
                    unsubscribed_count: stat.unsubscribe || 0,
                  }, { 
                    onConflict: 'workspace_id,metric_date',
                  });
                
                if (upsertError) {
                  console.error(`  Error upserting metrics for ${metricDate}:`, upsertError.message);
                } else {
                  progress.historical_days++;
                }
              }
              
            } catch (e) {
              console.error(`  Historical stats error for batch starting at ${i}:`, e);
              progress.errors.push(`Historical stats batch ${i}: ${(e as Error).message}`);
            }
          }
          
          progress.historical_chunks_processed++;
          console.log(`  Chunk ${chunkIdx + 1} complete. Total days processed: ${progress.historical_days}`);
        }
        
        console.log(`=== Historical fetch complete: ${progress.historical_days} days across ${progress.historical_chunks_processed} chunks ===`);
      }
      
      // If backfill_historical mode only, we're done after processing all chunks
      if (backfill_historical && !full_backfill) {
        await supabase.from('api_connections').update({
          sync_status: 'success',
          sync_progress: { 
            historical_complete: true,
            historical_days: progress.historical_days,
          },
          updated_at: new Date().toISOString(),
        }).eq('id', connection.id);
        
        return new Response(JSON.stringify({
          success: true,
          complete: true,
          progress,
          message: `Backfilled ${progress.historical_days} days of historical data`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ============================================
    // PHASE 2: Fetch All Campaigns
    // ============================================
    console.log('=== PHASE 2: Fetching all campaigns ===');
    const campaigns: SmartleadCampaign[] = await smartleadRequest('/campaigns', apiKey);
    console.log(`Found ${campaigns.length} total campaigns`);

    // Sort: active first, then by created_at
    campaigns.sort((a, b) => {
      const statusOrder = { active: 0, paused: 1, drafted: 2, completed: 3 };
      const aOrder = statusOrder[a.status?.toLowerCase() as keyof typeof statusOrder] ?? 4;
      const bOrder = statusOrder[b.status?.toLowerCase() as keyof typeof statusOrder] ?? 4;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const campaignProgress = (connection.sync_progress as any) || {};
    let startIndex = reset ? 0 : (campaignProgress.campaign_index || 0);

    // Step 2: Process campaigns in batches
    for (let i = startIndex; i < campaigns.length; i++) {
      if (isTimeBudgetExceeded()) {
        console.log(`Time budget exceeded at campaign ${i}/${campaigns.length}. Triggering continuation...`);
        
        await supabase.from('api_connections').update({
          sync_progress: { 
            campaign_index: i, 
            total_campaigns: campaigns.length,
            batch_number: batch_number,
            historical_complete: true,
            historical_days: progress.historical_days,
          },
          sync_status: 'partial',
          updated_at: new Date().toISOString(),
        }).eq('id', connection.id);

        // Use EdgeRuntime.waitUntil to trigger next batch after response
        const shouldContinue = auto_continue || batch_number === 1;
        if (shouldContinue) {
          EdgeRuntime.waitUntil(
            triggerNextBatch(supabaseUrl, anonKey, authHeader, workspace_id, batch_number + 1)
          );
        }

        return new Response(JSON.stringify({
          success: true,
          complete: false,
          progress,
          current: i,
          total: campaigns.length,
          batch_number,
          message: `Processed ${i}/${campaigns.length} campaigns. ${shouldContinue ? 'Auto-continuing...' : 'Run again to continue.'}`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const campaign = campaigns[i];
      console.log(`[${i + 1}/${campaigns.length}] Processing: ${campaign.name} (${campaign.status})`);

      try {
        // Upsert campaign
        const { data: upsertedCampaign, error: campError } = await supabase
          .from('smartlead_campaigns')
          .upsert({
            workspace_id,
            platform_id: String(campaign.id),
            name: campaign.name,
            status: campaign.status?.toLowerCase() || 'unknown',
          }, { onConflict: 'workspace_id,platform_id' })
          .select('id')
          .single();

        if (campError) {
          console.error(`Failed to upsert campaign ${campaign.name}:`, campError.message);
          progress.errors.push(`Campaign ${campaign.name}: ${campError.message}`);
          continue;
        }

        const campaignDbId = upsertedCampaign.id;
        progress.campaigns_synced++;

        // Fetch analytics
        try {
          const analytics: SmartleadAnalytics = await smartleadRequest(`/campaigns/${campaign.id}/analytics`, apiKey);
          const today = new Date().toISOString().split('T')[0];

          await supabase.from('smartlead_daily_metrics').upsert({
            workspace_id,
            campaign_id: campaignDbId,
            metric_date: today,
            sent_count: analytics.sent_count || 0,
            opened_count: analytics.unique_open_count || 0,
            clicked_count: analytics.unique_click_count || 0,
            replied_count: analytics.reply_count || 0,
            bounced_count: analytics.bounce_count || 0,
          }, { onConflict: 'campaign_id,metric_date' });

          progress.metrics_created++;
          console.log(`  Analytics synced: sent=${analytics.sent_count}, opens=${analytics.unique_open_count}, replies=${analytics.reply_count}`);
        } catch (e) {
          console.error(`  Analytics error for ${campaign.name}:`, e);
          progress.errors.push(`Analytics ${campaign.name}: ${(e as Error).message}`);
        }

        // Fetch sequences/variants for this campaign
        try {
          const sequences: SmartleadSequence[] = await smartleadRequest(`/campaigns/${campaign.id}/sequences`, apiKey);
          
          if (sequences && sequences.length > 0) {
            console.log(`  Found ${sequences.length} sequences for campaign`);
            
            for (const seq of sequences) {
              // Store the main sequence as a variant
              const mainSubject = seq.subject || '';
              const mainBody = seq.email_body || '';
              const mainVars = extractPersonalizationVars(mainSubject + ' ' + mainBody);
              const mainWordCount = mainBody.split(/\s+/).filter(Boolean).length;
              
              // Upsert main sequence as variant
              await supabase.from('smartlead_variants').upsert({
                campaign_id: campaignDbId,
                platform_variant_id: `seq-${seq.seq_id}`,
                name: `Step ${seq.seq_number}`,
                subject_line: mainSubject,
                body_preview: mainBody.substring(0, 500),
                email_body: mainBody,
                word_count: mainWordCount,
                personalization_vars: mainVars,
                step_number: seq.seq_number,
                is_control: true,
              }, { onConflict: 'campaign_id,platform_variant_id' });
              
              progress.variants_synced++;

              // Store A/B variants if they exist
              if (seq.sequence_variants && seq.sequence_variants.length > 0) {
                for (const variant of seq.sequence_variants) {
                  const varSubject = variant.subject || mainSubject;
                  const varBody = variant.email_body || mainBody;
                  const varVars = extractPersonalizationVars(varSubject + ' ' + varBody);
                  const varWordCount = varBody.split(/\s+/).filter(Boolean).length;
                  
                  await supabase.from('smartlead_variants').upsert({
                    campaign_id: campaignDbId,
                    platform_variant_id: `var-${variant.variant_id}`,
                    name: `Step ${seq.seq_number} Variant ${variant.variant_id}`,
                    subject_line: varSubject,
                    body_preview: varBody.substring(0, 500),
                    email_body: varBody,
                    word_count: varWordCount,
                    personalization_vars: varVars,
                    step_number: seq.seq_number,
                    is_control: false,
                  }, { onConflict: 'campaign_id,platform_variant_id' });
                  
                  progress.variants_synced++;
                }
              }
            }
            console.log(`  Variants synced: ${progress.variants_synced} total`);
          }
        } catch (e) {
          console.error(`  Sequences error for ${campaign.name}:`, e);
          progress.errors.push(`Sequences ${campaign.name}: ${(e as Error).message}`);
        }

        // Fetch email accounts for this campaign
        try {
          const emailAccounts: SmartleadEmailAccount[] = await smartleadRequest(`/campaigns/${campaign.id}/email-accounts`, apiKey);
          
          for (const account of emailAccounts || []) {
            await supabase.from('email_accounts').upsert({
              workspace_id,
              platform: 'smartlead',
              platform_id: String(account.id),
              email_address: account.from_email,
              sender_name: account.from_name || null,
              daily_limit: account.message_per_day || null,
              warmup_enabled: account.warmup_details?.status === 'enabled',
              is_active: true,
            }, { onConflict: 'workspace_id,platform,platform_id' });
            progress.email_accounts_synced++;
          }
          console.log(`  Email accounts synced: ${emailAccounts?.length || 0}`);
        } catch (e) {
          console.error(`  Email accounts error for ${campaign.name}:`, e);
        }

      } catch (e) {
        console.error(`Error processing campaign ${campaign.name}:`, e);
        progress.errors.push(`${campaign.name}: ${(e as Error).message}`);
      }
    }

    // ============================================
    // PHASE 3: Sync Complete
    // ============================================
    await supabase.from('api_connections').update({
      sync_status: 'success',
      sync_progress: { 
        completed: true, 
        historical_complete: true,
        total_campaigns: campaigns.length,
        historical_days: progress.historical_days,
      },
      last_sync_at: new Date().toISOString(),
      last_full_sync_at: new Date().toISOString(),
    }).eq('id', connection.id);

    console.log('SmartLead sync complete:', progress);

    // Check if Reply.io connection exists and trigger its sync
    const { data: replyioConnection } = await supabase
      .from('api_connections')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('platform', 'replyio')
      .eq('is_active', true)
      .single();

    if (replyioConnection && auto_continue) {
      EdgeRuntime.waitUntil(
        triggerReplyioSync(supabaseUrl, anonKey, authHeader, workspace_id)
      );
    }

    return new Response(JSON.stringify({
      success: true,
      complete: true,
      progress,
      message: `Synced ${progress.campaigns_synced} campaigns, ${progress.variants_synced} variants, ${progress.metrics_created} metrics, ${progress.historical_days} historical days, ${progress.email_accounts_synced} email accounts`,
      next: replyioConnection ? 'Triggering Reply.io sync...' : null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('smartlead-sync error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
