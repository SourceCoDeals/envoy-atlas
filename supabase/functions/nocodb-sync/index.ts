import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOCODB_BASE_URL = "https://nocodb-1b0ku-u5603.vm.elestio.app";
// Updated table ID from user's link
const NOCODB_TABLE_ID = "m9klgus7som6u7q";

// Column mapping from NocoDB "All Data" table to our external_calls table
const COLUMN_MAP: Record<string, string> = {
  // Core identifiers
  "Id": "nocodb_row_id",
  "Salesforce URL": "salesforce_url",
  
  // Call metadata
  "Call Recording": "phoneburner_recording_url",
  "Call Duration (sec)": "duration",
  "Called Date": "call_date",
  "Called Date Time": "date_time",
  "Direction": "call_direction",
  "Category": "call_category",
  "From Number (CallerID)": "from_number",
  "To Number": "to_number",
  
  // Contact/prospect info
  "To Name": "contact_name",
  "To Company": "company_name",
  "Analyst": "host_email", // Maps to rep/analyst name
  "Primary Opportunity": "engagement_name",
  
  // Call content
  "Call Transcript": "transcript_text",
  "Call Summary": "call_summary",
  
  // AI Scores (1-10 scale)
  "Interest Rating": "seller_interest_score",
  "Interest Rating (Reasoning)": "seller_interest_justification",
  "Conversation Quality": "quality_of_conversation_score",
  "Conversation Quality (Reasoning)": "conversation_quality_justification",
  "Objection Handling Rating": "objection_handling_score",
  "Objection Handling Rating (Reasoning)": "objection_handling_justification",
  "Script Adherence": "script_adherence_score",
  "Script Adherence (Reasoning)": "script_adherence_justification",
  "Value Clarity": "value_proposition_score",
  "Value Clarity (Reasoning)": "value_proposition_justification",
  "Decision Maker Identified": "decision_maker_score",
  "Decision Maker Identified (Reasoning)": "decision_maker_justification",
  "Referral Rate": "referral_rate_score",
  "Referral Rate (Reasoning)": "referral_rate_justification",
  "Resolution Rate": "objection_resolution_rate",
  "Resolution Rate (Reasoning)": "resolution_rate_justification",
  
  // Objections
  "Objections": "objections_list_text",
  "Not Interested (Reason)": "not_interested_reason",
  
  // Timestamps
  "CreatedAt": "nocodb_created_at",
  "UpdatedAt": "nocodb_updated_at",
};

// Additional columns we might need to add to external_calls table
const ADDITIONAL_COLUMNS = [
  "salesforce_url",
  "call_date",
  "call_direction",
  "from_number",
  "to_number",
  "engagement_name",
  "decision_maker_score",
  "decision_maker_justification",
  "referral_rate_score",
  "referral_rate_justification",
  "not_interested_reason",
  "nocodb_created_at",
  "nocodb_updated_at",
];

function parseDateTime(value: string | null): string | null {
  if (!value) return null;
  
  // Handle format like "5/5/2025 9:34:27"
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
    import_status: "scored", // NocoDB data is already fully processed with AI scores
  };

  for (const [nocoKey, dbKey] of Object.entries(COLUMN_MAP)) {
    const value = record[nocoKey];
    if (value === undefined || value === null || value === "") continue;
    
    // Handle numeric conversions for scores and duration
    if (dbKey === "duration") {
      mapped[dbKey] = parseInt(value, 10) || null;
    } else if (dbKey.includes("_score") || dbKey === "objection_resolution_rate" || dbKey === "referral_rate_score") {
      mapped[dbKey] = parseFloat(value) || null;
    } else if (dbKey === "date_time") {
      mapped[dbKey] = parseDateTime(value);
    } else if (dbKey === "nocodb_row_id") {
      mapped[dbKey] = String(value);
    } else {
      mapped[dbKey] = value;
    }
  }

  // Calculate composite_score as average of available scores
  const scores = [
    mapped.seller_interest_score,
    mapped.quality_of_conversation_score,
    mapped.objection_handling_score,
    mapped.script_adherence_score,
    mapped.value_proposition_score,
  ].filter(s => s !== null && s !== undefined);
  
  if (scores.length > 0) {
    mapped.composite_score = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }

  // Map Analyst to host_email (we store the name, will use for rep matching)
  // The Analyst field contains the rep name like "Leith Akallal"
  if (mapped.host_email && !mapped.host_email.includes("@")) {
    // It's a name, not an email - store as rep_name
    mapped.rep_name = mapped.host_email;
    // Generate a placeholder email for matching
    mapped.host_email = mapped.host_email.toLowerCase().replace(/\s+/g, ".") + "@sourcecodeals.com";
  }

  return mapped;
}

function extractContactInfo(record: Record<string, any>): { name: string; company: string | null; email: string } | null {
  const contactName = record.contact_name || "";
  const companyName = record.company_name || "";
  
  if (!contactName) return null;
  
  // Generate a placeholder email based on contact name and company
  const emailPrefix = contactName.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z.]/g, "");
  const emailDomain = companyName 
    ? companyName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "") + ".external"
    : "external-calls.local";
  
  return {
    name: contactName,
    company: companyName || null,
    email: `${emailPrefix}@${emailDomain}`,
  };
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

    const { workspace_id, action = "stats", since_date } = await req.json();

    if (!workspace_id) {
      throw new Error("workspace_id is required");
    }

    console.log(`[nocodb-sync] Action: ${action} for workspace ${workspace_id}`);

    // Stats action - return current processing status
    if (action === "stats") {
      const { data: calls, error } = await supabase
        .from("external_calls")
        .select("id, import_status, call_category")
        .eq("workspace_id", workspace_id);

      if (error) throw error;

      const categoryBreakdown: Record<string, number> = {};
      calls?.forEach(c => {
        const cat = c.call_category || "Unknown";
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
      });

      const stats = {
        total: calls?.length || 0,
        pending: calls?.filter(c => c.import_status === "pending").length || 0,
        transcript_fetched: calls?.filter(c => c.import_status === "transcript_fetched").length || 0,
        scored: calls?.filter(c => c.import_status === "scored").length || 0,
        error: calls?.filter(c => c.import_status === "error").length || 0,
        categories: categoryBreakdown,
      };

      return new Response(
        JSON.stringify({ success: true, stats }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sync and full_sync actions require API token
    if (!nocodbApiToken) {
      throw new Error("NOCODB_API_TOKEN is not configured. Please add it in the Connections settings.");
    }

    // Full sync - clear existing data first
    if (action === "full_sync") {
      console.log("[nocodb-sync] Full sync: clearing existing data...");
      
      // Delete existing leads from external_calls platform
      const { error: leadsError } = await supabase
        .from("leads")
        .delete()
        .eq("workspace_id", workspace_id)
        .eq("platform", "external_calls");
      
      if (leadsError) console.error("[nocodb-sync] Error deleting leads:", leadsError);
      
      // Delete existing external_calls
      const { error: callsError } = await supabase
        .from("external_calls")
        .delete()
        .eq("workspace_id", workspace_id);
      
      if (callsError) throw callsError;
      
      console.log("[nocodb-sync] Existing data cleared");
    }

    // Helper to update sync progress in real-time
    const updateSyncProgress = async (phase: string, current: number, total: number, message: string) => {
      await supabase
        .from("api_connections")
        .update({
          sync_status: "syncing",
          sync_progress: {
            phase,
            current,
            total,
            percent: total > 0 ? Math.round((current / total) * 100) : 0,
            message,
            updated_at: new Date().toISOString(),
          },
        })
        .eq("workspace_id", workspace_id)
        .eq("platform", "nocodb");
    };

    // Set initial syncing status
    await updateSyncProgress("fetching", 0, 0, "Connecting to NocoDB...");

    // Fetch all records from NocoDB with pagination
    let allRecords: Record<string, any>[] = [];
    let offset = 0;
    const limit = 200; // Larger batch for faster fetching
    let hasMore = true;

    console.log("[nocodb-sync] Fetching records from NocoDB...");

    // First, get total count
    const countUrl = `${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_ID}/records?limit=1&offset=0`;
    const countResponse = await fetch(countUrl, {
      headers: {
        "xc-token": nocodbApiToken,
        "Content-Type": "application/json",
      },
    });
    
    let estimatedTotal = 0;
    if (countResponse.ok) {
      const countData = await countResponse.json();
      estimatedTotal = countData.pageInfo?.totalRows || 500;
    }

    // Build filter for incremental sync
    let filterParam = "";
    if (action === "sync" && since_date) {
      // Only fetch records updated since the last sync
      filterParam = `&where=(UpdatedAt,gt,${since_date})`;
      console.log(`[nocodb-sync] Incremental sync since: ${since_date}`);
    }

    while (hasMore) {
      await updateSyncProgress("fetching", allRecords.length, estimatedTotal, `Fetching records... (${allRecords.length}/${estimatedTotal})`);
      
      const url = `${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_ID}/records?limit=${limit}&offset=${offset}${filterParam}`;
      console.log(`[nocodb-sync] Fetching: offset=${offset}`);
      
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
      
      // Update estimated total from actual pageInfo if available
      if (data.pageInfo?.totalRows) {
        estimatedTotal = data.pageInfo.totalRows;
      }
      
      console.log(`[nocodb-sync] Fetched ${records.length} records (total: ${allRecords.length})`);
      
      if (records.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    console.log(`[nocodb-sync] Total records fetched: ${allRecords.length}`);

    // Map and upsert records
    await updateSyncProgress("processing", 0, allRecords.length, "Processing records...");
    const mappedRecords = allRecords.map(r => mapNocoDBRecord(r, workspace_id));
    
    let inserted = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Upsert in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < mappedRecords.length; i += BATCH_SIZE) {
      const batch = mappedRecords.slice(i, i + BATCH_SIZE);
      
      // Update progress for each batch
      await updateSyncProgress("saving", i, mappedRecords.length, `Saving records... (${i}/${mappedRecords.length})`);
      
      const { data, error } = await supabase
        .from("external_calls")
        .upsert(batch, { 
          onConflict: "nocodb_row_id,workspace_id",
          ignoreDuplicates: false 
        })
        .select("id");

      if (error) {
        console.error(`[nocodb-sync] Batch upsert error:`, error);
        errors += batch.length;
        errorDetails.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
      } else {
        inserted += data?.length || 0;
      }
    }

    // Create/update leads for contacts using email as unique identifier
    await updateSyncProgress("contacts", 0, mappedRecords.length, "Creating contacts...");
    
    let leadsCreated = 0;
    const contactsToCreate: Record<string, any>[] = [];
    
    for (const record of mappedRecords) {
      const contact = extractContactInfo(record);
      if (contact && contact.email) {
        // Parse name into first/last
        const nameParts = contact.name.split(" ");
        const firstName = nameParts[0] || contact.name;
        const lastName = nameParts.slice(1).join(" ") || "";
        
        contactsToCreate.push({
          workspace_id,
          email: contact.email,
          first_name: firstName,
          last_name: lastName,
          company: contact.company || null,
          platform: "external_calls",
        });
      }
    }

    // Deduplicate and upsert leads
    const uniqueContacts = Array.from(
      new Map(contactsToCreate.map(c => [c.email, c])).values()
    );

    if (uniqueContacts.length > 0) {
      for (let i = 0; i < uniqueContacts.length; i += BATCH_SIZE) {
        const batch = uniqueContacts.slice(i, i + BATCH_SIZE);
        
        const { data, error } = await supabase
          .from("leads")
          .upsert(batch, { 
            onConflict: "workspace_id,email",
            ignoreDuplicates: false 
          })
          .select("id");

        if (error) {
          console.error("[nocodb-sync] Lead upsert error:", error);
        } else {
          leadsCreated += data?.length || 0;
        }
      }
    }

    // Update API connection record with sync status
    await supabase
      .from("api_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_full_sync_at: action === "full_sync" ? new Date().toISOString() : undefined,
        sync_status: "completed",
        sync_progress: {
          phase: "completed",
          records_synced: inserted,
          leads_created: leadsCreated,
          errors,
          error_details: errorDetails.length > 0 ? errorDetails.slice(0, 5) : undefined,
          last_sync: new Date().toISOString(),
        },
      })
      .eq("workspace_id", workspace_id)
      .eq("platform", "nocodb");

    console.log(`[nocodb-sync] Sync complete: ${inserted} records, ${leadsCreated} leads, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        stats: {
          fetched: allRecords.length,
          inserted,
          leads_created: leadsCreated,
          errors,
          error_details: errorDetails.length > 0 ? errorDetails.slice(0, 5) : undefined,
        },
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
