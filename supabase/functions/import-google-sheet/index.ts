import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sheetUrl, workspaceId } = await req.json();

    if (!sheetUrl || !workspaceId) {
      throw new Error("sheetUrl and workspaceId are required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract sheet ID and construct CSV export URL
    const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      throw new Error("Invalid Google Sheets URL");
    }
    const sheetId = sheetIdMatch[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    console.log("[import-google-sheet] Fetching CSV from:", csvUrl);

    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.split("\n").filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error("No data found in sheet");
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, "_"));
    console.log("[import-google-sheet] Headers:", headers);

    const records: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (cells.length === 0 || cells.every(c => !c)) continue;

      // Only use columns that exist in external_calls table:
      // id, workspace_id, nocodb_row_id, call_title, fireflies_url, 
      // phoneburner_recording_url, date_time, host_email, all_participants,
      // call_type, transcript_text, import_status, error_message, created_at, updated_at
      const record: any = {
        workspace_id: workspaceId,
        import_status: "pending",
        nocodb_row_id: `row_${i}`,
      };

      headers.forEach((header, index) => {
        const value = cells[index] || null;
        if (!value) return;

        // Map to actual table columns
        if (header.includes("title") || header.includes("name") || header === "company" || header.includes("lead")) {
          record.call_title = record.call_title || value;
        } else if (header.includes("fireflies") || header.includes("transcript") || header.includes("link")) {
          if (value.includes("fireflies") || value.includes("http")) {
            record.fireflies_url = value;
          }
        } else if (header.includes("recording") || header.includes("audio") || header.includes("phoneburner")) {
          record.phoneburner_recording_url = value;
        } else if (header.includes("date") || header.includes("time") || header.includes("created")) {
          const parsed = new Date(value);
          if (!isNaN(parsed.getTime())) {
            record.date_time = parsed.toISOString();
          }
        } else if (header.includes("type") || header.includes("category")) {
          record.call_type = value.toLowerCase() || "external";
        } else if (header.includes("host") || header.includes("email")) {
          record.host_email = value;
        } else if (header.includes("participant")) {
          record.all_participants = value;
        }
      });

      if (!record.call_title) {
        record.call_title = `Import ${records.length + 1}`;
      }

      records.push(record);
    }

    console.log(`[import-google-sheet] Parsed ${records.length} records`);

    if (records.length === 0) {
      throw new Error("No valid records found");
    }

    // Clear existing data
    await supabase
      .from("external_calls")
      .delete()
      .eq("workspace_id", workspaceId);

    // Insert in batches
    const batchSize = 100;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase.from("external_calls").insert(batch);
      
      if (error) {
        console.error(`[import-google-sheet] Batch ${Math.floor(i/batchSize)+1} error:`, error);
        errors += batch.length;
      } else {
        inserted += batch.length;
        console.log(`[import-google-sheet] Inserted batch ${Math.floor(i/batchSize)+1}: ${inserted} total`);
      }
    }

    console.log(`[import-google-sheet] Done: ${inserted} inserted, ${errors} errors`);

    return new Response(
      JSON.stringify({ success: true, total: records.length, inserted, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[import-google-sheet] Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});