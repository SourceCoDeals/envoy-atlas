import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecalculationResult {
  campaignsUpdated: number;
  variantsUpdated: number;
  positiveRepliesFound: number;
  errors: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: RecalculationResult = {
      campaignsUpdated: 0,
      variantsUpdated: 0,
      positiveRepliesFound: 0,
      errors: [],
    };

    console.log("Starting metrics recalculation...");

    // Step 1: Count positive replies from email_activities and update daily_metrics
    console.log("Step 1: Aggregating positive replies from email_activities...");
    
    const { data: positiveReplies, error: prError } = await supabase
      .from("email_activities")
      .select("campaign_id, engagement_id, sent_at, replied_at, reply_category")
      .in("reply_category", ["meeting_request", "interested"])
      .not("campaign_id", "is", null);

    if (prError) {
      result.errors.push(`Error fetching positive replies: ${prError.message}`);
    } else if (positiveReplies) {
      result.positiveRepliesFound = positiveReplies.length;
      console.log(`Found ${positiveReplies.length} positive replies`);

      // Group by campaign_id and date
      const groupedByDate: Record<string, { 
        campaign_id: string; 
        engagement_id: string; 
        date: string; 
        count: number 
      }> = {};

      for (const reply of positiveReplies) {
        const date = (reply.replied_at || reply.sent_at || new Date().toISOString()).split("T")[0];
        const key = `${reply.campaign_id}-${reply.engagement_id}-${date}`;
        
        if (!groupedByDate[key]) {
          groupedByDate[key] = {
            campaign_id: reply.campaign_id,
            engagement_id: reply.engagement_id,
            date,
            count: 0,
          };
        }
        groupedByDate[key].count++;
      }

      // Update daily_metrics with positive_replies counts
      for (const entry of Object.values(groupedByDate)) {
        const { error: updateError } = await supabase
          .from("daily_metrics")
          .update({ 
            positive_replies: entry.count,
            updated_at: new Date().toISOString()
          })
          .eq("campaign_id", entry.campaign_id)
          .eq("engagement_id", entry.engagement_id)
          .eq("date", entry.date);

        if (updateError) {
          result.errors.push(`Error updating daily_metrics for ${entry.campaign_id}: ${updateError.message}`);
        }
      }
    }

    // Step 2: Recalculate campaign totals from daily_metrics
    console.log("Step 2: Recalculating campaign totals from daily_metrics...");
    
    const { data: campaigns, error: campError } = await supabase
      .from("campaigns")
      .select("id")
      .not("id", "is", null);

    if (campError) {
      result.errors.push(`Error fetching campaigns: ${campError.message}`);
    } else if (campaigns) {
      for (const campaign of campaigns) {
        // Aggregate from daily_metrics
        const { data: metrics, error: metricsError } = await supabase
          .from("daily_metrics")
          .select("emails_sent, emails_delivered, emails_opened, emails_replied, emails_bounced, positive_replies")
          .eq("campaign_id", campaign.id);

        if (metricsError) {
          result.errors.push(`Error fetching metrics for campaign ${campaign.id}: ${metricsError.message}`);
          continue;
        }

        if (metrics && metrics.length > 0) {
          const totals = metrics.reduce(
            (acc, m) => ({
              sent: acc.sent + (m.emails_sent || 0),
              delivered: acc.delivered + (m.emails_delivered || 0),
              opened: acc.opened + (m.emails_opened || 0),
              replied: acc.replied + (m.emails_replied || 0),
              bounced: acc.bounced + (m.emails_bounced || 0),
              positive: acc.positive + (m.positive_replies || 0),
            }),
            { sent: 0, delivered: 0, opened: 0, replied: 0, bounced: 0, positive: 0 }
          );

          // Calculate rates
          const replyRate = totals.sent > 0 ? (totals.replied / totals.sent) * 100 : 0;
          const bounceRate = totals.sent > 0 ? (totals.bounced / totals.sent) * 100 : 0;
          const openRate = totals.sent > 0 ? (totals.opened / totals.sent) * 100 : 0;
          const positiveRate = totals.sent > 0 ? (totals.positive / totals.sent) * 100 : 0;

          const { error: updateError } = await supabase
            .from("campaigns")
            .update({
              total_sent: totals.sent,
              total_delivered: totals.delivered,
              total_opened: totals.opened,
              total_replied: totals.replied,
              total_bounced: totals.bounced,
              positive_replies: totals.positive,
              reply_rate: Math.round(replyRate * 100) / 100,
              bounce_rate: Math.round(bounceRate * 100) / 100,
              open_rate: Math.round(openRate * 100) / 100,
              positive_rate: Math.round(positiveRate * 100) / 100,
              updated_at: new Date().toISOString(),
            })
            .eq("id", campaign.id);

          if (updateError) {
            result.errors.push(`Error updating campaign ${campaign.id}: ${updateError.message}`);
          } else {
            result.campaignsUpdated++;
          }
        }
      }
    }

    // Step 3: Recalculate variant totals from daily_metrics
    console.log("Step 3: Recalculating variant totals...");
    
    const { data: variants, error: varError } = await supabase
      .from("campaign_variants")
      .select("id")
      .not("id", "is", null);

    if (varError) {
      result.errors.push(`Error fetching variants: ${varError.message}`);
    } else if (variants) {
      for (const variant of variants) {
        const { data: metrics, error: metricsError } = await supabase
          .from("daily_metrics")
          .select("emails_sent, emails_delivered, emails_opened, emails_replied, emails_bounced, positive_replies")
          .eq("variant_id", variant.id);

        if (metricsError) {
          result.errors.push(`Error fetching metrics for variant ${variant.id}: ${metricsError.message}`);
          continue;
        }

        if (metrics && metrics.length > 0) {
          const totals = metrics.reduce(
            (acc, m) => ({
              sent: acc.sent + (m.emails_sent || 0),
              delivered: acc.delivered + (m.emails_delivered || 0),
              opened: acc.opened + (m.emails_opened || 0),
              replied: acc.replied + (m.emails_replied || 0),
              bounced: acc.bounced + (m.emails_bounced || 0),
              positive: acc.positive + (m.positive_replies || 0),
            }),
            { sent: 0, delivered: 0, opened: 0, replied: 0, bounced: 0, positive: 0 }
          );

          // Rates as decimals for variants (0-1 range)
          const replyRate = totals.sent > 0 ? totals.replied / totals.sent : 0;
          const bounceRate = totals.sent > 0 ? totals.bounced / totals.sent : 0;
          const positiveReplyRate = totals.replied > 0 ? totals.positive / totals.replied : 0;

          const { error: updateError } = await supabase
            .from("campaign_variants")
            .update({
              total_sent: totals.sent,
              total_delivered: totals.delivered,
              total_opened: totals.opened,
              total_replied: totals.replied,
              total_bounced: totals.bounced,
              positive_replies: totals.positive,
              reply_rate: Math.round(replyRate * 10000) / 10000,
              bounce_rate: Math.round(bounceRate * 10000) / 10000,
              positive_reply_rate: Math.round(positiveReplyRate * 10000) / 10000,
              updated_at: new Date().toISOString(),
            })
            .eq("id", variant.id);

          if (updateError) {
            result.errors.push(`Error updating variant ${variant.id}: ${updateError.message}`);
          } else {
            result.variantsUpdated++;
          }
        }
      }
    }

    console.log("Metrics recalculation complete:", result);

    return new Response(JSON.stringify({
      success: true,
      message: "Metrics recalculation complete",
      ...result,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in recalculate-metrics:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
