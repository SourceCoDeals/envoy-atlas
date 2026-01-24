import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ClassificationResult {
  category: string;
  sentiment: string;
  is_positive: boolean;
  confidence: number;
  reasoning: string;
}

async function classifyEmail(replyText: string, subject: string): Promise<ClassificationResult | null> {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  
  if (!OPENROUTER_API_KEY) {
    console.warn('[smartlead-inbox-webhook] OPENROUTER_API_KEY not set, skipping classification');
    return null;
  }

  const prompt = `Classify this sales email reply into exactly one category and sentiment.

CATEGORIES:
- meeting_request: Wants to schedule a call/meeting (e.g., "let's chat", "when are you free?")
- interested: Expresses interest but no meeting request (e.g., "tell me more", "sounds interesting")
- question: Asking clarifying questions (e.g., "what is this?", "how did you get my info?")
- referral: Directing to someone else (e.g., "talk to my colleague", "I'm not the right person")
- not_now: Timing issue, not rejecting (e.g., "reach out next quarter", "busy right now")
- not_interested: Polite decline (e.g., "not a fit", "we're all set", "no thanks")
- unsubscribe: Explicit opt-out request (e.g., "unsubscribe", "remove me from your list")
- out_of_office: Automated OOO reply
- negative_hostile: Angry/hostile response (e.g., "stop emailing", "this is spam", threats)
- neutral: Cannot determine intent

SENTIMENT:
- positive: Interest in product/meeting, open to conversation
- negative: Rejection, complaint, hostility
- neutral: Questions, OOO, referrals, unclear intent

POSITIVE REPLY (is_positive = true) only for:
- meeting_request
- interested

Subject: ${subject || 'N/A'}
Reply Text: ${replyText}

Respond in JSON format only:
{"category": "<category>", "sentiment": "<sentiment>", "is_positive": <boolean>, "confidence": <0.0-1.0>, "reasoning": "<brief explanation>"}`;

  try {
    console.log('[smartlead-inbox-webhook] Calling OpenRouter with model openai/gpt-4.1-mini');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://envoy-atlas.lovable.app',
        'X-Title': 'Envoy Atlas',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-mini',
        messages: [
          { role: 'system', content: 'You are an expert at classifying sales email replies. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[smartlead-inbox-webhook] OpenRouter API error:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    
    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        category: parsed.category || 'neutral',
        sentiment: parsed.sentiment || 'neutral',
        is_positive: parsed.is_positive === true,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        reasoning: parsed.reasoning || '',
      };
    }
    
    console.warn('[smartlead-inbox-webhook] Could not parse AI response:', content);
    return null;
  } catch (error) {
    console.error('[smartlead-inbox-webhook] Classification error:', error);
    return null;
  }
}

function extractPlainText(htmlOrText: string): string {
  if (!htmlOrText) return '';
  // Remove HTML tags
  let text = htmlOrText.replace(/<[^>]*>/g, ' ');
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    
    console.log('[smartlead-inbox-webhook] Received webhook payload');

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract plain text from reply for classification
    const replyText = body.preview_text || extractPlainText(body.reply_body || '');
    const subject = body.subject || '';

    // Classify the email using OpenRouter
    console.log('[smartlead-inbox-webhook] Classifying reply...');
    const classification = await classifyEmail(replyText, subject);
    
    if (classification) {
      console.log('[smartlead-inbox-webhook] Classification result:', classification.category, classification.sentiment);
    }

    // Extract fields from the body - this comes from n8n forwarding SmartLead webhook
    const record = {
      // Campaign info
      campaign_status: body.campaign_status || null,
      campaign_name: body.campaign_name || null,
      campaign_id: body.campaign_id || null,
      
      // Lead identifiers
      stats_id: body.stats_id || null,
      sl_email_lead_id: body.sl_email_lead_id || null,
      sl_email_lead_map_id: body.sl_email_lead_map_id || null,
      sl_lead_email: body.sl_lead_email || null,
      
      // Email details
      from_email: body.from_email || null,
      to_email: body.to_email || null,
      to_name: body.to_name || null,
      cc_emails: body.cc_emails || [],
      subject: body.subject || null,
      message_id: body.message_id || null,
      
      // Sent message
      sent_message_body: body.sent_message_body || null,
      sent_message: body.sent_message || null,
      
      // Reply details
      time_replied: body.time_replied || null,
      event_timestamp: body.event_timestamp || null,
      reply_message: body.reply_message || null,
      reply_body: body.reply_body || null,
      preview_text: body.preview_text || null,
      
      // Sequence info
      sequence_number: body.sequence_number || null,
      
      // Links and metadata
      secret_key: body.secret_key || null,
      app_url: body.app_url || null,
      ui_master_inbox_link: body.ui_master_inbox_link || null,
      description: body.description || null,
      metadata: body.metadata || null,
      lead_correspondence: body.leadCorrespondence || null,
      
      // Webhook info
      webhook_url: body.webhook_url || null,
      webhook_id: body.webhook_id || null,
      webhook_name: body.webhook_name || null,
      event_type: body.event_type || null,
      
      // Client reference
      client_id: body.client_id || null,
      
      // AI categorization
      ai_category: classification?.category || null,
      ai_sentiment: classification?.sentiment || null,
      ai_is_positive: classification?.is_positive || false,
      ai_confidence: classification?.confidence || null,
      ai_reasoning: classification?.reasoning || null,
      categorized_at: classification ? new Date().toISOString() : null,
      
      // Store raw payload for debugging
      raw_payload: body,
    };

    console.log('[smartlead-inbox-webhook] Inserting record for lead:', record.sl_lead_email);

    const { data, error } = await supabase
      .from('smartlead_inbox_webhooks')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('[smartlead-inbox-webhook] Insert error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[smartlead-inbox-webhook] Successfully stored webhook:', data.id);

    return new Response(JSON.stringify({ 
      success: true, 
      id: data.id,
      classification: classification ? {
        category: classification.category,
        sentiment: classification.sentiment,
        is_positive: classification.is_positive,
      } : null,
      message: 'Webhook received, categorized, and stored' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[smartlead-inbox-webhook] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
