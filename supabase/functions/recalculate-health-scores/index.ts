import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Calculate email account health score based on multiple factors:
 * - Bounce rate (major negative impact)
 * - Spam complaint rate (severe negative impact)
 * - Reply rate (positive indicator)
 * - Warmup status (bonus for properly warmed accounts)
 * - Active status (penalty for inactive)
 * - Daily volume vs limit (utilization health)
 */
function calculateAccountHealthScore(account: {
  bounce_rate?: number | null;
  spam_complaint_rate?: number | null;
  reply_rate?: number | null;
  warmup_enabled?: boolean | null;
  warmup_percentage?: number | null;
  warmup_status?: string | null;
  is_active?: boolean | null;
  daily_limit?: number | null;
  sent_30d?: number | null;
}): number {
  let score = 100;
  
  // 1. Bounce Rate Impact (up to -40 points)
  // Industry target: < 2% hard bounces
  const bounceRate = account.bounce_rate || 0;
  if (bounceRate > 0) {
    if (bounceRate >= 10) score -= 40;
    else if (bounceRate >= 5) score -= 30;
    else if (bounceRate >= 3) score -= 20;
    else if (bounceRate >= 2) score -= 10;
    else score -= bounceRate * 5; // 0-2%: linear penalty
  }
  
  // 2. Spam Complaint Rate Impact (up to -30 points)
  // Industry target: < 0.1%
  const spamRate = account.spam_complaint_rate || 0;
  if (spamRate > 0) {
    if (spamRate >= 0.5) score -= 30;
    else if (spamRate >= 0.3) score -= 25;
    else if (spamRate >= 0.1) score -= 15;
    else score -= spamRate * 100; // 0-0.1%: linear penalty
  }
  
  // 3. Reply Rate Bonus (up to +10 points)
  // Good engagement indicates healthy account
  const replyRate = account.reply_rate || 0;
  if (replyRate >= 10) score += 10;
  else if (replyRate >= 5) score += 7;
  else if (replyRate >= 2) score += 5;
  else if (replyRate > 0) score += 3;
  
  // 4. Warmup Status (up to +10 / -10 points)
  if (account.warmup_enabled) {
    const warmupPct = account.warmup_percentage || 0;
    if (warmupPct >= 100) score += 10; // Fully warmed
    else if (warmupPct >= 75) score += 7;
    else if (warmupPct >= 50) score += 5;
    else if (warmupPct >= 25) score += 2;
    // Low warmup is a risk, but don't penalize new accounts
  } else {
    // No warmup enabled could be risky for new accounts
    const status = (account.warmup_status || '').toLowerCase();
    if (status === 'completed' || status === 'done') {
      score += 5; // Previously warmed
    }
  }
  
  // 5. Active Status (-20 if inactive)
  if (account.is_active === false) {
    score -= 20;
  }
  
  // 6. Volume Health
  // If sending very little relative to limit, might indicate issues
  const dailyLimit = account.daily_limit || 50;
  const sent30d = account.sent_30d || 0;
  const avgDaily = sent30d / 30;
  const utilization = (avgDaily / dailyLimit) * 100;
  
  if (utilization < 10 && sent30d > 0) {
    // Very low utilization but some activity - slight concern
    score -= 5;
  } else if (utilization > 90) {
    // High utilization could stress deliverability
    score -= 5;
  }
  
  // Clamp score to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify user auth
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl, 
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { workspace_id, batch_size = 100 } = await req.json();
    
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Recalculating health scores for workspace ${workspace_id}`);

    // Fetch all email accounts for workspace
    const { data: accounts, error: fetchError } = await supabase
      .from('email_accounts')
      .select('id, bounce_rate, spam_complaint_rate, reply_rate, warmup_enabled, warmup_percentage, warmup_status, is_active, daily_limit, sent_30d')
      .eq('workspace_id', workspace_id)
      .limit(batch_size);

    if (fetchError) {
      throw new Error(`Error fetching accounts: ${fetchError.message}`);
    }

    console.log(`Found ${accounts?.length || 0} accounts to recalculate`);

    const results: { id: string; old_score: number; new_score: number }[] = [];

    for (const account of accounts || []) {
      const newScore = calculateAccountHealthScore(account);
      
      // Get current score for comparison (we don't have it in select, fetch it)
      const { data: current } = await supabase
        .from('email_accounts')
        .select('health_score')
        .eq('id', account.id)
        .single();
      
      const oldScore = current?.health_score || 0;

      const { error: updateError } = await supabase
        .from('email_accounts')
        .update({ 
          health_score: newScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id);

      if (updateError) {
        console.error(`Error updating account ${account.id}:`, updateError);
      } else {
        results.push({
          id: account.id,
          old_score: oldScore,
          new_score: newScore,
        });
      }
    }

    // Summary statistics
    const avgOld = results.length > 0 
      ? Math.round(results.reduce((sum, r) => sum + r.old_score, 0) / results.length) 
      : 0;
    const avgNew = results.length > 0 
      ? Math.round(results.reduce((sum, r) => sum + r.new_score, 0) / results.length) 
      : 0;

    const scoreDistribution = {
      excellent: results.filter(r => r.new_score >= 90).length,
      good: results.filter(r => r.new_score >= 70 && r.new_score < 90).length,
      fair: results.filter(r => r.new_score >= 50 && r.new_score < 70).length,
      poor: results.filter(r => r.new_score < 50).length,
    };

    return new Response(JSON.stringify({
      success: true,
      accounts_updated: results.length,
      avg_score_before: avgOld,
      avg_score_after: avgNew,
      score_distribution: scoreDistribution,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in recalculate-health-scores:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
