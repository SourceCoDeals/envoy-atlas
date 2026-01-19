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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting variant decay computation...");

    // Get all variants with sufficient volume (50+ sent)
    const { data: variants, error: variantsError } = await supabase
      .from("campaign_variants")
      .select(`
        id,
        campaign_id,
        subject_line,
        total_sent,
        total_replied,
        reply_rate,
        first_sent_at,
        last_sent_at,
        campaigns!inner(engagement_id)
      `)
      .gte("total_sent", 50)
      .not("first_sent_at", "is", null);

    if (variantsError) throw variantsError;

    console.log(`Processing ${variants?.length || 0} variants`);

    const decayRecords: Array<{
      variant_id: string;
      engagement_id: string;
      period_start: string;
      period_end: string;
      period_sent: number;
      period_replied: number;
      period_reply_rate: number;
      cumulative_sent: number;
      cumulative_replied: number;
      cumulative_reply_rate: number;
      decay_rate: number | null;
      computed_at: string;
    }> = [];

    for (const variant of variants || []) {
      const campaigns = variant.campaigns as { engagement_id: string }[] | null;
      const engagementId = campaigns?.[0]?.engagement_id;
      if (!engagementId) continue;

      // Get daily metrics for this variant
      const { data: dailyData, error: dailyError } = await supabase
        .from("daily_metrics")
        .select("date, emails_sent, emails_replied")
        .eq("variant_id", variant.id)
        .order("date", { ascending: true });

      if (dailyError || !dailyData || dailyData.length < 7) continue;

      // Calculate weekly periods
      let cumulativeSent = 0;
      let cumulativeReplied = 0;
      let previousRate: number | null = null;
      let weekStart = dailyData[0].date;
      let weekSent = 0;
      let weekReplied = 0;
      let dayCount = 0;

      for (const day of dailyData) {
        weekSent += day.emails_sent || 0;
        weekReplied += day.emails_replied || 0;
        cumulativeSent += day.emails_sent || 0;
        cumulativeReplied += day.emails_replied || 0;
        dayCount++;

        // Complete week
        if (dayCount === 7) {
          const periodRate = weekSent > 0 ? (weekReplied / weekSent) * 100 : 0;
          const cumulativeRate = cumulativeSent > 0 ? (cumulativeReplied / cumulativeSent) * 100 : 0;
          
          // Calculate decay: negative if performance declining
          const decayRate = previousRate !== null 
            ? ((periodRate - previousRate) / previousRate) * 100 
            : null;

          decayRecords.push({
            variant_id: variant.id,
            engagement_id: engagementId,
            period_start: weekStart,
            period_end: day.date,
            period_sent: weekSent,
            period_replied: weekReplied,
            period_reply_rate: periodRate,
            cumulative_sent: cumulativeSent,
            cumulative_replied: cumulativeReplied,
            cumulative_reply_rate: cumulativeRate,
            decay_rate: decayRate,
            computed_at: new Date().toISOString(),
          });

          previousRate = periodRate;
          weekStart = day.date;
          weekSent = 0;
          weekReplied = 0;
          dayCount = 0;
        }
      }
    }

    // Upsert decay records
    if (decayRecords.length > 0) {
      const { error: upsertError } = await supabase
        .from("variant_decay_tracking")
        .upsert(decayRecords, { 
          onConflict: "variant_id,period_start",
          ignoreDuplicates: false 
        });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
      }
    }

    console.log(`Computed ${decayRecords.length} decay periods`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        variantsProcessed: variants?.length || 0,
        decayPeriodsCreated: decayRecords.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error computing variant decay:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
