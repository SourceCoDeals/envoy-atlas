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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspace_id, limit = 10 } = await req.json();

    if (!workspace_id) {
      throw new Error("workspace_id is required");
    }

    console.log(`[fetch-transcripts] Processing external calls for workspace ${workspace_id}`);

    // Get external calls that need transcript fetching
    const { data: pendingCalls, error: fetchError } = await supabase
      .from("external_calls")
      .select("*")
      .eq("workspace_id", workspace_id)
      .eq("import_status", "pending")
      .not("fireflies_url", "is", null)
      .limit(limit);

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingCalls || pendingCalls.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending calls to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fetch-transcripts] Found ${pendingCalls.length} calls to process`);

    let processed = 0;
    let errors = 0;

    for (const call of pendingCalls) {
      try {
        console.log(`[fetch-transcripts] Processing call ${call.id}: ${call.fireflies_url}`);

        // Use Firecrawl to scrape the Fireflies page
        const firecrawlResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("FIRECRAWL_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: call.fireflies_url,
            formats: ["markdown"],
            waitFor: 3000, // Wait for dynamic content
          }),
        });

        if (!firecrawlResponse.ok) {
          const errorText = await firecrawlResponse.text();
          console.error(`[fetch-transcripts] Firecrawl error for ${call.id}: ${errorText}`);
          
          // Update status to error
          await supabase
            .from("external_calls")
            .update({
              import_status: "error",
              error_message: `Firecrawl error: ${firecrawlResponse.status}`,
            })
            .eq("id", call.id);
          
          errors++;
          continue;
        }

        const firecrawlData = await firecrawlResponse.json();
        const transcriptText = firecrawlData.data?.markdown || firecrawlData.data?.content || "";

        if (!transcriptText || transcriptText.length < 100) {
          console.log(`[fetch-transcripts] Transcript too short for ${call.id}, marking as error`);
          
          await supabase
            .from("external_calls")
            .update({
              import_status: "error",
              error_message: "Transcript content too short or empty",
            })
            .eq("id", call.id);
          
          errors++;
          continue;
        }

        // Store transcript in external_calls table directly
        const { error: updateError } = await supabase
          .from("external_calls")
          .update({
            transcript_text: transcriptText,
            import_status: "transcript_fetched",
            error_message: null,
          })
          .eq("id", call.id);

        if (updateError) {
          console.error(`[fetch-transcripts] Update error for ${call.id}:`, updateError);
          errors++;
        } else {
          processed++;
          console.log(`[fetch-transcripts] Successfully processed ${call.id}`);
        }

      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[fetch-transcripts] Error processing ${call.id}:`, msg);
        
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

    console.log(`[fetch-transcripts] Complete. Processed: ${processed}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        total: pendingCalls.length,
        processed,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[fetch-transcripts] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
