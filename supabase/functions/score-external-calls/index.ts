import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SourceCo-specific scoring prompt
const SCORING_PROMPT = `You are an AI call analyst for SourceCo, an M&A advisory firm. Analyze this cold call transcript and score it across multiple dimensions.

CONTEXT:
- SourceCo reaches out to business owners who may be considering selling their business
- The goal is to qualify interest, build rapport, and set meetings with senior advisors

SCORING DIMENSIONS (score 1-10 for each):

1. SELLER INTEREST SCORE (1-10)
2. OBJECTION HANDLING SCORE (1-10)
3. RAPPORT BUILDING SCORE (1-10)
4. VALUE PROPOSITION SCORE (1-10)
5. ENGAGEMENT SCORE (1-10)
6. NEXT STEP CLARITY SCORE (1-10)
7. QUALITY OF CONVERSATION SCORE (1-10)

COMPOSITE SCORE CALCULATION (0-100):
Average of all scores × 10

Return a JSON object with this structure:
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
  "quality_of_conversation_score": number,
  "quality_of_conversation_justification": "string",
  "next_step_clarity_score": number,
  "next_step_clarity_justification": "string",
  "key_topics_discussed": ["list of main topics"],
  "key_concerns": ["list of concerns raised"],
  "motivation_factors": ["list of motivation factors mentioned"],
  "timeline_to_sell": "string or null",
  "composite_score": number (0-100),
  "call_summary": "2-3 sentence summary of the call"
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const { workspace_id, limit = 5 } = await req.json();

    if (!workspace_id) {
      throw new Error("workspace_id is required");
    }

    console.log(`[score-external-calls] Processing calls for workspace ${workspace_id}`);

    // Get external calls with transcripts that need scoring
    const { data: callsToScore, error: fetchError } = await supabase
      .from("external_calls")
      .select("*")
      .eq("workspace_id", workspace_id)
      .eq("import_status", "transcript_fetched")
      .not("transcript_text", "is", null)
      .limit(limit);

    if (fetchError) {
      throw fetchError;
    }

    if (!callsToScore || callsToScore.length === 0) {
      return new Response(
        JSON.stringify({ success: true, scored: 0, message: "No calls to score" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[score-external-calls] Found ${callsToScore.length} calls to score`);

    let scored = 0;
    let errors = 0;

    for (const call of callsToScore) {
      try {
        console.log(`[score-external-calls] Scoring call ${call.id}`);

        // Call Lovable AI for scoring
        const aiResponse = await fetch("https://ai.lovable.dev/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: SCORING_PROMPT + call.transcript_text,
              },
            ],
            max_completion_tokens: 2000,
            response_format: { type: "json_object" },
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`[score-external-calls] AI error for ${call.id}: ${errorText}`);
          
          await supabase
            .from("external_calls")
            .update({
              import_status: "error",
              error_message: `AI scoring error: ${aiResponse.status}`,
            })
            .eq("id", call.id);
          
          errors++;
          continue;
        }

        const aiResult = await aiResponse.json();
        const scoreContent = aiResult.choices?.[0]?.message?.content;

        if (!scoreContent) {
          throw new Error("AI returned empty result");
        }

        // Parse scores
        let scores;
        try {
          scores = JSON.parse(scoreContent);
        } catch {
          const jsonMatch = scoreContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            scores = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("Failed to parse AI response");
          }
        }

        // Create a synthetic call_ai_scores record for external calls
        // We'll use a generated UUID as the call_id since these aren't PhoneBurner calls
        const scoreData = {
          workspace_id,
          call_id: call.id, // Use external_call.id as the call_id
          data_source: "nocodb_fireflies",
          seller_interest_score: scores.seller_interest_score || null,
          seller_interest_justification: scores.seller_interest_justification || null,
          objection_handling_score: scores.objection_handling_score || null,
          objection_handling_justification: scores.objection_handling_justification || null,
          objections_list: scores.objections_list || [],
          rapport_building_score: scores.rapport_building_score || null,
          rapport_building_justification: scores.rapport_building_justification || null,
          value_proposition_score: scores.value_proposition_score || null,
          value_proposition_justification: scores.value_proposition_justification || null,
          engagement_score: scores.engagement_score || null,
          engagement_justification: scores.engagement_justification || null,
          quality_of_conversation_score: scores.quality_of_conversation_score || null,
          quality_of_conversation_justification: scores.quality_of_conversation_justification || null,
          next_step_clarity_score: scores.next_step_clarity_score || null,
          next_step_clarity_justification: scores.next_step_clarity_justification || null,
          key_topics_discussed: scores.key_topics_discussed || [],
          key_concerns: scores.key_concerns || [],
          motivation_factors: scores.motivation_factors || [],
          timeline_to_sell: scores.timeline_to_sell || null,
          composite_score: scores.composite_score || null,
          scoring_model: "google/gemini-2.5-flash",
        };

        // Insert score record - note: call_ai_scores.call_id references phoneburner_calls
        // For external calls, we'll store scores directly in the external_calls table
        // and aggregate them in the useAISummary hook

        // Update external_calls with scores directly
        const { error: updateError } = await supabase
          .from("external_calls")
          .update({
            import_status: "scored",
            error_message: null,
            seller_interest_score: scores.seller_interest_score || null,
            seller_interest_justification: scores.seller_interest_justification || null,
            objection_handling_score: scores.objection_handling_score || null,
            rapport_building_score: scores.rapport_building_score || null,
            value_proposition_score: scores.value_proposition_score || null,
            engagement_score: scores.engagement_score || null,
            quality_of_conversation_score: scores.quality_of_conversation_score || null,
            next_step_clarity_score: scores.next_step_clarity_score || null,
            composite_score: scores.composite_score || null,
            key_topics_discussed: scores.key_topics_discussed || [],
            key_concerns: scores.key_concerns || [],
            motivation_factors: scores.motivation_factors || [],
            timeline_to_sell: scores.timeline_to_sell || null,
            call_summary: scores.call_summary || null,
            call_category: scores.call_category || null,
          })
          .eq("id", call.id);

        if (updateError) {
          console.error(`[score-external-calls] Update error for ${call.id}:`, updateError);
          errors++;
          continue;
        }
        
        scored++;
        console.log(`[score-external-calls] Scored call ${call.id}: composite=${scores.composite_score}`);

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[score-external-calls] Error scoring ${call.id}:`, msg);
        
        await supabase
          .from("external_calls")
          .update({
            import_status: "error",
            error_message: msg,
          })
          .eq("id", call.id);
        
        errors++;
      }
    }

    console.log(`[score-external-calls] Complete. Scored: ${scored}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        total: callsToScore.length,
        scored,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[score-external-calls] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
