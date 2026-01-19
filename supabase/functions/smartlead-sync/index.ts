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
const MAX_BATCHES = 100;
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
    const startYear = parseInt(chunkStart.split('-')[0]);
    const endYear = parseInt(chunkEnd.split('-')[0]);
    
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
    
    for (const year of [endYear, startYear]) {
      const testDate = new Date(year, month, day);
      const testIso = testDate.toISOString().split('T')[0];
      
      if (testIso >= chunkStart && testIso <= chunkEnd) {
        return testIso;
      }
    }
    
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

// Strip HTML and return plain text
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

// Self-continuation for next batch
async function triggerNextBatch(
  supabaseUrl: string,
  authToken: string,
  clientId: string,
  engagementId: string,
  dataSourceId: string,
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
        client_id: clientId,
        engagement_id: engagementId,
        data_source_id: dataSourceId,
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

    // Verify user authentication
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl, anonKey,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) throw new Error('Unauthorized');

    const { 
      client_id,
      engagement_id,
      data_source_id,
      reset = false, 
      batch_number = 1, 
      auto_continue = true,
      full_backfill = false,
    } = await req.json();
    
    if (!client_id) throw new Error('client_id is required');
    if (!data_source_id) throw new Error('data_source_id is required');

    // Safety check for max batches
    if (batch_number > MAX_BATCHES) {
      console.error(`Max batch limit (${MAX_BATCHES}) reached. Stopping sync.`);
      await supabase.from('data_sources').update({
        last_sync_status: 'error',
        last_sync_error: `Sync stopped after ${MAX_BATCHES} batches. Some data may be missing.`,
        updated_at: new Date().toISOString(),
      }).eq('id', data_source_id);
      
      return new Response(JSON.stringify({ 
        error: 'Max batch limit reached',
        batch_number,
        message: 'Sync stopped after too many batches.'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Starting batch ${batch_number}, auto_continue=${auto_continue}, full_backfill=${full_backfill}`);

    // Verify user has access to this client
    const { data: membership } = await supabase
      .from('client_members').select('role')
      .eq('client_id', client_id).eq('user_id', user.id).single();
    if (!membership) throw new Error('Access denied to client');

    // Get data source (with API key)
    const { data: dataSource, error: dsError } = await supabase
      .from('data_sources').select('id, api_key_encrypted, additional_config, last_sync_status')
      .eq('id', data_source_id).eq('source_type', 'smartlead').single();
    if (dsError || !dataSource) throw new Error('No Smartlead data source found');

    const apiKey = dataSource.api_key_encrypted;
    if (!apiKey) throw new Error('No API key configured for Smartlead');

    // Get or create engagement for this sync
    let activeEngagementId = engagement_id;
    if (!activeEngagementId) {
      // Get or create a default engagement for this client
      const { data: existingEngagement } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', client_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (existingEngagement) {
        activeEngagementId = existingEngagement.id;
      } else {
        // Create a default engagement
        const { data: newEngagement, error: engError } = await supabase
          .from('engagements')
          .insert({
            client_id,
            name: 'Default Engagement',
            status: 'active',
          })
          .select('id')
          .single();
        
        if (engError) throw new Error(`Failed to create engagement: ${engError.message}`);
        activeEngagementId = newEngagement.id;
      }
    }

    // Update data source status
    await supabase.from('data_sources').update({ 
      last_sync_status: 'syncing',
      updated_at: new Date().toISOString(),
    }).eq('id', data_source_id);

    const progress = {
      campaigns_synced: 0,
      variants_synced: 0,
      metrics_created: 0,
      historical_days: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;

    // Reset if requested
    if (reset) {
      console.log('Resetting synced data for engagement:', activeEngagementId);
      
      // Get campaign IDs first
      const { data: existingCampaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('engagement_id', activeEngagementId)
        .eq('data_source_id', data_source_id);
      
      const campaignIds = existingCampaigns?.map(c => c.id) || [];
      
      if (campaignIds.length > 0) {
        // Delete related data
        await supabase.from('daily_metrics').delete().in('campaign_id', campaignIds);
        await supabase.from('campaign_variants').delete().in('campaign_id', campaignIds);
        await supabase.from('email_activities').delete().in('campaign_id', campaignIds);
        await supabase.from('campaigns').delete().in('id', campaignIds);
      }
      
      console.log('Reset complete');
    }

    // ============================================
    // PHASE 1: Fetch All Campaigns
    // ============================================
    console.log('=== PHASE 1: Fetching all campaigns ===');
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

    const existingConfig = (dataSource.additional_config as any) || {};
    let startIndex = reset ? 0 : (existingConfig.campaign_index || 0);

    // Process each campaign
    for (let i = startIndex; i < campaigns.length; i++) {
      if (isTimeBudgetExceeded()) {
        console.log(`Time budget exceeded at campaign ${i}/${campaigns.length}. Triggering continuation...`);
        
        await supabase.from('data_sources').update({
          additional_config: { 
            ...existingConfig,
            campaign_index: i, 
            total_campaigns: campaigns.length,
            batch_number,
          },
          last_sync_status: 'partial',
          updated_at: new Date().toISOString(),
        }).eq('id', data_source_id);

        if (auto_continue) {
          EdgeRuntime.waitUntil(
            triggerNextBatch(supabaseUrl, authHeader, client_id, activeEngagementId, data_source_id, batch_number + 1)
          );
        }

        return new Response(JSON.stringify({
          success: true,
          complete: false,
          progress,
          current: i,
          total: campaigns.length,
          batch_number,
          message: `Processed ${i}/${campaigns.length} campaigns. Auto-continuing...`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const campaign = campaigns[i];
      console.log(`[${i + 1}/${campaigns.length}] Processing: ${campaign.name} (${campaign.status})`);

      try {
        // Upsert campaign to unified campaigns table
        const { data: upsertedCampaign, error: campError } = await supabase
          .from('campaigns')
          .upsert({
            engagement_id: activeEngagementId,
            data_source_id: data_source_id,
            external_id: String(campaign.id),
            name: campaign.name,
            campaign_type: 'email',
            status: campaign.status?.toLowerCase() || 'unknown',
            started_at: campaign.created_at ? new Date(campaign.created_at).toISOString() : null,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'engagement_id,data_source_id,external_id' })
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

          const totalSent = analytics.sent_count || 0;
          const totalOpened = analytics.unique_open_count || 0;
          const totalClicked = analytics.unique_click_count || 0;
          const totalReplied = analytics.reply_count || 0;
          const totalBounced = analytics.bounce_count || 0;
          
          console.log(`  Analytics: sent=${totalSent}, opens=${totalOpened}, replies=${totalReplied}`);

          // Update campaign with totals
          await supabase.from('campaigns').update({
            total_sent: totalSent,
            total_opened: totalOpened,
            total_replied: totalReplied,
            total_bounced: totalBounced,
            reply_rate: totalSent > 0 ? (totalReplied / totalSent) * 100 : null,
            open_rate: totalSent > 0 ? (totalOpened / totalSent) * 100 : null,
            bounce_rate: totalSent > 0 ? (totalBounced / totalSent) * 100 : null,
          }).eq('id', campaignDbId);

          // Store daily metrics (using campaign created date as baseline for initial sync)
          if (totalSent > 0 || totalOpened > 0 || totalReplied > 0) {
            const metricDate = campaign.created_at 
              ? new Date(campaign.created_at).toISOString().split('T')[0]
              : today;

            await supabase.from('daily_metrics').upsert({
              engagement_id: activeEngagementId,
              campaign_id: campaignDbId,
              data_source_id: data_source_id,
              date: metricDate,
              emails_sent: totalSent,
              emails_opened: totalOpened,
              emails_clicked: totalClicked,
              emails_replied: totalReplied,
              emails_bounced: totalBounced,
            }, { onConflict: 'engagement_id,campaign_id,date' });
            progress.metrics_created++;
          }
        } catch (e) {
          console.error(`  Analytics error for ${campaign.name}:`, e);
          progress.errors.push(`Analytics ${campaign.name}: ${(e as Error).message}`);
        }

        // Fetch sequences/variants
        try {
          const sequencesRaw = await smartleadRequest(`/campaigns/${campaign.id}/sequences`, apiKey);
          
          let sequences: SmartleadSequence[] = [];
          if (Array.isArray(sequencesRaw)) {
            sequences = sequencesRaw;
          } else if (sequencesRaw?.data && Array.isArray(sequencesRaw.data)) {
            sequences = sequencesRaw.data;
          } else if (sequencesRaw?.sequences && Array.isArray(sequencesRaw.sequences)) {
            sequences = sequencesRaw.sequences;
          }
          
          if (sequences.length > 0) {
            console.log(`  Found ${sequences.length} sequences for campaign`);
            
            for (let seqIdx = 0; seqIdx < sequences.length; seqIdx++) {
              const seq = sequences[seqIdx];
              
              const mainSubject = seq.subject || (seq as any).email_subject || '';
              const mainBody = seq.email_body || (seq as any).body || '';
              
              if (!mainSubject && !mainBody) continue;
              
              const mainVars = extractPersonalizationVars(mainSubject + ' ' + mainBody);
              const bodyPlain = stripHtml(mainBody);
              const seqId = seq.seq_id || (seq as any).id || seqIdx;
              const seqNumber = seq.seq_number || (seq as any).step_number || (seqIdx + 1);
              
              // Upsert to unified campaign_variants table
              const { error: variantError } = await supabase.from('campaign_variants')
                .upsert({
                  campaign_id: campaignDbId,
                  data_source_id: data_source_id,
                  external_id: `seq-${seqId}`,
                  subject_line: mainSubject,
                  body_html: mainBody,
                  body_plain: bodyPlain,
                  body_preview: bodyPlain.substring(0, 200),
                  personalization_vars: mainVars,
                  step_number: seqNumber,
                  is_control: seqIdx === 0,
                }, { onConflict: 'campaign_id,external_id' });
              
              if (variantError) {
                console.error(`  Failed to upsert variant for step ${seqNumber}:`, variantError.message);
              } else {
                progress.variants_synced++;
              }

              // Store A/B variants if they exist
              if (seq.sequence_variants && seq.sequence_variants.length > 0) {
                for (const variant of seq.sequence_variants) {
                  const varSubject = variant.subject || mainSubject;
                  const varBody = variant.email_body || mainBody;
                  const varBodyPlain = stripHtml(varBody);
                  const varVars = extractPersonalizationVars(varSubject + ' ' + varBody);
                  
                  const { error: abError } = await supabase.from('campaign_variants').upsert({
                    campaign_id: campaignDbId,
                    data_source_id: data_source_id,
                    external_id: `var-${variant.variant_id}`,
                    subject_line: varSubject,
                    body_html: varBody,
                    body_plain: varBodyPlain,
                    body_preview: varBodyPlain.substring(0, 200),
                    personalization_vars: varVars,
                    step_number: seqNumber,
                    is_control: false,
                  }, { onConflict: 'campaign_id,external_id' });
                  
                  if (!abError) progress.variants_synced++;
                }
              }
            }
          }
        } catch (e) {
          console.error(`  Sequences error for ${campaign.name}:`, e);
          progress.errors.push(`Sequences ${campaign.name}: ${(e as Error).message}`);
        }

      } catch (e) {
        console.error(`Error processing campaign ${campaign.name}:`, e);
        progress.errors.push(`${campaign.name}: ${(e as Error).message}`);
      }
    }

    // ============================================
    // PHASE 2: Sync Complete
    // ============================================
    await supabase.from('data_sources').update({
      last_sync_status: 'success',
      last_sync_at: new Date().toISOString(),
      last_sync_records_processed: progress.campaigns_synced,
      additional_config: {
        ...existingConfig,
        campaign_index: 0, // Reset for next sync
        completed_at: new Date().toISOString(),
        total_campaigns: campaigns.length,
        variants_synced: progress.variants_synced,
      },
    }).eq('id', data_source_id);

    console.log('SmartLead sync complete:', progress);

    return new Response(JSON.stringify({
      success: true,
      complete: true,
      progress,
      message: `Synced ${progress.campaigns_synced} campaigns, ${progress.variants_synced} variants, ${progress.metrics_created} metrics`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('smartlead-sync error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
