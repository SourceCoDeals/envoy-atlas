import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reply Classification Categories
type ReplyCategory = 
  | 'meeting_request'
  | 'interested'
  | 'question'
  | 'referral'
  | 'not_now'
  | 'not_interested'
  | 'unsubscribe'
  | 'out_of_office'
  | 'negative_hostile'
  | 'neutral';

type ReplySentiment = 'positive' | 'negative' | 'neutral';

interface ClassificationResult {
  category: ReplyCategory;
  sentiment: ReplySentiment;
  is_positive: boolean;
  confidence: number;
  reasoning?: string;
}

// AI-based classification using Lovable AI
async function classifyWithAI(replyText: string, subject?: string): Promise<ClassificationResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not set, falling back to rule-based classification");
    return classifyWithRules(replyText, subject);
  }

  const prompt = `Classify this email reply into exactly one category and sentiment.

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
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert at classifying sales email replies. Always respond with valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1, // Low temperature for consistent classification
      }),
    });

    if (!response.ok) {
      console.error("Lovable AI error:", response.status, await response.text());
      return classifyWithRules(replyText, subject);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }
    
    const result = JSON.parse(jsonStr);
    
    return {
      category: result.category || 'neutral',
      sentiment: result.sentiment || 'neutral',
      is_positive: result.is_positive ?? false,
      confidence: result.confidence ?? 0.5,
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error("AI classification error:", error);
    return classifyWithRules(replyText, subject);
  }
}

// Rule-based fallback classification
function classifyWithRules(replyText: string, subject?: string): ClassificationResult {
  if (!replyText) {
    return { category: 'neutral', sentiment: 'neutral', is_positive: false, confidence: 0.3 };
  }

  const text = replyText.toLowerCase();
  const subjectLower = (subject || '').toLowerCase();

  // Check for OOO first (usually obvious)
  if (text.includes('out of office') || text.includes('out of the office') || 
      text.includes('automatic reply') || text.includes('auto-reply') ||
      text.includes('on vacation') || text.includes('away from') ||
      subjectLower.includes('out of office') || subjectLower.includes('automatic reply')) {
    return { category: 'out_of_office', sentiment: 'neutral', is_positive: false, confidence: 0.95 };
  }

  // Unsubscribe - high priority
  if (text.includes('unsubscribe') || text.includes('remove me') || 
      text.includes('take me off') || text.includes('opt out') ||
      text.includes('stop emailing') || text.includes('don\'t email')) {
    return { category: 'unsubscribe', sentiment: 'negative', is_positive: false, confidence: 0.9 };
  }

  // Hostile/negative
  if (text.includes('spam') || text.includes('reported') || text.includes('lawsuit') ||
      text.includes('legal action') || text.includes('harassing') || text.includes('block')) {
    return { category: 'negative_hostile', sentiment: 'negative', is_positive: false, confidence: 0.85 };
  }

  // Meeting request - positive
  if (text.includes('schedule') || text.includes('calendar') || text.includes('when are you') ||
      text.includes('let\'s chat') || text.includes('let\'s talk') || text.includes('quick call') ||
      text.includes('book a time') || text.includes('set up a meeting') || text.includes('are you free')) {
    return { category: 'meeting_request', sentiment: 'positive', is_positive: true, confidence: 0.85 };
  }

  // Interested - positive
  if (text.includes('sounds interesting') || text.includes('tell me more') || 
      text.includes('interested') || text.includes('intrigued') || text.includes('curious') ||
      text.includes('like to learn') || text.includes('send me info')) {
    return { category: 'interested', sentiment: 'positive', is_positive: true, confidence: 0.8 };
  }

  // Referral
  if (text.includes('talk to') || text.includes('speak with') || text.includes('contact') ||
      text.includes('reach out to') || text.includes('right person') || text.includes('cc\'ing') ||
      text.includes('forwarded') || text.includes('not the right person')) {
    return { category: 'referral', sentiment: 'neutral', is_positive: false, confidence: 0.75 };
  }

  // Not now
  if (text.includes('not now') || text.includes('next quarter') || text.includes('not a priority') ||
      text.includes('reach out later') || text.includes('in 6 months') || text.includes('busy right now') ||
      text.includes('bad timing') || text.includes('not the right time')) {
    return { category: 'not_now', sentiment: 'neutral', is_positive: false, confidence: 0.75 };
  }

  // Not interested
  if (text.includes('not interested') || text.includes('no thanks') || text.includes('all set') ||
      text.includes('don\'t need') || text.includes('not a fit') || text.includes('pass')) {
    return { category: 'not_interested', sentiment: 'negative', is_positive: false, confidence: 0.8 };
  }

  // Question
  if (text.includes('?') && text.length < 500) {
    if (text.includes('who are you') || text.includes('what is this') || 
        text.includes('how did you') || text.includes('what company')) {
      return { category: 'question', sentiment: 'neutral', is_positive: false, confidence: 0.7 };
    }
    return { category: 'question', sentiment: 'neutral', is_positive: false, confidence: 0.6 };
  }

  return { category: 'neutral', sentiment: 'neutral', is_positive: false, confidence: 0.3 };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { 
      engagement_id,
      email_activity_id,
      reply_text,
      subject,
      batch_size = 50,
      classify_unclassified = true,
    } = body;

    // Single classification mode
    if (reply_text) {
      const result = await classifyWithAI(reply_text, subject);
      
      // If email_activity_id provided, update the record
      if (email_activity_id) {
        await supabase.from('email_activities').update({
          reply_category: result.category,
          reply_sentiment: result.sentiment,
          updated_at: new Date().toISOString(),
        }).eq('id', email_activity_id);
      }
      
      return new Response(JSON.stringify({
        success: true,
        classification: result,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Batch classification mode - classify unclassified replies
    if (classify_unclassified && engagement_id) {
      console.log(`Batch classifying replies for engagement ${engagement_id}...`);
      
      const { data: unclassified, error: fetchError } = await supabase
        .from('email_activities')
        .select('id, reply_text, subject')
        .eq('engagement_id', engagement_id)
        .eq('replied', true)
        .is('reply_category', null)
        .not('reply_text', 'is', null)
        .limit(batch_size);
      
      if (fetchError) {
        throw new Error(`Failed to fetch unclassified replies: ${fetchError.message}`);
      }
      
      console.log(`Found ${unclassified?.length || 0} unclassified replies`);
      
      let classified = 0;
      let positiveCount = 0;
      const errors: string[] = [];
      
      for (const activity of unclassified || []) {
        try {
          const result = await classifyWithAI(activity.reply_text, activity.subject);
          
          await supabase.from('email_activities').update({
            reply_category: result.category,
            reply_sentiment: result.sentiment,
            updated_at: new Date().toISOString(),
          }).eq('id', activity.id);
          
          classified++;
          if (result.is_positive) positiveCount++;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          errors.push(`Activity ${activity.id}: ${(e as Error).message}`);
        }
      }
      
      // Update campaign positive_replies counts
      if (classified > 0) {
        console.log(`Updating campaign positive reply counts...`);
        
        // Get all campaigns for this engagement
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('id')
          .eq('engagement_id', engagement_id);
        
        for (const campaign of campaigns || []) {
          // Count positive replies for this campaign
          const { count: positiveReplies } = await supabase
            .from('email_activities')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .in('reply_category', ['meeting_request', 'interested']);
          
          const { count: totalReplies } = await supabase
            .from('email_activities')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('replied', true);
          
          const positiveRate = totalReplies && totalReplies > 0 
            ? ((positiveReplies || 0) / totalReplies) * 100 
            : 0;
          
          await supabase.from('campaigns').update({
            positive_replies: positiveReplies || 0,
            positive_rate: positiveRate,
            updated_at: new Date().toISOString(),
          }).eq('id', campaign.id);
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        classified,
        positive_count: positiveCount,
        remaining: (unclassified?.length || 0) === batch_size,
        errors: errors.length > 0 ? errors : undefined,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      error: 'Must provide reply_text for single classification or engagement_id for batch classification',
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('classify-replies error:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message 
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
