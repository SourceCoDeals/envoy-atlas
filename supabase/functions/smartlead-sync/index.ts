import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';
const RATE_LIMIT_DELAY = 300; // Increased from 150ms to reduce rate limiting errors
const BATCH_SIZE = 5; // Campaigns per invocation
const TIME_BUDGET_MS = 45000; // 45 seconds
const SYNC_LOCK_TIMEOUT_MS = 30000; // 30 seconds - if last heartbeat is older, allow new sync

// Personal email domains for classification
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
  'aol.com', 'icloud.com', 'protonmail.com', 'mail.com',
  'live.com', 'msn.com', 'me.com', 'ymail.com', 'googlemail.com',
  'yahoo.co.uk', 'hotmail.co.uk', 'outlook.co.uk', 'btinternet.com',
  'sky.com', 'virgin.net', 'ntlworld.com', 'talktalk.net',
  'gmx.com', 'gmx.net', 'web.de', 'zoho.com', 'fastmail.com',
  'tutanota.com', 'pm.me', 'proton.me'
]);

// Spam trigger words for subject line analysis
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

// ========== COPY FEATURE EXTRACTION ==========

interface CopyFeatures {
  // Subject features
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
  // Body features
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
  
  // Subject analysis
  const subjectWords = subject.split(/\s+/).filter(Boolean);
  const subjectTokens = [...subject.matchAll(/\{\{?(\w+)\}?\}/g)];
  const firstToken = subjectTokens[0];
  
  // Detect first word type
  const firstWord = subjectWords[0]?.toLowerCase() || '';
  let firstWordType = 'other';
  if (/^(hey|hi|hello)/i.test(firstWord)) firstWordType = 'greeting';
  else if (/^(who|what|when|where|why|how|is|are|do|does|can|could|would)/i.test(firstWord)) firstWordType = 'question';
  else if (/^(quick|just|re:|fwd:)/i.test(firstWord)) firstWordType = 'casual';
  else if (/^\{\{?first_?name\}?\}?$/i.test(subjectWords[0] || '')) firstWordType = 'name';
  else if (/^\{\{?company\}?\}?$/i.test(subjectWords[0] || '')) firstWordType = 'company';
  
  // Capitalization style
  let capStyle = 'mixed';
  if (subject === subject.toLowerCase()) capStyle = 'lowercase';
  else if (subject === subject.toUpperCase()) capStyle = 'uppercase';
  else if (subjectWords.every(w => w[0] === w[0]?.toUpperCase())) capStyle = 'title_case';
  else if (subjectWords[0]?.[0] === subjectWords[0]?.[0]?.toUpperCase() && 
           subjectWords.slice(1).every(w => w[0] === w[0]?.toLowerCase() || /^\{\{/.test(w))) capStyle = 'sentence_case';
  
  // Spam score
  const subjectLower = subject.toLowerCase();
  const spamCount = SPAM_TRIGGERS.filter(trigger => subjectLower.includes(trigger)).length;
  const spamScore = Math.min(100, spamCount * 15);
  
  // Emoji detection (common emoji unicode ranges)
  const hasEmoji = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(subject);
  
  // Body analysis
  const bodyClean = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const bodyWords = bodyClean.split(/\s+/).filter(Boolean);
  const sentences = bodyClean.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const bodyTokens = [...body.matchAll(/\{\{?(\w+)\}?\}/g)];
  const tokenTypes = [...new Set(bodyTokens.map(m => m[1].toLowerCase()))];
  
  // CTA classification
  const bodyLower = body.toLowerCase();
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
  
  // CTA position (find last question mark or call-to-action phrase)
  const bodyLength = bodyClean.length;
  const lastQuestionPos = bodyClean.lastIndexOf('?');
  let ctaPosition = 'end';
  if (lastQuestionPos > 0) {
    const relativePos = lastQuestionPos / bodyLength;
    if (relativePos < 0.33) ctaPosition = 'beginning';
    else if (relativePos < 0.66) ctaPosition = 'middle';
  }
  
  // Links detection
  const linkCount = (body.match(/https?:\/\/[^\s<]+/g) || []).length;
  const hasCalendarLink = /calendly\.com|cal\.com|hubspot\.com\/meetings|chili ?piper/i.test(body);
  
  // Proof detection
  const hasProof = /\d+%|\d+ clients|\d+ companies|trusted by|featured in|as seen|case study/i.test(body);
  
  // Tone classification
  let tone = 'direct';
  if (/hope this|just wanted|thought i'd|reaching out/i.test(bodyLower)) tone = 'casual';
  else if (/dear|sincerely|regards|respectfully/i.test(bodyLower)) tone = 'formal';
  else if (/help you|solve|challenge|struggle|pain/i.test(bodyLower)) tone = 'consultative';
  
  // Paragraph and bullet counts
  const paragraphs = body.split(/\n\s*\n/).filter(p => p.trim());
  const bullets = (body.match(/^[\s]*[-•*]\s/gm) || []).length;
  
  // Reading grade (simplified Flesch-Kincaid)
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
    .from('campaign_variant_features')
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

// ========== END COPY FEATURE EXTRACTION ==========

interface SmartleadCampaign {
  id: number;
  name: string;
  status: string;
  created_at: string;
}

interface SmartleadSequence {
  seq_number: number;
  seq_delay_details: { delay_in_days: number };
  // Direct fields for non-A/B campaigns
  subject?: string;
  email_body?: string;
  // Array of variants for A/B test campaigns (field name from API is sequence_variants)
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

      // COMPLETED CHECK: Don't restart a completed sync without explicit reset
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

    // Handle reset - clear all synced data
    if (reset) {
      console.log('Resetting sync data for workspace:', workspace_id);
      
      // Get campaign IDs first
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('workspace_id', workspace_id);
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      
      if (campaignIds.length > 0) {
        await supabase.from('message_events').delete().eq('workspace_id', workspace_id);
        await supabase.from('daily_metrics').delete().eq('workspace_id', workspace_id);
        await supabase.from('hourly_metrics').delete().eq('workspace_id', workspace_id);
        await supabase.from('leads').delete().eq('workspace_id', workspace_id);
        await supabase.from('campaign_variants').delete().in('campaign_id', campaignIds);
        await supabase.from('sequence_steps').delete().in('campaign_id', campaignIds);
        await supabase.from('campaigns').delete().eq('workspace_id', workspace_id);
      }
      
      await supabase.from('email_accounts').delete().eq('workspace_id', workspace_id);
      
      await supabase.from('api_connections').update({
        sync_status: 'syncing',
        sync_progress: { batch_index: 0, total_campaigns: 0 },
      }).eq('id', connection.id);
      
      console.log('Reset complete');
    }

    // Get sync progress
    let existingProgress = reset ? { campaign_index: 0, batch_index: 0 } : (connection.sync_progress || { campaign_index: 0, batch_index: 0 });
    
    // Prefer campaign_index, fallback to batch_index * BATCH_SIZE
    let resumeFromCampaign = typeof existingProgress.campaign_index === 'number' 
      ? existingProgress.campaign_index 
      : (existingProgress.batch_index || 0) * BATCH_SIZE;
    
    // Force advance skips to next campaign (useful when stuck on a problematic campaign)
    if (force_advance) {
      console.log(`Force advancing from campaign ${resumeFromCampaign} to ${resumeFromCampaign + 1}`);
      resumeFromCampaign += 1;
      existingProgress = { ...existingProgress, campaign_index: resumeFromCampaign, leads_offset: 0, force_advanced: true };
    }

    // Update status to syncing
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

    // Time budget tracking
    const startTime = Date.now();

    // Update heartbeat immediately to claim the sync lock
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
      const campaigns: SmartleadCampaign[] = await smartleadRequest('/campaigns', apiKey);
      console.log(`Found ${campaigns.length} campaigns`);

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
        // Check time budget before processing each campaign
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
        
        // Update current campaign in progress immediately
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
          // 1. Upsert campaign
          const { data: upsertedCampaign, error: campError } = await supabase
            .from('campaigns')
            .upsert({ 
              workspace_id, 
              platform: 'smartlead', 
              platform_id: String(campaign.id), 
              name: campaign.name, 
              status: campaign.status?.toLowerCase() || 'active',
              updated_at: new Date().toISOString()
            }, { 
              onConflict: 'workspace_id,platform_id,platform' 
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

          // 2. Fetch sequences (email copy variants)
          try {
            const sequencesRaw = await smartleadRequest(`/campaigns/${campaign.id}/sequences`, apiKey);
            // Handle case where API returns null, undefined, or non-array
            const sequences: SmartleadSequence[] = Array.isArray(sequencesRaw) ? sequencesRaw : [];
            console.log(`Campaign ${campaign.id} has ${sequences.length} sequences`);
            
            // Log first sequence structure for debugging
            if (sequences.length > 0) {
              console.log(`  First sequence keys: ${Object.keys(sequences[0]).join(', ')}`);
              console.log(`  First sequence sample:`, JSON.stringify({
                seq_number: sequences[0].seq_number,
                has_sequence_variants: !!sequences[0].sequence_variants,
                sequence_variants_count: sequences[0].sequence_variants?.length || 0,
                has_direct_subject: !!sequences[0].subject,
                has_direct_body: !!sequences[0].email_body,
              }));
            }
            
            for (const seq of sequences) {
              // Use sequence_variants (correct field name from Smartlead API)
              let variants = Array.isArray(seq.sequence_variants) ? seq.sequence_variants : [];
              
              // If no variants array, create one from the sequence's direct subject/body
              // This handles non-A/B tested campaigns where copy is directly on the sequence
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
                  .from('campaign_variants')
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
                  
                  // Extract and store copy features for analytics
                  if (upsertedVariant?.id) {
                    await upsertVariantFeatures(supabase, upsertedVariant.id, workspace_id, subjectLine, emailBody);
                  }
                }
              }

              // Create sequence step - use direct sequence fields
              const { error: stepError } = await supabase
                .from('sequence_steps')
                .upsert({
                  campaign_id: campaignDbId,
                  step_number: seq.seq_number,
                  subject_line: seq.subject || null,
                  body_preview: seq.email_body?.substring(0, 200) || null,
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

          // Process email accounts
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

          // Process analytics
          if (analyticsResult.status === 'fulfilled') {
            const analytics: SmartleadAnalytics = analyticsResult.value;
            const today = new Date().toISOString().split('T')[0];

            const metricsPayload = {
              workspace_id, 
              campaign_id: campaignDbId, 
              date: today,
              sent_count: analytics.sent_count || 0,
              delivered_count: analytics.unique_sent_count || 0,
              opened_count: analytics.unique_open_count || 0,
              clicked_count: analytics.unique_click_count || 0,
              replied_count: analytics.reply_count || 0,
              bounced_count: analytics.bounce_count || 0,
              unsubscribed_count: analytics.unsubscribe_count || 0,
            };

            // Use manual check and insert/update since partial unique index doesn't work with upsert
            const { data: existingMetric } = await supabase
              .from('daily_metrics')
              .select('id')
              .eq('workspace_id', workspace_id)
              .eq('campaign_id', campaignDbId)
              .eq('date', today)
              .is('variant_id', null)
              .is('email_account_id', null)
              .is('segment_id', null)
              .maybeSingle();

            const { error: metricsError } = existingMetric?.id
              ? await supabase.from('daily_metrics').update(metricsPayload).eq('id', existingMetric.id)
              : await supabase.from('daily_metrics').insert(metricsPayload);

            if (!metricsError) progress.metrics_created++;
          }

          // 5. Fetch ALL leads using leads-statistics endpoint (provides richer data with history)
          try {
            const savedOffset = (existingProgress?.campaign_index === i && typeof (existingProgress as any).leads_offset === 'number')
              ? (existingProgress as any).leads_offset
              : 0;

            let offset = savedOffset;
            const pageSize = 100;
            let hasMore = true;

            while (hasMore) {
              // Check time budget inside leads loop too
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

              const leadsData = await smartleadRequest(
                `/campaigns/${campaign.id}/leads-statistics?limit=${pageSize}&offset=${offset}`,
                apiKey
              );
              
              // leads-statistics returns { hasMore: boolean, data: [...] }
              const leads = leadsData?.data || [];
              hasMore = leadsData?.hasMore === true;
              
              if (!Array.isArray(leads) || leads.length === 0) {
                console.log(`  No leads returned at offset ${offset}`);
                break;
              }

              console.log(`  Fetched ${leads.length} leads at offset ${offset}`);

              // Batch arrays for bulk inserts
              const leadPayloads: any[] = [];
              const leadPlatformIds: string[] = [];

              for (const leadStat of leads) {
                const email = leadStat.to?.toLowerCase();
                if (!email) continue;

                const platformLeadId = String(leadStat.lead_id || leadStat.email_lead_map_id);
                leadPayloads.push({
                  workspace_id,
                  campaign_id: campaignDbId,
                  platform: 'smartlead',
                  platform_lead_id: platformLeadId,
                  email: email,
                  status: leadStat.status?.toLowerCase() || 'active',
                });
                leadPlatformIds.push(platformLeadId);
              }

              // Bulk upsert leads
              if (leadPayloads.length > 0) {
                const { error: bulkLeadError } = await supabase
                  .from('leads')
                  .upsert(leadPayloads, { 
                    onConflict: 'workspace_id,platform,platform_lead_id' 
                  });

                if (bulkLeadError) {
                  console.error('Bulk lead upsert error:', bulkLeadError);
                } else {
                  progress.leads_synced += leadPayloads.length;
                }

                // Fetch all the lead IDs we just upserted
                const { data: dbLeads } = await supabase
                  .from('leads')
                  .select('id, platform_lead_id')
                  .eq('workspace_id', workspace_id)
                  .eq('platform', 'smartlead')
                  .in('platform_lead_id', leadPlatformIds);

                const leadIdMap = new Map<string, string>();
                for (const l of dbLeads || []) {
                  leadIdMap.set(l.platform_lead_id, l.id);
                }

                // Collect all events for batch insert
                const eventPayloads: any[] = [];
                const hourlyUpdates = new Map<string, { replied: number; positive: number; hour: number; dayOfWeek: number; date: string }>();

                for (const leadStat of leads) {
                  const email = leadStat.to?.toLowerCase();
                  if (!email) continue;

                  const platformLeadId = String(leadStat.lead_id || leadStat.email_lead_map_id);
                  const dbLeadId = leadIdMap.get(platformLeadId);
                  if (!dbLeadId) continue;

                  const history = leadStat.history || [];
                  for (const msg of history) {
                    const msgType = (msg.type || '').toUpperCase();
                    
                    if (['SENT', 'OPEN', 'CLICK', 'REPLY', 'BOUNCE', 'UNSUBSCRIBE'].includes(msgType)) {
                      let eventType = msgType.toLowerCase();
                      let sentiment = 'neutral';
                      
                      if (msgType === 'REPLY') {
                        const leadStatus = (leadStat.status || '').toLowerCase();
                        if (leadStatus === 'interested' || leadStatus === 'meeting_booked') {
                          sentiment = 'positive';
                          eventType = 'positive_reply';
                        } else if (leadStatus === 'not_interested' || leadStatus === 'wrong_person') {
                          sentiment = 'negative';
                          eventType = 'negative_reply';
                        } else {
                          eventType = 'replied';
                        }
                      }

                      const occurredAt = msg.time ? new Date(msg.time).toISOString() : new Date().toISOString();
                      const platformEventId = msg.stats_id || msg.message_id || `${leadStat.lead_id}-${msgType}-${occurredAt}`;

                      eventPayloads.push({
                        workspace_id,
                        campaign_id: campaignDbId,
                        lead_id: dbLeadId,
                        platform: 'smartlead',
                        platform_event_id: platformEventId,
                        event_type: eventType,
                        occurred_at: occurredAt,
                        sent_at: msgType === 'SENT' ? occurredAt : null,
                        lead_email: email,
                        reply_content: msgType === 'REPLY' ? (msg.email_body || null) : null,
                        reply_sentiment: msgType === 'REPLY' ? sentiment : null,
                        sequence_step: parseInt(msg.email_seq_number) || 1,
                      });

                      // Track hourly metrics for replies
                      if (msgType === 'REPLY') {
                        const replyDate = new Date(occurredAt);
                        const hour = replyDate.getUTCHours();
                        const dayOfWeek = replyDate.getUTCDay();
                        const dateStr = occurredAt.split('T')[0];
                        const key = `${dateStr}-${hour}`;
                        
                        const existing = hourlyUpdates.get(key) || { replied: 0, positive: 0, hour, dayOfWeek, date: dateStr };
                        existing.replied += 1;
                        existing.positive += sentiment === 'positive' ? 1 : 0;
                        hourlyUpdates.set(key, existing);
                      }
                    }
                  }
                }

                // Bulk insert events - use insert with ignoreDuplicates 
                if (eventPayloads.length > 0) {
                  // Insert in batches of 500 to avoid payload size limits
                  const batchSize = 500;
                  for (let ei = 0; ei < eventPayloads.length; ei += batchSize) {
                    const batch = eventPayloads.slice(ei, ei + batchSize);
                    // Use insert - duplicates will be rejected by the unique index
                    const { error: eventError } = await supabase
                      .from('message_events')
                      .insert(batch);

                    if (!eventError) {
                      progress.events_created += batch.length;
                    } else if (eventError.code !== '23505') {
                      // Ignore unique constraint violations, log other errors
                      console.error('Batch event insert error:', eventError);
                    }
                  }
                }

                // Batch upsert hourly metrics
                for (const [, data] of hourlyUpdates) {
                  const { data: existingHourly } = await supabase
                    .from('hourly_metrics')
                    .select('id, replied_count, positive_reply_count')
                    .eq('workspace_id', workspace_id)
                    .eq('campaign_id', campaignDbId)
                    .eq('date', data.date)
                    .eq('hour', data.hour)
                    .maybeSingle();

                  if (existingHourly) {
                    await supabase
                      .from('hourly_metrics')
                      .update({
                        replied_count: (existingHourly.replied_count || 0) + data.replied,
                        positive_reply_count: (existingHourly.positive_reply_count || 0) + data.positive,
                      })
                      .eq('id', existingHourly.id);
                  } else {
                    await supabase
                      .from('hourly_metrics')
                      .insert({
                        workspace_id,
                        campaign_id: campaignDbId,
                        date: data.date,
                        hour: data.hour,
                        day_of_week: data.dayOfWeek,
                        replied_count: data.replied,
                        positive_reply_count: data.positive,
                      });
                  }
                }
              }

              offset += pageSize;
            }
          } catch (leadsError) {
            console.error(`Failed to fetch leads for campaign ${campaign.id}:`, leadsError);
          }

          // Update progress after each campaign - track last processed
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
          // Still advance campaign_index to avoid getting stuck
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

      return new Response(JSON.stringify({
        success: true, 
        done: isComplete, 
        campaign_index: nextCampaignIndex,
        total: totalCampaigns,
        message: isComplete ? 'Sync completed successfully' : `Processed to campaign ${nextCampaignIndex}; call again to continue`,
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
