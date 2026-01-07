import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SourceCo-specific scoring prompt based on specification
const SCORING_PROMPT = `You are an AI call analyst for SourceCo, an M&A advisory firm that helps business owners sell their companies. Analyze this cold call transcript and score it across multiple dimensions.

CONTEXT:
- SourceCo reaches out to business owners who may be considering selling their business
- The goal is to qualify interest, build rapport, and set meetings with senior advisors
- Key triggers indicating interest: health issues, burnout, partner disputes, succession planning, retirement

SCORING DIMENSIONS (score 1-10 for each):

1. SELLER INTEREST SCORE
   - 1-2: Hard no, hostile, asked to be removed
   - 3-4: Polite decline, no engagement on selling
   - 5-6: Open to conversation but no urgency
   - 7-8: Actively considering selling, mentioned timeline
   - 9-10: Ready to sell, clear trigger event, wants to meet

2. OBJECTION HANDLING SCORE
   - How well did the rep address objections?
   - Did they recover from pushback?
   - Did they use the right techniques (empathy, reframe, value)?

3. RAPPORT BUILDING SCORE
   - Did the rep establish personal connection?
   - Did they reference research about the prospect?
   - Was the conversation natural vs scripted?

4. VALUE PROPOSITION SCORE
   - Did they clearly articulate SourceCo's value?
   - Did they explain the M&A process benefits?
   - Did they differentiate from competitors?

5. ENGAGEMENT SCORE
   - Was it a two-way conversation?
   - Did the prospect ask questions?
   - Talk-time ratio (rep should be 30-40%)

6. SCRIPT ADHERENCE SCORE
   - Did they cover required talking points?
   - Did they ask discovery questions?
   - Did they attempt to qualify the prospect?

7. NEXT STEP CLARITY SCORE (Most Important)
   - Was a clear next step established?
   - Was a meeting scheduled or callback agreed?
   - Was there urgency created?

8. VALUATION DISCUSSION SCORE
   - Did they discuss valuation expectations?
   - Did they set realistic expectations?
   - Did they probe for numbers/multiples?

MANDATORY QUESTIONS TO CHECK:
- Asked about timeline to sell
- Asked about business valuation expectations
- Asked about reason for considering a sale
- Asked about decision makers/partners
- Asked about recent trigger events
- Offered to send information materials

EXTRACT THE FOLLOWING:
- Opening Type: "trigger" (referenced news/event), "permission" (asked for time), "value_first" (led with benefit), "generic" (standard intro)
- Trigger Events: Any life/business events mentioned (health, burnout, partner issues, retirement, etc.)
- Timeline to Sell: Any timeline mentioned
- Personal Insights: Names of family, hobbies, interests mentioned
- Objections List: Each objection raised and how it was handled

COMPOSITE SCORE CALCULATION (0-100):
Seller Interest × 0.15 +
Objection Handling × 0.10 +
Rapport Building × 0.15 +
Value Proposition × 0.10 +
Engagement × 0.10 +
Script Adherence × 0.10 +
Next Step Clarity × 0.20 +
Valuation Discussion × 0.10
= Total (multiply by 10 for 0-100 scale)

Return a JSON object with this exact structure:
{
  "seller_interest_score": number,
  "seller_interest_justification": "string",
  "objection_handling_score": number,
  "objection_handling_justification": "string",
  "objections_list": [{"objection": "string", "response": "string", "recovered": boolean}],
  "rapport_building_score": number,
  "rapport_building_justification": "string",
  "value_proposition_score": number,
  "value_proposition_justification": "string",
  "engagement_score": number,
  "engagement_justification": "string",
  "script_adherence_score": number,
  "script_adherence_justification": "string",
  "next_step_clarity_score": number,
  "next_step_clarity_justification": "string",
  "valuation_discussion_score": number,
  "valuation_discussion_justification": "string",
  "mandatory_questions_adherence": number (0-100 percentage of questions asked),
  "mandatory_questions_asked": ["list of questions that were asked"],
  "personal_insights": "string or null",
  "timeline_to_sell": "string or null",
  "buyer_type_preference": "string or null",
  "opening_type": "trigger" | "permission" | "value_first" | "generic",
  "trigger_events": ["list of trigger events mentioned"],
  "composite_score": number (0-100)
}

TRANSCRIPT TO ANALYZE:
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { call_id, transcript_id, workspace_id } = await req.json();

    if (!workspace_id) {
      throw new Error("workspace_id is required");
    }

    console.log(`[score-call] Starting scoring for call ${call_id || "via transcript"} transcript ${transcript_id || "to be fetched"}`);

    // Get transcript
    let transcript: { id: string; transcript_text: string; call_id: string } | null = null;

    if (transcript_id) {
      const { data, error } = await supabase
        .from("call_transcripts")
        .select("id, transcript_text, call_id")
        .eq("id", transcript_id)
        .eq("transcription_status", "completed")
        .single();

      if (error || !data) {
        throw new Error(`Transcript not found or not completed: ${transcript_id}`);
      }
      transcript = data;
    } else if (call_id) {
      const { data, error } = await supabase
        .from("call_transcripts")
        .select("id, transcript_text, call_id")
        .eq("call_id", call_id)
        .eq("transcription_status", "completed")
        .single();

      if (error || !data) {
        throw new Error(`No completed transcript found for call: ${call_id}`);
      }
      transcript = data;
    } else {
      throw new Error("Either call_id or transcript_id is required");
    }

    if (!transcript.transcript_text) {
      throw new Error("Transcript text is empty");
    }

    // Check if score already exists
    const { data: existingScore } = await supabase
      .from("call_ai_scores")
      .select("id")
      .eq("call_id", transcript.call_id)
      .single();

    if (existingScore) {
      console.log(`[score-call] Score already exists for call ${transcript.call_id}`);
      return new Response(
        JSON.stringify({ success: true, score_id: existingScore.id, status: "already_exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[score-call] Calling AI for scoring, transcript length: ${transcript.transcript_text.length}`);

    // Use Lovable AI (Gemini Pro for complex reasoning)
    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: SCORING_PROMPT + transcript.transcript_text,
          },
        ],
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[score-call] AI API error: ${errorText}`);
      throw new Error(`AI scoring failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const scoreContent = aiResult.choices?.[0]?.message?.content;

    if (!scoreContent) {
      throw new Error("AI returned empty scoring result");
    }

    console.log(`[score-call] AI scoring completed, parsing result`);

    // Parse the JSON response
    let scores;
    try {
      scores = JSON.parse(scoreContent);
    } catch (e) {
      // Try to extract JSON from the response
      const jsonMatch = scoreContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scores = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI scoring response as JSON");
      }
    }

    // Validate and clamp scores
    const clampScore = (val: unknown, min: number, max: number): number | null => {
      if (val === null || val === undefined) return null;
      const num = Number(val);
      if (isNaN(num)) return null;
      return Math.max(min, Math.min(max, Math.round(num)));
    };

    const scoreData = {
      workspace_id,
      call_id: transcript.call_id,
      transcript_id: transcript.id,
      seller_interest_score: clampScore(scores.seller_interest_score, 1, 10),
      seller_interest_justification: scores.seller_interest_justification || null,
      objection_handling_score: clampScore(scores.objection_handling_score, 1, 10),
      objection_handling_justification: scores.objection_handling_justification || null,
      objections_list: Array.isArray(scores.objections_list) ? scores.objections_list : [],
      rapport_building_score: clampScore(scores.rapport_building_score, 1, 10),
      rapport_building_justification: scores.rapport_building_justification || null,
      value_proposition_score: clampScore(scores.value_proposition_score, 1, 10),
      value_proposition_justification: scores.value_proposition_justification || null,
      engagement_score: clampScore(scores.engagement_score, 1, 10),
      engagement_justification: scores.engagement_justification || null,
      script_adherence_score: clampScore(scores.script_adherence_score, 1, 10),
      script_adherence_justification: scores.script_adherence_justification || null,
      next_step_clarity_score: clampScore(scores.next_step_clarity_score, 1, 10),
      next_step_clarity_justification: scores.next_step_clarity_justification || null,
      valuation_discussion_score: clampScore(scores.valuation_discussion_score, 1, 10),
      valuation_discussion_justification: scores.valuation_discussion_justification || null,
      mandatory_questions_adherence: clampScore(scores.mandatory_questions_adherence, 0, 100),
      mandatory_questions_asked: Array.isArray(scores.mandatory_questions_asked) ? scores.mandatory_questions_asked : [],
      personal_insights: scores.personal_insights || null,
      timeline_to_sell: scores.timeline_to_sell || null,
      buyer_type_preference: scores.buyer_type_preference || null,
      opening_type: scores.opening_type || null,
      trigger_events: Array.isArray(scores.trigger_events) ? scores.trigger_events : [],
      composite_score: clampScore(scores.composite_score, 0, 100),
      scoring_model: "google/gemini-2.5-pro",
    };

    // Insert score record
    const { data: newScore, error: insertError } = await supabase
      .from("call_ai_scores")
      .insert(scoreData)
      .select("id, composite_score")
      .single();

    if (insertError) {
      console.error(`[score-call] Insert error:`, insertError);
      throw insertError;
    }

    console.log(`[score-call] Score saved successfully for call ${transcript.call_id}, composite: ${newScore.composite_score}`);

    return new Response(
      JSON.stringify({
        success: true,
        score_id: newScore.id,
        composite_score: newScore.composite_score,
        seller_interest_score: scoreData.seller_interest_score,
        next_step_clarity_score: scoreData.next_step_clarity_score,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[score-call] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
