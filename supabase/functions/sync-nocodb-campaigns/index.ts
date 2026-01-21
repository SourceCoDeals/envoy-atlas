import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOCODB_BASE_URL = "https://nocodb-1b0ku-u5603.vm.elestio.app";
const SMARTLEAD_TABLE_ID = "mnm2whuwv3q42iq";
const REPLYIO_TABLE_ID = "m6491y21cjn581i";

interface SmartLeadRecord {
  Id: number;
  "Campaign Id": string;
  "Campaign Name": string;
  Status: string;
  "Campaign Created Date": string;
  "# of Steps in Sequence": number;
  "Step1 Subject": string | null;
  "Step1 Body": string | null;
  "Step2 Subject": string | null;
  "Step2 Body": string | null;
  "Step3 Subject": string | null;
  "Step3 Body": string | null;
  "Step4 Subject": string | null;
  "Step4 Body": string | null;
  "Leads in Progress": number;
  "Leads Completed": number;
  "Leads Interested": number;
  "Leads Not Started": number;
  "Leads Paused": number;
  "Leads Stopped": number;
  "Leads Blocked": number;
  "Link to Campaign": string;
  CreatedAt: string;
  UpdatedAt: string;
}

interface ReplyIORecord {
  Id: number;
  "Campaign Id": string;
  "Campaign Name": string;
  Status: string;
  "Campaign Created Date": string;
  "People Count": number;
  "People Active": number;
  "People Finished": number;
  "People Paused": number;
  "# of Deliveries": number;
  "# of Bounces": number;
  "# of Replies": number;
  "# of OOOs": number;
  "# of OptOuts": number;
  "Step1 Subject": string | null;
  "Step1 Body": string | null;
  "Step2 Subject": string | null;
  "Step2 Body": string | null;
  "Step3 Subject": string | null;
  "Step3 Body": string | null;
  "Step4 Subject": string | null;
  "Step4 Body": string | null;
  "Step5 Subject": string | null;
  "Step5 Body": string | null;
  "Step6 Subject": string | null;
  "Step6 Body": string | null;
  "Step7 Subject": string | null;
  "Step7 Body": string | null;
  "Step8 Subject": string | null;
  "Step8 Body": string | null;
  "Step9 Subject": string | null;
  "Step9 Body": string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

function mapSmartLeadRecord(record: SmartLeadRecord) {
  return {
    nocodb_id: record.Id,
    campaign_id: record["Campaign Id"],
    campaign_name: record["Campaign Name"],
    status: record.Status,
    campaign_created_date: record["Campaign Created Date"] || null,
    steps_count: record["# of Steps in Sequence"] || 0,
    step1_subject: record["Step1 Subject"],
    step1_body: record["Step1 Body"],
    step2_subject: record["Step2 Subject"],
    step2_body: record["Step2 Body"],
    step3_subject: record["Step3 Subject"],
    step3_body: record["Step3 Body"],
    step4_subject: record["Step4 Subject"],
    step4_body: record["Step4 Body"],
    leads_in_progress: record["Leads in Progress"] || 0,
    leads_completed: record["Leads Completed"] || 0,
    leads_interested: record["Leads Interested"] || 0,
    leads_not_started: record["Leads Not Started"] || 0,
    leads_paused: record["Leads Paused"] || 0,
    leads_stopped: record["Leads Stopped"] || 0,
    leads_blocked: record["Leads Blocked"] || 0,
    link_to_campaign: record["Link to Campaign"],
    nocodb_created_at: record.CreatedAt,
    nocodb_updated_at: record.UpdatedAt,
    synced_at: new Date().toISOString(),
  };
}

function mapReplyIORecord(record: ReplyIORecord) {
  return {
    nocodb_id: record.Id,
    campaign_id: record["Campaign Id"],
    campaign_name: record["Campaign Name"],
    status: record.Status,
    campaign_created_date: record["Campaign Created Date"] || null,
    people_count: record["People Count"] || 0,
    people_active: record["People Active"] || 0,
    people_finished: record["People Finished"] || 0,
    people_paused: record["People Paused"] || 0,
    deliveries: record["# of Deliveries"] || 0,
    bounces: record["# of Bounces"] || 0,
    replies: record["# of Replies"] || 0,
    ooos: record["# of OOOs"] || 0,
    optouts: record["# of OptOuts"] || 0,
    step1_subject: record["Step1 Subject"],
    step1_body: record["Step1 Body"],
    step2_subject: record["Step2 Subject"],
    step2_body: record["Step2 Body"],
    step3_subject: record["Step3 Subject"],
    step3_body: record["Step3 Body"],
    step4_subject: record["Step4 Subject"],
    step4_body: record["Step4 Body"],
    step5_subject: record["Step5 Subject"],
    step5_body: record["Step5 Body"],
    step6_subject: record["Step6 Subject"],
    step6_body: record["Step6 Body"],
    step7_subject: record["Step7 Subject"],
    step7_body: record["Step7 Body"],
    step8_subject: record["Step8 Subject"],
    step8_body: record["Step8 Body"],
    step9_subject: record["Step9 Subject"],
    step9_body: record["Step9 Body"],
    nocodb_created_at: record.CreatedAt,
    nocodb_updated_at: record.UpdatedAt,
    synced_at: new Date().toISOString(),
  };
}

async function fetchAllRecords(tableId: string, apiToken: string): Promise<any[]> {
  const allRecords: any[] = [];
  let offset = 0;
  const limit = 200;
  let hasMore = true;

  while (hasMore) {
    const url = `${NOCODB_BASE_URL}/api/v2/tables/${tableId}/records?limit=${limit}&offset=${offset}`;
    console.log(`[sync-nocodb] Fetching from offset ${offset}...`);
    
    const response = await fetch(url, {
      headers: {
        "xc-token": apiToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NocoDB API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const records = data.list || [];
    allRecords.push(...records);
    
    console.log(`[sync-nocodb] Fetched ${records.length} records (total: ${allRecords.length})`);
    
    if (records.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allRecords;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const nocodbApiToken = Deno.env.get("NOCODB_API_TOKEN");
    
    if (!nocodbApiToken) {
      throw new Error("NOCODB_API_TOKEN is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await req.json().catch(() => ({}));
    const { platform = "all" } = body;
    
    console.log(`[sync-nocodb] Starting sync for platform: ${platform}`);
    
    const results = {
      smartlead: { fetched: 0, upserted: 0, errors: 0 },
      replyio: { fetched: 0, upserted: 0, errors: 0 },
    };

    // Sync SmartLead campaigns
    if (platform === "all" || platform === "smartlead") {
      console.log("[sync-nocodb] Syncing SmartLead campaigns...");
      try {
        const records = await fetchAllRecords(SMARTLEAD_TABLE_ID, nocodbApiToken);
        results.smartlead.fetched = records.length;
        
        const mappedRecords = records.map((r: SmartLeadRecord) => mapSmartLeadRecord(r));
        
        // Upsert in batches
        const batchSize = 100;
        for (let i = 0; i < mappedRecords.length; i += batchSize) {
          const batch = mappedRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from("nocodb_smartlead_campaigns")
            .upsert(batch, { onConflict: "campaign_id" });
          
          if (error) {
            console.error(`[sync-nocodb] SmartLead batch error:`, error);
            results.smartlead.errors++;
          } else {
            results.smartlead.upserted += batch.length;
          }
        }
        
        console.log(`[sync-nocodb] SmartLead sync complete: ${results.smartlead.upserted} upserted`);
      } catch (error) {
        console.error("[sync-nocodb] SmartLead sync failed:", error);
        results.smartlead.errors++;
      }
    }

    // Sync Reply.io campaigns
    if (platform === "all" || platform === "replyio") {
      console.log("[sync-nocodb] Syncing Reply.io campaigns...");
      try {
        const records = await fetchAllRecords(REPLYIO_TABLE_ID, nocodbApiToken);
        results.replyio.fetched = records.length;
        
        const mappedRecords = records.map((r: ReplyIORecord) => mapReplyIORecord(r));
        
        // Upsert in batches
        const batchSize = 100;
        for (let i = 0; i < mappedRecords.length; i += batchSize) {
          const batch = mappedRecords.slice(i, i + batchSize);
          const { error } = await supabase
            .from("nocodb_replyio_campaigns")
            .upsert(batch, { onConflict: "campaign_id" });
          
          if (error) {
            console.error(`[sync-nocodb] Reply.io batch error:`, error);
            results.replyio.errors++;
          } else {
            results.replyio.upserted += batch.length;
          }
        }
        
        console.log(`[sync-nocodb] Reply.io sync complete: ${results.replyio.upserted} upserted`);
      } catch (error) {
        console.error("[sync-nocodb] Reply.io sync failed:", error);
        results.replyio.errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[sync-nocodb] Sync completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        duration_ms: duration,
        synced_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[sync-nocodb] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
