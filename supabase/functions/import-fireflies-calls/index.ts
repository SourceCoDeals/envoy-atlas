import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FirefliesRow {
  callTitle: string;
  firefliesUrl: string;
  dateTime: string;
  date: string;
  hostEmail: string;
  allParticipants: string;
  duration: number;
  transcript: string;
  sellerInterestScore: number | null;
  sellerInterestJustification: string;
  objectionHandlingScore: number | null;
  objectionHandlingJustification: string;
  objectionToResolutionRatePercentage: string;
  resolutionRateJustification: string;
  valuationDiscussionScore: number | null;
  valuationDiscussionJustification: string;
  rapportBuildingScore: number | null;
  rapportBuildingJustification: string;
  valuePropositionScore: number | null;
  valuePropositionJustification: string;
  conversationQualityScore: number | null;
  conversationQualityJustification: string;
  scriptAdherenceScore: number | null;
  scriptAdherenceJustification: string;
  overallQualityScore: number | null;
  overallQualityJustification: string;
  questionAdherenceScore: number | null;
  questionAdherenceJustification: string;
  summary: string;
  annualRevenue: string;
  ownershipDetails: string;
  ebitda: string;
  businessHistory: string;
  transactionGoals: string;
  ownershipInformation: string;
  businessDescription: string;
  growthInformation: string;
  valuationExpectations: string;
  maDiscussions: string;
  financialData: string;
  noOfEmployees: string;
  interestInSelling: string;
  exitReason: string;
  revenueEbitdaFromPastFewYears: string;
  targetPainPoints: string;
  futureGrowthPlans: string;
  mobileNumber: string;
  personalInsights: string;
  listOfObjections: string;
  numberOfObjections: number | null;
  objectionsResolvedCount: number | null;
  questionsCoveredCount: number | null;
  personalInsightsJustification: string;
  personalInsightsScore: number | null;
  nextStepsClarityScore: number | null;
  nextStepsClarityJustification: string;
  timelineToSell: string;
  buyerTypePreference: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function parseNumber(val: string): number | null {
  if (!val || val === "" || val === "None found") return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    // Format: 1/20/2026 6:07 or 1/20/2026
    const parts = dateStr.split(" ");
    const dateParts = parts[0].split("/");
    if (dateParts.length !== 3) return null;
    
    const month = dateParts[0].padStart(2, "0");
    const day = dateParts[1].padStart(2, "0");
    const year = dateParts[2];
    
    let hour = "00", minute = "00";
    if (parts[1]) {
      const timeParts = parts[1].split(":");
      hour = timeParts[0].padStart(2, "0");
      minute = timeParts[1]?.padStart(2, "0") || "00";
    }
    
    return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
  } catch {
    return null;
  }
}

function extractPhoneFromTitle(title: string): string {
  const phoneMatch = title.match(/\((\d{10})\)/);
  return phoneMatch ? phoneMatch[1] : "0000000000";
}

function extractNameFromTitle(title: string): string {
  const match = title.match(/Cold Call to ([^(]+)/);
  if (match) return match[1].trim();
  
  const meetingMatch = title.match(/^([^<]+)/);
  if (meetingMatch) return meetingMatch[1].trim();
  
  return title.substring(0, 100);
}

function parseObjectionsList(val: string): string[] | null {
  if (!val || val === "None found" || val === "") return null;
  return val.split(/[;,]/).map(s => s.trim()).filter(s => s.length > 0);
}

function parsePainPoints(val: string): string[] | null {
  if (!val || val === "" || val === "None found") return null;
  return val.split(/[;,]/).map(s => s.trim()).filter(s => s.length > 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvContent, testEngagementId, batchSize = 50 } = await req.json();
    
    if (!csvContent) {
      return new Response(JSON.stringify({ error: "csvContent is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If no test engagement provided, create one
    let engagementId = testEngagementId;
    if (!engagementId) {
      // First check if a test engagement already exists
      const { data: existingEng } = await supabase
        .from("engagements")
        .select("id")
        .eq("name", "Fireflies Test Import")
        .single();
      
      if (existingEng) {
        engagementId = existingEng.id;
      } else {
        // Get a workspace ID
        const { data: workspace } = await supabase
          .from("workspaces")
          .select("id")
          .limit(1)
          .single();
        
        if (!workspace) {
          return new Response(JSON.stringify({ error: "No workspace found" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: newEng, error: engError } = await supabase
          .from("engagements")
          .insert({
            name: "Fireflies Test Import",
            workspace_id: workspace.id,
            status: "active",
            start_date: new Date().toISOString().split("T")[0],
          })
          .select("id")
          .single();
        
        if (engError) {
          return new Response(JSON.stringify({ error: `Failed to create engagement: ${engError.message}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        engagementId = newEng.id;
      }
    }

    // Parse CSV content
    const lines = csvContent.split("\n");
    const headerLine = lines[0].replace(/^\uFEFF/, ""); // Remove BOM
    const headers = parseCSVLine(headerLine);
    
    console.log("Headers found:", headers.length);
    console.log("Total lines:", lines.length);
    
    // Collect complete rows (some transcripts span multiple lines)
    const rows: FirefliesRow[] = [];
    let currentRowData: string[] = [];
    let isCollecting = false;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Check if this is a new row (starts with a call title pattern)
      const isNewRow = line.match(/^(Cold Call to|ThinkB!G|[A-Z][a-z]+.*<ext>)/i) || 
                       line.startsWith('"Cold Call to') ||
                       line.match(/^"?[A-Za-z]/);
      
      if (isNewRow && currentRowData.length === 0) {
        // Start collecting a new row
        const parsed = parseCSVLine(line);
        if (parsed.length >= headers.length) {
          // Complete row on single line
          rows.push(mapToFirefliesRow(parsed));
        } else {
          currentRowData = parsed;
          isCollecting = true;
        }
      } else if (isCollecting) {
        // Continue collecting multi-line row
        // This is likely continuation of transcript
        currentRowData[currentRowData.length - 1] += "\n" + line;
        
        // Check if we now have enough fields
        const testParse = parseCSVLine(currentRowData.join(","));
        if (testParse.length >= headers.length) {
          rows.push(mapToFirefliesRow(currentRowData));
          currentRowData = [];
          isCollecting = false;
        }
      }
      
      // Safety limit for testing
      if (rows.length >= 500) break;
    }

    console.log("Parsed rows:", rows.length);
    
    // Create placeholder company and contact for all imports
    let placeholderCompanyId: string;
    let placeholderContactId: string;
    
    const { data: existingCompany } = await supabase
      .from("companies")
      .select("id")
      .eq("name", "Fireflies Import Placeholder")
      .eq("engagement_id", engagementId)
      .single();
    
    if (existingCompany) {
      placeholderCompanyId = existingCompany.id;
    } else {
      const { data: newCompany, error: compError } = await supabase
        .from("companies")
        .insert({
          name: "Fireflies Import Placeholder",
          engagement_id: engagementId,
        })
        .select("id")
        .single();
      
      if (compError) {
        return new Response(JSON.stringify({ error: `Failed to create placeholder company: ${compError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      placeholderCompanyId = newCompany.id;
    }

    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("first_name", "Fireflies")
      .eq("last_name", "Import")
      .eq("engagement_id", engagementId)
      .single();
    
    if (existingContact) {
      placeholderContactId = existingContact.id;
    } else {
      const { data: newContact, error: contError } = await supabase
        .from("contacts")
        .insert({
          first_name: "Fireflies",
          last_name: "Import",
          engagement_id: engagementId,
          company_id: placeholderCompanyId,
          email: "fireflies-import@placeholder.com",
        })
        .select("id")
        .single();
      
      if (contError) {
        return new Response(JSON.stringify({ error: `Failed to create placeholder contact: ${contError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      placeholderContactId = newContact.id;
    }

    // Insert data in batches
    let insertedCalls = 0;
    let insertedIntel = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      // Insert call_activities
      const callActivities = batch.map((row) => ({
        contact_id: placeholderContactId,
        company_id: placeholderCompanyId,
        engagement_id: engagementId,
        to_phone: extractPhoneFromTitle(row.callTitle),
        to_name: extractNameFromTitle(row.callTitle),
        disposition: "completed",
        started_at: parseDate(row.dateTime),
        duration_seconds: Math.round((row.duration || 0) * 60),
        recording_url: row.firefliesUrl,
        transcription: row.transcript?.substring(0, 50000), // Limit transcript size
        source: "fireflies",
        seller_interest_score: row.sellerInterestScore,
        objection_handling_score: row.objectionHandlingScore,
        script_adherence_score: row.scriptAdherenceScore,
        value_proposition_score: row.valuePropositionScore,
        quality_of_conversation_score: row.conversationQualityScore,
        composite_score: row.overallQualityScore,
        call_summary: row.summary?.substring(0, 5000),
        objections_list: parseObjectionsList(row.listOfObjections),
        raw_data: {
          fireflies_url: row.firefliesUrl,
          host_email: row.hostEmail,
          all_participants: row.allParticipants,
          annual_revenue: row.annualRevenue,
          ownership_details: row.ownershipDetails,
          ebitda: row.ebitda,
          business_history: row.businessHistory,
          transaction_goals: row.transactionGoals,
          ownership_information: row.ownershipInformation,
          business_description: row.businessDescription,
          growth_information: row.growthInformation,
          valuation_expectations: row.valuationExpectations,
          ma_discussions: row.maDiscussions,
          financial_data: row.financialData,
          no_of_employees: row.noOfEmployees,
          exit_reason: row.exitReason,
          revenue_ebitda_history: row.revenueEbitdaFromPastFewYears,
          future_growth_plans: row.futureGrowthPlans,
          mobile_number: row.mobileNumber,
        },
      }));

      const { data: insertedCAs, error: caError } = await supabase
        .from("call_activities")
        .insert(callActivities)
        .select("id");

      if (caError) {
        errors.push(`Batch ${i}: call_activities error: ${caError.message}`);
        continue;
      }

      insertedCalls += insertedCAs?.length || 0;

      // Insert external_call_intel for each call
      if (insertedCAs) {
        const intelRecords = insertedCAs.map((ca, idx) => {
          const row = batch[idx];
          return {
            call_id: ca.id,
            engagement_id: engagementId,
            seller_interest_score: row.sellerInterestScore,
            seller_interest_justification: row.sellerInterestJustification,
            objection_handling_score: row.objectionHandlingScore,
            objection_handling_justification: row.objectionHandlingJustification,
            valuation_discussion_score: row.valuationDiscussionScore,
            valuation_discussion_justification: row.valuationDiscussionJustification,
            rapport_building_score: row.rapportBuildingScore,
            rapport_building_justification: row.rapportBuildingJustification,
            value_proposition_score: row.valuePropositionScore,
            value_proposition_justification: row.valuePropositionJustification,
            conversation_quality_score: row.conversationQualityScore,
            conversation_quality_justification: row.conversationQualityJustification,
            script_adherence_score: row.scriptAdherenceScore,
            script_adherence_justification: row.scriptAdherenceJustification,
            overall_quality_score: row.overallQualityScore,
            overall_quality_justification: row.overallQualityJustification,
            question_adherence_score: row.questionAdherenceScore,
            question_adherence_justification: row.questionAdherenceJustification,
            personal_insights_score: row.personalInsightsScore,
            personal_insights_justification: row.personalInsightsJustification,
            next_steps_clarity_score: row.nextStepsClarityScore,
            next_steps_clarity_justification: row.nextStepsClarityJustification,
            interest_in_selling: row.interestInSelling,
            timeline_to_sell: row.timelineToSell,
            buyer_type_preference: row.buyerTypePreference,
            personal_insights: row.personalInsights,
            target_pain_points: parsePainPoints(row.targetPainPoints),
            number_of_objections: row.numberOfObjections,
            objections_resolved_count: row.objectionsResolvedCount,
            objections_list: parseObjectionsList(row.listOfObjections),
            questions_covered_count: row.questionsCoveredCount,
            transcription_used: "fireflies",
            ai_model_used: "fireflies-ai",
            processed_at: new Date().toISOString(),
          };
        });

        const { data: insertedIntels, error: intelError } = await supabase
          .from("external_call_intel")
          .insert(intelRecords)
          .select("id");

        if (intelError) {
          errors.push(`Batch ${i}: external_call_intel error: ${intelError.message}`);
        } else {
          insertedIntel += insertedIntels?.length || 0;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        engagementId,
        insertedCalls,
        insertedIntel,
        totalRows: rows.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Import error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function mapToFirefliesRow(fields: string[]): FirefliesRow {
  return {
    callTitle: fields[0] || "",
    firefliesUrl: fields[1] || "",
    dateTime: fields[2] || "",
    date: fields[3] || "",
    hostEmail: fields[4] || "",
    allParticipants: fields[5] || "",
    duration: parseNumber(fields[6]) || 0,
    transcript: fields[7] || "",
    sellerInterestScore: parseNumber(fields[8]),
    sellerInterestJustification: fields[9] || "",
    objectionHandlingScore: parseNumber(fields[10]),
    objectionHandlingJustification: fields[11] || "",
    objectionToResolutionRatePercentage: fields[12] || "",
    resolutionRateJustification: fields[13] || "",
    valuationDiscussionScore: parseNumber(fields[14]),
    valuationDiscussionJustification: fields[15] || "",
    rapportBuildingScore: parseNumber(fields[16]),
    rapportBuildingJustification: fields[17] || "",
    valuePropositionScore: parseNumber(fields[18]),
    valuePropositionJustification: fields[19] || "",
    conversationQualityScore: parseNumber(fields[20]),
    conversationQualityJustification: fields[21] || "",
    scriptAdherenceScore: parseNumber(fields[22]),
    scriptAdherenceJustification: fields[23] || "",
    overallQualityScore: parseNumber(fields[24]),
    overallQualityJustification: fields[25] || "",
    questionAdherenceScore: parseNumber(fields[26]),
    questionAdherenceJustification: fields[27] || "",
    summary: fields[28] || "",
    annualRevenue: fields[29] || "",
    ownershipDetails: fields[30] || "",
    ebitda: fields[31] || "",
    businessHistory: fields[32] || "",
    transactionGoals: fields[33] || "",
    ownershipInformation: fields[34] || "",
    businessDescription: fields[35] || "",
    growthInformation: fields[36] || "",
    valuationExpectations: fields[37] || "",
    maDiscussions: fields[38] || "",
    financialData: fields[39] || "",
    noOfEmployees: fields[40] || "",
    interestInSelling: fields[41] || "",
    exitReason: fields[42] || "",
    revenueEbitdaFromPastFewYears: fields[43] || "",
    targetPainPoints: fields[44] || "",
    futureGrowthPlans: fields[45] || "",
    mobileNumber: fields[46] || "",
    personalInsights: fields[47] || "",
    listOfObjections: fields[48] || "",
    numberOfObjections: parseNumber(fields[49]),
    objectionsResolvedCount: parseNumber(fields[50]),
    questionsCoveredCount: parseNumber(fields[51]),
    personalInsightsJustification: fields[52] || "",
    personalInsightsScore: parseNumber(fields[53]),
    nextStepsClarityScore: parseNumber(fields[54]),
    nextStepsClarityJustification: fields[55] || "",
    timelineToSell: fields[56] || "",
    buyerTypePreference: fields[57] || "",
  };
}
