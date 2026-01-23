import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  engagement_id: string;
}

interface BackfillResult {
  success: boolean;
  engagement_id: string;
  campaigns_processed: number;
  daily_metrics_created: number;
  weeks_generated: number;
  message: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { engagement_id }: BackfillRequest = await req.json();

    if (!engagement_id) {
      return new Response(
        JSON.stringify({ error: 'engagement_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[backfill-daily-metrics] Starting backfill for engagement: ${engagement_id}`);

    // Fetch campaigns linked to this engagement
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, total_sent, total_replied, total_bounced, positive_replies, created_at, updated_at, settings')
      .eq('engagement_id', engagement_id)
      .gt('total_sent', 0);

    if (campaignsError) {
      console.error('[backfill-daily-metrics] Error fetching campaigns:', campaignsError);
      throw campaignsError;
    }

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          engagement_id,
          campaigns_processed: 0,
          daily_metrics_created: 0,
          weeks_generated: 0,
          message: 'No campaigns with sent emails found for this engagement',
        } as BackfillResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[backfill-daily-metrics] Found ${campaigns.length} campaigns with sent emails`);

    // Check for existing daily_metrics to avoid duplicates
    const { data: existingMetrics } = await supabase
      .from('daily_metrics')
      .select('campaign_id, date')
      .eq('engagement_id', engagement_id);

    const existingKeys = new Set(
      (existingMetrics || []).map((m) => `${m.campaign_id}:${m.date}`)
    );

    let totalMetricsCreated = 0;
    let totalWeeksGenerated = 0;

    for (const campaign of campaigns) {
      // Determine date range from campaign created_at and updated_at
      // Fall back to settings.campaign_created_date if available
      const settings = campaign.settings as Record<string, string> | null;
      const createdDateStr = settings?.campaign_created_date || campaign.created_at;
      const updatedDateStr = campaign.updated_at || new Date().toISOString();

      const createdDate = new Date(createdDateStr);
      const updatedDate = new Date(updatedDateStr);

      // Calculate weeks between dates
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksDiff = Math.max(1, Math.ceil((updatedDate.getTime() - createdDate.getTime()) / msPerWeek));

      console.log(`[backfill-daily-metrics] Campaign ${campaign.name}: ${weeksDiff} weeks, ${campaign.total_sent} sent`);

      // Distribute totals across weeks
      const sentPerWeek = Math.floor((campaign.total_sent || 0) / weeksDiff);
      const repliedPerWeek = Math.floor((campaign.total_replied || 0) / weeksDiff);
      const bouncedPerWeek = Math.floor((campaign.total_bounced || 0) / weeksDiff);
      const positivePerWeek = Math.floor((campaign.positive_replies || 0) / weeksDiff);

      // Calculate remainder to add to the last week
      const sentRemainder = (campaign.total_sent || 0) % weeksDiff;
      const repliedRemainder = (campaign.total_replied || 0) % weeksDiff;
      const bouncedRemainder = (campaign.total_bounced || 0) % weeksDiff;
      const positiveRemainder = (campaign.positive_replies || 0) % weeksDiff;

      const metricsToInsert = [];

      for (let weekIndex = 0; weekIndex < weeksDiff; weekIndex++) {
        // Calculate the Monday of this week
        const weekStart = new Date(createdDate.getTime() + weekIndex * msPerWeek);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Move to Monday
        const dateStr = weekStart.toISOString().split('T')[0];

        const key = `${campaign.id}:${dateStr}`;
        if (existingKeys.has(key)) {
          console.log(`[backfill-daily-metrics] Skipping existing metric for ${dateStr}`);
          continue;
        }

        const isLastWeek = weekIndex === weeksDiff - 1;

        metricsToInsert.push({
          engagement_id,
          campaign_id: campaign.id,
          date: dateStr,
          emails_sent: sentPerWeek + (isLastWeek ? sentRemainder : 0),
          emails_delivered: Math.max(0, (sentPerWeek + (isLastWeek ? sentRemainder : 0)) - (bouncedPerWeek + (isLastWeek ? bouncedRemainder : 0))),
          emails_replied: repliedPerWeek + (isLastWeek ? repliedRemainder : 0),
          emails_bounced: bouncedPerWeek + (isLastWeek ? bouncedRemainder : 0),
          positive_replies: positivePerWeek + (isLastWeek ? positiveRemainder : 0),
          is_estimated: true, // Flag to indicate this is synthetic data
        });
      }

      if (metricsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('daily_metrics')
          .insert(metricsToInsert);

        if (insertError) {
          console.error(`[backfill-daily-metrics] Error inserting metrics for campaign ${campaign.id}:`, insertError);
          // Continue with other campaigns
        } else {
          totalMetricsCreated += metricsToInsert.length;
          totalWeeksGenerated += weeksDiff;
          console.log(`[backfill-daily-metrics] Inserted ${metricsToInsert.length} metrics for campaign ${campaign.name}`);
        }
      }
    }

    const result: BackfillResult = {
      success: true,
      engagement_id,
      campaigns_processed: campaigns.length,
      daily_metrics_created: totalMetricsCreated,
      weeks_generated: totalWeeksGenerated,
      message: totalMetricsCreated > 0
        ? `Successfully generated ${totalMetricsCreated} weekly data points from ${campaigns.length} campaigns`
        : 'No new metrics to generate (data already exists)',
    };

    console.log(`[backfill-daily-metrics] Complete:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const error = err as Error;
    console.error('[backfill-daily-metrics] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
