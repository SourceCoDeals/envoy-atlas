import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { workspace_id, limit = 10, mode = "pending" } = await req.json();

    if (!workspace_id) {
      throw new Error("workspace_id is required");
    }

    console.log(`[process-calls-batch] Starting batch processing for workspace ${workspace_id}, mode: ${mode}, limit: ${limit}`);

    const results = {
      processed: 0,
      transcribed: 0,
      scored: 0,
      errors: [] as string[],
    };

    if (mode === "pending" || mode === "transcribe") {
      // Find calls that need transcription (have recording but no transcript)
      const { data: callsToTranscribe, error: fetchError } = await supabase
        .from("phoneburner_calls")
        .select(`
          id,
          recording_url,
          duration_seconds,
          workspace_id
        `)
        .eq("workspace_id", workspace_id)
        .not("recording_url", "is", null)
        .gt("duration_seconds", 30) // Only process calls longer than 30 seconds
        .limit(limit);

      if (fetchError) {
        throw fetchError;
      }

      console.log(`[process-calls-batch] Found ${callsToTranscribe?.length || 0} calls with recordings`);

      // Filter out calls that already have transcripts
      const callIds = callsToTranscribe?.map(c => c.id) || [];
      const { data: existingTranscripts } = await supabase
        .from("call_transcripts")
        .select("call_id")
        .in("call_id", callIds);

      const existingCallIds = new Set(existingTranscripts?.map(t => t.call_id) || []);
      const callsNeedingTranscription = callsToTranscribe?.filter(c => !existingCallIds.has(c.id)) || [];

      console.log(`[process-calls-batch] ${callsNeedingTranscription.length} calls need transcription`);

      // Process each call for transcription
      for (const call of callsNeedingTranscription) {
        try {
          const response = await supabase.functions.invoke("transcribe-call", {
            body: {
              call_id: call.id,
              workspace_id: call.workspace_id,
              recording_url: call.recording_url,
            },
          });

          if (response.error) {
            console.error(`[process-calls-batch] Transcription error for ${call.id}:`, response.error);
            results.errors.push(`Transcription failed for ${call.id}: ${response.error.message}`);
          } else {
            results.transcribed++;
            console.log(`[process-calls-batch] Transcribed call ${call.id}`);
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error(`[process-calls-batch] Error processing call ${call.id}:`, e);
          results.errors.push(`Error for ${call.id}: ${errMsg}`);
        }

        results.processed++;

        // Rate limiting - wait between calls
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (mode === "pending" || mode === "score") {
      // Find transcripts that need scoring
      const { data: transcriptsToScore, error: transcriptError } = await supabase
        .from("call_transcripts")
        .select("id, call_id, workspace_id")
        .eq("workspace_id", workspace_id)
        .eq("transcription_status", "completed")
        .limit(limit);

      if (transcriptError) {
        throw transcriptError;
      }

      // Filter out transcripts that already have scores
      const transcriptCallIds = transcriptsToScore?.map(t => t.call_id) || [];
      const { data: existingScores } = await supabase
        .from("call_ai_scores")
        .select("call_id")
        .in("call_id", transcriptCallIds);

      const scoredCallIds = new Set(existingScores?.map(s => s.call_id) || []);
      const transcriptsNeedingScoring = transcriptsToScore?.filter(t => !scoredCallIds.has(t.call_id)) || [];

      console.log(`[process-calls-batch] ${transcriptsNeedingScoring.length} transcripts need scoring`);

      // Process each transcript for scoring
      for (const transcript of transcriptsNeedingScoring) {
        try {
          const response = await supabase.functions.invoke("score-call", {
            body: {
              transcript_id: transcript.id,
              call_id: transcript.call_id,
              workspace_id: transcript.workspace_id,
            },
          });

          if (response.error) {
            console.error(`[process-calls-batch] Scoring error for ${transcript.call_id}:`, response.error);
            results.errors.push(`Scoring failed for ${transcript.call_id}: ${response.error.message}`);
          } else {
            results.scored++;
            console.log(`[process-calls-batch] Scored call ${transcript.call_id}`);
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error(`[process-calls-batch] Error scoring ${transcript.call_id}:`, e);
          results.errors.push(`Error for ${transcript.call_id}: ${errMsg}`);
        }

        results.processed++;

        // Rate limiting - wait between calls
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`[process-calls-batch] Batch complete. Processed: ${results.processed}, Transcribed: ${results.transcribed}, Scored: ${results.scored}, Errors: ${results.errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[process-calls-batch] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
