import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function returns the count and status of external calls for a workspace
// The data was pre-imported as test data - no NocoDB API needed
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspace_id } = await req.json();

    if (!workspace_id) {
      throw new Error("workspace_id is required");
    }

    console.log(`[nocodb-sync] Getting stats for workspace ${workspace_id}`);

    // Get counts by status
    const { data: calls, error } = await supabase
      .from("external_calls")
      .select("id, import_status, call_type")
      .eq("workspace_id", workspace_id);

    if (error) {
      throw error;
    }

    const stats = {
      total: calls?.length || 0,
      pending: calls?.filter(c => c.import_status === "pending").length || 0,
      transcript_fetched: calls?.filter(c => c.import_status === "transcript_fetched").length || 0,
      scored: calls?.filter(c => c.import_status === "scored").length || 0,
      error: calls?.filter(c => c.import_status === "error").length || 0,
      by_type: {
        sales: calls?.filter(c => c.call_type === "sales").length || 0,
        remarketing: calls?.filter(c => c.call_type === "remarketing").length || 0,
        external: calls?.filter(c => c.call_type === "external").length || 0,
      }
    };

    console.log(`[nocodb-sync] Stats:`, stats);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[nocodb-sync] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
