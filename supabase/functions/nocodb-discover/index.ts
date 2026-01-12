import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOCODB_BASE_URL = "https://nocodb-1b0ku-u5603.vm.elestio.app";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const nocodbApiToken = Deno.env.get("NOCODB_API_TOKEN");
    
    if (!nocodbApiToken) {
      throw new Error("NOCODB_API_TOKEN is not configured");
    }

    const { table_id, action = "schema" } = await req.json();

    // Use the new table ID from the user's link
    const tableId = table_id || "m9klgus7som6u7q";

    console.log(`[nocodb-discover] Action: ${action} for table ${tableId}`);

    if (action === "schema") {
      // Get table metadata/columns
      const url = `${NOCODB_BASE_URL}/api/v2/meta/tables/${tableId}`;
      console.log(`[nocodb-discover] Fetching schema from: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          "xc-token": nocodbApiToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NocoDB API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ success: true, schema: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "sample") {
      // Get sample records
      const url = `${NOCODB_BASE_URL}/api/v2/tables/${tableId}/records?limit=5`;
      console.log(`[nocodb-discover] Fetching sample from: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          "xc-token": nocodbApiToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NocoDB API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ success: true, records: data.list || [], pageInfo: data.pageInfo }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "count") {
      // Get record count
      const url = `${NOCODB_BASE_URL}/api/v2/tables/${tableId}/records?limit=1`;
      
      const response = await fetch(url, {
        headers: {
          "xc-token": nocodbApiToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NocoDB API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return new Response(
        JSON.stringify({ success: true, totalRows: data.pageInfo?.totalRows || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[nocodb-discover] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
