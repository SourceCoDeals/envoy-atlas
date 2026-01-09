import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOCODB_BASE_URL = "https://nocodb-1b0ku-u5603.vm.elestio.app";
const NOCODB_TABLE_ID = "mc5kej8avjporvh";

// Column mapping from NocoDB to our database
const COLUMN_MAP: Record<string, string> = {
  "Id": "nocodb_row_id",
  "Call Title": "call_title",
  "Fireflies URL": "fireflies_url",
  "Date Time": "date_time",
  "Date": "date_time", // fallback
  "Host Email": "host_email",
  "All Participants": "all_participants",
  "Duration": "duration",
  "Transcript": "transcript_text",
  "Summary": "call_summary",
  "Seller Interest Score": "seller_interest_score",
  "Seller Interest Justification": "seller_interest_justification",
  "Objection Handling Score": "objection_handling_score",
  "Objection Handling Justification": "objection_handling_justification",
  "Objection to Resolution Rate Percentage": "objection_resolution_rate",
  "Resolution Rate Justification": "resolution_rate_justification",
  "Valuation Discussion Score": "valuation_discussion_score",
  "Valuation Discussion Justification": "valuation_discussion_justification",
  "Rapport Building Score": "rapport_building_score",
  "Rapport Building Justification": "rapport_building_justification",
  "Value Proposition Score": "value_proposition_score",
  "Value Proposition Justification": "value_proposition_justification",
  "Conversation Quality Score": "quality_of_conversation_score",
  "Conversation Quality Justification": "conversation_quality_justification",
  "Script Adherence Score": "script_adherence_score",
  "Script Adherence Justification": "script_adherence_justification",
  "Overall Quality Score": "overall_quality_score",
  "Overall Quality Justification": "overall_quality_justification",
  "Question Adherence Score": "question_adherence_score",
  "Question Adherence Justification": "question_adherence_justification",
  "Next Steps Clarity Score": "next_step_clarity_score",
  "Next Steps Clarity Justification": "next_step_clarity_justification",
  "Personal Insights Score": "personal_insights_score",
  "Personal Insights Justification": "personal_insights_justification",
  "Personal Insights": "personal_insights",
  "Annual Revenue": "annual_revenue",
  "Ownership Details": "ownership_details",
  "EBITDA": "ebitda",
  "Business History": "business_history",
  "Transaction Goals": "transaction_goals",
  "Ownership Information": "ownership_information",
  "Business Description": "business_description",
  "Growth Information": "growth_information",
  "Valuation Expectations": "valuation_expectations",
  "M&A Discussions": "ma_discussions",
  "Financial Data": "financial_data",
  "No of Employees": "employee_count",
  "Interest in Selling": "interest_in_selling",
  "Exit Reason": "exit_reason",
  "Revenue/EBITDA from past few years": "historical_financials",
  "Target Pain Points": "target_pain_points",
  "Future Growth Plans": "future_growth_plans",
  "Mobile Number": "mobile_number",
  "List of Objections": "objections_list_text",
  "Number of Objections": "objections_count",
  "Objections Resolved Count": "objections_resolved_count",
  "Questions Covered Count": "questions_covered_count",
  "Timeline To Sell": "timeline_to_sell",
  "Buyer Type Preference": "buyer_type_preference",
};

function mapNocoDBRecord(record: Record<string, any>, workspaceId: string): Record<string, any> {
  const mapped: Record<string, any> = {
    workspace_id: workspaceId,
    import_status: "scored", // NocoDB data is already fully processed
  };

  for (const [nocoKey, dbKey] of Object.entries(COLUMN_MAP)) {
    if (record[nocoKey] !== undefined && record[nocoKey] !== null && record[nocoKey] !== "") {
      let value = record[nocoKey];
      
      // Handle numeric conversions
      if (["duration", "employee_count", "objections_count", "objections_resolved_count", "questions_covered_count"].includes(dbKey)) {
        value = parseInt(value, 10) || null;
      } else if (dbKey.includes("_score") || dbKey.includes("_rate")) {
        value = parseFloat(value) || null;
      }
      
      // Don't overwrite date_time if already set (Date is fallback)
      if (dbKey === "date_time" && mapped.date_time) continue;
      
      mapped[dbKey] = value;
    }
  }

  // Set composite_score from overall_quality_score if available
  if (mapped.overall_quality_score && !mapped.composite_score) {
    mapped.composite_score = mapped.overall_quality_score;
  }

  // Extract contact name from call title if possible
  const callTitle = mapped.call_title || "";
  const contactMatch = callTitle.match(/(?:with|call with|meeting with)\s+(.+?)(?:\s+from|\s+-|$)/i);
  if (contactMatch) {
    mapped.contact_name = contactMatch[1].trim();
  }

  // Extract company name from call title or participants
  const companyMatch = callTitle.match(/(?:from|at|@)\s+(.+?)(?:\s+-|$)/i);
  if (companyMatch) {
    mapped.company_name = companyMatch[1].trim();
  }

  return mapped;
}

function extractContactInfo(record: Record<string, any>): { name: string; company: string | null; email: string } | null {
  const callTitle = record.call_title || "";
  const participants = record.all_participants || "";
  const hostEmail = (record.host_email || "").toLowerCase().trim();
  
  // Parse participants to find non-host emails (prospects)
  const participantList = participants
    .split(/[,;]/)
    .map((p: string) => p.trim().toLowerCase())
    .filter((p: string) => p && p.includes("@"));
  
  // Find the first non-SourceCo email (the prospect)
  const prospectEmail = participantList.find((email: string) => 
    !email.includes("sourcecodeals.com") && 
    email !== hostEmail
  );
  
  if (!prospectEmail) return null;
  
  // Extract name from call title - pattern: "Company Name <ext> SourceCo"
  let name = "";
  let company = "";
  
  // Try to get company from call title (before <ext>)
  const extMatch = callTitle.match(/^(.+?)\s*<ext>/i);
  if (extMatch) {
    company = extMatch[1].trim();
    // Use company as display name for the contact
    name = company;
  }
  
  // If no company extracted, try to get name from email
  if (!name) {
    const emailPrefix = prospectEmail.split("@")[0];
    // Convert email prefix to name (e.g., mike.smith -> Mike Smith)
    name = emailPrefix
      .replace(/[._-]/g, " ")
      .split(" ")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  
  // Extract company from email domain if not already set
  if (!company) {
    const domain = prospectEmail.split("@")[1];
    if (domain) {
      company = domain.split(".")[0]
        .replace(/[-_]/g, " ")
        .split(" ")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }
  
  return { name, company, email: prospectEmail };
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

    const { workspace_id, action = "stats" } = await req.json();

    if (!workspace_id) {
      throw new Error("workspace_id is required");
    }

    console.log(`[nocodb-sync] Action: ${action} for workspace ${workspace_id}`);

    // Stats action - return current processing status
    if (action === "stats") {
      const { data: calls, error } = await supabase
        .from("external_calls")
        .select("id, import_status")
        .eq("workspace_id", workspace_id);

      if (error) throw error;

      const stats = {
        total: calls?.length || 0,
        pending: calls?.filter(c => c.import_status === "pending").length || 0,
        transcript_fetched: calls?.filter(c => c.import_status === "transcript_fetched").length || 0,
        scored: calls?.filter(c => c.import_status === "scored").length || 0,
        error: calls?.filter(c => c.import_status === "error").length || 0,
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
    const limit = 100;
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
      estimatedTotal = countData.pageInfo?.totalRows || 500; // Fallback estimate
    }

    while (hasMore) {
      await updateSyncProgress("fetching", allRecords.length, estimatedTotal, `Fetching records... (${allRecords.length}/${estimatedTotal})`);
      
      const url = `${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_ID}/records?limit=${limit}&offset=${offset}`;
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

    // Upsert in batches
    const BATCH_SIZE = 50;
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
          email: contact.email, // Use actual prospect email
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
            onConflict: "leads_workspace_email_unique",
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
        sync_status: "completed",
        sync_progress: {
          records_synced: inserted,
          leads_created: leadsCreated,
          errors,
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
