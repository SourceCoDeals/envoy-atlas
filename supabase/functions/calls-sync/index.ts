import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOCODB_BASE_URL = "https://nocodb-1b0ku-u5603.vm.elestio.app";
const NOCODB_TABLE_ID = "m9klgus7som6u7q";

// =============================================================================
// COLUMN MAPPING: NocoDB → Unified calls table
// =============================================================================
const NOCODB_COLUMN_MAP: Record<string, string> = {
  // NocoDB system columns
  "Id": "external_id",
  
  // Call metadata
  "Direction": "direction",
  "From Name": "analyst", // The caller/analyst
  "To Name": "contact_name",
  "To Company": "contact_company",
  "To Number": "contact_phone",
  "To Email": "contact_email",
  "Salesforce URL": "salesforce_url",
  "Call Duration (sec)": "duration_seconds",
  "Called Date Time": "called_at",
  "Call Transcript": "transcript",
  "Call Summary": "summary",
  "Category": "category",
  "Analyst": "analyst", // Override if present
  
  // AI Scores (will be normalized to 1-10 scale)
  "Interest Rating": "seller_interest_score",
  "Objection Handling Rating": "objection_handling_score",
  "Conversation Quality": "quality_score",
  "Value Clarity": "value_proposition_score",
  "Rapport Building": "rapport_score",
  "Engagement Score": "engagement_score",
  "Next Step Clarity": "next_step_score",
  "Gatekeeper Handling": "gatekeeper_score",
  
  // Other fields
  "Opening Type": "opening_type",
  "Primary Opportunity": "primary_opportunity",
  "Key Concerns": "key_concerns",
  "Target Pain Points": "target_pain_points",
};

// =============================================================================
// CATEGORY NORMALIZATION
// =============================================================================
function normalizeCategory(category: string | null): string {
  if (!category) return 'Unknown';
  
  const cat = category.toLowerCase().trim();
  
  // Normalize common variations
  if (cat.includes('hung up') || cat.includes('hangup')) return 'Hung Up';
  if (cat.includes('no answer') || cat.includes('noanswer')) return 'No Answer';
  if (cat.includes('voicemail') || cat.includes('vm')) return 'Voicemail';
  if (cat.includes('wrong number') || cat.includes('wrong#')) return 'Wrong Number';
  if (cat.includes('gatekeeper')) return 'Gatekeeper';
  if (cat.includes('not interested') || cat.includes('ni')) return 'Not Interested';
  if (cat.includes('interested') || cat.includes('qualified')) return 'Interested';
  if (cat.includes('callback') || cat.includes('call back')) return 'Callback';
  if (cat.includes('meeting') || cat.includes('appointment')) return 'Meeting Scheduled';
  if (cat.includes('conversation') || cat.includes('convo')) return 'Conversation';
  if (cat.includes('busy')) return 'Busy';
  if (cat.includes('disconnected') || cat.includes('disc')) return 'Disconnected';
  
  // Return original if no match (but capitalized)
  return category.charAt(0).toUpperCase() + category.slice(1);
}

// =============================================================================
// DATE PARSING
// =============================================================================
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

// =============================================================================
// MAP NOCODB RECORD TO UNIFIED CALLS TABLE
// =============================================================================
function mapNocoDBRecord(record: Record<string, any>, workspaceId: string): Record<string, any> {
  const mapped: Record<string, any> = {
    workspace_id: workspaceId,
    platform: 'nocodb',
  };

  for (const [nocoKey, dbKey] of Object.entries(NOCODB_COLUMN_MAP)) {
    const value = record[nocoKey];
    if (value === undefined || value === null || value === "") continue;
    
    // Handle specific type conversions
    if (dbKey === "external_id") {
      mapped[dbKey] = String(value);
    } else if (dbKey === "duration_seconds") {
      mapped[dbKey] = parseInt(value, 10) || null;
    } else if (dbKey.includes("_score")) {
      // Normalize scores to 1-10 scale
      const score = parseFloat(value);
      mapped[dbKey] = !isNaN(score) ? Math.min(10, Math.max(0, score)) : null;
    } else if (dbKey === "called_at") {
      mapped[dbKey] = parseDateTime(value);
    } else if (dbKey === "key_concerns") {
      // Handle array field
      if (Array.isArray(value)) {
        mapped[dbKey] = value;
      } else if (typeof value === "string") {
        mapped[dbKey] = value.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    } else if (dbKey === "category") {
      mapped[dbKey] = normalizeCategory(value);
    } else {
      mapped[dbKey] = value;
    }
  }

  // Calculate composite_score as average of available scores
  const scores = [
    mapped.seller_interest_score,
    mapped.quality_score,
    mapped.objection_handling_score,
    mapped.value_proposition_score,
    mapped.rapport_score,
    mapped.engagement_score,
    mapped.next_step_score,
    mapped.gatekeeper_score,
  ].filter(s => s !== null && s !== undefined && !isNaN(s));
  
  if (scores.length > 0) {
    mapped.composite_score = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
  }

  return mapped;
}

// =============================================================================
// FETCH NOCODB RECORDS
// =============================================================================
async function fetchNocoDBRecords(apiToken: string): Promise<any[]> {
  const allRecords: any[] = [];
  let offset = 0;
  const limit = 100;
  
  console.log('Fetching records from NocoDB...');
  
  while (true) {
    const url = `${NOCODB_BASE_URL}/api/v2/tables/${NOCODB_TABLE_ID}/records?limit=${limit}&offset=${offset}`;
    
    const response = await fetch(url, {
      headers: {
        'xc-token': apiToken,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NocoDB API error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const records = data.list || [];
    
    console.log(`  Fetched ${records.length} records at offset ${offset}`);
    allRecords.push(...records);
    
    if (records.length < limit) {
      break; // No more pages
    }
    
    offset += limit;
  }
  
  console.log(`Total records fetched: ${allRecords.length}`);
  return allRecords;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================
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
    const { workspace_id, reset = false } = body;

    console.log(`[calls-sync] workspace=${workspace_id || "all"}, reset=${reset}`);

    if (!nocodbApiToken) {
      throw new Error("NOCODB_API_TOKEN is not configured");
    }

    // Determine which workspaces to sync
    let workspaceIds: string[] = [];
    
    if (workspace_id) {
      workspaceIds = [workspace_id];
    } else {
      // Get all workspaces (for batch sync)
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id');
      workspaceIds = workspaces?.map(w => w.id) || [];
    }

    if (workspaceIds.length === 0) {
      throw new Error("No workspaces found");
    }

    const progress = {
      calls_synced: 0,
      calls_created: 0,
      calls_updated: 0,
      errors: [] as string[],
    };

    // Reset data if requested
    if (reset && workspace_id) {
      console.log('Resetting calls for workspace...');
      await supabase
        .from('calls')
        .delete()
        .eq('workspace_id', workspace_id)
        .eq('platform', 'nocodb');
      console.log('Reset complete');
    }

    // Log sync start
    for (const wsId of workspaceIds) {
      await supabase.from('sync_status').insert({
        workspace_id: wsId,
        platform: 'nocodb',
        sync_type: reset ? 'full' : 'incremental',
        status: 'running',
        started_at: new Date().toISOString(),
      });
    }

    // Fetch all records from NocoDB
    const nocodbRecords = await fetchNocoDBRecords(nocodbApiToken);

    // Process records for each workspace
    for (const wsId of workspaceIds) {
      console.log(`Processing calls for workspace ${wsId}...`);
      
      const mappedRecords = nocodbRecords.map(record => mapNocoDBRecord(record, wsId));
      
      // Filter out records without external_id
      const validRecords = mappedRecords.filter(r => r.external_id);
      
      if (validRecords.length === 0) {
        console.log(`  No valid records for workspace ${wsId}`);
        continue;
      }

      // Batch upsert (100 at a time)
      const batchSize = 100;
      for (let i = 0; i < validRecords.length; i += batchSize) {
        const batch = validRecords.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from('calls')
          .upsert(batch, { 
            onConflict: 'workspace_id,platform,external_id',
            count: 'exact'
          });
        
        if (error) {
          console.error(`  Batch upsert error: ${error.message}`);
          progress.errors.push(`Batch ${i}: ${error.message}`);
        } else {
          progress.calls_synced += batch.length;
        }
      }

      console.log(`  Synced ${validRecords.length} calls`);
    }

    // Update sync status
    for (const wsId of workspaceIds) {
      await supabase
        .from('sync_status')
        .update({
          status: progress.errors.length > 0 ? 'completed_with_errors' : 'completed',
          completed_at: new Date().toISOString(),
          records_processed: progress.calls_synced,
          error_message: progress.errors.length > 0 ? progress.errors.join('; ') : null,
        })
        .eq('workspace_id', wsId)
        .eq('platform', 'nocodb')
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1);
    }

    return new Response(JSON.stringify({
      success: true,
      progress,
      message: `Synced ${progress.calls_synced} calls`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('calls-sync error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
