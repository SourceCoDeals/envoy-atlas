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
const TIME_BUDGET_MS = 55000;
const MAX_BATCHES = 25;
const MAX_HISTORICAL_DAYS = 730; // 2 years max lookback
const HISTORICAL_CHUNK_DAYS = 90; // Process history in 90-day chunks
const REPLIES_PER_PAGE = 100; // Pagination for inbox replies

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

// Day-wise analytics - actual API response format
interface SmartleadDayWiseStat {
  date: string; // "8 Jan" format
  day_name: string;
  email_engagement_metrics: {
    sent: number;
    opened: number;
    replied: number;
    bounced: number;
    unsubscribed: number;
  };
}

// Inbox reply structure from master inbox
interface SmartleadInboxReply {
  email_lead_id: number;
  email_lead_map_id: number;
  lead_email: string;
  lead_first_name?: string;
  lead_last_name?: string;
  email_campaign_id: number;
  email_campaign_name: string;
  last_reply_time: string;
  lead_category_id?: number;
  lead_status?: string;
  is_important?: boolean;
  email_history?: Array<{
    type: string; // 'SENT' or 'RECEIVED'
    email_body: string;
    time: string;
    seq_number?: number;
  }>;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function smartleadRequest(endpoint: string, apiKey: string, method = 'GET', body?: any, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    await delay(RATE_LIMIT_DELAY);
    const url = `${SMARTLEAD_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}`;
    console.log(`Fetching (${method}): ${endpoint}`);
    
    try {
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(url, options);
      
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

// Parse SmartLead's short date format "8 Jan" to ISO date string
function parseShortDate(shortDate: string, chunkStart: string, chunkEnd: string): string | null {
  try {
    // Parse the chunk dates to get year context
    const startYear = parseInt(chunkStart.split('-')[0]);
    const endYear = parseInt(chunkEnd.split('-')[0]);
    
    // Parse short date like "8 Jan", "15 Oct"
    const parts = shortDate.trim().split(' ');
    if (parts.length !== 2) return null;
    
    const day = parseInt(parts[0]);
    const monthStr = parts[1].toLowerCase();
    
    const monthMap: Record<string, number> = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };
    
    const month = monthMap[monthStr];
    if (month === undefined || isNaN(day)) return null;
    
    // Try both years if they differ (e.g., chunk spans Dec-Jan)
    // Check which year makes the date fall within the chunk range
    for (const year of [endYear, startYear]) {
      const testDate = new Date(year, month, day);
      const testIso = testDate.toISOString().split('T')[0];
      
      if (testIso >= chunkStart && testIso <= chunkEnd) {
        return testIso;
      }
    }
    
    // Fallback to end year
    const date = new Date(endYear, month, day);
    return date.toISOString().split('T')[0];
  } catch (e) {
    console.error(`Failed to parse date "${shortDate}":`, e);
    return null;
  }
}

// Extract personalization variables from email content
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

// Self-continuation functions
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

async function triggerRepliesContinuation(
  supabaseUrl: string,
  authToken: string,
  workspaceId: string,
  offset: number
) {
  console.log(`Triggering replies fetch at offset ${offset}...`);
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
        fetch_replies_only: true,
        replies_offset: offset,
        auto_continue: true,
      }),
    });
    console.log(`Replies continuation triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger replies continuation:', error);
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
      backfill_historical = false,
      full_backfill = false,
      historical_chunk_index = 0,
      fetch_replies_only = false,
      replies_offset = 0,
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

    console.log(`Starting batch ${batch_number}, auto_continue=${auto_continue}, backfill_historical=${backfill_historical}, full_backfill=${full_backfill}, chunk=${historical_chunk_index}, fetch_replies_only=${fetch_replies_only}`);

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
        await supabase.from('smartlead_message_events').delete().eq('workspace_id', workspace_id);
        await supabase.from('smartlead_campaigns').delete().eq('workspace_id', workspace_id);
      }
      await supabase.from('email_accounts').delete().eq('workspace_id', workspace_id).eq('platform', 'smartlead');
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
      replies_fetched: 0,
      message_events_created: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;

    // ============================================
    // MODE: Fetch Replies Only
    // ============================================
    if (fetch_replies_only) {
      console.log(`=== REPLIES MODE: Fetching inbox replies at offset ${replies_offset} ===`);
      
      // Get campaign ID mapping
      const { data: campaignMap } = await supabase
        .from('smartlead_campaigns')
        .select('id, platform_id')
        .eq('workspace_id', workspace_id);
      
      const campaignLookup = new Map(campaignMap?.map(c => [c.platform_id, c.id]) || []);
      
      try {
        // Fetch inbox replies with pagination
        const repliesResponse = await smartleadRequest(
          '/master-inbox/inbox-replies',
          apiKey,
          'POST',
          {
            offset: replies_offset,
            limit: REPLIES_PER_PAGE,
          }
        );
        
        const replies = repliesResponse?.data || repliesResponse || [];
        console.log(`Fetched ${Array.isArray(replies) ? replies.length : 0} replies at offset ${replies_offset}`);
        
        if (Array.isArray(replies) && replies.length > 0) {
          for (const reply of replies as SmartleadInboxReply[]) {
            const campaignDbId = campaignLookup.get(String(reply.email_campaign_id));
            
            if (!campaignDbId) {
              console.log(`Skipping reply - campaign ${reply.email_campaign_id} not found in DB`);
              continue;
            }
            
            // Extract reply content from email_history
            const receivedMessages = reply.email_history?.filter(e => {
              const t = String((e as any).type || '').toUpperCase();
              // SmartLead docs use REPLY; some payloads use RECEIVED
              return t === 'REPLY' || t === 'RECEIVED';
            }) || [];
            
            for (const msg of receivedMessages) {
              // Create robust unique message_id that handles edge cases
              const msgTimestamp = msg.time ? new Date(msg.time).getTime() : Date.now();
              const messageId = `${reply.email_lead_id}-${reply.email_lead_map_id}-${msgTimestamp}`;
              
              const { error: upsertError } = await supabase
                .from('smartlead_message_events')
                .upsert({
                  workspace_id,
                  campaign_id: campaignDbId,
                  lead_id: null, // We don't have lead UUIDs, could create leads table
                  event_type: 'reply',
                  event_timestamp: msg.time || reply.last_reply_time,
                  message_id: messageId,
                  reply_text: msg.email_body?.substring(0, 5000), // Limit size
                  reply_sentiment: null, // Could add classification later
                }, { onConflict: 'workspace_id,campaign_id,message_id' });
              
              if (upsertError) {
                console.error(`Failed to store reply message: ${upsertError.message}`);
              } else {
                progress.message_events_created++;
              }
            }
            progress.replies_fetched++;
          }
          
          // If we got a full page, there might be more
          if (replies.length >= REPLIES_PER_PAGE && !isTimeBudgetExceeded()) {
            // Continue fetching in same invocation
            // Note: for very large inboxes, we'd need to continue in another invocation
          } else if (replies.length >= REPLIES_PER_PAGE) {
            // Time budget exceeded, continue in another invocation
            EdgeRuntime.waitUntil(
              triggerRepliesContinuation(supabaseUrl, authHeader, workspace_id, replies_offset + REPLIES_PER_PAGE)
            );
          }
        }
      } catch (e) {
        console.error('Error fetching inbox replies:', e);
        progress.errors.push(`Inbox replies: ${(e as Error).message}`);
      }
      
      await supabase.from('api_connections').update({
        sync_status: 'success',
        sync_progress: {
          ...(connection.sync_progress as any || {}),
          replies_complete: true,
          replies_fetched: progress.replies_fetched,
          message_events_created: progress.message_events_created,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', connection.id);
      
      return new Response(JSON.stringify({
        success: true,
        complete: true,
        progress,
        message: `Fetched ${progress.replies_fetched} replies, created ${progress.message_events_created} message events`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================
    // PHASE 1: Fetch Historical Day-Wise Statistics
    // ============================================
    const existingProgress = (connection.sync_progress as any) || {};
    const shouldFetchHistorical = batch_number === 1 || backfill_historical || full_backfill || !existingProgress.historical_complete;
    
    if (shouldFetchHistorical) {
      console.log('=== PHASE 1: Fetching historical day-wise statistics ===');
      
      const allCampaigns: SmartleadCampaign[] = await smartleadRequest('/campaigns', apiKey);
      console.log(`Found ${allCampaigns.length} campaigns for historical fetch`);
      
      if (allCampaigns.length === 0) {
        console.log('No campaigns found - skipping historical fetch');
      } else {
        const campaignPlatformIds = allCampaigns.map(c => c.id);
        
        const endDate = new Date();
        let historicalStartDate: Date;
        
        if (full_backfill || backfill_historical) {
          const earliestCampaign = allCampaigns.reduce((earliest, c) => {
            if (!c.created_at) return earliest;
            const cDate = new Date(c.created_at);
            return cDate < earliest ? cDate : earliest;
          }, new Date());
          
          const twoYearsAgo = new Date(Date.now() - MAX_HISTORICAL_DAYS * 24 * 60 * 60 * 1000);
          historicalStartDate = earliestCampaign < twoYearsAgo ? twoYearsAgo : earliestCampaign;
          
          console.log(`Full backfill mode: earliest campaign is ${earliestCampaign.toISOString()}`);
          console.log(`Using start date: ${historicalStartDate.toISOString()} (max 2 years)`);
        } else {
          historicalStartDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        }
        
        const dateChunks = generateDateChunks(historicalStartDate, endDate, HISTORICAL_CHUNK_DAYS);
        console.log(`Processing ${dateChunks.length} date chunks (${HISTORICAL_CHUNK_DAYS} days each)`);
        
        const startChunk = historical_chunk_index || 0;
        
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
        
        for (let chunkIdx = startChunk; chunkIdx < dateChunks.length; chunkIdx++) {
          if (isTimeBudgetExceeded()) {
            console.log(`Time budget exceeded at chunk ${chunkIdx}/${dateChunks.length}. Will continue in next invocation.`);
            
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
              console.log(`  Fetching campaign batch ${Math.floor(i / BATCH_SIZE_HISTORY) + 1}/${Math.ceil(campaignPlatformIds.length / BATCH_SIZE_HISTORY)} for date range ${chunk.start} to ${chunk.end}...`);
              
              const dayWiseResponse = await smartleadRequest(
                `/analytics/day-wise-overall-stats?start_date=${chunk.start}&end_date=${chunk.end}&campaign_ids=${idsParam}`,
                apiKey
              );
              
              // Parse the ACTUAL API response format: { success, message, data: { day_wise_stats: [...] } }
              let dailyStats: SmartleadDayWiseStat[] = [];
              
              if (dayWiseResponse?.data?.day_wise_stats && Array.isArray(dayWiseResponse.data.day_wise_stats)) {
                dailyStats = dayWiseResponse.data.day_wise_stats;
                console.log(`  Found ${dailyStats.length} daily records in day_wise_stats`);
              } else if (Array.isArray(dayWiseResponse)) {
                // Old format fallback
                dailyStats = dayWiseResponse as any;
              } else {
                console.log(`  Unexpected response format. Keys: ${dayWiseResponse ? Object.keys(dayWiseResponse).join(', ') : 'null'}`);
                if (dayWiseResponse?.data) {
                  console.log(`  data keys: ${Object.keys(dayWiseResponse.data).join(', ')}`);
                }
              }
              
              // Process each day's data
              for (const stat of dailyStats) {
                // Parse the short date format "8 Jan" to ISO date
                const metricDate = parseShortDate(stat.date, chunk.start, chunk.end);
                
                if (!metricDate) {
                  console.log(`  Skipping - could not parse date: "${stat.date}"`);
                  continue;
                }
                
                // Extract nested metrics
                const metrics = stat.email_engagement_metrics || {};
                
                const { error: upsertError } = await supabase
                  .from('smartlead_workspace_daily_metrics')
                  .upsert({
                    workspace_id,
                    metric_date: metricDate,
                    sent_count: metrics.sent || 0,
                    opened_count: metrics.opened || 0,
                    clicked_count: 0, // Not in this API response
                    replied_count: metrics.replied || 0,
                    bounced_count: metrics.bounced || 0,
                    unsubscribed_count: metrics.unsubscribed || 0,
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

    // Process campaigns
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
          const sequencesRaw = await smartleadRequest(`/campaigns/${campaign.id}/sequences`, apiKey);
          
          // COMPREHENSIVE Debug: Log raw response structure
          const rawStr = JSON.stringify(sequencesRaw).substring(0, 800);
          console.log(`  Sequences API raw response:`, rawStr);
          console.log(`  Sequences API type: ${typeof sequencesRaw}, isArray: ${Array.isArray(sequencesRaw)}`);
          
          // Store first campaign's response for debugging
          if (i === startIndex && progress.variants_synced === 0) {
            await supabase.from('api_connections').update({
              sync_progress: {
                ...((connection.sync_progress as any) || {}),
                debug_sequences_sample: rawStr,
                debug_sequences_type: typeof sequencesRaw,
                debug_sequences_isArray: Array.isArray(sequencesRaw),
                debug_sequences_keys: sequencesRaw && !Array.isArray(sequencesRaw) ? Object.keys(sequencesRaw).join(', ') : 'N/A',
              },
            }).eq('id', connection.id);
          }
          
          if (sequencesRaw && !Array.isArray(sequencesRaw)) {
            console.log(`  Sequences API response keys:`, Object.keys(sequencesRaw).join(', '));
          }
          
          // Handle ALL possible response formats from SmartLead API
          let sequences: SmartleadSequence[] = [];
          
          if (Array.isArray(sequencesRaw)) {
            sequences = sequencesRaw;
          } else if (sequencesRaw?.data && Array.isArray(sequencesRaw.data)) {
            sequences = sequencesRaw.data;
          } else if (sequencesRaw?.sequences && Array.isArray(sequencesRaw.sequences)) {
            sequences = sequencesRaw.sequences;
          } else if (sequencesRaw?.steps && Array.isArray(sequencesRaw.steps)) {
            sequences = sequencesRaw.steps;
          } else if (sequencesRaw?.email_sequences && Array.isArray(sequencesRaw.email_sequences)) {
            sequences = sequencesRaw.email_sequences;
          } else if (sequencesRaw?.ok === true && sequencesRaw?.data) {
            // SmartLead often returns { ok: true, data: [...] }
            sequences = Array.isArray(sequencesRaw.data) ? sequencesRaw.data : [sequencesRaw.data];
          } else if (sequencesRaw && typeof sequencesRaw === 'object' && !Array.isArray(sequencesRaw)) {
            // Maybe it's a single sequence object
            if (sequencesRaw.seq_id || sequencesRaw.id || sequencesRaw.subject || sequencesRaw.email_body) {
              sequences = [sequencesRaw];
            }
          }
          
          if (sequences && sequences.length > 0) {
            console.log(`  Found ${sequences.length} sequences for campaign`);
            
            for (let seqIdx = 0; seqIdx < sequences.length; seqIdx++) {
              const seq = sequences[seqIdx];
              
              // Log sequence structure to debug field names
              console.log(`    Sequence ${seqIdx + 1} keys: ${Object.keys(seq).join(', ')}`);
              console.log(`    Sequence ${seqIdx + 1} sample:`, JSON.stringify(seq).substring(0, 300));
              
              // SmartLead sequence field variations
              const mainSubject = seq.subject || (seq as any).email_subject || (seq as any).emailSubject || 
                                  (seq as any).title || (seq as any).name || '';
              const mainBody = seq.email_body || (seq as any).body || (seq as any).emailBody || 
                               (seq as any).content || (seq as any).text || (seq as any).template || '';
              
              if (!mainSubject && !mainBody) {
                console.log(`    Skipping sequence ${seqIdx + 1} - no subject or body found`);
                continue;
              }
              
              const mainVars = extractPersonalizationVars(mainSubject + ' ' + mainBody);
              const mainWordCount = mainBody.split(/\s+/).filter(Boolean).length;
              const seqId = seq.seq_id || (seq as any).id || (seq as any).sequence_id || seqIdx;
              const seqNumber = seq.seq_number || (seq as any).step_number || (seq as any).order || (seqIdx + 1);
              
              // Upsert main sequence as variant
              const variantData = {
                campaign_id: campaignDbId,
                platform_variant_id: `seq-${seqId}`,
                name: `Step ${seqNumber}`,
                variant_type: 'sequence',
                subject_line: mainSubject,
                body_preview: mainBody.substring(0, 500),
                email_body: mainBody,
                word_count: mainWordCount,
                personalization_vars: mainVars,
                is_control: true,
              };
              
              console.log(`    Upserting variant: seq-${seqId} with subject "${mainSubject.substring(0, 40)}..."`);
              
              const { error: variantError } = await supabase.from('smartlead_variants')
                .upsert(variantData, { onConflict: 'campaign_id,platform_variant_id' });
              
              if (variantError) {
                console.error(`    Failed to upsert variant for step ${seqNumber}:`, variantError.message);
                console.error(`    Variant data:`, JSON.stringify(variantData).substring(0, 300));
              } else {
                progress.variants_synced++;
                console.log(`    ✓ Variant synced: Step ${seqNumber} (${mainSubject.substring(0, 30)}...)`);
              }

              // Store A/B variants if they exist
              if (seq.sequence_variants && seq.sequence_variants.length > 0) {
                console.log(`    Found ${seq.sequence_variants.length} A/B variants`);
                for (const variant of seq.sequence_variants) {
                  const varSubject = variant.subject || mainSubject;
                  const varBody = variant.email_body || mainBody;
                  const varVars = extractPersonalizationVars(varSubject + ' ' + varBody);
                  const varWordCount = varBody.split(/\s+/).filter(Boolean).length;
                  
                  const { error: abError } = await supabase.from('smartlead_variants').upsert({
                    campaign_id: campaignDbId,
                    platform_variant_id: `var-${variant.variant_id}`,
                    name: `Step ${seqNumber} Variant ${variant.variant_id}`,
                    variant_type: 'ab_variant',
                    subject_line: varSubject,
                    body_preview: varBody.substring(0, 500),
                    email_body: varBody,
                    word_count: varWordCount,
                    personalization_vars: varVars,
                    is_control: false,
                  }, { onConflict: 'campaign_id,platform_variant_id' });
                  
                  if (abError) {
                    console.error(`    Failed to upsert A/B variant:`, abError.message);
                  } else {
                    progress.variants_synced++;
                  }
                }
              }
            }
            console.log(`  Variants synced for campaign: ${sequences.length} steps`);
          } else {
            console.log(`  No sequences found for campaign ${campaign.name} (empty or unrecognized format)`);
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
    // PHASE 3: Fetch Inbox Replies (first page)
    // ============================================
    if (!isTimeBudgetExceeded()) {
      console.log('=== PHASE 3: Fetching inbox replies ===');
      
      const { data: campaignMap } = await supabase
        .from('smartlead_campaigns')
        .select('id, platform_id')
        .eq('workspace_id', workspace_id);
      
      const campaignLookup = new Map(campaignMap?.map(c => [c.platform_id, c.id]) || []);
      
      try {
        const repliesResponse = await smartleadRequest(
          '/master-inbox/inbox-replies',
          apiKey,
          'POST',
          { offset: 0, limit: REPLIES_PER_PAGE }
        );
        
        const replies = repliesResponse?.data || repliesResponse || [];
        console.log(`Fetched ${Array.isArray(replies) ? replies.length : 0} replies`);
        
        if (Array.isArray(replies)) {
          for (const reply of replies as SmartleadInboxReply[]) {
            const campaignDbId = campaignLookup.get(String(reply.email_campaign_id));
            if (!campaignDbId) continue;
            
            const receivedMessages = reply.email_history?.filter(e => {
              const t = String((e as any).type || '').toUpperCase();
              // SmartLead docs use REPLY; some payloads use RECEIVED
              return t === 'REPLY' || t === 'RECEIVED';
            }) || [];
            
            for (const msg of receivedMessages) {
              // Create robust unique message_id that handles edge cases
              const msgTimestamp = msg.time ? new Date(msg.time).getTime() : Date.now();
              const messageId = `${reply.email_lead_id}-${reply.email_lead_map_id}-${msgTimestamp}`;
              
              console.log(`    Storing reply: lead=${reply.email_lead_id}, campaign=${reply.email_campaign_id}, msgId=${messageId}`);
              
              const { error: upsertError } = await supabase
                .from('smartlead_message_events')
                .upsert({
                  workspace_id,
                  campaign_id: campaignDbId,
                  lead_id: null,
                  event_type: 'reply',
                  event_timestamp: msg.time || reply.last_reply_time,
                  message_id: messageId,
                  reply_text: msg.email_body?.substring(0, 5000),
                  reply_sentiment: null,
                }, { onConflict: 'workspace_id,campaign_id,message_id' });
              
              if (upsertError) {
                console.error(`    Failed to store message: ${upsertError.message}`);
              } else {
                progress.message_events_created++;
                console.log(`    ✓ Stored message event: ${messageId}`);
              }
            }
            progress.replies_fetched++;
          }
          
          // If there are more replies, trigger continuation
          if (replies.length >= REPLIES_PER_PAGE) {
            console.log('More replies available, will need additional fetch');
          }
        }
      } catch (e) {
        console.error('Error fetching inbox replies:', e);
        progress.errors.push(`Inbox replies: ${(e as Error).message}`);
      }
    }

    // ============================================
    // PHASE 4: Sync Complete
    // ============================================
    await supabase.from('api_connections').update({
      sync_status: 'success',
      sync_progress: { 
        completed: true, 
        historical_complete: true,
        total_campaigns: campaigns.length,
        historical_days: progress.historical_days,
        variants_synced: progress.variants_synced,
        replies_fetched: progress.replies_fetched,
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
      message: `Synced ${progress.campaigns_synced} campaigns, ${progress.variants_synced} variants, ${progress.metrics_created} metrics, ${progress.historical_days} historical days, ${progress.email_accounts_synced} email accounts, ${progress.replies_fetched} replies`,
      next: replyioConnection ? 'Triggering Reply.io sync...' : null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('smartlead-sync error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
