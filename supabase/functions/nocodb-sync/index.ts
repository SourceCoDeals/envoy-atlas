import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NocoDBRecord {
  Id: number;
  "Call Title"?: string;
  "Fireflies URL"?: string;
  "PhoneBurner Recording URL"?: string;
  "Date Time"?: string;
  "Host Email"?: string;
  "All Participants"?: string;
  [key: string]: unknown;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspace_id, nocodb_api_token, nocodb_base_url, table_id } = await req.json();

    if (!workspace_id) {
      throw new Error("workspace_id is required");
    }

    if (!nocodb_api_token) {
      throw new Error("nocodb_api_token is required");
    }

    // Default NocoDB base URL
    const baseUrl = nocodb_base_url || "https://nocodb-1b0ku-u5603.vm.elestio.app";
    
    console.log(`[nocodb-sync] Starting sync for workspace ${workspace_id}`);

    // Fetch all records from NocoDB using the API
    // The table_id should be the ID of the "External Calls" table
    const nocoTableId = table_id || "tblExternalCalls"; // Default table name
    
    let allRecords: NocoDBRecord[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${baseUrl}/api/v2/tables/${nocoTableId}/records?offset=${offset}&limit=${limit}`,
        {
          headers: {
            "xc-token": nocodb_api_token,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[nocodb-sync] NocoDB API error: ${errorText}`);
        throw new Error(`NocoDB API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const records = data.list || [];
      allRecords = [...allRecords, ...records];

      console.log(`[nocodb-sync] Fetched ${records.length} records (total: ${allRecords.length})`);

      if (records.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    console.log(`[nocodb-sync] Total records fetched: ${allRecords.length}`);

    // Transform and upsert records
    let imported = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    for (const record of allRecords) {
      try {
        // Parse date_time if present
        let dateTime: string | null = null;
        if (record["Date Time"]) {
          try {
            dateTime = new Date(record["Date Time"] as string).toISOString();
          } catch {
            // Keep as null if parse fails
          }
        }

        // Determine call type based on table or field
        let callType = "external";
        const title = record["Call Title"]?.toLowerCase() || "";
        if (title.includes("sales") || title.includes("cold call")) {
          callType = "sales";
        } else if (title.includes("remarketing") || title.includes("buyer")) {
          callType = "remarketing";
        }

        const externalCall = {
          workspace_id,
          nocodb_row_id: String(record.Id),
          call_title: record["Call Title"] || null,
          fireflies_url: record["Fireflies URL"] || null,
          phoneburner_recording_url: record["PhoneBurner Recording URL"] || null,
          date_time: dateTime,
          host_email: record["Host Email"] || null,
          all_participants: record["All Participants"] || null,
          call_type: callType,
          import_status: "pending",
        };

        const { error: upsertError } = await supabase
          .from("external_calls")
          .upsert(externalCall, {
            onConflict: "workspace_id,nocodb_row_id",
          });

        if (upsertError) {
          console.error(`[nocodb-sync] Error upserting record ${record.Id}:`, upsertError);
          errors++;
          errorMessages.push(`Row ${record.Id}: ${upsertError.message}`);
        } else {
          imported++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[nocodb-sync] Error processing record ${record.Id}:`, msg);
        errors++;
        errorMessages.push(`Row ${record.Id}: ${msg}`);
      }
    }

    console.log(`[nocodb-sync] Sync complete. Imported: ${imported}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        total_fetched: allRecords.length,
        imported,
        errors,
        error_messages: errorMessages.slice(0, 10), // Limit error messages
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
