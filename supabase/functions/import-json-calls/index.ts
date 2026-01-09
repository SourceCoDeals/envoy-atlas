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

    // Helper to parse numeric score
    const parseScore = (val: any): number | null => {
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "number" ? val : parseFloat(String(val));
      return isNaN(num) ? null : num;
    };

    // Helper to extract contact name from call title
    const extractContactName = (title: string): string | null => {
      // Pattern: "Cold Call to John Smith(1234567890)"
      const match = title?.match(/Cold Call to ([^(]+)/i);
      if (match) return match[1].trim();
      // Pattern: "Company Name <ext> Something"
      const extMatch = title?.match(/^([^<]+)/);
      if (extMatch) return extMatch[1].trim();
      return null;
    };

    const records = calls.map((call: any, index: number) => {
      const transcript = call["Transcript"];
      const hasTranscript = transcript && transcript !== "[No Transcript]" && transcript.length > 50;
      
      // Check if already scored - look for any score field
      const sellerInterestScore = parseScore(call["Seller Interest Score"]);
      const hasScores = sellerInterestScore !== null;
      
      // Extract contact name from title
      const callTitle = call["Call Title"] || `Import ${index + 1}`;
      const contactName = extractContactName(callTitle);
      
      return {
        workspace_id: workspaceId,
        nocodb_row_id: `json_${index}_${Date.now()}`,
        call_title: callTitle,
        fireflies_url: call["Fireflies URL"] || null,
        date_time: call["Date Time"] ? new Date(call["Date Time"]).toISOString() : null,
        host_email: call["Host Email"] || null,
        all_participants: call["All Participants"] || null,
        call_type: "external",
        transcript_text: hasTranscript ? transcript : null,
        import_status: hasScores ? "scored" : (hasTranscript ? "transcript_fetched" : "pending"),
        // Score fields
        seller_interest_score: sellerInterestScore,
        seller_interest_justification: call["Seller Interest Score Justification"] || call["Interest Justification"] || null,
        objection_handling_score: parseScore(call["Objection Handling Score"]),
        rapport_building_score: parseScore(call["Rapport Building Score"]),
        value_proposition_score: parseScore(call["Value Proposition Score"]),
        engagement_score: parseScore(call["Engagement Score"]),
        quality_of_conversation_score: parseScore(call["Quality of Conversation Score"]) || parseScore(call["Conversation Quality Score"]),
        next_step_clarity_score: parseScore(call["Next Step Clarity Score"]),
        composite_score: parseScore(call["Composite Score"]) || parseScore(call["Overall Score"]),
        timeline_to_sell: call["Timeline to Sell"] || call["Timeline"] || null,
        call_summary: call["Call Summary"] || call["Summary"] || null,
        call_category: call["Call Category"] || call["Category"] || null,
        opening_type: call["Opening Type"] || null,
        contact_name: contactName,
        company_name: call["Company Name"] || call["Company"] || null,
        key_topics_discussed: call["Key Topics"] ? (Array.isArray(call["Key Topics"]) ? call["Key Topics"] : [call["Key Topics"]]) : null,
        key_concerns: call["Key Concerns"] ? (Array.isArray(call["Key Concerns"]) ? call["Key Concerns"] : [call["Key Concerns"]]) : null,
        motivation_factors: call["Motivation Factors"] ? (Array.isArray(call["Motivation Factors"]) ? call["Motivation Factors"] : [call["Motivation Factors"]]) : null,
      };
    });

    // Insert external_calls in batches of 500
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

    // Step 2: Create/update leads from the imported calls
    console.log(`[import-json-calls] Creating leads from ${records.length} call records...`);
    
    // Build unique contacts from records
    const contactMap = new Map<string, {
      contact_name: string;
      company_name: string | null;
      seller_interest_score: number | null;
      last_call_at: string | null;
    }>();
    
    records.forEach((r: any) => {
      if (r.contact_name) {
        const key = r.contact_name.toLowerCase().trim();
        const existing = contactMap.get(key);
        // Keep the record with highest interest score or most recent call
        if (!existing || (r.seller_interest_score || 0) > (existing.seller_interest_score || 0)) {
          contactMap.set(key, {
            contact_name: r.contact_name,
            company_name: r.company_name,
            seller_interest_score: r.seller_interest_score,
            last_call_at: r.date_time,
          });
        }
      }
    });

    // Insert unique leads
    let leadsCreated = 0;
    const leadBatches = Array.from(contactMap.values());
    
    for (let i = 0; i < leadBatches.length; i += batchSize) {
      const batch = leadBatches.slice(i, i + batchSize);
      const leadRecords = batch.map(contact => {
        const nameParts = contact.contact_name.split(' ');
        const platformLeadId = `ext_${contact.contact_name.toLowerCase().replace(/\s+/g, '_')}`;
        // Generate placeholder email since leads.email is NOT NULL
        const placeholderEmail = `${platformLeadId}@external-calls.local`;
        return {
          workspace_id: workspaceId,
          platform: 'external_calls',
          platform_lead_id: platformLeadId,
          email: placeholderEmail,
          first_name: nameParts[0] || null,
          last_name: nameParts.slice(1).join(' ') || null,
          company: contact.company_name,
          contact_status: (contact.seller_interest_score || 0) >= 7 ? 'interested' : 'contacted',
          seller_interest_score: contact.seller_interest_score ? Math.round(contact.seller_interest_score) : null,
          last_call_at: contact.last_call_at,
          last_contact_at: contact.last_call_at,
        };
      });

      // Upsert leads so repeated imports don't fail on unique constraints
      const { error: leadError } = await supabase
        .from("leads")
        .upsert(leadRecords, {
          onConflict: "workspace_id,platform,platform_lead_id",
          ignoreDuplicates: true,
        });

      if (leadError) {
        console.error(`[import-json-calls] Lead batch error:`, leadError.message);
      } else {
        leadsCreated += batch.length;
      }
    }

    console.log(`[import-json-calls] Created ${leadsCreated} leads`);

    const withTranscripts = records.filter((r: any) => r.transcript_text).length;
    const scored = records.filter((r: any) => r.import_status === "scored").length;
    
    console.log(`[import-json-calls] Done: ${inserted} inserted (${withTranscripts} with transcripts, ${scored} scored), ${leadsCreated} leads, ${errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: calls.length, 
        inserted, 
        withTranscripts,
        scored,
        leadsCreated,
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
