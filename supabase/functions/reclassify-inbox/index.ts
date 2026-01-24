import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    console.error('[reclassify-inbox] OPENROUTER_API_KEY not set');
    return null;
  }

  const prompt = `Classify this sales email reply into exactly one category and sentiment.

CATEGORIES:
- meeting_request: Wants to schedule a call/meeting
- interested: Expresses interest but no meeting request
- question: Asking clarifying questions
- referral: Directing to someone else
- not_now: Timing issue, not rejecting
- not_interested: Polite decline
- unsubscribe: Explicit opt-out request
- out_of_office: Automated OOO reply
- negative_hostile: Angry/hostile response
- neutral: Cannot determine intent

SENTIMENT:
- positive: Interest in product/meeting
- negative: Rejection, complaint, hostility
- neutral: Questions, OOO, referrals, unclear

POSITIVE REPLY (is_positive = true) only for: meeting_request, interested

Subject: ${subject || 'N/A'}
Reply Text: ${replyText}

Respond in JSON format only:
{"category": "<category>", "sentiment": "<sentiment>", "is_positive": <boolean>, "confidence": <0.0-1.0>, "reasoning": "<brief explanation>"}`;

  try {
    console.log('[reclassify-inbox] Calling OpenRouter API...');
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
      console.error('[reclassify-inbox] OpenRouter error:', response.status, errorText);
      return null;
    }

    const result = await response.json();
    console.log('[reclassify-inbox] OpenRouter response:', JSON.stringify(result));
    
    const content = result.choices?.[0]?.message?.content || '';
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
    
    console.warn('[reclassify-inbox] Could not parse response:', content);
    return null;
  } catch (error) {
    console.error('[reclassify-inbox] Error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get records that need classification
    const { data: records, error: fetchError } = await supabase
      .from('smartlead_inbox_webhooks')
      .select('id, preview_text, reply_body, subject')
      .is('ai_category', null)
      .limit(50);

    if (fetchError) throw fetchError;

    console.log(`[reclassify-inbox] Found ${records?.length || 0} records to classify`);

    const results = [];
    for (const record of records || []) {
      const replyText = record.preview_text || record.reply_body?.replace(/<[^>]*>/g, ' ').substring(0, 2000) || '';
      
      if (!replyText) {
        console.log(`[reclassify-inbox] Skipping ${record.id} - no text`);
        continue;
      }

      const classification = await classifyEmail(replyText, record.subject || '');
      
      if (classification) {
        const { error: updateError } = await supabase
          .from('smartlead_inbox_webhooks')
          .update({
            ai_category: classification.category,
            ai_sentiment: classification.sentiment,
            ai_is_positive: classification.is_positive,
            ai_confidence: classification.confidence,
            ai_reasoning: classification.reasoning,
            categorized_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        if (updateError) {
          console.error(`[reclassify-inbox] Update error for ${record.id}:`, updateError);
        } else {
          results.push({ id: record.id, ...classification });
          console.log(`[reclassify-inbox] Classified ${record.id}: ${classification.category}`);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      classified: results.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[reclassify-inbox] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
