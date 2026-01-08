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
    const { calls, workspaceId, clearExisting } = await req.json();

    if (!calls || !Array.isArray(calls) || !workspaceId) {
      throw new Error("calls array and workspaceId are required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[import-json-calls] Processing ${calls.length} calls`);

    // Clear existing if requested
    if (clearExisting) {
      await supabase.from("external_calls").delete().eq("workspace_id", workspaceId);
      console.log(`[import-json-calls] Cleared existing calls`);
    }

    const records = calls.map((call: any, index: number) => {
      const transcript = call["Transcript"];
      const hasTranscript = transcript && transcript !== "[No Transcript]" && transcript.length > 50;
      
      // Check if already scored
      const hasScores = call["Seller Interest Score"] && call["Seller Interest Score"] !== "";
      
      return {
        workspace_id: workspaceId,
        nocodb_row_id: `json_${index}_${Date.now()}`,
        call_title: call["Call Title"] || `Import ${index + 1}`,
        fireflies_url: call["Fireflies URL"] || null,
        date_time: call["Date Time"] ? new Date(call["Date Time"]).toISOString() : null,
        host_email: call["Host Email"] || null,
        all_participants: call["All Participants"] || null,
        call_type: "external",
        transcript_text: hasTranscript ? transcript : null,
        import_status: hasScores ? "scored" : (hasTranscript ? "transcript_fetched" : "pending"),
      };
    });

    // Insert in batches of 500
    const batchSize = 500;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase.from("external_calls").insert(batch);
      
      if (error) {
        console.error(`[import-json-calls] Batch ${Math.floor(i/batchSize)+1} error:`, error.message);
        errors += batch.length;
      } else {
        inserted += batch.length;
        console.log(`[import-json-calls] Inserted batch ${Math.floor(i/batchSize)+1}: ${inserted} total`);
      }
    }

    const withTranscripts = records.filter((r: any) => r.transcript_text).length;
    const scored = records.filter((r: any) => r.import_status === "scored").length;
    
    console.log(`[import-json-calls] Done: ${inserted} inserted (${withTranscripts} with transcripts, ${scored} scored), ${errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: calls.length, 
        inserted, 
        withTranscripts,
        scored,
        errors 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[import-json-calls] Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
