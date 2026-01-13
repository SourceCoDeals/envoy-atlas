import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOCODB_BASE_URL = "https://nocodb-1b0ku-u5603.vm.elestio.app";
const NOCODB_TABLE_ID = "m9klgus7som6u7q";

// Column mapping from NocoDB to cold_calls table
const COLUMN_MAP: Record<string, string> = {
  // NocoDB system columns
  "Id": "nocodb_id",
  "CreatedAt": "nocodb_created_at",
  "UpdatedAt": "nocodb_updated_at",
  
  // Call metadata
  "Direction": "direction",
  "From Number (CallerID)": "from_number",
  "From Name": "from_name",
  "To Number": "to_number",
  "To Name": "to_name",
  "To Company": "to_company",
  "To Email": "to_email",
  "Salesforce URL": "salesforce_url",
  "Call Duration (sec)": "call_duration_sec",
  "Called Date": "called_date",
  "Called Date Time": "called_date_time",
  "Call Transcript": "call_transcript",
  "Category": "category",
  "Analyst": "analyst",
  
  // AI Scores
  "Interest Rating": "seller_interest_score",
  "Objection Handling Rating": "objection_handling_score",
  "Conversation Quality": "quality_of_conversation_score",
  "Value Clarity": "value_proposition_score",
  "Rapport Building": "rapport_building_score",
  "Engagement Score": "engagement_score",
  "Next Step Clarity": "next_step_clarity_score",
  "Gatekeeper Handling": "gatekeeper_handling_score",
  
  // Other fields
  "Opening Type": "opening_type",
  "Primary Opportunity": "primary_opportunity",
  "Call Summary": "call_summary",
  "Key Concerns": "key_concerns",
  "Target Pain Points": "target_pain_points",
};

function parseDateTime(value: string | null): string | null {
  if (!value) return null;
  
  try {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch {
    // Try manual parsing
  }
  
  // Manual parsing for M/D/YYYY H:M:S format
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const [_, month, day, year, hour, minute, second] = match;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
    return date.toISOString();
  }
  
  return null;
}

function mapNocoDBRecord(record: Record<string, any>, workspaceId: string): Record<string, any> {
  const mapped: Record<string, any> = {
    workspace_id: workspaceId,
  };

  for (const [nocoKey, dbKey] of Object.entries(COLUMN_MAP)) {
    const value = record[nocoKey];
    if (value === undefined || value === null || value === "") continue;
    
    // Handle specific type conversions
    if (dbKey === "nocodb_id") {
      mapped[dbKey] = parseInt(value, 10) || null;
    } else if (dbKey === "call_duration_sec") {
      mapped[dbKey] = parseInt(value, 10) || null;
    } else if (dbKey.includes("_score")) {
      mapped[dbKey] = parseFloat(value) || null;
    } else if (dbKey === "called_date" || dbKey === "called_date_time" || dbKey === "nocodb_created_at" || dbKey === "nocodb_updated_at") {
      mapped[dbKey] = parseDateTime(value);
    } else if (dbKey === "key_concerns") {
      // Handle array field - could be string or already array
      if (Array.isArray(value)) {
        mapped[dbKey] = value;
      } else if (typeof value === "string") {
        mapped[dbKey] = value.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    } else {
      mapped[dbKey] = value;
    }
  }

  // Calculate composite_score as average of available scores
  const scores = [
    mapped.seller_interest_score,
    mapped.quality_of_conversation_score,
    mapped.objection_handling_score,
    mapped.value_proposition_score,
    mapped.rapport_building_score,
    mapped.engagement_score,
    mapped.next_step_clarity_score,
    mapped.gatekeeper_handling_score,
  ].filter(s => s !== null && s !== undefined);
  
  if (scores.length > 0) {
    mapped.composite_score = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
  }

  return mapped;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const nocodbApiToken = Deno.env.get("NOCODB_API_TOKEN");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { workspace_id, action = "sync" } = body;

    console.log(`[cold-calls-sync] Action: ${action}, workspace: ${workspace_id || "all"}`);

    if (!nocodbApiToken) {
      throw new Error("NOCODB_API_TOKEN is not configured");
    }

    // If no workspace_id provided, sync for all workspaces with nocodb connections
    let workspaceIds: string[] = [];
    
    if (workspace_id) {
      workspaceIds = [workspace_id];
    } else {
      // Get all workspaces with nocodb connections
      const { data: connections } = await supabase
        .from("api_connections")
        .select("workspace_id")
        .eq("platform", "nocodb")
        .eq("is_active", true);
      
      workspaceIds = connections?.map(c => c.workspace_id) || [];
      
      // If no connections found, try to get any workspace
      if (workspaceIds.length === 0) {
        const { data: workspaces } = await supabase
          .from("workspaces")
          .select("id")
          .limit(1);
        workspaceIds = workspaces?.map(w => w.id) || [];
      }
    }

    if (workspaceIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No workspaces found to sync" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all records from NocoDB with pagination
    let allRecords: Record<string, any>[] = [];
    let offset = 0;
    const limit = 200;
    let hasMore = true;

    console.log("[cold-calls-sync] Fetching records from NocoDB...");

    while (hasMore) {
      const url = `${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_ID}/records?limit=${limit}&offset=${offset}`;
      console.log(`[cold-calls-sync] Fetching: offset=${offset}`);
      
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
      const records = data.list || [];
      allRecords = allRecords.concat(records);
      
      console.log(`[cold-calls-sync] Fetched ${records.length} records (total: ${allRecords.length})`);
      
      if (records.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    console.log(`[cold-calls-sync] Total records fetched: ${allRecords.length}`);

    // Process for each workspace
    const results: Record<string, any>[] = [];
    
    for (const wsId of workspaceIds) {
      console.log(`[cold-calls-sync] Processing workspace: ${wsId}`);
      
      const mappedRecords = allRecords.map(r => mapNocoDBRecord(r, wsId));
      
      let inserted = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      // Upsert in batches using nocodb_id as unique key
      const BATCH_SIZE = 100;
      for (let i = 0; i < mappedRecords.length; i += BATCH_SIZE) {
        const batch = mappedRecords.slice(i, i + BATCH_SIZE);
        
        const { data, error } = await supabase
          .from("cold_calls")
          .upsert(batch, { 
            onConflict: "nocodb_id",
            ignoreDuplicates: false 
          })
          .select("id");

        if (error) {
          console.error(`[cold-calls-sync] Batch upsert error:`, error);
          errors += batch.length;
          errorDetails.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
        } else {
          inserted += data?.length || 0;
        }
      }

      results.push({
        workspace_id: wsId,
        fetched: allRecords.length,
        inserted,
        errors,
        error_details: errorDetails.slice(0, 5),
      });

      console.log(`[cold-calls-sync] Workspace ${wsId}: ${inserted} upserted, ${errors} errors`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        synced_at: new Date().toISOString(),
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[cold-calls-sync] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
