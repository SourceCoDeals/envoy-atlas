import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Starting nightly reconciliation...");

  const results = {
    timestamp: new Date().toISOString(),
    recalculated: false,
    issuesFound: 0,
    issues: [] as string[],
  };

  try {
    // Step 1: Call recalculate-metrics
    console.log("Calling recalculate-metrics...");
    const recalcResponse = await fetch(`${supabaseUrl}/functions/v1/recalculate-metrics`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (recalcResponse.ok) {
      results.recalculated = true;
      console.log("Recalculate-metrics completed successfully");
    } else {
      results.issues.push('recalculate-metrics failed: ' + await recalcResponse.text());
    }

    // Step 2: Check for data consistency issues
    console.log("Checking data consistency...");

    // Check 1: Positive replies match between campaigns and email_activities
    const { data: campaignPositive, error: campErr } = await supabase
      .from('campaigns')
      .select('positive_replies');
    
    if (campErr) {
      results.issues.push(`Failed to query campaigns: ${campErr.message}`);
    } else {
      const campaignTotal = campaignPositive?.reduce((sum, c) => sum + (c.positive_replies || 0), 0) || 0;
      
      const { count: activityTotal, error: actErr } = await supabase
        .from('email_activities')
        .select('id', { count: 'exact', head: true })
        .in('reply_category', ['meeting_request', 'interested']);
      
      if (actErr) {
        results.issues.push(`Failed to query email_activities: ${actErr.message}`);
      } else if (campaignTotal !== activityTotal) {
        results.issues.push(`Positive reply mismatch: campaigns=${campaignTotal}, activities=${activityTotal}`);
      }
    }

    // Check 2: Verify reply_category is set for replied emails
    const { count: uncategorizedReplies, error: uncatErr } = await supabase
      .from('email_activities')
      .select('id', { count: 'exact', head: true })
      .eq('replied', true)
      .is('reply_category', null);

    if (uncatErr) {
      results.issues.push(`Failed to check uncategorized replies: ${uncatErr.message}`);
    } else if (uncategorizedReplies && uncategorizedReplies > 0) {
      results.issues.push(`${uncategorizedReplies} replied emails have no reply_category set`);
    }

    // Check 3: Verify campaigns have synced recently
    const { data: staleCampaigns, error: staleErr } = await supabase
      .from('campaigns')
      .select('id, name, last_synced_at')
      .lt('last_synced_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .eq('status', 'active');

    if (staleErr) {
      results.issues.push(`Failed to check stale campaigns: ${staleErr.message}`);
    } else if (staleCampaigns && staleCampaigns.length > 0) {
      results.issues.push(`${staleCampaigns.length} active campaigns haven't synced in 48+ hours`);
    }

    // Check 4: Verify daily_metrics totals match campaign totals
    const { data: campaignTotals, error: totalsErr } = await supabase
      .from('campaigns')
      .select('total_sent, total_replied, total_bounced');

    if (!totalsErr && campaignTotals) {
      const campSent = campaignTotals.reduce((sum, c) => sum + (c.total_sent || 0), 0);
      const campReplied = campaignTotals.reduce((sum, c) => sum + (c.total_replied || 0), 0);
      
      const { data: dailyTotals, error: dailyErr } = await supabase
        .from('daily_metrics')
        .select('emails_sent, emails_replied');

      if (!dailyErr && dailyTotals) {
        const dailySent = dailyTotals.reduce((sum, d) => sum + (d.emails_sent || 0), 0);
        const dailyReplied = dailyTotals.reduce((sum, d) => sum + (d.emails_replied || 0), 0);

        // Allow 5% variance
        if (Math.abs(campSent - dailySent) > campSent * 0.05) {
          results.issues.push(`Sent count drift: campaigns=${campSent}, daily_metrics=${dailySent}`);
        }
        if (Math.abs(campReplied - dailyReplied) > Math.max(campReplied * 0.05, 5)) {
          results.issues.push(`Reply count drift: campaigns=${campReplied}, daily_metrics=${dailyReplied}`);
        }
      }
    }

    results.issuesFound = results.issues.length;

    // Step 3: Log results to a system table if it exists
    // For now, just log to console
    console.log("Reconciliation complete:", JSON.stringify(results, null, 2));

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Reconciliation error:", error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message,
      results 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
