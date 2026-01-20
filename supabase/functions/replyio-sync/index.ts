import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Declare EdgeRuntime global for Supabase Edge Functions
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REPLYIO_V1_URL = 'https://api.reply.io/v1';
const REPLYIO_V3_URL = 'https://api.reply.io/v3';

// Reply.io Rate Limit: 10 seconds between API calls (strict!), 15,000 requests/month
const RATE_LIMIT_DELAY_LIST = 3000;
const RATE_LIMIT_DELAY_STATS = 10500;
// Increased time budget for full processing - edge functions can run up to 400s  
const TIME_BUDGET_MS = 300000;
// Remove practical batch limit - allow full sync to complete
const MAX_BATCHES = 1000;
const CONTINUATION_RETRIES = 3;

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

// Reply.io category to our category mapping
const REPLYIO_CATEGORY_MAP: Record<string, { category: string; sentiment: string; is_positive: boolean }> = {
  'Interested': { category: 'interested', sentiment: 'positive', is_positive: true },
  'Meeting Booked': { category: 'meeting_request', sentiment: 'positive', is_positive: true },
  'MeetingBooked': { category: 'meeting_request', sentiment: 'positive', is_positive: true },
  'Positive': { category: 'interested', sentiment: 'positive', is_positive: true },
  'Not Interested': { category: 'not_interested', sentiment: 'negative', is_positive: false },
  'NotInterested': { category: 'not_interested', sentiment: 'negative', is_positive: false },
  'Out of Office': { category: 'out_of_office', sentiment: 'neutral', is_positive: false },
  'OOO': { category: 'out_of_office', sentiment: 'neutral', is_positive: false },
  'Auto-reply': { category: 'out_of_office', sentiment: 'neutral', is_positive: false },
  'Referral': { category: 'referral', sentiment: 'neutral', is_positive: false },
  'Unsubscribed': { category: 'unsubscribe', sentiment: 'negative', is_positive: false },
  'OptedOut': { category: 'unsubscribe', sentiment: 'negative', is_positive: false },
  'Neutral': { category: 'neutral', sentiment: 'neutral', is_positive: false },
  'Question': { category: 'question', sentiment: 'neutral', is_positive: false },
};

function mapReplyioCategory(category: string | null | undefined, isInterested?: boolean | null): { 
  reply_category: string | null; 
  reply_sentiment: string | null; 
  is_positive: boolean;
} {
  // If explicitly marked as interested, use that
  if (isInterested === true) {
    return { reply_category: 'interested', reply_sentiment: 'positive', is_positive: true };
  }
  
  if (!category) return { reply_category: null, reply_sentiment: null, is_positive: false };
  
  const mapped = REPLYIO_CATEGORY_MAP[category];
  if (mapped) {
    return {
      reply_category: mapped.category,
      reply_sentiment: mapped.sentiment,
      is_positive: mapped.is_positive,
    };
  }
  
  // Fallback: try to infer from category name
  const lower = category.toLowerCase();
  if (lower.includes('interested') && !lower.includes('not')) {
    return { reply_category: 'interested', reply_sentiment: 'positive', is_positive: true };
  }
  if (lower.includes('meeting') || lower.includes('booked')) {
    return { reply_category: 'meeting_request', reply_sentiment: 'positive', is_positive: true };
  }
  
  return { reply_category: 'neutral', reply_sentiment: 'neutral', is_positive: false };
}

// Extract domain from email
function extractDomain(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1]?.toLowerCase();
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com'];
  if (personalDomains.includes(domain)) return null;
  return domain;
}

async function replyioRequest(
  endpoint: string, 
  apiKey: string, 
  options: { retries?: number; allow404?: boolean; delayMs?: number; useV1?: boolean; method?: string; body?: any } = {}
): Promise<any> {
  const { retries = 3, allow404 = false, delayMs = RATE_LIMIT_DELAY_LIST, useV1 = false, method = 'GET', body } = options;
  const baseUrl = useV1 ? REPLYIO_V1_URL : REPLYIO_V3_URL;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await delay(delayMs);
      const url = `${baseUrl}${endpoint}`;
      console.log(`Fetching: ${url}`);
      
      const fetchOptions: RequestInit = {
        method,
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      };
      if (body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(body);
      }
      
      const response = await fetch(url, fetchOptions);
      
      if (response.status === 429) {
        // Improved rate limiting with exponential backoff
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : Math.min(60000, 10000 * (attempt + 1));  // Exponential backoff, max 60s
        
        console.log(`Rate limited (429), waiting ${waitMs}ms before retry ${attempt + 1}/${retries}...`);
        await delay(waitMs);
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

// Self-continuation for next batch with exponential backoff retry
// CRITICAL: Include both 'apikey' and 'Authorization' headers for gateway compatibility
async function triggerNextBatch(
  supabaseUrl: string,
  serviceKey: string,
  clientId: string,
  engagementId: string,
  dataSourceId: string,
  batchNumber: number,
  phase: string
) {
  console.log(`Triggering next Reply.io batch (${batchNumber}, phase=${phase}) via self-continuation...`);
  
  // Get anon key from environment for apikey header
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  
  for (let attempt = 0; attempt < CONTINUATION_RETRIES; attempt++) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/replyio-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey, // Required by Supabase gateway
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          engagement_id: engagementId,
          data_source_id: dataSourceId,
          reset: false,
          batch_number: batchNumber,
          auto_continue: true,
          internal_continuation: true,
          current_phase: phase,
        }),
      });
      
      if (response.ok) {
        console.log(`Next batch triggered successfully, status: ${response.status}`);
        return;
      }
      
      // Log more details on failure
      const errorText = await response.text().catch(() => 'unable to read response body');
      console.warn(`Continuation attempt ${attempt + 1} failed - status: ${response.status}, body: ${errorText}`);
    } catch (error) {
      console.error(`Continuation attempt ${attempt + 1} error:`, error);
    }
    
    // Exponential backoff: 1s, 2s, 4s
    if (attempt < CONTINUATION_RETRIES - 1) {
      const backoffMs = 1000 * Math.pow(2, attempt);
      console.log(`Retrying in ${backoffMs}ms...`);
      await delay(backoffMs);
    }
  }
  
  console.error(`Failed to trigger next batch after ${CONTINUATION_RETRIES} attempts`);
}

async function triggerAnalysis(
  supabaseUrl: string,
  serviceKey: string,
  engagementId: string,
  classifyReplies: boolean = true
) {
  console.log('Sync complete - triggering analysis functions...');
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/backfill-features`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ engagement_id: engagementId }),
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
      body: JSON.stringify({ engagement_id: engagementId }),
    });
    console.log(`compute-patterns triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger compute-patterns:', error);
  }
  
  // Trigger variant decay computation
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/compute-variant-decay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ engagement_id: engagementId }),
    });
    console.log(`compute-variant-decay triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger compute-variant-decay:', error);
  }
  
  // Trigger AI reply classification
  if (classifyReplies) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/classify-replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ engagement_id: engagementId, batch_size: 100 }),
      });
      console.log(`classify-replies triggered, status: ${response.status}`);
    } catch (error) {
      console.error('Failed to trigger classify-replies:', error);
    }
  }
}

// Aggregate metrics from email_activities to campaign_variants
async function aggregateVariantMetrics(
  supabase: any,
  campaignDbId: string,
  engagementId: string
) {
  console.log(`  Aggregating variant metrics for campaign ${campaignDbId}...`);
  
  // Get all email activities for this campaign grouped by step
  const { data: activities } = await supabase
    .from('email_activities')
    .select('step_number, sent, opened, replied, reply_category')
    .eq('campaign_id', campaignDbId);
  
  if (!activities || activities.length === 0) return;
  
  // Aggregate by step_number
  const stepMetrics = new Map<number, { 
    sent: number; 
    opened: number; 
    replied: number; 
    positive: number;
  }>();
  
  for (const activity of activities) {
    const step = activity.step_number || 1;
    const current = stepMetrics.get(step) || { sent: 0, opened: 0, replied: 0, positive: 0 };
    
    if (activity.sent) current.sent++;
    if (activity.opened) current.opened++;
    if (activity.replied) current.replied++;
    if (activity.reply_category === 'meeting_request' || activity.reply_category === 'interested') {
      current.positive++;
    }
    
    stepMetrics.set(step, current);
  }
  
  // Update each variant with its metrics
  for (const [stepNumber, metrics] of stepMetrics) {
    const delivered = metrics.sent;
    
    await supabase
      .from('campaign_variants')
      .update({
        total_sent: metrics.sent,
        total_opened: metrics.opened,
        total_replied: metrics.replied,
        positive_replies: metrics.positive,
        open_rate: delivered > 0 ? (metrics.opened / delivered) * 100 : null,
        reply_rate: delivered > 0 ? (metrics.replied / delivered) * 100 : null,
        positive_reply_rate: delivered > 0 ? (metrics.positive / delivered) * 100 : null,
        updated_at: new Date().toISOString(),
      })
      .eq('campaign_id', campaignDbId)
      .eq('step_number', stepNumber);
  }
  
  console.log(`  Updated metrics for ${stepMetrics.size} variants`);
}

// Update campaign and daily_metrics with positive reply counts
async function aggregatePositiveReplies(
  supabase: any,
  campaignDbId: string
) {
  console.log(`  Aggregating positive replies for campaign ${campaignDbId}...`);
  
  // Count total positive replies
  const { count: totalPositive } = await supabase
    .from('email_activities')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignDbId)
    .in('reply_category', ['meeting_request', 'interested']);
  
  // Count total replies
  const { count: totalReplied } = await supabase
    .from('email_activities')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignDbId)
    .eq('replied', true);
  
  // Count total sent
  const { count: totalSent } = await supabase
    .from('email_activities')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignDbId)
    .eq('sent', true);
  
  // Update campaign totals
  const delivered = totalSent || 0;
  await supabase.from('campaigns').update({
    positive_replies: totalPositive || 0,
    total_replied: totalReplied || 0,
    positive_rate: delivered > 0 ? ((totalPositive || 0) / delivered) * 100 : 0,
    reply_rate: delivered > 0 ? ((totalReplied || 0) / delivered) * 100 : 0,
    updated_at: new Date().toISOString(),
  }).eq('id', campaignDbId);
  
  // Get positive replies grouped by date
  const { data: positiveByDate } = await supabase
    .from('email_activities')
    .select('replied_at')
    .eq('campaign_id', campaignDbId)
    .in('reply_category', ['meeting_request', 'interested'])
    .not('replied_at', 'is', null);
  
  // Group by date
  const dateGroups = new Map<string, number>();
  for (const activity of positiveByDate || []) {
    const date = new Date(activity.replied_at).toISOString().split('T')[0];
    dateGroups.set(date, (dateGroups.get(date) || 0) + 1);
  }
  
  // Update daily_metrics
  for (const [date, count] of dateGroups) {
    await supabase.from('daily_metrics').update({
      positive_replies: count,
      updated_at: new Date().toISOString(),
    }).eq('campaign_id', campaignDbId).eq('date', date);
  }
  
  console.log(`  Campaign positive: ${totalPositive}, updated ${dateGroups.size} daily records`);
}

// Strip HTML and return plain text
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
      client_id,
      engagement_id,
      data_source_id,
      reset = false, 
      batch_number = 1, 
      auto_continue = false,
      internal_continuation = false,
      current_phase = 'sequences',
      sync_people = true,
      sync_email_activities = true,
      sync_email_accounts = true,  // NEW: Sync email accounts
      classify_replies = true,
    } = body;

    // Auth check for initial requests (skip for internal continuations)
    const authHeader = req.headers.get('Authorization');
    
    if (!internal_continuation) {
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
      console.log(`Internal continuation batch ${batch_number} - using service role auth`);
    }
    
    if (!client_id || !engagement_id || !data_source_id) {
      return new Response(JSON.stringify({ error: 'Missing client_id, engagement_id, or data_source_id' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (batch_number > MAX_BATCHES) {
      console.error(`Max batch limit (${MAX_BATCHES}) reached. Stopping sync.`);
      
      await supabase.from('data_sources').update({
        last_sync_status: 'error',
        last_sync_error: `Sync stopped after ${MAX_BATCHES} batches`,
        updated_at: new Date().toISOString(),
      }).eq('id', data_source_id);
      
      return new Response(JSON.stringify({ 
        error: 'Max batch limit reached',
        batch_number,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Starting batch ${batch_number}, phase=${current_phase}, engagement=${engagement_id}`);

    // Get data source with API key
    const { data: dataSource, error: dsError } = await supabase
      .from('data_sources')
      .select('*')
      .eq('id', data_source_id)
      .eq('source_type', 'replyio')
      .single();
    
    if (dsError || !dataSource) {
      return new Response(JSON.stringify({ error: 'No Reply.io data source found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = dataSource.api_key_encrypted;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key configured' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const existingConfig = (dataSource.additional_config as any) || {};

    // Handle reset
    if (reset) {
      console.log('Resetting Reply.io sync data for engagement:', engagement_id);
      
      await supabase.from('daily_metrics').delete().eq('data_source_id', data_source_id);
      await supabase.from('campaign_variants').delete().eq('data_source_id', data_source_id);
      await supabase.from('sequences').delete().eq('data_source_id', data_source_id);
      await supabase.from('email_activities').delete().eq('data_source_id', data_source_id);
      await supabase.from('message_threads').delete().eq('data_source_id', data_source_id);
      await supabase.from('campaign_email_accounts').delete().eq('data_source_id', data_source_id);
      await supabase.from('campaigns').delete().eq('data_source_id', data_source_id);
      await supabase.from('email_accounts').delete().eq('engagement_id', engagement_id).eq('data_source_id', data_source_id);
      
      console.log('Reset complete');
    }

    // Update sync status
    await supabase.from('data_sources').update({ 
      last_sync_status: 'syncing',
      updated_at: new Date().toISOString(),
    }).eq('id', data_source_id);

    const progress = {
      sequences_synced: 0,
      metrics_created: 0,
      variants_synced: 0,
      people_synced: 0,
      companies_synced: 0,
      email_accounts_synced: 0,
      email_activities_synced: 0,
      message_threads_synced: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;
    
    // ============================================
    // SYNC PROGRESS TRACKING
    // ============================================
    let progressId: string | null = null;
    if (batch_number === 1) {
      try {
        const { data: progressRecord } = await supabase
          .from('sync_progress')
          .insert({
            data_source_id: data_source_id,
            engagement_id: engagement_id,
            status: 'running',
            current_phase: 'initializing',
          })
          .select('id')
          .single();
        progressId = progressRecord?.id;
        console.log('Created sync_progress record:', progressId);
      } catch (e) {
        console.log('Could not create sync progress record:', (e as Error).message);
      }
    } else {
      // Get existing progress record for continuation
      const { data: existingProgress } = await supabase
        .from('sync_progress')
        .select('id')
        .eq('data_source_id', data_source_id)
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      progressId = existingProgress?.id || null;
      if (progressId) console.log('Using existing sync_progress record:', progressId);
    }
    
    // Helper to update sync progress
    async function updateSyncProgress(updates: Record<string, any>) {
      if (!progressId) return;
      try {
        await supabase.from('sync_progress').update({
          ...updates,
          updated_at: new Date().toISOString(),
        }).eq('id', progressId);
      } catch (e) {
        console.log('Could not update sync progress:', (e as Error).message);
      }
    }

    // ============================================
    // PHASE 0: Fetch Email Accounts (once per sync)
    // ============================================
    if (sync_email_accounts && batch_number === 1 && current_phase === 'sequences') {
      console.log('=== Fetching email accounts ===');
      try {
        // Reply.io uses /emailAccounts endpoint for v3 API
        const emailAccountsRaw = await replyioRequest('/emailAccounts', apiKey, { 
          delayMs: RATE_LIMIT_DELAY_LIST,
          allow404: true 
        });
        
        const emailAccounts = Array.isArray(emailAccountsRaw) 
          ? emailAccountsRaw 
          : (emailAccountsRaw?.emailAccounts || emailAccountsRaw?.accounts || []);
        
        if (emailAccounts.length > 0) {
          console.log(`Found ${emailAccounts.length} email accounts`);
          
          for (const account of emailAccounts) {
            const { data: emailAccountData, error: eaError } = await supabase
              .from('email_accounts')
              .upsert({
                engagement_id,
                data_source_id,
                external_id: String(account.id || account.emailAccountId),
                from_email: account.email || account.fromEmail,
                from_name: account.name || account.fromName || null,
                smtp_host: account.smtpHost || null,
                smtp_port: account.smtpPort || null,
                is_smtp_success: account.isSmtpConnected ?? account.smtpStatus === 'connected',
                imap_host: account.imapHost || null,
                imap_port: account.imapPort || null,
                is_imap_success: account.isImapConnected ?? account.imapStatus === 'connected',
                message_per_day: account.dailyLimit || account.maxEmailsPerDay || null,
                daily_sent_count: account.sentToday || account.dailySentCount || 0,
                warmup_enabled: account.warmupEnabled ?? false,
                warmup_status: account.warmupStatus || null,
                account_type: account.type || account.provider || 'smtp',
                is_active: account.isActive ?? account.status === 'active',
                last_synced_at: new Date().toISOString(),
              }, { onConflict: 'engagement_id,from_email' })
              .select('id')
              .single();
            
            if (!eaError && emailAccountData) {
              progress.email_accounts_synced++;
            }
          }
        }
      } catch (e) {
        console.log('Email accounts not available:', (e as Error).message);
      }
    }

    // ============================================
    // PHASE 0.5: Fetch Global Statistics (/statistics v3)
    // ============================================
    if (batch_number === 1 && current_phase === 'sequences') {
      console.log('=== Fetching global statistics ===');
      try {
        const statsResponse = await replyioRequest('/statistics', apiKey, { 
          delayMs: RATE_LIMIT_DELAY_LIST,
          allow404: true 
        });
        
        if (statsResponse) {
          console.log('Global statistics available:', JSON.stringify(statsResponse).substring(0, 200));
          
          // Store aggregate stats in workspace/engagement metrics if useful
          const stats = statsResponse.statistics || statsResponse;
          const today = new Date().toISOString().split('T')[0];
          
          // These are account-wide stats, useful for benchmarking
          const aggStats = {
            total_sequences: stats.sequencesCount || stats.totalSequences || 0,
            total_people: stats.peopleCount || stats.totalPeople || 0,
            active_sequences: stats.activeSequencesCount || stats.activeSequences || 0,
            active_people: stats.activeContactsCount || stats.activePeople || 0,
            total_sent: stats.deliveriesCount || stats.sentCount || stats.sent || 0,
            total_opened: stats.opensCount || stats.openCount || stats.opens || 0,
            total_replied: stats.repliesCount || stats.replyCount || stats.replies || 0,
            total_bounced: stats.bouncesCount || stats.bounceCount || stats.bounces || 0,
            total_interested: stats.interestedCount || stats.interested || 0,
            total_not_interested: stats.notInterestedCount || stats.notInterested || 0,
            total_opted_out: stats.optOutsCount || stats.optedOut || 0,
          };
          
          console.log(`  Global stats: ${aggStats.total_sequences} sequences, ${aggStats.total_people} people, ${aggStats.total_sent} sent`);
          
          // Store in additional_config for reference
          await supabase.from('data_sources').update({
            additional_config: {
              ...existingConfig,
              global_statistics: aggStats,
              global_statistics_updated_at: new Date().toISOString(),
            },
          }).eq('id', data_source_id);
        }
      } catch (e) {
        console.log('Global statistics not available:', (e as Error).message);
      }
    }

    // ============================================
    // PHASE 1: Sync Sequences/Campaigns
    // ============================================
    if (current_phase === 'sequences') {
      // Use cached sequence list if available and not reset
      let allSequences: any[] = existingConfig.cached_sequences || [];
      
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
        
        // Cache sequences in data source config with extended fields
        await supabase.from('data_sources').update({
          additional_config: { 
            ...existingConfig,
            cached_sequences: allSequences.map((s: any) => ({ 
              id: s.id, 
              name: s.name, 
              status: s.status,
              ownerId: s.ownerId,
              teamId: s.teamId,
              isArchived: s.isArchived,
            })),
            sequence_index: 0,
            total_sequences: allSequences.length,
            batch_number: batch_number,
          },
        }).eq('id', data_source_id);
        
        // Update sync progress with total campaigns
        await updateSyncProgress({
          total_campaigns: allSequences.length,
          processed_campaigns: 0,
          current_phase: 'sequences',
        });
      } else {
        console.log(`Using cached sequence list: ${allSequences.length} sequences`);
        // Ensure sync progress reflects cached total
        await updateSyncProgress({
          total_campaigns: allSequences.length,
          current_phase: 'sequences',
        });
      }

      let startIndex = reset ? 0 : (existingConfig.sequence_index || 0);

      for (let i = startIndex; i < allSequences.length; i++) {
        // Heartbeat every 5 sequences - update data_sources and sync_progress
        if (i > 0 && i % 5 === 0) {
          await supabase.from('data_sources').update({
            additional_config: { 
              ...existingConfig,
              cached_sequences: allSequences,
              sequence_index: i, 
              total_sequences: allSequences.length,
              batch_number: batch_number,
              heartbeat: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          }).eq('id', data_source_id);
          
          // Update sync progress
          await updateSyncProgress({
            processed_campaigns: i,
            current_campaign_name: allSequences[i]?.name || null,
            records_synced: progress.sequences_synced + progress.people_synced + progress.email_activities_synced,
          });
        }
        
        if (isTimeBudgetExceeded()) {
          console.log(`Time budget exceeded at sequence ${i}/${allSequences.length}. Triggering continuation...`);
          
          await supabase.from('data_sources').update({
            additional_config: { 
              ...existingConfig,
              cached_sequences: allSequences,
              sequence_index: i, 
              total_sequences: allSequences.length,
              batch_number: batch_number,
            },
            last_sync_status: 'partial',
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', data_source_id);

          const shouldContinue = auto_continue || batch_number === 1;
          if (shouldContinue) {
            EdgeRuntime.waitUntil(
              triggerNextBatch(supabaseUrl, supabaseServiceKey, client_id, engagement_id, data_source_id, batch_number + 1, 'sequences')
            );
          }

          return new Response(JSON.stringify({
            success: true,
            complete: false,
            progress,
            current: i,
            total: allSequences.length,
            phase: 'sequences',
            batch_number,
            message: `Processed ${i}/${allSequences.length} sequences. ${shouldContinue ? 'Auto-continuing...' : 'Run again to continue.'}`,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const sequence = allSequences[i];
        console.log(`[${i + 1}/${allSequences.length}] Processing: ${sequence.name} (${sequence.status})`);

        try {
          // 1. Upsert campaign with extended fields
          const { data: campaign, error: campError } = await supabase
            .from('campaigns')
            .upsert({
              engagement_id,
              data_source_id,
              external_id: String(sequence.id),
              name: sequence.name,
              status: mapSequenceStatus(sequence.status),
              campaign_type: 'email',
              // Extended fields
              owner_id: sequence.ownerId ? String(sequence.ownerId) : null,
              team_id: sequence.teamId ? String(sequence.teamId) : null,
              is_archived: sequence.isArchived ?? false,
            }, { onConflict: 'engagement_id,data_source_id,external_id' })
            .select('id')
            .single();

          if (campError) {
            console.error(`Failed to upsert campaign ${sequence.name}:`, campError.message);
            progress.errors.push(`Campaign ${sequence.name}: ${campError.message}`);
            continue;
          }

          const campaignId = campaign.id;
          progress.sequences_synced++;

          // 2. Upsert sequence details
          await supabase.from('sequences').upsert({
            campaign_id: campaignId,
            data_source_id,
            external_id: String(sequence.id),
            name: sequence.name,
            status: mapSequenceStatus(sequence.status),
            step_count: sequence.stepsCount || sequence.steps?.length || 0,
          }, { onConflict: 'campaign_id,external_id' });

          // 3. Fetch and store variants (email templates) with extended fields
          const extractSteps = (resp: any): any[] => {
            if (!resp) return [];
            if (Array.isArray(resp)) return resp;
            if (Array.isArray(resp.steps)) return resp.steps;
            if (Array.isArray(resp.emails)) return resp.emails;
            if (Array.isArray(resp.items)) return resp.items;
            if (resp.sequence?.emails) return resp.sequence.emails;
            return [];
          };

          const upsertVariants = async (steps: any[], source: string) => {
            console.log(`  ${source} Found ${steps.length} step(s)`);
            
            for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
              const step = steps[stepIdx];
              
              const stepType = (step.type || step.stepType || '').toLowerCase();
              if (stepType && !['email', 'e-mail', 'manual_email', ''].includes(stepType)) {
                continue;
              }
              
              let templates: any[] = [];
              if (step.templates?.length > 0) {
                templates = step.templates;
              } else if (step.emails?.length > 0) {
                templates = step.emails;
              } else if (step.subject || step.body) {
                templates = [step];
              } else {
                continue;
              }
              
              for (let tplIdx = 0; tplIdx < templates.length; tplIdx++) {
                const tpl = templates[tplIdx];
                if (!tpl) continue;
                
                const subject = tpl.subject || tpl.emailSubject || tpl.title || '';
                const bodyContent = tpl.body || tpl.emailBody || tpl.text || tpl.content || '';
                
                if (!subject && !bodyContent) continue;

                const vars = extractPersonalizationVars(`${subject} ${bodyContent}`);
                const templateId = tpl.id || tpl.templateId;
                const externalId = templateId ? `tpl-${templateId}` : `step-${stepIdx + 1}-tpl-${tplIdx + 1}`;
                
                // Extract delay info if available
                const delayDays = step.delay || step.delayDays || step.waitDays || null;

                const { error: varErr } = await supabase
                  .from('campaign_variants')
                  .upsert({
                    campaign_id: campaignId,
                    data_source_id,
                    external_id: externalId,
                    subject_line: String(subject).substring(0, 500),
                    body_preview: String(bodyContent).substring(0, 500),
                    body_plain: String(bodyContent),
                    body_html: tpl.bodyHtml || tpl.htmlBody || bodyContent,
                    step_number: stepIdx + 1,
                    is_control: tplIdx === 0,
                    personalization_vars: vars,
                    // Extended fields
                    variant_label: tpl.label || tpl.variantName || null,
                    delay_days: delayDays,
                    delay_config: step.delayConfig || (delayDays ? { delay_in_days: delayDays } : null),
                    send_as_reply: step.sendAsReply ?? (stepIdx > 0),
                  }, { onConflict: 'campaign_id,external_id' });

                if (!varErr) {
                  progress.variants_synced++;
                }
              }
            }
          };

          // Try v3 API first
          try {
            const resp = await replyioRequest(
              `/sequences/${sequence.id}/steps`,
              apiKey,
              { retries: 1, allow404: true, delayMs: RATE_LIMIT_DELAY_LIST }
            );
            const steps = extractSteps(resp);
            if (steps.length) {
              await upsertVariants(steps, 'v3');
            }
          } catch (e) {
            console.log(`  v3 steps failed:`, (e as Error).message);
          }

          // 4. Fetch metrics using v1 API (lifetime totals)
          try {
            const seqDetailsRaw = await replyioRequest(
              `/campaigns?id=${sequence.id}`,
              apiKey,
              { retries: 2, allow404: true, delayMs: RATE_LIMIT_DELAY_STATS, useV1: true }
            );
            
            const seqDetails = Array.isArray(seqDetailsRaw) ? seqDetailsRaw[0] : seqDetailsRaw;
            
            if (seqDetails) {
              const today = new Date().toISOString().split('T')[0];
              const stats = seqDetails.stats || seqDetails.statistics || {};
              
              const totalSent = Number(
                seqDetails.deliveriesCount ?? stats.deliveriesCount ??
                stats.peopleContacted ?? stats.sent ?? 0
              );
              const totalOpened = Number(seqDetails.opensCount ?? stats.opensCount ?? stats.opened ?? 0);
              const totalClicked = Number(seqDetails.clicksCount ?? stats.clicksCount ?? stats.clicked ?? 0);
              const totalReplied = Number(seqDetails.repliesCount ?? stats.repliesCount ?? stats.replied ?? 0);
              const totalBounced = Number(seqDetails.bouncesCount ?? stats.bouncesCount ?? stats.bounced ?? 0);
              const totalPositive = Number(stats.interestedContacts ?? stats.interested ?? 0);
              
              // Extract enrollment stats for tracking
              const totalPeople = Number(seqDetails.peopleCount ?? stats.peopleCount ?? 0);
              const activePeople = Number(seqDetails.activeContactsCount ?? stats.activeContactsCount ?? 0);
              const finishedPeople = Number(seqDetails.finishedContactsCount ?? stats.finishedContactsCount ?? 0);
              const notStarted = Math.max(0, totalPeople - activePeople - finishedPeople);
              
              const enrollmentSettings = {
                total_leads: totalPeople,
                not_started: notStarted,
                in_progress: activePeople,
                completed: finishedPeople,
                blocked: 0,
                paused: 0,
                unsubscribed: Number(seqDetails.optOutsCount ?? stats.optOuts ?? 0),
              };
              
              console.log(`  Metrics: sent=${totalSent}, opens=${totalOpened}, replies=${totalReplied}, leads=${totalPeople}`);
              
              // Update campaign totals with proper error handling
              const { error: updateError } = await supabase.from('campaigns').update({
                total_sent: totalSent,
                total_opened: totalOpened,
                total_replied: totalReplied,
                total_bounced: totalBounced,
                total_delivered: Math.max(0, totalSent - totalBounced),
                positive_replies: totalPositive,
                open_rate: totalSent > 0 ? Math.min(0.9999, totalOpened / totalSent) : null,
                reply_rate: totalSent > 0 ? Math.min(0.9999, totalReplied / totalSent) : null,
                bounce_rate: totalSent > 0 ? Math.min(0.9999, totalBounced / totalSent) : null,
                positive_rate: totalReplied > 0 && totalPositive > 0 ? Math.min(0.9999, totalPositive / totalReplied) : null,
                last_synced_at: new Date().toISOString(),
                settings: enrollmentSettings,
              }).eq('id', campaignId);
              
              // Store enrollment snapshot for tracking trends
              if (enrollmentSettings.total_leads > 0 || enrollmentSettings.not_started > 0) {
                const { data: campaignRecord } = await supabase
                  .from('campaigns')
                  .select('engagement_id')
                  .eq('id', campaignId)
                  .single();
                const actualEngagementIdForSnapshot = campaignRecord?.engagement_id || engagement_id;
                
                await supabase.from('enrollment_snapshots').upsert({
                  campaign_id: campaignId,
                  engagement_id: actualEngagementIdForSnapshot,
                  date: today,
                  total_leads: enrollmentSettings.total_leads,
                  not_started: enrollmentSettings.not_started,
                  in_progress: enrollmentSettings.in_progress,
                  completed: enrollmentSettings.completed,
                  blocked: 0,
                  paused: 0,
                  unsubscribed: enrollmentSettings.unsubscribed,
                }, { onConflict: 'campaign_id,date' });
                console.log(`  Enrollment snapshot: total=${enrollmentSettings.total_leads}, backlog=${enrollmentSettings.not_started}`);
              }
              
              if (updateError) {
                console.error(`  Failed to update campaign totals:`, updateError.message);
                progress.errors.push(`Campaign ${sequence.name} metrics update: ${updateError.message}`);
              }
              
              // Get the campaign's ACTUAL engagement_id
              const { data: campaignRecord } = await supabase
                .from('campaigns')
                .select('engagement_id')
                .eq('id', campaignId)
                .single();
              
              const actualEngagementId = campaignRecord?.engagement_id || engagement_id;
              
              // Store daily metrics using the campaign's actual engagement_id
              if (totalSent > 0 || totalReplied > 0) {
                const { error: metricsErr } = await supabase.from('daily_metrics').upsert({
                  engagement_id: actualEngagementId,
                  campaign_id: campaignId,
                  data_source_id,
                  date: today,
                  emails_sent: totalSent,
                  emails_opened: totalOpened,
                  emails_clicked: totalClicked,
                  emails_replied: totalReplied,
                  emails_bounced: totalBounced,
                  positive_replies: totalPositive,
                  open_rate: totalSent > 0 ? Math.min(0.9999, totalOpened / totalSent) : null,
                  reply_rate: totalSent > 0 ? Math.min(0.9999, totalReplied / totalSent) : null,
                  bounce_rate: totalSent > 0 ? Math.min(0.9999, totalBounced / totalSent) : null,
                  positive_rate: totalReplied > 0 && totalPositive > 0 ? Math.min(0.9999, totalPositive / totalReplied) : null,
                }, { onConflict: 'engagement_id,campaign_id,date' });

                if (metricsErr) {
                  console.error(`  Failed to insert daily_metrics:`, metricsErr.message);
                } else {
                  progress.metrics_created++;
                }
              }
            }
          } catch (e) {
            console.error(`  v1 API error:`, (e as Error).message);
          }

          // ============================================
          // Fetch Sequence Reports (/reports/sequence v3)
          // ============================================
          try {
            const reportResponse = await replyioRequest(
              `/reports/sequence?sequenceId=${sequence.id}`,
              apiKey,
              { retries: 1, allow404: true, delayMs: RATE_LIMIT_DELAY_STATS }
            );
            
            if (reportResponse) {
              const report = reportResponse.report || reportResponse;
              const today = new Date().toISOString().split('T')[0];
              
              // Extract detailed report metrics
              const reportMetrics = {
                // Email metrics
                sent: report.sent || report.deliveriesCount || 0,
                opened: report.opened || report.opensCount || 0,
                clicked: report.clicked || report.clicksCount || 0,
                replied: report.replied || report.repliesCount || 0,
                bounced: report.bounced || report.bouncesCount || 0,
                
                // Engagement metrics
                interested: report.interested || report.interestedCount || 0,
                notInterested: report.notInterested || report.notInterestedCount || 0,
                optedOut: report.optedOut || report.optOutsCount || 0,
                
                // Time-based metrics if available
                avgResponseTime: report.avgResponseTime || report.averageResponseTime || null,
                avgOpenTime: report.avgOpenTime || report.averageOpenTime || null,
                
                // Conversion metrics
                meetings: report.meetings || report.meetingsBooked || 0,
                calls: report.calls || report.callsScheduled || 0,
              };
              
              console.log(`  Sequence report: sent=${reportMetrics.sent}, replies=${reportMetrics.replied}, interested=${reportMetrics.interested}`);
              
              // Update campaign with report data if newer
              if (reportMetrics.sent > 0) {
                await supabase.from('campaigns').update({
                  total_meetings: reportMetrics.meetings,
                  quality_score: reportMetrics.interested > 0 && reportMetrics.replied > 0 
                    ? Math.round((reportMetrics.interested / reportMetrics.replied) * 100) 
                    : null,
                }).eq('id', campaignId);
              }
              
              // Store detailed daily metrics from report
              if (report.dailyStats && Array.isArray(report.dailyStats)) {
                for (const dayStat of report.dailyStats) {
                  const date = dayStat.date || dayStat.day;
                  if (!date) continue;
                  
                  const { data: campaignRecord } = await supabase
                    .from('campaigns')
                    .select('engagement_id')
                    .eq('id', campaignId)
                    .single();
                  
                  const actualEngagementId = campaignRecord?.engagement_id || engagement_id;
                  
                  await supabase.from('daily_metrics').upsert({
                    engagement_id: actualEngagementId,
                    campaign_id: campaignId,
                    data_source_id,
                    date: typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0],
                    emails_sent: dayStat.sent || dayStat.deliveries || 0,
                    emails_opened: dayStat.opened || dayStat.opens || 0,
                    emails_clicked: dayStat.clicked || dayStat.clicks || 0,
                    emails_replied: dayStat.replied || dayStat.replies || 0,
                    emails_bounced: dayStat.bounced || dayStat.bounces || 0,
                    positive_replies: dayStat.interested || 0,
                    meetings_booked: dayStat.meetings || 0,
                  }, { onConflict: 'engagement_id,campaign_id,date' });
                  
                  progress.metrics_created++;
                }
              }
            }
          } catch (e) {
            console.log(`  Sequence report not available:`, (e as Error).message);
          }

          // ============================================
          // Fetch People with Extended Data
          // ============================================
          if (sync_people) {
            try {
              let offset = 0;
              const limit = 100;
              let hasMorePeople = true;
              
              while (hasMorePeople && !isTimeBudgetExceeded()) {
                const peopleUrl = `/sequences/${sequence.id}/people?top=${limit}&skip=${offset}`;
                const peopleResponse = await replyioRequest(peopleUrl, apiKey, { 
                  delayMs: RATE_LIMIT_DELAY_LIST,
                  allow404: true 
                });
                
                const people = Array.isArray(peopleResponse) 
                  ? peopleResponse 
                  : (peopleResponse?.people || peopleResponse?.items || []);
                
                if (!people || people.length === 0) {
                  hasMorePeople = false;
                  break;
                }
                
                console.log(`  Fetched ${people.length} people (offset ${offset})`);
                
                for (const person of people) {
                  try {
                    // Create/upsert company with proper conflict handling
                    let companyId: string | null = null;
                    const domain = extractDomain(person.email);
                    const companyName = person.company || domain || 'Unknown';
                    
                    // Try to find existing company first
                    if (domain) {
                      const { data: existingByDomain } = await supabase
                        .from('companies')
                        .select('id')
                        .eq('engagement_id', engagement_id)
                        .eq('domain', domain)
                        .maybeSingle();
                      
                      if (existingByDomain) {
                        companyId = existingByDomain.id;
                      }
                    }
                    
                    // If not found by domain, try by name
                    if (!companyId) {
                      const { data: existingByName } = await supabase
                        .from('companies')
                        .select('id')
                        .eq('engagement_id', engagement_id)
                        .eq('name', companyName)
                        .maybeSingle();
                      
                      if (existingByName) {
                        companyId = existingByName.id;
                      }
                    }
                    
                    // Create new company if not found
                    if (!companyId) {
                      const { data: newCompany, error: companyError } = await supabase
                        .from('companies')
                        .insert({
                          engagement_id,
                          name: companyName,
                          domain: domain,
                          website: domain ? `https://${domain}` : null,
                          source: 'replyio',
                        })
                        .select('id')
                        .single();
                      
                      if (!companyError && newCompany) {
                        companyId = newCompany.id;
                        progress.companies_synced++;
                      } else if (companyError?.code === '23505') {
                        // Duplicate - try to fetch again
                        const { data: retryCompany } = await supabase
                          .from('companies')
                          .select('id')
                          .eq('engagement_id', engagement_id)
                          .or(`domain.eq.${domain},name.eq.${companyName}`)
                          .maybeSingle();
                        companyId = retryCompany?.id;
                      }
                    }
                    
                    if (!companyId) continue;
                    
                    // Extract extended person data
                    const enrolledAt = person.addedAt || person.createdAt || person.created || person.added_at || null;
                    const sequenceStatus = person.status || person.contactStatus || null;
                    const currentStep = person.currentStep || person.step || null;
                    const finishReason = person.finishReason || person.endReason || null;
                    const isInterested = person.isInterested ?? person.interested ?? null;
                    const openCount = person.openedCount || person.opensCount || person.opens || 0;
                    const clickCount = person.clickedCount || person.clicksCount || person.clicks || 0;
                    const replyCount = person.repliedCount || person.repliesCount || person.replies || 0;
                    const lastActivityAt = person.lastActivityAt || person.lastActivity || null;
                    
                    // Upsert contact with extended fields
                    const { error: contactError } = await supabase
                      .from('contacts')
                      .upsert({
                        engagement_id,
                        company_id: companyId,
                        email: person.email,
                        first_name: person.firstName || person.first_name || null,
                        last_name: person.lastName || person.last_name || null,
                        phone: person.phone || person.phoneNumber || null,
                        linkedin_url: person.linkedInUrl || person.linkedin || null,
                        title: person.title || person.jobTitle || person.job_title || null,
                        enrolled_at: enrolledAt,
                        source: 'replyio',
                        // Extended fields
                        external_lead_id: person.id ? String(person.id) : null,
                        sequence_status: sequenceStatus,
                        current_step: currentStep,
                        finish_reason: finishReason,
                        is_interested: isInterested,
                        open_count: openCount,
                        click_count: clickCount,
                        reply_count: replyCount,
                        last_activity_at: lastActivityAt ? new Date(lastActivityAt).toISOString() : null,
                        is_unsubscribed: person.isOptedOut ?? person.unsubscribed ?? false,
                        unsubscribed_at: person.optOutAt || person.unsubscribedAt || null,
                      }, { onConflict: 'engagement_id,email' });
                    
                    if (!contactError) {
                      progress.people_synced++;
                    }
                  } catch (personError) {
                    console.error(`  Error processing person ${person.email}:`, personError);
                  }
                }
                
                offset += people.length;
                if (people.length < limit) hasMorePeople = false;
              }
            } catch (e) {
              console.log(`  People fetch not available for ${sequence.name}:`, (e as Error).message);
            }
          }

          // ============================================
          // Fetch Email Activities with Extended Data
          // ============================================
          if (sync_email_activities) {
            try {
              // Fetch email events for this sequence
              const eventsUrl = `/sequences/${sequence.id}/emailEvents`;
              const eventsResponse = await replyioRequest(eventsUrl, apiKey, { 
                delayMs: RATE_LIMIT_DELAY_LIST,
                allow404: true 
              });
              
              const events = Array.isArray(eventsResponse)
                ? eventsResponse
                : (eventsResponse?.events || eventsResponse?.items || []);
              
              if (events && events.length > 0) {
                console.log(`  Found ${events.length} email events`);
                
                for (const event of events) {
                  try {
                    const email = event.email || event.to || event.personEmail;
                    if (!email) continue;
                    
                    // Get contact for this email - or create on-the-fly if missing
                    let contact = null;
                    const { data: existingContact } = await supabase
                      .from('contacts')
                      .select('id, company_id')
                      .eq('engagement_id', engagement_id)
                      .eq('email', email)
                      .single();
                    
                    contact = existingContact;
                    
                    // Create contact if doesn't exist
                    if (!contact) {
                      const domain = extractDomain(email);
                      let companyId = null;
                      
                      // Try to find existing company by domain
                      if (domain) {
                        const { data: existingCompany } = await supabase
                          .from('companies')
                          .select('id')
                          .eq('engagement_id', engagement_id)
                          .eq('domain', domain)
                          .maybeSingle();
                        companyId = existingCompany?.id;
                      }
                      
                      // Create minimal contact
                      const { data: newContact, error: contactError } = await supabase
                        .from('contacts')
                        .insert({
                          engagement_id,
                          email: email,
                          company_id: companyId,
                          source: 'replyio',
                        })
                        .select('id, company_id')
                        .single();
                      
                      if (contactError) {
                        console.error(`  Failed to create contact for ${email}:`, contactError.message);
                        continue;
                      }
                      
                      contact = newContact;
                      progress.people_synced++;
                    }
                    
                    if (!contact) continue;
                    
                    // Extract bounce details
                    const bounceType = event.bounceType || event.bounce_type || 
                      (event.isHardBounce ? 'hard' : event.isSoftBounce ? 'soft' : null);
                    const bounceReason = event.bounceReason || event.bounce_reason || event.errorMessage || null;
                    
                    // Map category from Reply.io data
                    const eventCategory = event.category || event.replyCategory || event.personCategory || null;
                    const isInterested = event.isInterested ?? event.interested ?? null;
                    const mappedCategory = mapReplyioCategory(eventCategory, isInterested);
                    const hasReplied = event.replied ?? event.eventType === 'replied';
                    
                    const { error: activityError } = await supabase
                      .from('email_activities')
                      .upsert({
                        engagement_id,
                        campaign_id: campaignId,
                        data_source_id,
                        contact_id: contact.id,
                        company_id: contact.company_id,
                        external_id: event.id ? String(event.id) : null,
                        to_email: email,
                        from_email: event.fromEmail || event.from || null,
                        subject: event.subject || null,
                        sent: event.sent ?? event.eventType === 'sent',
                        sent_at: event.sentAt || event.sent_at ? new Date(event.sentAt || event.sent_at).toISOString() : null,
                        delivered: event.delivered ?? null,
                        delivered_at: event.deliveredAt ? new Date(event.deliveredAt).toISOString() : null,
                        opened: event.opened ?? event.eventType === 'opened',
                        first_opened_at: event.openedAt || event.opened_at ? new Date(event.openedAt || event.opened_at).toISOString() : null,
                        open_count: event.openCount || event.opensCount || 0,
                        clicked: event.clicked ?? event.eventType === 'clicked',
                        first_clicked_at: event.clickedAt || event.clicked_at ? new Date(event.clickedAt || event.clicked_at).toISOString() : null,
                        click_count: event.clickCount || event.clicksCount || 0,
                        replied: hasReplied,
                        replied_at: event.repliedAt || event.replied_at ? new Date(event.repliedAt || event.replied_at).toISOString() : null,
                        reply_text: event.replyText || event.reply || event.replyBody || null,
                        // Use mapped category and sentiment
                        reply_category: hasReplied ? mappedCategory.reply_category : null,
                        reply_sentiment: hasReplied ? (event.sentiment || event.replySentiment || mappedCategory.reply_sentiment) : null,
                        is_interested: isInterested,
                        bounced: event.bounced ?? event.eventType === 'bounced',
                        bounced_at: event.bouncedAt || event.bounced_at ? new Date(event.bouncedAt || event.bounced_at).toISOString() : null,
                        bounce_type: bounceType,
                        bounce_reason: bounceReason,
                        unsubscribed: event.unsubscribed ?? event.eventType === 'unsubscribed',
                        unsubscribed_at: event.unsubscribedAt ? new Date(event.unsubscribedAt).toISOString() : null,
                        marked_spam: event.markedSpam ?? event.isSpam ?? false,
                        spam_reported_at: event.spamReportedAt ? new Date(event.spamReportedAt).toISOString() : null,
                        step_number: event.stepNumber || event.step_number || event.step || null,
                        link_clicks: event.clickedLinks || event.links || null,
                        open_timestamps: event.openTimestamps || null,
                      }, { onConflict: 'engagement_id,campaign_id,contact_id,step_number' });
                    
                    if (!activityError) {
                      progress.email_activities_synced++;
                      
                      // Aggregate hourly metrics from timestamps
                      const addToHourlyMetrics = async (timestamp: string | null, metricType: 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced') => {
                        if (!timestamp) return;
                        try {
                          const date = new Date(timestamp);
                          const hour = date.getUTCHours();
                          const dayOfWeek = date.getUTCDay();
                          const metricDate = date.toISOString().split('T')[0];
                          
                          const metricData: Record<string, any> = {
                            engagement_id,
                            campaign_id: campaignId,
                            hour_of_day: hour,
                            day_of_week: dayOfWeek,
                            metric_date: metricDate,
                          };
                          metricData[`emails_${metricType}`] = 1;
                          
                          await supabase.from('hourly_metrics').upsert(metricData, { 
                            onConflict: 'engagement_id,campaign_id,hour_of_day,day_of_week,metric_date' 
                          });
                        } catch (e) {
                          // Continue on hourly metrics error
                        }
                      };
                      
                      // Add metrics from this event
                      if (event.sentAt || event.sent_at) await addToHourlyMetrics(event.sentAt || event.sent_at, 'sent');
                      if (event.openedAt || event.opened_at) await addToHourlyMetrics(event.openedAt || event.opened_at, 'opened');
                      if (event.clickedAt || event.clicked_at) await addToHourlyMetrics(event.clickedAt || event.clicked_at, 'clicked');
                      if (event.repliedAt || event.replied_at) await addToHourlyMetrics(event.repliedAt || event.replied_at, 'replied');
                      if (event.bouncedAt || event.bounced_at) await addToHourlyMetrics(event.bouncedAt || event.bounced_at, 'bounced');
                      
                      // If this is a reply with content, also store in message_threads
                      if (event.replyText || event.reply || event.replyBody) {
                        const replyContent = event.replyText || event.reply || event.replyBody;
                        await supabase.from('message_threads').upsert({
                          contact_id: contact.id,
                          campaign_id: campaignId,
                          engagement_id,
                          external_stats_id: event.id ? String(event.id) : null,
                          message_type: 'reply',
                          subject: event.subject || null,
                          body_html: replyContent,
                          body_plain: stripHtml(replyContent),
                          body_preview: stripHtml(replyContent).substring(0, 200),
                          sent_at: event.repliedAt ? new Date(event.repliedAt).toISOString() : new Date().toISOString(),
                          from_email: email,
                          to_email: event.fromEmail || null,
                          sequence_number: event.stepNumber || null,
                          is_automated: false,
                        }, { onConflict: 'engagement_id,external_stats_id,message_type' });
                        progress.message_threads_synced++;
                      }
                    }
                  } catch (e) {
                    // Continue on individual event errors
                  }
                }
              }
            } catch (e) {
              console.log(`  Email events not available for ${sequence.name}`);
            }
            
            // After email activities sync, aggregate variant metrics and positive replies
            await aggregateVariantMetrics(supabase, campaignId, engagement_id);
            await aggregatePositiveReplies(supabase, campaignId);
          }

        } catch (e) {
          console.error(`Error processing sequence ${sequence.name}:`, e);
          progress.errors.push(`Sequence ${sequence.name}: ${(e as Error).message}`);
        }
      }
    }

    // ============================================
    // Sync Complete
    // ============================================
    console.log('=== Reply.io sync complete ===');
    console.log(`Final: ${progress.sequences_synced} sequences, ${progress.metrics_created} metrics, ${progress.variants_synced} variants, ${progress.people_synced} people, ${progress.companies_synced} companies, ${progress.email_accounts_synced} email accounts, ${progress.email_activities_synced} email activities, ${progress.message_threads_synced} message threads`);
    
    // Mark sync progress as completed
    await updateSyncProgress({
      status: 'completed',
      processed_campaigns: progress.sequences_synced,
      records_synced: progress.sequences_synced + progress.people_synced + progress.email_activities_synced,
      current_phase: 'complete',
      current_campaign_name: null,
      completed_at: new Date().toISOString(),
      errors: progress.errors,
    });
    
    await supabase.from('data_sources').update({
      last_sync_status: 'success',
      last_sync_at: new Date().toISOString(),
      last_sync_records_processed: progress.sequences_synced,
      additional_config: {
        ...existingConfig,
        cached_sequences: null, // Clear cache
        sequence_index: 0,
        completed_at: new Date().toISOString(),
        sequences_synced: progress.sequences_synced,
        variants_synced: progress.variants_synced,
        people_synced: progress.people_synced,
        companies_synced: progress.companies_synced,
        email_accounts_synced: progress.email_accounts_synced,
        email_activities_synced: progress.email_activities_synced,
        message_threads_synced: progress.message_threads_synced,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', data_source_id);

    // Trigger analysis
    EdgeRuntime.waitUntil(triggerAnalysis(supabaseUrl, supabaseServiceKey, engagement_id));

    return new Response(JSON.stringify({
      success: true,
      complete: true,
      progress,
      message: `Synced ${progress.sequences_synced} sequences, ${progress.variants_synced} variants, ${progress.people_synced} contacts, ${progress.companies_synced} companies, ${progress.email_accounts_synced} email accounts, ${progress.email_activities_synced} email activities, ${progress.message_threads_synced} message threads`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('replyio-sync error:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message,
      stack: (error as Error).stack,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
