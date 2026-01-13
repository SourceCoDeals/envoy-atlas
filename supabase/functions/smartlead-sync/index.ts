import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';
const RATE_LIMIT_DELAY = 450;
const BATCH_SIZE = 20;
const TIME_BUDGET_MS = 55000;
const SYNC_LOCK_TIMEOUT_MS = 30000;

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
  'aol.com', 'icloud.com', 'protonmail.com', 'mail.com',
  'live.com', 'msn.com', 'me.com', 'ymail.com', 'googlemail.com',
  'yahoo.co.uk', 'hotmail.co.uk', 'outlook.co.uk', 'btinternet.com',
  'sky.com', 'virgin.net', 'ntlworld.com', 'talktalk.net',
  'gmx.com', 'gmx.net', 'web.de', 'zoho.com', 'fastmail.com',
  'tutanota.com', 'pm.me', 'proton.me'
]);

const SPAM_TRIGGERS = [
  'free', 'guarantee', 'no obligation', 'winner', 'cash', 'urgent',
  'act now', 'limited time', 'exclusive deal', 'click here', 'buy now',
  'order now', 'don\'t miss', 'special promotion', 'amazing', 'incredible'
];

function classifyEmailType(email: string): 'personal' | 'work' {
  const domain = email.split('@')[1]?.toLowerCase();
  return PERSONAL_DOMAINS.has(domain) ? 'personal' : 'work';
}

function extractEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

interface CopyFeatures {
  subject_char_count: number;
  subject_word_count: number;
  subject_is_question: boolean;
  subject_has_number: boolean;
  subject_has_emoji: boolean;
  subject_personalization_position: number | null;
  subject_personalization_count: number;
  subject_first_word_type: string;
  subject_capitalization_style: string;
  subject_spam_score: number;
  body_word_count: number;
  body_sentence_count: number;
  body_avg_sentence_length: number;
  body_reading_grade: number;
  body_personalization_density: number;
  body_personalization_types: string[];
  body_has_link: boolean;
  body_link_count: number;
  body_has_calendar_link: boolean;
  body_cta_type: string;
  body_cta_position: string;
  body_question_count: number;
  body_has_proof: boolean;
  body_tone: string;
  body_paragraph_count: number;
  body_bullet_point_count: number;
}

function extractCopyFeatures(subjectLine: string | null, emailBody: string | null): CopyFeatures {
  const subject = subjectLine || '';
  const body = emailBody || '';
  
  const subjectWords = subject.split(/\s+/).filter(Boolean);
  const subjectTokens = [...subject.matchAll(/\{\{?(\w+)\}?\}/g)];
  const firstToken = subjectTokens[0];
  
  const firstWord = subjectWords[0]?.toLowerCase() || '';
  let firstWordType = 'other';
  if (/^(hey|hi|hello)/i.test(firstWord)) firstWordType = 'greeting';
  else if (/^(who|what|when|where|why|how|is|are|do|does|can|could|would)/i.test(firstWord)) firstWordType = 'question';
  else if (/^(quick|just|re:|fwd:)/i.test(firstWord)) firstWordType = 'casual';
  else if (/^\{\{?first_?name\}?\}?$/i.test(subjectWords[0] || '')) firstWordType = 'name';
  else if (/^\{\{?company\}?\}?$/i.test(subjectWords[0] || '')) firstWordType = 'company';
  
  let capStyle = 'mixed';
  if (subject === subject.toLowerCase()) capStyle = 'lowercase';
  else if (subject === subject.toUpperCase()) capStyle = 'uppercase';
  else if (subjectWords.every(w => w[0] === w[0]?.toUpperCase())) capStyle = 'title_case';
  else if (subjectWords[0]?.[0] === subjectWords[0]?.[0]?.toUpperCase() && 
           subjectWords.slice(1).every(w => w[0] === w[0]?.toLowerCase() || /^\{\{/.test(w))) capStyle = 'sentence_case';
  
  const subjectLower = subject.toLowerCase();
  const spamCount = SPAM_TRIGGERS.filter(trigger => subjectLower.includes(trigger)).length;
  const spamScore = Math.min(100, spamCount * 15);
  
  const hasEmoji = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(subject);
  
  const bodyClean = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const bodyWords = bodyClean.split(/\s+/).filter(Boolean);
  const sentences = bodyClean.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const bodyTokens = [...body.matchAll(/\{\{?(\w+)\}?\}/g)];
  const tokenTypes = [...new Set(bodyTokens.map(m => m[1].toLowerCase()))];
  
  let ctaType = 'no_cta';
  if (/tuesday|wednesday|thursday|friday|monday/i.test(body) && /\bor\b/i.test(body)) {
    ctaType = 'choice_ask';
  } else if (/open to|would you be|interested in/i.test(body)) {
    ctaType = 'soft_ask';
  } else if (/schedule|book|calendar|15 min|30 min|call/i.test(body)) {
    ctaType = 'direct_ask';
  } else if (/send you|share with you|want me to|can i send/i.test(body)) {
    ctaType = 'value_ask';
  } else if (/who handles|who owns|who should|right person|point me/i.test(body)) {
    ctaType = 'referral_ask';
  } else if (body.includes('?') && !/schedule|book|open to/i.test(body)) {
    ctaType = 'question_only';
  }
  
  const bodyLength = bodyClean.length;
  const lastQuestionPos = bodyClean.lastIndexOf('?');
  let ctaPosition = 'end';
  if (lastQuestionPos > 0) {
    const relativePos = lastQuestionPos / bodyLength;
    if (relativePos < 0.33) ctaPosition = 'beginning';
    else if (relativePos < 0.66) ctaPosition = 'middle';
  }
  
  const linkCount = (body.match(/https?:\/\/[^\s<]+/g) || []).length;
  const hasCalendarLink = /calendly\.com|cal\.com|hubspot\.com\/meetings|chili ?piper/i.test(body);
  const hasProof = /\d+%|\d+ clients|\d+ companies|trusted by|featured in|as seen|case study/i.test(body);
  
  let tone = 'direct';
  const bodyLower = body.toLowerCase();
  if (/hope this|just wanted|thought i'd|reaching out/i.test(bodyLower)) tone = 'casual';
  else if (/dear|sincerely|regards|respectfully/i.test(bodyLower)) tone = 'formal';
  else if (/help you|solve|challenge|struggle|pain/i.test(bodyLower)) tone = 'consultative';
  
  const paragraphs = body.split(/\n\s*\n/).filter(p => p.trim());
  const bullets = (body.match(/^[\s]*[-•*]\s/gm) || []).length;
  
  const avgSentenceLength = sentences.length > 0 ? bodyWords.length / sentences.length : 0;
  const avgWordLength = bodyWords.length > 0 ? bodyClean.replace(/\s/g, '').length / bodyWords.length : 0;
  const readingGrade = Math.max(0, Math.min(18, 0.39 * avgSentenceLength + 11.8 * (avgWordLength / 5) - 15.59));
  
  return {
    subject_char_count: subject.length,
    subject_word_count: subjectWords.length,
    subject_is_question: subject.trim().endsWith('?'),
    subject_has_number: /\d/.test(subject),
    subject_has_emoji: hasEmoji,
    subject_personalization_position: firstToken ? subject.indexOf(firstToken[0]) : null,
    subject_personalization_count: subjectTokens.length,
    subject_first_word_type: firstWordType,
    subject_capitalization_style: capStyle,
    subject_spam_score: spamScore,
    body_word_count: bodyWords.length,
    body_sentence_count: sentences.length,
    body_avg_sentence_length: Number(avgSentenceLength.toFixed(2)),
    body_reading_grade: Number(readingGrade.toFixed(2)),
    body_personalization_density: bodyWords.length > 0 ? Number((bodyTokens.length / bodyWords.length).toFixed(4)) : 0,
    body_personalization_types: tokenTypes,
    body_has_link: linkCount > 0,
    body_link_count: linkCount,
    body_has_calendar_link: hasCalendarLink,
    body_cta_type: ctaType,
    body_cta_position: ctaPosition,
    body_question_count: (body.match(/\?/g) || []).length,
    body_has_proof: hasProof,
    body_tone: tone,
    body_paragraph_count: paragraphs.length,
    body_bullet_point_count: bullets,
  };
}

async function upsertVariantFeatures(
  supabase: any,
  variantId: string,
  workspaceId: string,
  subjectLine: string | null,
  emailBody: string | null
) {
  const features = extractCopyFeatures(subjectLine, emailBody);
  
  const { error } = await supabase
    .from('smartlead_variant_features')
    .upsert({
      variant_id: variantId,
      workspace_id: workspaceId,
      ...features,
      extracted_at: new Date().toISOString(),
    }, { onConflict: 'variant_id' });
  
  if (error) {
    console.error(`Failed to upsert variant features for ${variantId}:`, error.message);
  } else {
    console.log(`    Features extracted for variant ${variantId}`);
  }
}

interface SmartleadCampaign {
  id: number;
  name: string;
  status: string;
  created_at: string;
}

interface SmartleadSequence {
  seq_number: number;
  seq_delay_details: { delay_in_days: number };
  subject?: string;
  email_body?: string;
  sequence_variants?: Array<{
    id: number;
    variant_label: string;
    subject: string;
    email_body: string;
  }>;
}

interface SmartleadEmailAccount {
  id: number;
  from_email: string;
  from_name: string;
  message_per_day: number;
  warmup_details?: { status: string };
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

interface SmartleadLead {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  company?: string;
  linkedin_profile?: string;
  linkedin_url?: string;
  phone_number?: string;
  website?: string;
  lead_status?: string;
  category?: string;
  designation?: string;
  title?: string;
  location?: string;
  city?: string;
  industry?: string;
  company_size?: string;
  source?: string;
}

interface SmartleadLeadMessageHistory {
  id: number;
  type: string;
  time: string;
  email_body?: string;
  email_subject?: string;
  seq_number?: number;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await createClient(
      supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) throw new Error('Unauthorized');

    const { workspace_id, sync_type = 'full', reset = false, force_advance = false } = await req.json();
    if (!workspace_id) throw new Error('workspace_id is required');

    const { data: membership, error: memberError } = await supabase
      .from('workspace_members').select('role')
      .eq('workspace_id', workspace_id).eq('user_id', user.id).single();
    if (memberError || !membership) throw new Error('Access denied to workspace');

    const { data: connection, error: connError } = await supabase
      .from('api_connections').select('id, api_key_encrypted, sync_progress, sync_status')
      .eq('workspace_id', workspace_id).eq('platform', 'smartlead').eq('is_active', true).single();
    if (connError || !connection) throw new Error('No active Smartlead connection found');

    const apiKey = connection.api_key_encrypted;
    const existingSyncProgress = connection.sync_progress as any || {};

    // SYNC LOCK: Check if another sync is currently running
    if (!reset && !force_advance) {
      const lastHeartbeat = existingSyncProgress.last_heartbeat;
      if (lastHeartbeat) {
        const timeSinceHeartbeat = Date.now() - new Date(lastHeartbeat).getTime();
        if (timeSinceHeartbeat < SYNC_LOCK_TIMEOUT_MS) {
          console.log(`[smartlead-sync] Another sync is active (heartbeat ${Math.round(timeSinceHeartbeat / 1000)}s ago). Skipping.`);
          return new Response(JSON.stringify({
            success: true,
            done: false,
            skipped: true,
            message: 'Another sync is currently running. Skipping to avoid race condition.',
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      if (existingSyncProgress.completed === true && connection.sync_status === 'success') {
        console.log(`[smartlead-sync] Sync already completed. Use reset=true to restart.`);
        return new Response(JSON.stringify({
          success: true,
          done: true,
          already_complete: true,
          message: 'Sync already completed. Use reset to re-sync from scratch.',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Handle reset - clear all synced data from SmartLead-specific tables
    if (reset) {
      console.log('Resetting SmartLead sync data for workspace:', workspace_id);
      
      // Get SmartLead campaign IDs first
      const { data: campaigns } = await supabase
        .from('smartlead_campaigns')
        .select('id')
        .eq('workspace_id', workspace_id);
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      
      if (campaignIds.length > 0) {
        await supabase.from('smartlead_message_events').delete().eq('workspace_id', workspace_id);
        await supabase.from('smartlead_daily_metrics').delete().eq('workspace_id', workspace_id);
        await supabase.from('smartlead_variant_features').delete().eq('workspace_id', workspace_id);
        await supabase.from('smartlead_variants').delete().in('campaign_id', campaignIds);
        await supabase.from('smartlead_sequence_steps').delete().in('campaign_id', campaignIds);
        await supabase.from('smartlead_campaigns').delete().eq('workspace_id', workspace_id);
      }
      
      // Also clear leads with platform = 'smartlead'
      await supabase.from('leads').delete().eq('workspace_id', workspace_id).eq('platform', 'smartlead');
      await supabase.from('email_accounts').delete().eq('workspace_id', workspace_id).eq('platform', 'smartlead');
      
      await supabase.from('api_connections').update({
        sync_status: 'syncing',
        sync_progress: { batch_index: 0, total_campaigns: 0 },
      }).eq('id', connection.id);
      
      console.log('Reset complete');
    }

    let existingProgress = reset ? { campaign_index: 0, batch_index: 0 } : (connection.sync_progress || { campaign_index: 0, batch_index: 0 });
    
    let resumeFromCampaign = typeof existingProgress.campaign_index === 'number' 
      ? existingProgress.campaign_index 
      : (existingProgress.batch_index || 0) * BATCH_SIZE;
    
    if (force_advance) {
      console.log(`Force advancing from campaign ${resumeFromCampaign} to ${resumeFromCampaign + 1}`);
      resumeFromCampaign += 1;
      existingProgress = { ...existingProgress, campaign_index: resumeFromCampaign, leads_offset: 0, force_advanced: true };
    }

    await supabase.from('api_connections').update({
      sync_status: 'syncing',
    }).eq('id', connection.id);

    const progress = {
      campaigns_synced: 0,
      email_accounts_synced: 0,
      variants_synced: 0,
      metrics_created: 0,
      leads_synced: 0,
      events_created: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();

    await supabase.from('api_connections').update({
      sync_status: 'syncing',
      sync_progress: {
        ...existingProgress,
        last_heartbeat: new Date().toISOString(),
      },
    }).eq('id', connection.id);
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;

    try {
      console.log('Fetching campaigns...');
      const campaignsRaw: SmartleadCampaign[] = await smartleadRequest('/campaigns', apiKey);
      
      const campaigns = [...campaignsRaw].sort((a, b) => {
        const statusOrder = { active: 0, paused: 1, drafted: 2, completed: 3 };
        const aOrder = statusOrder[a.status?.toLowerCase() as keyof typeof statusOrder] ?? 4;
        const bOrder = statusOrder[b.status?.toLowerCase() as keyof typeof statusOrder] ?? 4;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      console.log(`Found ${campaigns.length} campaigns (sorted: active first)`);

      const totalCampaigns = campaigns.length;
      const startIndex = resumeFromCampaign;
      const endIndex = Math.min(startIndex + BATCH_SIZE, campaigns.length);

      console.log(`Processing campaigns ${startIndex + 1}-${endIndex} of ${totalCampaigns}`);

      await supabase.from('api_connections').update({
        sync_progress: { 
          ...existingProgress,
          campaign_index: startIndex,
          batch_index: Math.floor(startIndex / BATCH_SIZE),
          total_campaigns: totalCampaigns,
          current_campaign: startIndex,
          campaign_name: campaigns[startIndex]?.name || 'Loading...',
          step: 'campaigns', 
          progress: Math.round((startIndex / Math.max(1, totalCampaigns)) * 90) + 5 
        },
      }).eq('id', connection.id);

      let lastProcessedIndex = startIndex - 1;
      let lastProcessedName = campaigns[startIndex]?.name || 'Unknown';

      for (let i = startIndex; i < endIndex; i++) {
        if (isTimeBudgetExceeded()) {
          console.log(`[smartlead-sync] Time budget exceeded at campaign ${i}, saving progress`);
          await supabase.from('api_connections').update({
            sync_progress: {
              ...existingProgress,
              campaign_index: i,
              batch_index: Math.floor(i / BATCH_SIZE),
              total_campaigns: totalCampaigns,
              current_campaign: i,
              campaign_name: lastProcessedName,
              step: 'campaigns',
              progress: Math.round((i / Math.max(1, totalCampaigns)) * 90) + 5,
              time_budget_exit: true,
              ...progress,
            },
          }).eq('id', connection.id);

          return new Response(JSON.stringify({
            success: true,
            done: false,
            message: `Time budget reached at campaign ${i}/${totalCampaigns}. Call again to continue.`,
            campaign_index: i,
            total: totalCampaigns,
            ...progress,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const campaign = campaigns[i];
        console.log(`Processing campaign ${i + 1}/${totalCampaigns}: ${campaign.name}`);
        
        await supabase.from('api_connections').update({
          sync_progress: {
            ...existingProgress,
            campaign_index: i,
            batch_index: Math.floor(i / BATCH_SIZE),
            total_campaigns: totalCampaigns,
            current_campaign: i + 1,
            campaign_name: campaign.name,
            step: 'campaigns',
            progress: Math.round(((i + 1) / Math.max(1, totalCampaigns)) * 90) + 5,
          },
        }).eq('id', connection.id);

        try {
          const isActiveCampaign = ['active', 'paused'].includes(campaign.status?.toLowerCase() || '');
          
          // 1. Upsert campaign to smartlead_campaigns table
          const { data: upsertedCampaign, error: campError } = await supabase
            .from('smartlead_campaigns')
            .upsert({ 
              workspace_id, 
              platform_id: String(campaign.id), 
              name: campaign.name, 
              status: campaign.status?.toLowerCase() || 'active',
              updated_at: new Date().toISOString()
            }, { 
              onConflict: 'workspace_id,platform_id' 
            })
            .select('id')
            .single();

          if (campError) {
            console.error(`Failed to upsert campaign ${campaign.id}:`, campError);
            progress.errors.push(`Campaign ${campaign.name}: ${campError.message}`);
            continue;
          }

          const campaignDbId = upsertedCampaign.id;
          progress.campaigns_synced++;
          
          if (!isActiveCampaign) {
            console.log(`  Skipping detailed sync for non-active campaign: ${campaign.status}`);
            
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
            } catch (e) {
              console.error(`  Analytics fetch failed for ${campaign.name}:`, e);
            }
            
            continue;
          }

          // 2. Fetch sequences (email copy variants)
          try {
            const sequencesRaw = await smartleadRequest(`/campaigns/${campaign.id}/sequences`, apiKey);
            const sequences: SmartleadSequence[] = Array.isArray(sequencesRaw) ? sequencesRaw : [];
            console.log(`Campaign ${campaign.id} has ${sequences.length} sequences`);
            
            for (const seq of sequences) {
              let variants = Array.isArray(seq.sequence_variants) ? seq.sequence_variants : [];
              
              if (variants.length === 0 && (seq.subject || seq.email_body)) {
                console.log(`    Seq ${seq.seq_number}: Creating variant from sequence direct fields`);
                variants = [{
                  id: `seq_${campaign.id}_${seq.seq_number}` as any,
                  variant_label: 'A',
                  subject: seq.subject || '',
                  email_body: seq.email_body || '',
                }];
              }
              
              console.log(`  Seq ${seq.seq_number}: ${variants.length} variant(s)`);
              
              for (const variant of variants) {
                const variantId = variant.id ?? `seq_${campaign.id}_${seq.seq_number}`;
                
                const emailBody = variant.email_body || '';
                const subjectLine = variant.subject || null;
                const wordCount = emailBody.split(/\s+/).filter(Boolean).length;
                const personalizationVars = [...emailBody.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);

                const variantPayload = {
                  campaign_id: campaignDbId,
                  platform_variant_id: String(variantId),
                  name: `Step ${seq.seq_number} - ${variant.variant_label || 'Default'}`,
                  variant_type: variant.variant_label || 'A',
                  subject_line: subjectLine,
                  body_preview: emailBody.substring(0, 500),
                  email_body: emailBody,
                  word_count: wordCount,
                  personalization_vars: personalizationVars,
                  is_control: seq.seq_number === 1 && (variant.variant_label === 'A' || !variant.variant_label),
                };

                console.log(`    Upserting variant ${variantId} (${variant.variant_label || 'Default'}) - subject: ${subjectLine ? 'yes' : 'no'}`);

                const { data: upsertedVariant, error: variantError } = await supabase
                  .from('smartlead_variants')
                  .upsert(variantPayload, { 
                    onConflict: 'campaign_id,platform_variant_id' 
                  })
                  .select('id')
                  .single();

                if (variantError) {
                  console.error(`    VARIANT UPSERT FAILED for ${variantId}:`, variantError.message, variantError.details);
                  progress.errors.push(`Variant ${variantId}: ${variantError.message}`);
                } else {
                  console.log(`    Variant ${variantId} upserted successfully`);
                  progress.variants_synced++;
                  
                  if (upsertedVariant?.id) {
                    await upsertVariantFeatures(supabase, upsertedVariant.id, workspace_id, subjectLine, emailBody);
                  }
                }
              }

              // Create sequence step
              const { error: stepError } = await supabase
                .from('smartlead_sequence_steps')
                .upsert({
                  campaign_id: campaignDbId,
                  step_number: seq.seq_number,
                  step_type: 'email',
                  delay_days: seq.seq_delay_details?.delay_in_days || 0
                }, { 
                  onConflict: 'campaign_id,step_number' 
                });

              if (stepError) console.error('Step error:', stepError);
            }
          } catch (seqError) {
            console.error(`Failed to fetch sequences for campaign ${campaign.id}:`, seqError);
            progress.errors.push(`Sequences for ${campaign.name}: ${String(seqError)}`);
          }

          // 3 & 4. Fetch email accounts and analytics in PARALLEL
          const [emailAccountsResult, analyticsResult] = await Promise.allSettled([
            smartleadRequest(`/campaigns/${campaign.id}/email-accounts`, apiKey),
            smartleadRequest(`/campaigns/${campaign.id}/analytics`, apiKey),
          ]);

          if (emailAccountsResult.status === 'fulfilled') {
            const emailAccounts: SmartleadEmailAccount[] = emailAccountsResult.value;
            for (const account of emailAccounts) {
              const { error: accountError } = await supabase
                .from('email_accounts')
                .upsert({
                  workspace_id, 
                  platform: 'smartlead', 
                  platform_id: String(account.id),
                  email_address: account.from_email, 
                  sender_name: account.from_name,
                  daily_limit: account.message_per_day,
                  warmup_enabled: account.warmup_details?.status === 'ACTIVE',
                  is_active: true,
                }, { 
                  onConflict: 'workspace_id,platform_id,platform' 
                });
                
              if (!accountError) progress.email_accounts_synced++;
            }
          } else {
            console.error(`Failed to fetch email accounts for campaign ${campaign.id}:`, emailAccountsResult.reason);
          }

          if (analyticsResult.status === 'fulfilled') {
            const analytics: SmartleadAnalytics = analyticsResult.value;
            const today = new Date().toISOString().split('T')[0];

            const { data: campaignVariants } = await supabase
              .from('smartlead_variants')
              .select('id, name')
              .eq('campaign_id', campaignDbId);

            const totalVariants = campaignVariants?.length || 0;

            if (totalVariants > 0) {
              const variantCount = totalVariants;
              
              for (const variant of (campaignVariants || [])) {
                const { error: metricsError } = await supabase.from('smartlead_daily_metrics').upsert({
                  workspace_id,
                  campaign_id: campaignDbId,
                  metric_date: today,
                  sent_count: Math.round((analytics.sent_count || 0) / variantCount),
                  opened_count: Math.round((analytics.unique_open_count || 0) / variantCount),
                  clicked_count: Math.round((analytics.unique_click_count || 0) / variantCount),
                  replied_count: Math.round((analytics.reply_count || 0) / variantCount),
                  bounced_count: Math.round((analytics.bounce_count || 0) / variantCount),
                }, { onConflict: 'campaign_id,metric_date' });

                if (!metricsError) progress.metrics_created++;
              }
            } else {
              const { error: metricsError } = await supabase.from('smartlead_daily_metrics').upsert({
                workspace_id, 
                campaign_id: campaignDbId, 
                metric_date: today,
                sent_count: analytics.sent_count || 0,
                opened_count: analytics.unique_open_count || 0,
                clicked_count: analytics.unique_click_count || 0,
                replied_count: analytics.reply_count || 0,
                bounced_count: analytics.bounce_count || 0,
              }, { onConflict: 'campaign_id,metric_date' });

              if (!metricsError) progress.metrics_created++;
            }
          }

          // 5. Fetch leads - still use shared leads table but with platform = 'smartlead'
          try {
            const savedOffset = (existingProgress?.campaign_index === i && typeof (existingProgress as any).leads_offset === 'number')
              ? (existingProgress as any).leads_offset
              : 0;

            let offset = savedOffset;
            const pageSize = 100;
            let hasMore = true;

            // Build step to variant map for message events
            const { data: variantsForMapping } = await supabase
              .from('smartlead_variants')
              .select('id, name')
              .eq('campaign_id', campaignDbId);
            
            const stepToVariantMap = new Map<number, string>();
            for (const v of (variantsForMapping || [])) {
              const match = v.name.match(/Step (\d+)/);
              if (match) {
                stepToVariantMap.set(parseInt(match[1]), v.id);
              }
            }

            while (hasMore) {
              if (isTimeBudgetExceeded()) {
                console.log(`[smartlead-sync] Time budget exceeded during leads fetch for campaign ${i}`);
                await supabase.from('api_connections').update({
                  sync_progress: {
                    ...existingProgress,
                    campaign_index: i,
                    batch_index: Math.floor(i / BATCH_SIZE),
                    total_campaigns: totalCampaigns,
                    current_campaign: i + 1,
                    campaign_name: campaign.name,
                    step: 'leads',
                    progress: Math.round(((i + 1) / Math.max(1, totalCampaigns)) * 90) + 5,
                    time_budget_exit: true,
                    leads_offset: offset,
                    ...progress,
                  },
                }).eq('id', connection.id);

                return new Response(JSON.stringify({
                  success: true,
                  done: false,
                  message: `Time budget reached during leads fetch. Call again to continue.`,
                  campaign_index: i,
                  total: totalCampaigns,
                  ...progress,
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              }

              const leadsStats = await smartleadRequest(
                `/campaigns/${campaign.id}/leads?offset=${offset}&limit=${pageSize}`,
                apiKey
              );
              
              const leadsArray = Array.isArray(leadsStats) ? leadsStats : [];

              if (leadsArray.length === 0) {
                hasMore = false;
                continue;
              }

              console.log(`  Fetched ${leadsArray.length} leads at offset ${offset}`);

              const eventPayloads: any[] = [];

              for (const leadStat of leadsArray) {
                const email = leadStat.email?.toLowerCase();
                if (!email) continue;

                // Upsert lead to shared leads table
                const leadPayload = {
                  workspace_id,
                  platform: 'smartlead',
                  platform_lead_id: String(leadStat.id || email),
                  email,
                  first_name: leadStat.first_name || null,
                  last_name: leadStat.last_name || null,
                  company: leadStat.company_name || leadStat.company || null,
                  title: leadStat.designation || leadStat.title || null,
                  linkedin_url: leadStat.linkedin_profile || leadStat.linkedin_url || null,
                  phone: leadStat.phone_number || null,
                  industry: leadStat.industry || null,
                  location: leadStat.location || leadStat.city || null,
                  email_domain: extractEmailDomain(email),
                  email_type: classifyEmailType(email),
                  status: leadStat.lead_status || leadStat.category || null,
                  updated_at: new Date().toISOString(),
                };

                const { data: upsertedLead, error: leadError } = await supabase
                  .from('leads')
                  .upsert(leadPayload, { onConflict: 'workspace_id,platform,platform_lead_id' })
                  .select('id')
                  .single();

                if (leadError) {
                  console.error(`Lead upsert error:`, leadError);
                  continue;
                }

                progress.leads_synced++;
                const dbLeadId = upsertedLead?.id;

                // Fetch message history for this lead
                if (dbLeadId) {
                  try {
                    const messageHistory: SmartleadLeadMessageHistory[] = await smartleadRequest(
                      `/campaigns/${campaign.id}/leads/${leadStat.id}/message-history`,
                      apiKey
                    );

                    if (Array.isArray(messageHistory)) {
                      for (const msg of messageHistory) {
                        const msgType = msg.type?.toUpperCase();
                        let eventType = 'unknown';
                        let sentiment: string | null = null;

                        if (msgType === 'SENT') eventType = 'sent';
                        else if (msgType === 'OPENED' || msgType === 'OPEN') eventType = 'opened';
                        else if (msgType === 'CLICKED' || msgType === 'CLICK') eventType = 'clicked';
                        else if (msgType === 'REPLY' || msgType === 'REPLIED') {
                          eventType = 'replied';
                          const replyLower = (msg.email_body || '').toLowerCase();
                          if (/interested|yes|sure|let's|schedule|available/i.test(replyLower)) {
                            sentiment = 'positive';
                          } else if (/not interested|no thanks|unsubscribe|remove|stop/i.test(replyLower)) {
                            sentiment = 'negative';
                          } else {
                            sentiment = 'neutral';
                          }
                        } else if (msgType === 'BOUNCE' || msgType === 'BOUNCED') eventType = 'bounced';

                        const occurredAt = msg.time ? new Date(msg.time).toISOString() : new Date().toISOString();
                        const sequenceStep = msg.seq_number || 1;
                        const variantId = stepToVariantMap.get(sequenceStep) || null;

                        eventPayloads.push({
                          workspace_id,
                          campaign_id: campaignDbId,
                          lead_id: dbLeadId,
                          variant_id: variantId,
                          event_type: eventType,
                          event_timestamp: occurredAt,
                          message_id: `${leadStat.id}-${msgType}-${occurredAt}`,
                          reply_text: msgType === 'REPLY' ? (msg.email_body || null) : null,
                          reply_sentiment: sentiment,
                        });
                      }
                    }
                  } catch (msgError) {
                    console.error(`  Message history fetch failed for lead ${leadStat.id}:`, msgError);
                  }
                }
              }

              // Bulk insert events to smartlead_message_events
              if (eventPayloads.length > 0) {
                const batchSize = 500;
                for (let ei = 0; ei < eventPayloads.length; ei += batchSize) {
                  const batch = eventPayloads.slice(ei, ei + batchSize);
                  const { error: eventError } = await supabase
                    .from('smartlead_message_events')
                    .insert(batch);

                  if (!eventError) {
                    progress.events_created += batch.length;
                  } else if (eventError.code !== '23505') {
                    console.error('Batch event insert error:', eventError);
                  }
                }
              }

              offset += pageSize;
              if (leadsArray.length < pageSize) {
                hasMore = false;
              }
            }
          } catch (leadsError) {
            console.error(`Failed to fetch leads for campaign ${campaign.id}:`, leadsError);
          }

          lastProcessedIndex = i;
          lastProcessedName = campaign.name;
          
          await supabase.from('api_connections').update({
            sync_progress: {
              ...existingProgress,
              campaign_index: i + 1,
              batch_index: Math.floor((i + 1) / BATCH_SIZE),
              total_campaigns: totalCampaigns,
              current_campaign: i + 1,
              campaign_name: campaign.name,
              step: 'campaigns',
              progress: Math.round(((i + 1) / Math.max(1, totalCampaigns)) * 90) + 5,
              leads_offset: 0,
              ...progress,
            },
          }).eq('id', connection.id);
          
        } catch (campaignError) {
          console.error(`Error processing campaign ${campaign.id}:`, campaignError);
          progress.errors.push(`Campaign ${campaign.name}: ${String(campaignError)}`);
          lastProcessedIndex = i;
          lastProcessedName = campaign.name;
        }
      }

      const nextCampaignIndex = lastProcessedIndex + 1;
      const isComplete = nextCampaignIndex >= campaigns.length;

      await supabase.from('api_connections').update({
        sync_status: isComplete ? 'success' : 'syncing',
        last_sync_at: isComplete ? new Date().toISOString() : undefined,
        last_full_sync_at: isComplete && sync_type === 'full' ? new Date().toISOString() : undefined,
        sync_progress: {
          campaign_index: nextCampaignIndex,
          batch_index: Math.floor(nextCampaignIndex / BATCH_SIZE),
          total_campaigns: totalCampaigns,
          current_campaign: isComplete ? totalCampaigns : nextCampaignIndex,
          campaign_name: lastProcessedName,
          step: isComplete ? 'complete' : 'campaigns',
          progress: isComplete ? 100 : Math.round((nextCampaignIndex / Math.max(1, totalCampaigns)) * 90) + 5,
          completed: isComplete,
          ...progress,
        },
      }).eq('id', connection.id);

      console.log('Progress:', { isComplete, campaign_index: nextCampaignIndex, total: totalCampaigns, ...progress });

      if (isComplete) {
        console.log('Sync complete - triggering pattern computation...');
        try {
          const patternResponse = await fetch(`${supabaseUrl}/functions/v1/compute-patterns`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ workspace_id }),
          });
          
          if (patternResponse.ok) {
            const patternResult = await patternResponse.json();
            console.log('Pattern computation triggered:', patternResult);
          } else {
            console.warn('Pattern computation failed:', await patternResponse.text());
          }
        } catch (patternError) {
          console.error('Failed to trigger pattern computation:', patternError);
        }
      }

      if (!isComplete) {
        console.log('Scheduling auto-continue for next batch...');
        
        (globalThis as any).EdgeRuntime?.waitUntil?.(
          (async () => {
            await new Promise(r => setTimeout(r, 1000));
            try {
              await fetch(`${supabaseUrl}/functions/v1/smartlead-sync`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ workspace_id, sync_type }),
              });
              console.log('Auto-continue triggered');
            } catch (e) {
              console.error('Auto-continue failed:', e);
            }
          })()
        );
      }

      return new Response(JSON.stringify({
        success: true, 
        done: isComplete, 
        campaign_index: nextCampaignIndex,
        total: totalCampaigns,
        message: isComplete ? 'Sync completed successfully' : `Processed to campaign ${nextCampaignIndex}; auto-continuing...`,
        patterns_triggered: isComplete,
        auto_continue: !isComplete,
        ...progress,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (syncError) {
      console.error('Sync error:', syncError);
      await supabase.from('api_connections').update({
        sync_status: 'error', 
        sync_progress: { step: 'error', error: String(syncError), ...progress },
      }).eq('id', connection.id);
      throw syncError;
    }
  } catch (error: unknown) {
    console.error('Error in smartlead-sync:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
