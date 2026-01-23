import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOCODB_BASE_URL = "https://nocodb-1b0ku-u5603.vm.elestio.app";
const NOCODB_TABLE_ID = "m9klgus7som6u7q";

// Complete column mapping from NocoDB to cold_calls table (all 38 columns)
const COLUMN_MAP: Record<string, string> = {
  // NocoDB system columns
  "Id": "nocodb_id",
  "CreatedAt": "nocodb_created_at",
  "UpdatedAt": "nocodb_updated_at",
  
  // Call metadata
  "Direction": "direction",
  "From Number (CallerID)": "from_number",
  "To Name": "to_name",
  "To Company": "to_company",
  "To Number": "to_number",
  "Salesforce URL": "salesforce_url",
  "Call Recording": "call_recording_url",
  "Call Duration (sec)": "call_duration_sec",
  "Called Date": "called_date",
  "Called Date Time": "called_date_time",
  "Call Transcript": "call_transcript",
  "Call Summary": "call_summary",
  "Category": "category",
  "Analyst": "analyst",
  "Primary Opportunity": "primary_opportunity",
  
  // AI Scores (1-10 scale)
  "Interest Rating": "seller_interest_score",
  "Objection Handling Rating": "objection_handling_score",
  "Conversation Quality": "quality_of_conversation_score",
  "Value Clarity": "value_proposition_score",
  "Script Adherence": "script_adherence_score",
  "Decision Maker Identified": "decision_maker_identified_score",
  "Referral Rate": "referral_rate_score",
  
  // Resolution rate (percentage)
  "Resolution Rate": "resolution_rate",
  
  // AI Reasoning fields
  "Interest Rating (Reasoning)": "interest_rating_reasoning",
  "Objection Handling Rating (Reasoning)": "objection_handling_reasoning",
  "Resolution Rate (Reasoning)": "resolution_rate_reasoning",
  "Conversation Quality (Reasoning)": "conversation_quality_reasoning",
  "Script Adherence (Reasoning)": "script_adherence_reasoning",
  "Decision Maker Identified (Reasoning)": "decision_maker_reasoning",
  "Value Clarity (Reasoning)": "value_clarity_reasoning",
  "Referral Rate (Reasoning)": "referral_rate_reasoning",
  
  // Objection tracking
  "Objections": "objections",
  "Not Interested (Reason)": "not_interested_reason",
};

// Cold Call Disposition Classification Map
// Strips time suffixes (e.g., "Voicemail - 39 seconds" → "Voicemail")
// and maps to boolean metric flags
const COLD_CALL_DISPOSITION_MAP: Record<string, {
  is_connection: boolean;
  is_meeting: boolean;
  is_voicemail: boolean;
  is_bad_data: boolean;
}> = {
  // CONNECTION DISPOSITIONS (counts toward connections)
  'receptionist': { is_connection: true, is_meeting: false, is_voicemail: false, is_bad_data: false },
  'callback requested': { is_connection: true, is_meeting: true, is_voicemail: false, is_bad_data: false },
  'send email': { is_connection: true, is_meeting: false, is_voicemail: false, is_bad_data: false },
  'not qualified': { is_connection: true, is_meeting: false, is_voicemail: false, is_bad_data: false },
  'positive - blacklist co': { is_connection: true, is_meeting: true, is_voicemail: false, is_bad_data: false },
  'negative - blacklist co': { is_connection: true, is_meeting: false, is_voicemail: false, is_bad_data: false },
  'negative - blacklist contact': { is_connection: true, is_meeting: false, is_voicemail: false, is_bad_data: false },
  'hung up': { is_connection: true, is_meeting: false, is_voicemail: false, is_bad_data: false },
  'meeting booked': { is_connection: true, is_meeting: true, is_voicemail: false, is_bad_data: false },
  
  // VOICEMAIL DISPOSITIONS
  'voicemail': { is_connection: false, is_meeting: false, is_voicemail: true, is_bad_data: false },
  'live voicemail': { is_connection: false, is_meeting: false, is_voicemail: true, is_bad_data: false },
  'voicemail drop': { is_connection: false, is_meeting: false, is_voicemail: true, is_bad_data: false },
  
  // NO ANSWER / NON-CONNECTION
  'no answer': { is_connection: false, is_meeting: false, is_voicemail: false, is_bad_data: false },
  
  // BAD DATA
  'bad phone': { is_connection: false, is_meeting: false, is_voicemail: false, is_bad_data: true },
  'wrong number': { is_connection: false, is_meeting: false, is_voicemail: false, is_bad_data: true },
  'do not call': { is_connection: false, is_meeting: false, is_voicemail: false, is_bad_data: true },
};

/**
 * Normalize category by stripping time suffixes and variations
 * e.g., "Voicemail - 39 seconds" → "voicemail"
 * e.g., "Live Voicemail - 1 minute 23 seconds" → "live voicemail"
 * e.g., "Voicemail drop (or) Spoke for 21 seconds only" → "voicemail"
 */
function normalizeCategory(category: string | null): string | null {
  if (!category) return null;
  
  let normalized = category.toLowerCase().trim();
  
  // Handle "Voicemail drop (or) Spoke for X seconds only" pattern
  if (normalized.includes('voicemail drop') || normalized.includes('spoke for')) {
    return 'voicemail';
  }
  
  // Handle "Live Voicemail" variations
  if (normalized.includes('live voicemail')) {
    return 'live voicemail';
  }
  
  // Handle simple voicemail with time suffix
  if (normalized.startsWith('voicemail')) {
    return 'voicemail';
  }
  
  // Handle Gatekeeper (legacy disposition name)
  if (normalized === 'gatekeeper') {
    return 'receptionist';
  }
  
  // Handle Connection (legacy generic name) 
  if (normalized === 'connection') {
    // Default to send email since it's a generic connection without clear outcome
    return 'send email';
  }
  
  // Remove time suffixes like "- 39 seconds", "- 1 minute 23 seconds"
  normalized = normalized
    .replace(/\s*-\s*\d+\s*(second|seconds|minute|minutes|min|sec|s).*$/i, '')
    .trim();
  
  return normalized || null;
}

/**
 * Classify a disposition with optional duration-based override
 * If duration > 60s, consider it a connection even if not in map
 */
function classifyDisposition(
  category: string | null,
  durationSec: number | null
): {
  normalized_category: string | null;
  is_connection: boolean;
  is_meeting: boolean;
  is_voicemail: boolean;
  is_bad_data: boolean;
} {
  const normalized = normalizeCategory(category);
  
  // Default values
  let result = {
    normalized_category: normalized,
    is_connection: false,
    is_meeting: false,
    is_voicemail: false,
    is_bad_data: false,
  };
  
  if (!normalized) return result;
  
  // Check exact match in map
  const mapping = COLD_CALL_DISPOSITION_MAP[normalized];
  if (mapping) {
    result = { ...result, ...mapping };
  } else {
    // Fuzzy matching for variations
    if (normalized.includes('voicemail')) {
      result.is_voicemail = true;
    } else if (normalized.includes('callback') || normalized.includes('meeting')) {
      result.is_connection = true;
      result.is_meeting = true;
    } else if (normalized.includes('positive')) {
      result.is_connection = true;
      result.is_meeting = true;
    } else if (normalized.includes('negative') || normalized.includes('not qualified')) {
      result.is_connection = true;
    } else if (normalized.includes('bad') || normalized.includes('wrong') || normalized.includes('do not call')) {
      result.is_bad_data = true;
    } else if (normalized.includes('receptionist') || normalized.includes('hung up')) {
      result.is_connection = true;
    }
  }
  
  // Duration-based override: if talk_duration > 60s, count as connection
  if (!result.is_connection && (durationSec ?? 0) > 60) {
    result.is_connection = true;
  }
  
  return result;
}

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

function parseDate(value: string | null): string | null {
  if (!value) return null;
  
  try {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {
    // Return null
  }
  
  return null;
}

function extractFromName(direction: string | null): string | null {
  if (!direction) return null;
  // Direction format: "Name to Name" - extract the first part
  const parts = direction.split(' to ');
  return parts[0]?.trim() || null;
}

function mapNocoDBRecord(record: Record<string, any>, clientId: string): Record<string, any> {
  const mapped: Record<string, any> = {
    client_id: clientId,
  };

  for (const [nocoKey, dbKey] of Object.entries(COLUMN_MAP)) {
    const value = record[nocoKey];
    if (value === undefined || value === null || value === "") continue;
    
    // Handle specific type conversions
    if (dbKey === "nocodb_id") {
      mapped[dbKey] = parseInt(value, 10) || null;
    } else if (dbKey === "call_duration_sec") {
      mapped[dbKey] = parseInt(value, 10) || null;
    } else if (dbKey.includes("_score") || dbKey === "resolution_rate") {
      mapped[dbKey] = parseFloat(value) || null;
    } else if (dbKey === "called_date_time" || dbKey === "nocodb_created_at" || dbKey === "nocodb_updated_at") {
      mapped[dbKey] = parseDateTime(value);
    } else if (dbKey === "called_date") {
      mapped[dbKey] = parseDate(value);
    } else {
      mapped[dbKey] = value;
    }
  }

  // Extract from_name from Direction field
  if (record["Direction"]) {
    mapped.from_name = extractFromName(record["Direction"]);
  }

  // Classify disposition and add pre-computed flags
  const classification = classifyDisposition(
    record["Category"],
    mapped.call_duration_sec
  );
  mapped.normalized_category = classification.normalized_category;
  mapped.is_connection = classification.is_connection;
  mapped.is_meeting = classification.is_meeting;
  mapped.is_voicemail = classification.is_voicemail;
  mapped.is_bad_data = classification.is_bad_data;

  // Calculate composite_score as average of available scores
  const scores = [
    mapped.seller_interest_score,
    mapped.quality_of_conversation_score,
    mapped.objection_handling_score,
    mapped.value_proposition_score,
    mapped.script_adherence_score,
    mapped.decision_maker_identified_score,
    mapped.referral_rate_score,
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
    const { client_id, action = "sync" } = body;

    console.log(`[cold-calls-sync] Action: ${action}, client: ${client_id || "default"}`);

    if (!nocodbApiToken) {
      throw new Error("NOCODB_API_TOKEN is not configured");
    }

    // Get client ID - use provided or get default
    let clientIds: string[] = [];
    
    if (client_id) {
      clientIds = [client_id];
    } else {
      // Get the default client (sourceco)
      const { data: clients } = await supabase
        .from("clients")
        .select("id")
        .eq("slug", "sourceco")
        .limit(1);
      
      clientIds = clients?.map(c => c.id) || [];
      
      // If no default client, get any client
      if (clientIds.length === 0) {
        const { data: anyClients } = await supabase
          .from("clients")
          .select("id")
          .limit(1);
        clientIds = anyClients?.map(c => c.id) || [];
      }
    }

    if (clientIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No clients found to sync" }),
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

    // Process for each client
    const results: Record<string, any>[] = [];
    
    for (const cId of clientIds) {
      console.log(`[cold-calls-sync] Processing client: ${cId}`);
      
      const mappedRecords = allRecords.map(r => mapNocoDBRecord(r, cId));
      
      let inserted = 0;
      let updated = 0;
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
        client_id: cId,
        fetched: allRecords.length,
        upserted: inserted,
        errors,
        error_details: errorDetails.slice(0, 5),
      });

      console.log(`[cold-calls-sync] Client ${cId}: ${inserted} upserted, ${errors} errors`);
    }

    // Calculate total errors across all results
    const totalErrors = results.reduce((sum, r) => sum + (r.errors || 0), 0);

    // Log sync to function_logs
    await supabase.from("function_logs").insert({
      function_name: "cold-calls-sync",
      status: totalErrors > 0 ? "partial" : "success",
      records_processed: allRecords.length,
      details: { results },
    });

    return new Response(
      JSON.stringify({
        success: true,
        action,
        synced_at: new Date().toISOString(),
        total_records: allRecords.length,
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
