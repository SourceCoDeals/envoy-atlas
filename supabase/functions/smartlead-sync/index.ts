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
const RATE_LIMIT_DELAY = 350;  // Safer margin for SmartLead's 10 req/2s limit
// Increased time budget for full processing - edge functions can run up to 400s
const TIME_BUDGET_MS = 300000;
// Remove practical batch limit - allow full sync to complete
const MAX_BATCHES = 1000;
const CONTINUATION_RETRIES = 3;

// ============================================
// COMPREHENSIVE DATA INTERFACES
// ============================================
interface SmartleadCampaign {
  id: number;
  name: string;
  status: string;
  created_at: string;
  // Additional fields from API
  scheduler_cron_value?: string;
  min_time_btwn_emails?: number;
  max_leads_per_day?: number;
  track_settings?: {
    track_open?: boolean;
    track_click?: boolean;
    track_reply?: boolean;
  };
  stop_lead_settings?: {
    stop_on_reply?: boolean;
    stop_on_auto_reply?: boolean;
    stop_on_meeting_booked?: boolean;
  };
  timezone?: string;
  client_id?: number;
  user_id?: number;
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
  // Lead stats for enrollment tracking
  total_count?: number;
  drafted_count?: number;
  campaign_lead_stats?: {
    total?: number;
    notStarted?: number;
    inprogress?: number;
    completed?: number;
    blocked?: number;
    paused?: number;
    unsubscribed?: number;
  };
}

interface SmartleadSequence {
  seq_id: number;
  seq_number: number;
  subject: string;
  email_body: string;
  seq_delay_details?: { delay_in_days: number };
  variant_label?: string;
  send_as_reply?: boolean;
  sequence_variants?: Array<{
    variant_id: string;
    subject: string;
    email_body: string;
    variant_label?: string;
  }>;
}

interface SmartleadLead {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone_number?: string;
  website?: string;
  linkedin_profile?: string;
  custom_fields?: Record<string, any>;
  lead_status?: string;
  email_status?: string;
  created_at?: string;
  // Extended lead data
  status?: string;
  is_interested?: boolean;
  is_unsubscribed?: boolean;
  last_email_sequence_sent?: number;
  open_count?: number;
  click_count?: number;
  reply_count?: number;
  category_id?: string | number;
  lead_category?: string;
}

interface SmartleadEmailAccount {
  id: number;
  from_email: string;
  from_name?: string;
  smtp_host?: string;
  smtp_port?: number;
  is_smtp_success?: boolean;
  smtp_failure_error?: string;
  imap_host?: string;
  imap_port?: number;
  is_imap_success?: boolean;
  imap_failure_error?: string;
  message_per_day?: number;
  daily_sent_count?: number;
  warmup_enabled?: boolean;
  warmup_details?: {
    status?: string;
    warmup_reputation?: number;
    total_spam_count?: number;
    total_sent_count?: number;
  };
  custom_tracking_domain?: string;
  type?: string;
}

interface SmartleadCategory {
  id: number | string;
  name: string;
  color?: string;
  is_positive?: boolean;
  is_meeting?: boolean;
  is_ooo?: boolean;
  sort_order?: number;
}

interface SmartleadMessageHistory {
  stats_id: string;
  email_subject?: string;
  email_body?: string;
  sent_time?: string;
  type: 'SENT' | 'REPLY';
  from_email?: string;
  to_email?: string;
}

// SmartLead category to our category mapping
const SMARTLEAD_CATEGORY_MAP: Record<string, { category: string; sentiment: string; is_positive: boolean }> = {
  'Interested': { category: 'interested', sentiment: 'positive', is_positive: true },
  'Meeting Booked': { category: 'meeting_request', sentiment: 'positive', is_positive: true },
  'Meeting Scheduled': { category: 'meeting_request', sentiment: 'positive', is_positive: true },
  'Positive': { category: 'interested', sentiment: 'positive', is_positive: true },
  'Not Interested': { category: 'not_interested', sentiment: 'negative', is_positive: false },
  'Out of Office': { category: 'out_of_office', sentiment: 'neutral', is_positive: false },
  'OOO': { category: 'out_of_office', sentiment: 'neutral', is_positive: false },
  'Wrong Person': { category: 'referral', sentiment: 'neutral', is_positive: false },
  'Unsubscribed': { category: 'unsubscribe', sentiment: 'negative', is_positive: false },
  'Do Not Contact': { category: 'unsubscribe', sentiment: 'negative', is_positive: false },
  'Neutral': { category: 'neutral', sentiment: 'neutral', is_positive: false },
  'Question': { category: 'question', sentiment: 'neutral', is_positive: false },
  'Not Now': { category: 'not_now', sentiment: 'neutral', is_positive: false },
};

function mapSmartleadCategory(leadCategory: string | null | undefined): { 
  reply_category: string | null; 
  reply_sentiment: string | null; 
  is_positive: boolean;
} {
  if (!leadCategory) return { reply_category: null, reply_sentiment: null, is_positive: false };
  
  const mapped = SMARTLEAD_CATEGORY_MAP[leadCategory];
  if (mapped) {
    return {
      reply_category: mapped.category,
      reply_sentiment: mapped.sentiment,
      is_positive: mapped.is_positive,
    };
  }
  
  // Fallback: try to infer from category name
  const lower = leadCategory.toLowerCase();
  if (lower.includes('interested') && !lower.includes('not')) {
    return { reply_category: 'interested', reply_sentiment: 'positive', is_positive: true };
  }
  if (lower.includes('meeting') || lower.includes('booked') || lower.includes('scheduled')) {
    return { reply_category: 'meeting_request', reply_sentiment: 'positive', is_positive: true };
  }
  
  return { reply_category: 'neutral', reply_sentiment: 'neutral', is_positive: false };
}

interface SmartleadStatistic {
  id: number | string;
  lead_id: number;
  email: string;
  sent_time?: string;
  open_time?: string;
  click_time?: string;
  reply_time?: string;
  seq_number?: number;
  variant_id?: string;
  is_bounced?: boolean;
  bounce_type?: string;
  is_unsubscribed?: boolean;
  lead_category?: string;
  lead_category_id?: string | number;
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
        // Check for Retry-After header
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : Math.min(30000, (i + 1) * 3000);  // Exponential backoff, max 30s
        
        console.log(`Rate limited (429), waiting ${waitMs}ms before retry ${i + 1}/${retries}...`);
        await delay(waitMs);
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

// Extract domain from email
function extractDomain(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1]?.toLowerCase();
  // Exclude common personal email domains
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com'];
  if (personalDomains.includes(domain)) return null;
  return domain;
}

// Self-continuation for next batch with exponential backoff retry
// Uses service role key to avoid user JWT expiration issues
async function triggerNextBatch(
  supabaseUrl: string,
  serviceKey: string,
  clientId: string,
  engagementId: string,
  dataSourceId: string,
  batchNumber: number,
  phase: string
) {
  console.log(`Triggering next batch (${batchNumber}, phase=${phase}) via self-continuation...`);
  
  for (let attempt = 0; attempt < CONTINUATION_RETRIES; attempt++) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/smartlead-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      
      console.warn(`Continuation attempt ${attempt + 1} failed with status: ${response.status}`);
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

// Trigger post-sync analysis
async function triggerAnalysis(
  supabaseUrl: string,
  serviceKey: string,
  engagementId: string,
  classifyReplies: boolean = true
) {
  console.log('Sync complete - triggering analysis functions...');
  
  try {
    await fetch(`${supabaseUrl}/functions/v1/backfill-features`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ engagement_id: engagementId }),
    });
    console.log('backfill-features triggered');
  } catch (e) {
    console.error('Failed to trigger backfill-features:', e);
  }
  
  try {
    await fetch(`${supabaseUrl}/functions/v1/compute-patterns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ engagement_id: engagementId }),
    });
    console.log('compute-patterns triggered');
  } catch (e) {
    console.error('Failed to trigger compute-patterns:', e);
  }
  
  // Trigger variant decay computation
  try {
    await fetch(`${supabaseUrl}/functions/v1/compute-variant-decay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ engagement_id: engagementId }),
    });
    console.log('compute-variant-decay triggered');
  } catch (e) {
    console.error('Failed to trigger compute-variant-decay:', e);
  }
  
  // Trigger AI reply classification
  if (classifyReplies) {
    try {
      await fetch(`${supabaseUrl}/functions/v1/classify-replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ engagement_id: engagementId, batch_size: 100 }),
      });
      console.log('classify-replies triggered');
    } catch (e) {
      console.error('Failed to trigger classify-replies:', e);
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
    const delivered = metrics.sent; // Simplified - could subtract bounces
    
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

serve(async (req) => {
  console.log('smartlead-sync: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { 
      client_id,
      engagement_id,
      data_source_id,
      reset = false, 
      batch_number = 1, 
      auto_continue = true,
      internal_continuation = false,
      current_phase = 'campaigns',
      sync_leads = true,
      sync_email_accounts = true,
      sync_lead_categories = true,
      sync_statistics = true,
      sync_message_history = false,
      classify_replies = true,
    } = body;

    // Auth check: skip for internal continuations (they use service role)
    const authHeader = req.headers.get('Authorization');
    
    if (!internal_continuation) {
      if (!authHeader) {
        console.error('smartlead-sync: Missing authorization header');
        return new Response(JSON.stringify({ error: 'Missing authorization header' }), 
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: { user }, error: authError } = await createClient(
        supabaseUrl, anonKey,
        { global: { headers: { Authorization: authHeader } } }
      ).auth.getUser();

      if (authError || !user) throw new Error('Unauthorized');
    } else {
      console.log(`Internal continuation batch ${batch_number} - using service role auth`);
    }
    
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

    console.log(`Starting batch ${batch_number}, phase=${current_phase}, auto_continue=${auto_continue}`);

    // Verify user has access to this client (skip for internal continuations)
    if (!internal_continuation) {
      const { data: membership } = await supabase
        .from('client_members').select('role')
        .eq('client_id', client_id).single();
      if (!membership) throw new Error('Access denied to client');
    }

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
      leads_synced: 0,
      companies_synced: 0,
      email_accounts_synced: 0,
      lead_categories_synced: 0,
      email_activities_synced: 0,
      message_threads_synced: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;

    const existingConfig = (dataSource.additional_config as any) || {};

    // Create sync progress record (only for first batch)
    let progressId: string | null = null;
    if (batch_number === 1) {
      try {
        const { data: progressRecord } = await supabase
          .from('sync_progress')
          .insert({
            data_source_id: data_source_id,
            engagement_id: activeEngagementId,
            status: 'running',
            current_phase: 'initializing',
          })
          .select('id')
          .single();
        progressId = progressRecord?.id;
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
    }

    // Helper to update sync progress
    async function updateSyncProgress(updates: Record<string, any>) {
      if (!progressId) return;
      try {
        await supabase.from('sync_progress').update(updates).eq('id', progressId);
      } catch (e) {
        console.log('Could not update sync progress:', (e as Error).message);
      }
    }

    // Reset if requested
    if (reset) {
      console.log('Resetting synced data for engagement:', activeEngagementId);
      
      const { data: existingCampaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('engagement_id', activeEngagementId)
        .eq('data_source_id', data_source_id);
      
      const campaignIds = existingCampaigns?.map(c => c.id) || [];
      
      if (campaignIds.length > 0) {
        await supabase.from('daily_metrics').delete().in('campaign_id', campaignIds);
        await supabase.from('campaign_variants').delete().in('campaign_id', campaignIds);
        await supabase.from('email_activities').delete().in('campaign_id', campaignIds);
        await supabase.from('message_threads').delete().in('campaign_id', campaignIds);
        await supabase.from('campaign_email_accounts').delete().in('campaign_id', campaignIds);
        await supabase.from('campaigns').delete().in('id', campaignIds);
      }
      
      // Reset email accounts and categories for this engagement
      await supabase.from('email_accounts').delete().eq('engagement_id', activeEngagementId).eq('data_source_id', data_source_id);
      await supabase.from('lead_categories').delete().eq('engagement_id', activeEngagementId).eq('data_source_id', data_source_id);
      
      console.log('Reset complete');
    }

    // ============================================
    // PHASE 0: Sync Lead Categories (once)
    // ============================================
    if (sync_lead_categories && batch_number === 1 && current_phase === 'campaigns') {
      console.log('=== Fetching lead categories ===');
      try {
        const categoriesResponse = await smartleadRequest('/leads/fetch-categories', apiKey);
        const categories: SmartleadCategory[] = Array.isArray(categoriesResponse) 
          ? categoriesResponse 
          : (categoriesResponse?.categories || []);
        
        console.log(`Found ${categories.length} lead categories`);
        
        for (const cat of categories) {
          const isPositive = cat.is_positive ?? (
            (cat.name?.toLowerCase().includes('interested') && !cat.name?.toLowerCase().includes('not')) ||
            cat.name?.toLowerCase().includes('meeting') ||
            cat.name?.toLowerCase().includes('positive')
          );
          
          const isMeeting = cat.is_meeting ?? (cat.name?.toLowerCase().includes('meeting'));
          const isOoo = cat.is_ooo ?? (cat.name?.toLowerCase().includes('ooo') || cat.name?.toLowerCase().includes('out of office'));
          
          const { error: catError } = await supabase.from('lead_categories').upsert({
            engagement_id: activeEngagementId,
            data_source_id: data_source_id,
            external_id: String(cat.id),
            name: cat.name,
            color: cat.color || null,
            is_positive: isPositive,
            is_meeting: isMeeting,
            is_ooo: isOoo,
            sort_order: cat.sort_order || null,
          }, { onConflict: 'engagement_id,external_id' });
          
          if (!catError) progress.lead_categories_synced++;
        }
      } catch (e) {
        console.error('Failed to fetch lead categories:', e);
        progress.errors.push(`Lead categories: ${(e as Error).message}`);
      }
    }

    // ============================================
    // PHASE 1: Fetch All Campaigns
    // ============================================
    if (current_phase === 'campaigns') {
      console.log('=== PHASE 1: Fetching all campaigns ===');
      const campaignsRaw = await smartleadRequest('/campaigns', apiKey);
      const campaigns: SmartleadCampaign[] = Array.isArray(campaignsRaw) ? campaignsRaw : (campaignsRaw?.campaigns || []);
      console.log(`Found ${campaigns.length} total campaigns`);

      // Update progress with total campaigns
      await updateSyncProgress({
        total_campaigns: campaigns.length,
        current_phase: 'campaigns',
      });

      // Sort: active first, then by created_at
      campaigns.sort((a, b) => {
        const statusOrder = { active: 0, paused: 1, drafted: 2, completed: 3 };
        const aOrder = statusOrder[a.status?.toLowerCase() as keyof typeof statusOrder] ?? 4;
        const bOrder = statusOrder[b.status?.toLowerCase() as keyof typeof statusOrder] ?? 4;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

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
              triggerNextBatch(supabaseUrl, supabaseServiceKey, client_id, activeEngagementId, data_source_id, batch_number + 1, 'campaigns')
            );
          }

          return new Response(JSON.stringify({
            success: true,
            complete: false,
            progress,
            current: i,
            total: campaigns.length,
            phase: 'campaigns',
            batch_number,
            message: `Processed ${i}/${campaigns.length} campaigns. Auto-continuing...`,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const campaign = campaigns[i];
        console.log(`[${i + 1}/${campaigns.length}] Processing: ${campaign.name} (${campaign.status})`);

        // Update progress (every campaign)
        await updateSyncProgress({
          processed_campaigns: i,
          current_campaign_name: campaign.name,
          records_synced: progress.email_activities_synced + progress.leads_synced,
        });

        try {
          // Build schedule and sending limits config
          const scheduleConfig = {
            scheduler_cron_value: campaign.scheduler_cron_value || null,
            timezone: campaign.timezone || null,
          };
          
          const sendingLimits = {
            max_leads_per_day: campaign.max_leads_per_day || null,
            min_time_between_emails: campaign.min_time_btwn_emails || null,
          };

          // Upsert campaign to unified campaigns table with extended fields
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
              // Extended fields
              owner_id: campaign.user_id ? String(campaign.user_id) : null,
              team_id: campaign.client_id ? String(campaign.client_id) : null,
              timezone: campaign.timezone || null,
              schedule_config: scheduleConfig,
              sending_limits: sendingLimits,
              track_settings: campaign.track_settings || null,
              stop_lead_settings: campaign.stop_lead_settings || null,
              max_leads_per_day: campaign.max_leads_per_day || null,
              min_time_between_emails: campaign.min_time_btwn_emails || null,
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

          // ============================================
          // PRIORITY 1: Fetch Leads FIRST (before analytics)
          // This ensures contacts exist for email_activities
          // ============================================
          if (sync_leads) {
            try {
              let offset = 0;
              const limit = 100;
              let hasMoreLeads = true;
              
              // Get category lookup for this engagement
              const { data: categoriesLookup } = await supabase
                .from('lead_categories')
                .select('id, external_id')
                .eq('engagement_id', activeEngagementId);
              const categoryMap = new Map(categoriesLookup?.map(c => [c.external_id, c.id]) || []);
              
              while (hasMoreLeads && !isTimeBudgetExceeded()) {
                const leadsUrl = `/campaigns/${campaign.id}/leads?offset=${offset}&limit=${limit}`;
                const leadsResponse = await smartleadRequest(leadsUrl, apiKey);
                
                const leads: SmartleadLead[] = Array.isArray(leadsResponse) 
                  ? leadsResponse 
                  : (leadsResponse?.leads || leadsResponse?.data || []);
                
                if (leads.length === 0) {
                  hasMoreLeads = false;
                  break;
                }
                
                console.log(`  Fetched ${leads.length} leads (offset ${offset})`);
                
                // Debug: Log first lead structure to understand API response
                if (leads.length > 0 && offset === 0) {
                  const sampleLead = leads[0] as any;
                  console.log(`  DEBUG Top-level keys: ${Object.keys(sampleLead).join(', ')}`);
                  // Check if there's a nested 'lead' object
                  if (sampleLead.lead && typeof sampleLead.lead === 'object') {
                    console.log(`  DEBUG Nested lead keys: ${Object.keys(sampleLead.lead).join(', ')}`);
                    console.log(`  DEBUG Nested lead email: ${sampleLead.lead.email}, first_name: ${sampleLead.lead.first_name}`);
                  }
                }
                
                // Process leads in batch
                for (const leadRaw of leads) {
                  try {
                    const rawItem = leadRaw as any;
                    
                    // SmartLead API returns leads with a nested 'lead' object
                    // Structure: { campaign_lead_map_id, lead_category_id, status, created_at, lead: { email, first_name, ... } }
                    const lead = rawItem.lead || rawItem.lead_data || rawItem;
                    
                    // Extract email - the email is inside the nested 'lead' object
                    const leadEmail = lead?.email || rawItem.email || rawItem.lead_email;
                    const leadId = lead?.id || rawItem.id || rawItem.lead_id;
                    
                    // Skip if no email (critical field)
                    if (!leadEmail) {
                      if (offset === 0) {
                        console.log(`  Skipping lead without email. lead obj type: ${typeof lead}, has lead prop: ${!!rawItem.lead}`);
                      }
                      continue;
                    }
                    
                    // First, create/upsert company if we have company info
                    let companyId: string | null = null;
                    const domain = extractDomain(leadEmail);
                    const companyName = lead.company_name || (leadRaw as any).company_name || (leadRaw as any).company || domain || 'Unknown';
                    
                    // Try to find existing company first
                    if (domain) {
                      const { data: existingByDomain } = await supabase
                        .from('companies')
                        .select('id')
                        .eq('engagement_id', activeEngagementId)
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
                        .eq('engagement_id', activeEngagementId)
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
                          engagement_id: activeEngagementId,
                          name: companyName,
                          domain: domain,
                          website: lead.website || (domain ? `https://${domain}` : null),
                          source: 'smartlead',
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
                          .eq('engagement_id', activeEngagementId)
                          .or(`domain.eq.${domain},name.eq.${companyName}`)
                          .maybeSingle();
                        companyId = retryCompany?.id;
                      }
                    }
                    
                    if (!companyId) continue;
                    
                    // Map category if available - use leadRaw for status fields
                    const leadCategoryId = lead.category_id || (leadRaw as any).category_id;
                    const categoryId = leadCategoryId 
                      ? categoryMap.get(String(leadCategoryId)) 
                      : null;
                    
                    // Extract other fields - try both lead and leadRaw
                    const firstName = lead.first_name || (leadRaw as any).first_name || null;
                    const lastName = lead.last_name || (leadRaw as any).last_name || null;
                    const phoneNumber = lead.phone_number || (leadRaw as any).phone_number || (leadRaw as any).phone || null;
                    const linkedinUrl = lead.linkedin_profile || (leadRaw as any).linkedin_profile || (leadRaw as any).linkedin || null;
                    const title = lead.custom_fields?.title || lead.custom_fields?.job_title || (leadRaw as any).title || (leadRaw as any).job_title || null;
                    const emailStatus = lead.email_status || (leadRaw as any).email_status || null;
                    const leadStatus = lead.status || (leadRaw as any).status || lead.lead_status || (leadRaw as any).lead_status || null;
                    
                    // Upsert contact with extended fields
                    const enrolledAt = lead.created_at || (leadRaw as any).created_at || null;
                    const { error: contactError } = await supabase
                      .from('contacts')
                      .upsert({
                        engagement_id: activeEngagementId,
                        company_id: companyId,
                        email: leadEmail,
                        first_name: firstName,
                        last_name: lastName,
                        phone: phoneNumber,
                        linkedin_url: linkedinUrl,
                        title: title,
                        email_status: emailStatus,
                        enrolled_at: enrolledAt,
                        source: 'smartlead',
                        // Extended fields
                        external_lead_id: leadId ? String(leadId) : null,
                        sequence_status: leadStatus,
                        current_step: lead.last_email_sequence_sent || (leadRaw as any).last_email_sequence_sent || null,
                        is_interested: lead.is_interested ?? (leadRaw as any).is_interested ?? null,
                        is_unsubscribed: lead.is_unsubscribed ?? (leadRaw as any).is_unsubscribed ?? false,
                        category_id: categoryId,
                        open_count: lead.open_count || (leadRaw as any).open_count || 0,
                        click_count: lead.click_count || (leadRaw as any).click_count || 0,
                        reply_count: lead.reply_count || (leadRaw as any).reply_count || 0,
                      }, { onConflict: 'engagement_id,email' });
                    
                    if (!contactError) {
                      progress.leads_synced++;
                    } else {
                      console.error(`  Contact upsert error for ${leadEmail}:`, contactError.message);
                    }
                  } catch (leadError) {
                    // Silently continue on individual lead errors
                    console.error(`  Error processing lead:`, leadError);
                  }
                }
                
                offset += leads.length;
                if (leads.length < limit) hasMoreLeads = false;
              }
            } catch (e) {
              console.error(`  Leads error for ${campaign.name}:`, e);
              progress.errors.push(`Leads ${campaign.name}: ${(e as Error).message}`);
            }
          }

          // ============================================
          // PRIORITY 2: Fetch Email Accounts for this campaign
          // ============================================
          if (sync_email_accounts) {
            try {
              const emailAccountsRaw = await smartleadRequest(`/campaigns/${campaign.id}/email-accounts`, apiKey);
              const emailAccounts: SmartleadEmailAccount[] = Array.isArray(emailAccountsRaw) 
                ? emailAccountsRaw 
                : (emailAccountsRaw?.email_accounts || emailAccountsRaw?.accounts || []);
              
              if (emailAccounts.length > 0) {
                console.log(`  Found ${emailAccounts.length} email accounts`);
                
                for (const account of emailAccounts) {
                  // Upsert email account
                  let warmupDetails = account.warmup_details || {};
                  
                  // ============================================
                  // NEW: Fetch warmup-stats for enhanced deliverability data
                  // ============================================
                  let warmupScore: number | null = null;
                  let inboxRate: number | null = null;
                  let spamRate: number | null = null;
                  
                  try {
                    const warmupStatsUrl = `/email-accounts/${account.id}/warmup-stats`;
                    const warmupStats = await smartleadRequest(warmupStatsUrl, apiKey);
                    
                    if (warmupStats) {
                      warmupDetails = {
                        ...warmupDetails,
                        status: warmupStats.status || warmupDetails.status,
                        warmup_reputation: warmupStats.warmup_reputation ?? warmupStats.reputation ?? warmupDetails.warmup_reputation,
                        total_spam_count: warmupStats.spam_count ?? warmupStats.total_spam_count ?? warmupDetails.total_spam_count,
                        total_sent_count: warmupStats.sent_count ?? warmupStats.total_sent_count ?? warmupDetails.total_sent_count,
                      };
                      warmupScore = warmupStats.score ?? warmupStats.warmup_score ?? null;
                      inboxRate = warmupStats.inbox_rate ?? warmupStats.inboxRate ?? null;
                      spamRate = warmupStats.spam_rate ?? warmupStats.spamRate ?? null;
                      console.log(`    Warmup stats for ${account.from_email}: rep=${warmupDetails.warmup_reputation}, spam=${warmupDetails.total_spam_count}`);
                    }
                  } catch (e) {
                    // Warmup stats may not be available for all accounts
                  }
                  
                  const { data: emailAccountData, error: eaError } = await supabase
                    .from('email_accounts')
                    .upsert({
                      engagement_id: activeEngagementId,
                      data_source_id: data_source_id,
                      external_id: String(account.id),
                      from_email: account.from_email,
                      from_name: account.from_name || null,
                      smtp_host: account.smtp_host || null,
                      smtp_port: account.smtp_port || null,
                      is_smtp_success: account.is_smtp_success ?? null,
                      smtp_failure_error: account.smtp_failure_error || null,
                      imap_host: account.imap_host || null,
                      imap_port: account.imap_port || null,
                      is_imap_success: account.is_imap_success ?? null,
                      imap_failure_error: account.imap_failure_error || null,
                      message_per_day: account.message_per_day || null,
                      daily_sent_count: account.daily_sent_count || 0,
                      warmup_enabled: account.warmup_enabled ?? false,
                      warmup_status: warmupDetails.status || null,
                      warmup_reputation: warmupDetails.warmup_reputation || null,
                      warmup_spam_count: warmupDetails.total_spam_count || 0,
                      warmup_sent_count: warmupDetails.total_sent_count || 0,
                      custom_tracking_domain: account.custom_tracking_domain || null,
                      account_type: account.type || 'smtp',
                      is_active: true,
                      last_synced_at: new Date().toISOString(),
                    }, { onConflict: 'engagement_id,from_email' })
                    .select('id')
                    .single();
                  
                  if (!eaError && emailAccountData) {
                    progress.email_accounts_synced++;
                    
                    // Link account to campaign
                    await supabase.from('campaign_email_accounts').upsert({
                      campaign_id: campaignDbId,
                      email_account_id: emailAccountData.id,
                      is_active: true,
                    }, { onConflict: 'campaign_id,email_account_id' });
                  }
                }
              }
            } catch (e) {
              console.log(`  Email accounts not available for ${campaign.name}:`, (e as Error).message);
            }
          }

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

            // Extract lead stats for enrollment tracking
            const leadStats = (analytics as any).campaign_lead_stats || {};
            const enrollmentSettings = {
              total_leads: (analytics as any).total_count || 0,
              not_started: leadStats.notStarted || 0,
              in_progress: leadStats.inprogress || 0,
              completed: leadStats.completed || 0,
              blocked: leadStats.blocked || 0,
              paused: leadStats.paused || 0,
              unsubscribed: leadStats.unsubscribed || (analytics as any).unsubscribe_count || 0,
              drafted_count: (analytics as any).drafted_count || 0,
            };

            // Update campaign with totals and enrollment settings
            await supabase.from('campaigns').update({
              total_sent: totalSent,
              total_opened: totalOpened,
              total_replied: totalReplied,
              total_bounced: totalBounced,
              total_delivered: Math.max(0, totalSent - totalBounced),
              reply_rate: totalSent > 0 ? Math.min(0.9999, totalReplied / totalSent) : null,
              open_rate: totalSent > 0 ? Math.min(0.9999, totalOpened / totalSent) : null,
              bounce_rate: totalSent > 0 ? Math.min(0.9999, totalBounced / totalSent) : null,
              settings: enrollmentSettings,
            }).eq('id', campaignDbId);

            // Store enrollment snapshot for tracking trends
            if (enrollmentSettings.total_leads > 0 || enrollmentSettings.not_started > 0) {
              await supabase.from('enrollment_snapshots').upsert({
                campaign_id: campaignDbId,
                engagement_id: activeEngagementId,
                date: today,
                total_leads: enrollmentSettings.total_leads,
                not_started: enrollmentSettings.not_started,
                in_progress: enrollmentSettings.in_progress,
                completed: enrollmentSettings.completed,
                blocked: enrollmentSettings.blocked,
                paused: enrollmentSettings.paused,
                unsubscribed: enrollmentSettings.unsubscribed,
              }, { onConflict: 'campaign_id,date' });
              console.log(`  Enrollment snapshot: total=${enrollmentSettings.total_leads}, backlog=${enrollmentSettings.not_started}`);
            }

            // ============================================
            // NEW: Fetch analytics-by-date for granular daily metrics
            // SmartLead API limits to 30-day windows, so we chunk requests
            // ============================================
            try {
              // Get date range: campaign start to today
              const campaignStartStr = campaign.created_at 
                ? new Date(campaign.created_at).toISOString().split('T')[0]
                : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              
              const campaignStartDate = new Date(campaignStartStr);
              const todayDate = new Date(today);
              const msPerDay = 24 * 60 * 60 * 1000;
              const totalDays = Math.ceil((todayDate.getTime() - campaignStartDate.getTime()) / msPerDay);
              
              let totalDailyRecords = 0;
              
              // Chunk into 30-day windows
              const maxDaysPerRequest = 29; // Stay safely under 30
              let windowStart = new Date(campaignStartDate);
              
              while (windowStart < todayDate) {
                const windowEnd = new Date(Math.min(
                  windowStart.getTime() + maxDaysPerRequest * msPerDay,
                  todayDate.getTime()
                ));
                
                const startStr = windowStart.toISOString().split('T')[0];
                const endStr = windowEnd.toISOString().split('T')[0];
                
                try {
                  const analyticsUrl = `/campaigns/${campaign.id}/analytics-by-date?start_date=${startStr}&end_date=${endStr}`;
                  const dailyAnalytics = await smartleadRequest(analyticsUrl, apiKey);
                  
                  const dailyData = Array.isArray(dailyAnalytics) 
                    ? dailyAnalytics 
                    : (dailyAnalytics?.data || dailyAnalytics?.analytics || []);
                  
                  for (const day of dailyData) {
                    const metricDate = day.date || day.metric_date;
                    if (!metricDate) continue;
                    
                    const daySent = day.sent_count || day.sent || 0;
                    const dayOpened = day.open_count || day.unique_open_count || day.opened || 0;
                    const dayClicked = day.click_count || day.unique_click_count || day.clicked || 0;
                    const dayReplied = day.reply_count || day.replied || 0;
                    const dayBounced = day.bounce_count || day.bounced || 0;
                    const dayPositive = day.positive_count || day.positive_replies || 0;
                    
                    if (daySent > 0 || dayOpened > 0 || dayReplied > 0) {
                      await supabase.from('daily_metrics').upsert({
                        engagement_id: activeEngagementId,
                        campaign_id: campaignDbId,
                        data_source_id: data_source_id,
                        date: metricDate,
                        emails_sent: daySent,
                        emails_opened: dayOpened,
                        emails_clicked: dayClicked,
                        emails_replied: dayReplied,
                        emails_bounced: dayBounced,
                        positive_replies: dayPositive,
                        open_rate: daySent > 0 ? Math.min(0.9999, dayOpened / daySent) : null,
                        reply_rate: daySent > 0 ? Math.min(0.9999, dayReplied / daySent) : null,
                        bounce_rate: daySent > 0 ? Math.min(0.9999, dayBounced / daySent) : null,
                      }, { onConflict: 'engagement_id,campaign_id,date' });
                      progress.metrics_created++;
                      totalDailyRecords++;
                    }
                  }
                } catch (chunkError) {
                  // Continue to next chunk even if one fails
                  console.log(`  Chunk ${startStr}-${endStr} failed: ${(chunkError as Error).message}`);
                }
                
                // Move to next window
                windowStart = new Date(windowEnd.getTime() + msPerDay);
              }
              
              if (totalDailyRecords > 0) {
                console.log(`  Fetched ${totalDailyRecords} days of analytics-by-date (${Math.ceil(totalDays / maxDaysPerRequest)} chunks)`);
              }
            } catch (e) {
              // analytics-by-date may not be available for all campaigns - fall back to totals
              console.log(`  analytics-by-date not available: ${(e as Error).message}`);
              console.log(`  analytics-by-date not available: ${(e as Error).message}`);
              
              // Store daily metrics as before
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
            }
          } catch (e) {
            console.error(`  Analytics error for ${campaign.name}:`, e);
            progress.errors.push(`Analytics ${campaign.name}: ${(e as Error).message}`);
          }

          // Fetch sequences/variants with extended fields
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
                const delayDays = seq.seq_delay_details?.delay_in_days || null;
                
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
                    // Extended fields
                    variant_label: seq.variant_label || null,
                    delay_days: delayDays,
                    delay_config: seq.seq_delay_details || null,
                    send_as_reply: seq.send_as_reply ?? (seqNumber > 1),
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
                      variant_label: variant.variant_label || null,
                      delay_days: delayDays,
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

          // ============================================
          // Fetch Individual Statistics (Email Events)
          // ============================================
          if (sync_statistics) {
            try {
              let offset = 0;
              const limit = 100;
              let hasMoreStats = true;
              
              while (hasMoreStats && !isTimeBudgetExceeded()) {
                const statsUrl = `/campaigns/${campaign.id}/statistics?offset=${offset}&limit=${limit}`;
                const statsResponse = await smartleadRequest(statsUrl, apiKey);
                
                const stats: SmartleadStatistic[] = Array.isArray(statsResponse) 
                  ? statsResponse 
                  : (statsResponse?.statistics || statsResponse?.data || []);
                
                if (stats.length === 0) {
                  hasMoreStats = false;
                  break;
                }
                
                console.log(`  Fetched ${stats.length} statistics (offset ${offset})`);
                
                // Get category lookup for this engagement
                const { data: categoriesLookup } = await supabase
                  .from('lead_categories')
                  .select('id, external_id')
                  .eq('engagement_id', activeEngagementId);
                const categoryMap = new Map(categoriesLookup?.map(c => [c.external_id, c.id]) || []);
                
                for (const stat of stats) {
                  try {
                    const email = stat.email;
                    if (!email) continue;
                    
                    // Get contact for this email - or create on-the-fly if missing
                    let contact = null;
                    const { data: existingContact } = await supabase
                      .from('contacts')
                      .select('id, company_id')
                      .eq('engagement_id', activeEngagementId)
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
                          .eq('engagement_id', activeEngagementId)
                          .eq('domain', domain)
                          .maybeSingle();
                        companyId = existingCompany?.id;
                      }
                      
                      // Create minimal contact
                      const { data: newContact, error: contactError } = await supabase
                        .from('contacts')
                        .insert({
                          engagement_id: activeEngagementId,
                          email: email,
                          company_id: companyId,
                          source: 'smartlead',
                        })
                        .select('id, company_id')
                        .single();
                      
                      if (contactError) {
                        console.error(`  Failed to create contact for ${email}:`, contactError.message);
                        continue;
                      }
                      
                      contact = newContact;
                      progress.leads_synced++;
                    }
                    
                    if (!contact) continue;
                    
                    // Map category if available
                    const categoryId = stat.lead_category_id 
                      ? categoryMap.get(String(stat.lead_category_id)) 
                      : null;
                    
                    // Get mapped category from SmartLead's lead_category for replies
                    const mappedCategory = mapSmartleadCategory(stat.lead_category);
                    
                    const { error: activityError } = await supabase
                      .from('email_activities')
                      .upsert({
                        engagement_id: activeEngagementId,
                        campaign_id: campaignDbId,
                        data_source_id: data_source_id,
                        contact_id: contact.id,
                        company_id: contact.company_id,
                        external_id: stat.id ? String(stat.id) : null,
                        to_email: email,
                        sent: !!stat.sent_time,
                        sent_at: stat.sent_time ? new Date(stat.sent_time).toISOString() : null,
                        opened: !!stat.open_time,
                        first_opened_at: stat.open_time ? new Date(stat.open_time).toISOString() : null,
                        clicked: !!stat.click_time,
                        first_clicked_at: stat.click_time ? new Date(stat.click_time).toISOString() : null,
                        replied: !!stat.reply_time,
                        replied_at: stat.reply_time ? new Date(stat.reply_time).toISOString() : null,
                        bounced: stat.is_bounced ?? false,
                        bounce_type: stat.bounce_type || null,
                        unsubscribed: stat.is_unsubscribed ?? false,
                        step_number: stat.seq_number || null,
                        lead_category: stat.lead_category || null,
                        category_id: categoryId,
                        // Map reply category and sentiment from SmartLead's classification
                        reply_category: stat.reply_time ? mappedCategory.reply_category : null,
                        reply_sentiment: stat.reply_time ? mappedCategory.reply_sentiment : null,
                      }, { onConflict: 'engagement_id,campaign_id,contact_id,step_number' });
                    
                    if (!activityError) {
                      progress.email_activities_synced++;
                      
                      // Aggregate hourly metrics from timestamps
                      const hourlyBuckets: Map<string, { sent: number; opened: number; clicked: number; replied: number; bounced: number }> = new Map();
                      
                      const addToHourlyBucket = (timestamp: string | null, metricType: 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced') => {
                        if (!timestamp) return;
                        const date = new Date(timestamp);
                        const hour = date.getUTCHours();
                        const dayOfWeek = date.getUTCDay();
                        const metricDate = date.toISOString().split('T')[0];
                        const key = `${hour}-${dayOfWeek}-${metricDate}`;
                        
                        if (!hourlyBuckets.has(key)) {
                          hourlyBuckets.set(key, { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 });
                        }
                        const bucket = hourlyBuckets.get(key)!;
                        bucket[metricType]++;
                      };
                      
                      // Add metrics from this stat
                      if (stat.sent_time) addToHourlyBucket(stat.sent_time, 'sent');
                      if (stat.open_time) addToHourlyBucket(stat.open_time, 'opened');
                      if (stat.click_time) addToHourlyBucket(stat.click_time, 'clicked');
                      if (stat.reply_time) addToHourlyBucket(stat.reply_time, 'replied');
                      if (stat.is_bounced && stat.sent_time) addToHourlyBucket(stat.sent_time, 'bounced');
                      
                      // Upsert hourly metrics
                      for (const [key, metrics] of hourlyBuckets) {
                        const [hour, dayOfWeek, metricDate] = key.split('-');
                        await supabase.from('hourly_metrics').upsert({
                          engagement_id: activeEngagementId,
                          campaign_id: campaignDbId,
                          hour_of_day: parseInt(hour),
                          day_of_week: parseInt(dayOfWeek),
                          metric_date: metricDate,
                          emails_sent: metrics.sent,
                          emails_opened: metrics.opened,
                          emails_clicked: metrics.clicked,
                          emails_replied: metrics.replied,
                          emails_bounced: metrics.bounced,
                        }, { onConflict: 'engagement_id,campaign_id,hour_of_day,day_of_week,metric_date' });
                      }
                    }
                  } catch (e) {
                    // Continue on individual stat errors
                  }
                }
                
                offset += stats.length;
                if (stats.length < limit) hasMoreStats = false;
              }
            } catch (e) {
              console.log(`  Statistics not available for ${campaign.name}:`, (e as Error).message);
            }
            
            // After statistics sync, aggregate variant metrics and positive replies
            await aggregateVariantMetrics(supabase, campaignDbId, activeEngagementId);
            await aggregatePositiveReplies(supabase, campaignDbId);
          }

          // NOTE: Leads are now synced FIRST in PRIORITY 1 section above
          // to ensure contacts exist before email_activities are synced

        } catch (e) {
          console.error(`Error processing campaign ${campaign.name}:`, e);
          progress.errors.push(`${campaign.name}: ${(e as Error).message}`);
        }
      }

      // Campaigns phase complete, move to completion
      console.log('=== Campaigns phase complete ===');
    }

    // ============================================
    // PHASE 2: Sync Complete
    // ============================================
    const hasErrors = progress.errors.length > 0;
    const finalStatus = hasErrors ? 'partial' : 'completed';

    // Update sync progress record
    await updateSyncProgress({
      status: finalStatus,
      processed_campaigns: progress.campaigns_synced,
      records_synced: progress.email_activities_synced + progress.leads_synced,
      errors: progress.errors,
      completed_at: new Date().toISOString(),
      current_phase: 'complete',
      current_campaign_name: null,
    });

    await supabase.from('data_sources').update({
      last_sync_status: 'success',
      last_sync_at: new Date().toISOString(),
      last_sync_records_processed: progress.campaigns_synced,
      additional_config: {
        ...existingConfig,
        campaign_index: 0,
        completed_at: new Date().toISOString(),
        campaigns_synced: progress.campaigns_synced,
        variants_synced: progress.variants_synced,
        leads_synced: progress.leads_synced,
        companies_synced: progress.companies_synced,
        email_accounts_synced: progress.email_accounts_synced,
        lead_categories_synced: progress.lead_categories_synced,
        email_activities_synced: progress.email_activities_synced,
        message_threads_synced: progress.message_threads_synced,
      },
    }).eq('id', data_source_id);

    // Trigger analysis functions
    EdgeRuntime.waitUntil(triggerAnalysis(supabaseUrl, supabaseServiceKey, activeEngagementId));

    console.log('SmartLead sync complete:', progress);

    return new Response(JSON.stringify({
      success: true,
      complete: true,
      progress,
      message: `Synced ${progress.campaigns_synced} campaigns, ${progress.variants_synced} variants, ${progress.leads_synced} contacts, ${progress.companies_synced} companies, ${progress.email_accounts_synced} email accounts, ${progress.lead_categories_synced} categories, ${progress.email_activities_synced} email activities, ${progress.message_threads_synced} message threads`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('smartlead-sync error:', error);

    // Update sync progress to failed and add to retry queue
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Mark any running progress as failed
    try {
      await supabaseAdmin.from('sync_progress')
        .update({ 
          status: 'failed', 
          errors: [{ message: (error as Error).message }],
          completed_at: new Date().toISOString(),
        })
        .eq('status', 'running');
    } catch (e) {
      console.log('Could not update sync progress:', e);
    }

    // Add to retry queue if not already a retry
    try {
      const body = await new Response(req.clone().body).json().catch(() => ({}));
      if (!body.is_retry && body.data_source_id) {
        await supabaseAdmin.from('sync_retry_queue').insert({
          data_source_id: body.data_source_id,
          engagement_id: body.engagement_id,
          last_error: (error as Error).message,
          next_retry_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
        });
        console.log('Added sync to retry queue');
      }
    } catch (e) {
      console.log('Could not add to retry queue:', e);
    }

    return new Response(JSON.stringify({ error: (error as Error).message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
