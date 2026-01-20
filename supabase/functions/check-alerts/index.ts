import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertCheck {
  type: 'bounce_spike' | 'stalled' | 'reply_drop' | 'deliverability' | 'opportunity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  details: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const { engagement_id } = body;

    // Get campaigns to check
    let query = supabaseAdmin
      .from('campaigns')
      .select('id, name, bounce_rate, reply_rate, positive_rate, open_rate, total_sent, status, updated_at, engagement_id')
      .eq('status', 'active');

    if (engagement_id) {
      query = query.eq('engagement_id', engagement_id);
    }

    const { data: campaigns, error: campaignsError } = await query;

    if (campaignsError) {
      throw campaignsError;
    }

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active campaigns to check', alertsCreated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const alertsToCreate: Array<{
      campaign_id: string;
      type: string;
      severity: string;
      message: string;
      details: Record<string, unknown>;
    }> = [];

    for (const campaign of campaigns) {
      const checks: AlertCheck[] = [];

      // Check 1: Bounce spike (> 5%)
      if (campaign.bounce_rate > 5) {
        const severity = campaign.bounce_rate > 10 ? 'critical' : 'high';
        checks.push({
          type: 'bounce_spike',
          severity,
          message: `${campaign.name} has ${campaign.bounce_rate.toFixed(1)}% bounce rate`,
          details: {
            bounce_rate: campaign.bounce_rate,
            threshold: 5,
            total_sent: campaign.total_sent,
          },
        });
      }

      // Check 2: Stalled campaign (no activity in 3+ days)
      const lastActivity = new Date(campaign.updated_at);
      const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceActivity > 3 && campaign.total_sent > 0) {
        checks.push({
          type: 'stalled',
          severity: daysSinceActivity > 7 ? 'high' : 'medium',
          message: `${campaign.name} has no activity in ${Math.floor(daysSinceActivity)} days`,
          details: {
            last_activity: campaign.updated_at,
            days_since_activity: Math.floor(daysSinceActivity),
          },
        });
      }

      // Check 3: High opens but low replies (CTA problem)
      if ((campaign.open_rate || 0) > 40 && campaign.reply_rate < 1 && campaign.total_sent >= 100) {
        checks.push({
          type: 'opportunity',
          severity: 'medium',
          message: `${campaign.name}: ${campaign.open_rate?.toFixed(0)}% opens but only ${campaign.reply_rate.toFixed(1)}% replies - CTA may need work`,
          details: {
            open_rate: campaign.open_rate,
            reply_rate: campaign.reply_rate,
            suggestion: 'Try a softer call-to-action',
          },
        });
      }

      // Check for existing unresolved alerts to avoid duplicates
      for (const check of checks) {
        const { data: existingAlert } = await supabaseAdmin
          .from('campaign_alerts')
          .select('id')
          .eq('campaign_id', campaign.id)
          .eq('type', check.type)
          .eq('is_resolved', false)
          .maybeSingle();

        if (!existingAlert) {
          alertsToCreate.push({
            campaign_id: campaign.id,
            ...check,
          });
        }
      }
    }

    // Insert new alerts
    if (alertsToCreate.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('campaign_alerts')
        .insert(alertsToCreate);

      if (insertError) {
        console.error('Error inserting alerts:', insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaignsChecked: campaigns.length,
        alertsCreated: alertsToCreate.length,
        alerts: alertsToCreate.map(a => ({ type: a.type, message: a.message })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in check-alerts:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
