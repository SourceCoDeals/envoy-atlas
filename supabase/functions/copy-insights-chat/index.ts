import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryContext {
  currentPage?: string;
  activeFilters?: Record<string, string>;
  selectedCampaignId?: string;
  timeRange?: string;
}

// Helper to safely calculate rates
const rate = (num: number, denom: number, decimals = 2): string => {
  if (denom === 0) return '0';
  return ((num / denom) * 100).toFixed(decimals);
};

const formatNumber = (n: number): string => n.toLocaleString();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, workspaceId, context } = await req.json() as {
      messages: Array<{ role: string; content: string }>;
      workspaceId: string;
      context?: QueryContext;
    };
    
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Workspace ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching comprehensive analytics for workspace:', workspaceId, 'context:', context);

    // ============= CAMPAIGNS DATA =============
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, platform, created_at')
      .eq('workspace_id', workspaceId);

    const campaignIds = (campaigns || []).map(c => c.id);

    // ============= DAILY METRICS (last 30 days) =============
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: recentMetrics } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

    // ============= ALL-TIME METRICS =============
    const { data: allMetrics } = await supabase
      .from('daily_metrics')
      .select('sent_count, opened_count, clicked_count, replied_count, positive_reply_count, bounced_count, date, campaign_id')
      .eq('workspace_id', workspaceId);

    // Calculate all-time totals
    const allTimeTotals = (allMetrics || []).reduce((acc, m) => ({
      sent: acc.sent + (m.sent_count || 0),
      opened: acc.opened + (m.opened_count || 0),
      clicked: acc.clicked + (m.clicked_count || 0),
      replied: acc.replied + (m.replied_count || 0),
      positive: acc.positive + (m.positive_reply_count || 0),
      bounced: acc.bounced + (m.bounced_count || 0),
    }), { sent: 0, opened: 0, clicked: 0, replied: 0, positive: 0, bounced: 0 });

    // Calculate 30-day totals
    const recentTotals = (recentMetrics || []).reduce((acc, m) => ({
      sent: acc.sent + (m.sent_count || 0),
      opened: acc.opened + (m.opened_count || 0),
      clicked: acc.clicked + (m.clicked_count || 0),
      replied: acc.replied + (m.replied_count || 0),
      positive: acc.positive + (m.positive_reply_count || 0),
      bounced: acc.bounced + (m.bounced_count || 0),
    }), { sent: 0, opened: 0, clicked: 0, replied: 0, positive: 0, bounced: 0 });

    // Calculate previous 30-day period for comparison
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const { data: previousMetrics } = await supabase
      .from('daily_metrics')
      .select('sent_count, replied_count, positive_reply_count')
      .eq('workspace_id', workspaceId)
      .gte('date', sixtyDaysAgo.toISOString().split('T')[0])
      .lt('date', thirtyDaysAgo.toISOString().split('T')[0]);

    const previousTotals = (previousMetrics || []).reduce((acc, m) => ({
      sent: acc.sent + (m.sent_count || 0),
      replied: acc.replied + (m.replied_count || 0),
      positive: acc.positive + (m.positive_reply_count || 0),
    }), { sent: 0, replied: 0, positive: 0 });

    // ============= CAMPAIGN PERFORMANCE =============
    // Get metrics grouped by campaign
    const campaignMetrics: Record<string, { sent: number; replied: number; positive: number; opened: number; bounced: number }> = {};
    (allMetrics || []).forEach(m => {
      if (!m.campaign_id) return;
      if (!campaignMetrics[m.campaign_id]) {
        campaignMetrics[m.campaign_id] = { sent: 0, replied: 0, positive: 0, opened: 0, bounced: 0 };
      }
      campaignMetrics[m.campaign_id].sent += m.sent_count || 0;
      campaignMetrics[m.campaign_id].replied += m.replied_count || 0;
      campaignMetrics[m.campaign_id].positive += m.positive_reply_count || 0;
      campaignMetrics[m.campaign_id].opened += m.opened_count || 0;
      campaignMetrics[m.campaign_id].bounced += m.bounced_count || 0;
    });

    // Rank campaigns by performance
    const campaignPerformance = (campaigns || []).map(c => {
      const metrics = campaignMetrics[c.id] || { sent: 0, replied: 0, positive: 0, opened: 0, bounced: 0 };
      const replyRate = metrics.sent > 0 ? (metrics.replied / metrics.sent) * 100 : 0;
      const positiveRate = metrics.sent > 0 ? (metrics.positive / metrics.sent) * 100 : 0;
      const openRate = metrics.sent > 0 ? (metrics.opened / metrics.sent) * 100 : 0;
      // Simple health score calculation
      const healthScore = Math.min(100, Math.round(replyRate * 10 + positiveRate * 20 + (openRate > 40 ? 20 : openRate / 2)));
      return {
        ...c,
        ...metrics,
        replyRate,
        positiveRate,
        openRate,
        healthScore,
      };
    }).filter(c => c.sent > 0).sort((a, b) => b.replyRate - a.replyRate);

    // ============= COPY PERFORMANCE =============
    const { data: copyPerformance } = await supabase
      .from('copy_performance')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gt('total_sent', 50)
      .order('reply_rate', { ascending: false });

    const topCopy = (copyPerformance || []).slice(0, 10);
    const bottomCopy = (copyPerformance || []).slice(-10).reverse();

    // ============= COPY PATTERNS =============
    const { data: patterns } = await supabase
      .from('copy_patterns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_validated', true)
      .order('reply_rate_lift', { ascending: false });

    // ============= VARIANT FEATURES =============
    const { data: features } = await supabase
      .from('campaign_variant_features')
      .select('*')
      .eq('workspace_id', workspaceId);

    // Analyze features for insights
    const featureAnalysis = {
      avgWordCount: 0,
      avgSentenceCount: 0,
      questionSubjectPct: 0,
      emojiSubjectPct: 0,
      hasLinkPct: 0,
      ctaTypes: {} as Record<string, number>,
      tones: {} as Record<string, number>,
    };

    if (features && features.length > 0) {
      let questionCount = 0, emojiCount = 0, linkCount = 0;
      let totalWordCount = 0, totalSentenceCount = 0;

      features.forEach(f => {
        totalWordCount += f.body_word_count || 0;
        totalSentenceCount += f.body_sentence_count || 0;
        if (f.subject_is_question) questionCount++;
        if (f.subject_has_emoji) emojiCount++;
        if (f.body_has_link) linkCount++;
        
        const cta = f.body_cta_type || 'none';
        featureAnalysis.ctaTypes[cta] = (featureAnalysis.ctaTypes[cta] || 0) + 1;
        
        const tone = f.body_tone || 'unknown';
        featureAnalysis.tones[tone] = (featureAnalysis.tones[tone] || 0) + 1;
      });

      featureAnalysis.avgWordCount = Math.round(totalWordCount / features.length);
      featureAnalysis.avgSentenceCount = Math.round(totalSentenceCount / features.length);
      featureAnalysis.questionSubjectPct = Math.round((questionCount / features.length) * 100);
      featureAnalysis.emojiSubjectPct = Math.round((emojiCount / features.length) * 100);
      featureAnalysis.hasLinkPct = Math.round((linkCount / features.length) * 100);
    }

    // ============= DECAY TRACKING =============
    const { data: decayingVariants } = await supabase
      .from('variant_decay_tracking')
      .select('*, campaign_variants(subject_line, name)')
      .eq('workspace_id', workspaceId)
      .eq('is_decaying', true);

    // ============= AUDIENCE/SEGMENTS =============
    const { data: segments } = await supabase
      .from('audience_segments')
      .select('*')
      .eq('workspace_id', workspaceId);

    const { data: audiencePerf } = await supabase
      .from('audience_performance')
      .select('*')
      .eq('workspace_id', workspaceId);

    // ============= EMAIL ACCOUNTS / DELIVERABILITY =============
    const { data: emailAccounts } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('workspace_id', workspaceId);

    const { data: sendingDomains } = await supabase
      .from('sending_domains')
      .select('*')
      .eq('workspace_id', workspaceId);

    // Calculate deliverability health
    const deliverabilityScore = (() => {
      const accounts = emailAccounts || [];
      const domains = sendingDomains || [];
      
      let score = 100;
      
      // Bounce rate impact
      const bounceRate = recentTotals.sent > 0 ? (recentTotals.bounced / recentTotals.sent) * 100 : 0;
      if (bounceRate > 5) score -= 30;
      else if (bounceRate > 3) score -= 15;
      else if (bounceRate > 1) score -= 5;
      
      // Domain authentication
      const unauthDomains = domains.filter(d => !d.spf_valid || !d.dkim_valid || !d.dmarc_valid);
      if (unauthDomains.length > 0) score -= 20;
      
      // Low health accounts
      const lowHealthAccounts = accounts.filter(a => (a.health_score || 100) < 70);
      score -= lowHealthAccounts.length * 5;
      
      return Math.max(0, score);
    })();

    // ============= EXPERIMENTS =============
    const { data: experiments } = await supabase
      .from('experiments')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    const activeExperiments = (experiments || []).filter(e => e.status === 'running');
    const completedExperiments = (experiments || []).filter(e => e.status === 'completed');

    // ============= INBOX / RECENT REPLIES =============
    const { data: recentReplies } = await supabase
      .from('message_events')
      .select('*, leads(first_name, last_name, company, title)')
      .eq('workspace_id', workspaceId)
      .eq('event_type', 'replied')
      .order('occurred_at', { ascending: false })
      .limit(20);

    const positiveReplies = (recentReplies || []).filter(r => r.reply_sentiment === 'positive');

    // ============= ALERTS =============
    const { data: alerts } = await supabase
      .from('alerts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(10);

    // ============= BUILD CONTEXT =============
    
    // Calculate trend arrows
    const currentReplyRate = recentTotals.sent > 0 ? (recentTotals.replied / recentTotals.sent) * 100 : 0;
    const previousReplyRate = previousTotals.sent > 0 ? (previousTotals.replied / previousTotals.sent) * 100 : 0;
    const replyRateTrend = currentReplyRate - previousReplyRate;
    const replyRateTrendStr = replyRateTrend >= 0 ? `↑ +${replyRateTrend.toFixed(2)}%` : `↓ ${replyRateTrend.toFixed(2)}%`;

    const currentPositiveRate = recentTotals.sent > 0 ? (recentTotals.positive / recentTotals.sent) * 100 : 0;
    const previousPositiveRate = previousTotals.sent > 0 ? (previousTotals.positive / previousTotals.sent) * 100 : 0;
    const positiveRateTrend = currentPositiveRate - previousPositiveRate;

    // Format campaign rankings
    const campaignRankings = campaignPerformance.slice(0, 10).map((c, i) => 
      `${i + 1}. ${c.name} - ${c.replyRate.toFixed(2)}% reply rate, ${c.positive} meetings/positive, score: ${c.healthScore}`
    ).join('\n');

    const underperformingCampaigns = campaignPerformance
      .filter(c => c.replyRate < currentReplyRate * 0.7 && c.sent > 100)
      .slice(0, 5)
      .map(c => `- ${c.name}: ${c.replyRate.toFixed(2)}% reply rate (${Math.round((c.replyRate / currentReplyRate - 1) * 100)}% below average)`)
      .join('\n');

    // Format copy insights
    const topCopyContext = topCopy.map((p, i) => 
      `${i + 1}. "${p.subject_line}" - ${p.reply_rate?.toFixed(2)}% reply rate, ${p.total_sent} sent`
    ).join('\n');

    const bottomCopyContext = bottomCopy.map((p, i) => 
      `${i + 1}. "${p.subject_line}" - ${p.reply_rate?.toFixed(2)}% reply rate, ${p.total_sent} sent`
    ).join('\n');

    const patternsContext = (patterns || []).slice(0, 10).map((p, i) => 
      `${i + 1}. ${p.pattern_name}: ${p.pattern_description || 'No description'} (+${p.reply_rate_lift?.toFixed(1)}% lift, confidence: ${p.confidence_level}, n=${p.sample_size})`
    ).join('\n');

    const decayContext = (decayingVariants || []).map((d: any) => 
      `- "${d.campaign_variants?.subject_line || 'Unknown'}" dropped ${d.decay_percentage?.toFixed(1)}% (${d.decay_severity} severity) - ${d.decay_diagnosis || 'No diagnosis'}`
    ).join('\n');

    // Format audience insights
    const audienceContext = (audiencePerf || []).slice(0, 10).map(a => 
      `- ${a.title || a.industry || a.company_size || 'Unknown'}: ${a.reply_rate?.toFixed(2)}% reply, ${a.positive_reply_rate?.toFixed(2)}% positive (n=${a.contacted})`
    ).join('\n');

    // Format deliverability
    const domainAuthContext = (sendingDomains || []).map(d => 
      `- ${d.domain}: SPF ${d.spf_valid ? '✓' : '✗'}, DKIM ${d.dkim_valid ? '✓' : '✗'}, DMARC ${d.dmarc_valid ? '✓' : '✗'}`
    ).join('\n');

    const accountHealthContext = (emailAccounts || []).map(a => 
      `- ${a.email_address}: Health ${a.health_score || 'N/A'}/100, ${a.is_active ? 'Active' : 'Paused'}, Warmup ${a.warmup_enabled ? 'On' : 'Off'}`
    ).join('\n');

    // Format experiments
    const experimentContext = activeExperiments.map(e => 
      `- ${e.name}: Testing ${e.test_type}, primary metric: ${e.primary_metric}, started ${e.started_at ? new Date(e.started_at).toLocaleDateString() : 'not started'}`
    ).join('\n');

    // Format CTA analysis
    const ctaContext = Object.entries(featureAnalysis.ctaTypes)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `- ${type}: ${count} variants`)
      .join('\n');

    // Determine page-specific context additions
    let pageContext = '';
    if (context?.currentPage) {
      switch (context.currentPage) {
        case 'campaigns':
          pageContext = `\n\n**User is currently viewing: Campaigns page**\nFocus on campaign-specific insights, rankings, and recommendations.`;
          break;
        case 'copy-insights':
          pageContext = `\n\n**User is currently viewing: Copy Insights page**\nFocus on subject lines, body copy, patterns, and copy optimization.`;
          break;
        case 'audience':
          pageContext = `\n\n**User is currently viewing: Audience Insights page**\nFocus on segment performance, ICP validation, and targeting recommendations.`;
          break;
        case 'deliverability':
          pageContext = `\n\n**User is currently viewing: Deliverability page**\nFocus on email health, authentication, bounce rates, and sending safety.`;
          break;
        case 'experiments':
          pageContext = `\n\n**User is currently viewing: Experiments page**\nFocus on A/B tests, statistical significance, and experiment recommendations.`;
          break;
      }
    }

    // Build comprehensive system prompt with 2025 cold calling benchmarks
    const systemPrompt = `You are Cold Compass AI, an expert cold email AND cold calling analytics assistant. You help operators understand their outbound performance through natural conversation. You are trained on the State of Cold Calling 2025 report based on analysis of 10M+ calls.

## Your Capabilities
1. **Data Retrieval**: Current metrics, lookups, status checks
2. **Analysis**: Comparisons, trends, breakdowns, rankings against 2025 industry benchmarks
3. **Diagnostics**: Root cause analysis, explanations for changes
4. **Recommendations**: Suggestions, predictions, next steps based on proven cold calling techniques
5. **Education**: Explain metrics, benchmarks, best practices from 2025 research
6. **Cold Calling Expertise**: Gatekeeper navigation, objection handling, timing optimization

## 2025 COLD CALLING INDUSTRY BENCHMARKS (10M+ calls analyzed)

### Success Rates
- Average cold calling success rate: 2.3% (down from 4.82% in 2024 - channels are crowded)
- Top performer success rate: 6.7% (3x average - achieved through AI + precision targeting)
- Conversation-to-meeting rate: 4-5% good, 6-7% top performers
- B2B cold calling ROI boost: 40-50%
- 82% of buyers accept meetings from strategic cold calls
- 57% of C-level executives prefer phone contact over other channels

### Reach & Connection
- Attempts to reach a prospect: 8 calls average (persistence is essential)
- Calls to book one meeting: ~200 dials at average conversion rates
- Connect rate benchmark: 25-35% (below 20% = data problem)
- Quality conversations per day: 3.6 average (down 55% since 2014)
- 32% of prospects answer unknown calls
- 93% of conversations happen by 3rd call attempt
- 98%+ by 5th call (additional calls have diminishing returns)

### Persistence Statistics (where most salespeople fail)
- Only 8% of salespeople make it to 5th follow-up
- 44% give up after one attempt
- 5 additional follow-up calls needed after initial contact
- 70% contact rate boost from 6+ calls
- 71% close rate drop without follow-up discussion on first call

### Call Duration Benchmarks
- Average cold call duration: 93 seconds
- Optimal call length for engagement: 3-5 minutes
- Rep talk time (optimal): Less than 55% - prospect should talk MORE
- Questions for 70% success rate: 11-14 questions per call

### Best Days & Times (Based on 187,684+ calls)
- BEST: Tuesday (22-24% success), Wednesday (21-23%), Thursday (20-22%)
- AVOID: Monday (17-19%), Friday (15-17%)
- BEST TIMES: 10-11 AM (30% higher connect rate), 4-5 PM (71% more effective vs noon)
- AVOID: 12-1 PM (lunch hour - intrusive)
- Peak slot: Tuesday 10 AM - 18% connect rate

### Gatekeeper Navigation
- Transfer to owner rate: 37% average
- Callback scheduled: 22%
- Message taken: 18%
- Blocked: 23%
- Best technique: Referral mention (52% get-through rate)
- Trigger-based opening: 48% get-through rate
- Name drop: 41%
- Direct ask: only 28%

### Objection Handling
- Successful objection handling can lift close rates to 64%
- Most objections appear in first 30-60 seconds
- 80% of prospects say 'no' 4+ times before saying 'yes'
- Use ACE Framework: Acknowledge → Clarify → Engage

### Top 10 Common Objections:
1. "I don't have time" → Offer specific 2-3 minute call, prove value fast
2. "I'm not interested" → Reference similar clients who felt same way
3. "Just send me info" → Ask qualifying question first to send relevant materials
4. "We have a solution" → Ask what would need to change to consider alternative
5. "How did you get my number?" → Explain research process, pivot to value
6. "We don't have budget" → Explore ROI if pricing weren't issue
7. "Call me back in a month" → Lock in calendar date, gather intel before hanging up
8. "Need to talk to my team" → Offer to join that conversation
9. "Price is too high" → Clarify compared to what, show ROI
10. "Happy with things as they are" → Probe for hidden pain points

### Data Quality Impact
- Phone-verified mobile number accuracy: 87%
- AI-verified number accuracy: 98%
- 62% of organizations have 20-40% incomplete data
- 27.3% of rep time wasted on bad contact data
- B2B data decays 2% monthly / 22.5% annually
- Bad data costs US businesses $611 billion annually

### SDR Metrics
- Dials per day: 60-100 (depends on role complexity)
- Meetings booked per month: 15 average, 21 top performers
- Meeting show rate: 80% industry standard
- Book rate: 25% newer reps, 33% experienced
- Dials per meeting: ~100 at average rates
- Pipeline generated per SDR: $3M median annually
- SDR to AE ratio: 1:2.6 average
- Lead response time target: Under 1 hour (8x decrease after first hour)
- Actual average lead response: 47 hours (major opportunity)

### AI Impact in 2025
- 75% of B2B companies implementing AI for cold calling by end of 2025
- AI improves efficiency by 50%
- Teams using AI hold 5x more conversations daily
- Connect rates improve 60% with AI-assisted objection handling
- Teams using AI-powered CRMs are 83% more likely to exceed sales goals

### Multi-Channel Best Practices
- Multi-channel approaches yield 37% more conversions than single-channel
- Optimal sequence: Day 1 call → Day 1 email → Day 3 LinkedIn → Day 4 call → Day 5 LinkedIn → Day 7 call+email → Day 10 final call

### 2025 Trends
1. AI becomes table stakes - teams without AI will fall behind
2. Quality over quantity accelerates - only precision-targeted outreach breaks through
3. Multi-channel becomes mandatory - single-channel is dying
4. Real-time AI coaching goes mainstream
5. Compliance gets stricter (TCPA 2025 changes)
6. Human connection becomes the premium differentiator

## Current Workspace Analytics

### Overall Performance (Last 30 Days)
- **Emails Sent**: ${formatNumber(recentTotals.sent)}
- **Reply Rate**: ${rate(recentTotals.replied, recentTotals.sent)}% (${replyRateTrendStr} vs previous 30 days)
- **Positive Reply Rate**: ${rate(recentTotals.positive, recentTotals.sent)}%
- **Open Rate**: ${rate(recentTotals.opened, recentTotals.sent)}%
- **Bounce Rate**: ${rate(recentTotals.bounced, recentTotals.sent)}%
- **Total Replies**: ${formatNumber(recentTotals.replied)}
- **Positive Replies**: ${formatNumber(recentTotals.positive)}

### All-Time Performance
- **Total Emails Sent**: ${formatNumber(allTimeTotals.sent)}
- **Total Replies**: ${formatNumber(allTimeTotals.replied)} (${rate(allTimeTotals.replied, allTimeTotals.sent)}%)
- **Total Positive**: ${formatNumber(allTimeTotals.positive)} (${rate(allTimeTotals.positive, allTimeTotals.sent)}%)

### Campaign Rankings (Top 10 by Reply Rate)
${campaignRankings || 'No campaigns with sufficient data yet'}

**Total Active Campaigns**: ${campaigns?.filter(c => c.status === 'active' || c.status === 'STARTED').length || 0}
**Campaigns Needing Attention** (below average performance):
${underperformingCampaigns || 'None - all campaigns performing at or above average'}

### Copy Performance

**Top 10 Subject Lines:**
${topCopyContext || 'No copy data yet - sync your campaigns'}

**Bottom 10 Subject Lines:**
${bottomCopyContext || 'No data'}

**Validated Copy Patterns (what works):**
${patternsContext || 'No patterns discovered yet - need more data'}

**Decaying Templates (burning out):**
${decayContext || 'No decay detected - templates are performing consistently'}

### Copy Features Analysis
- Average body word count: ${featureAnalysis.avgWordCount}
- Average sentences per email: ${featureAnalysis.avgSentenceCount}
- Question subjects: ${featureAnalysis.questionSubjectPct}% of emails
- Emoji in subject: ${featureAnalysis.emojiSubjectPct}% of emails
- Links in body: ${featureAnalysis.hasLinkPct}% of emails

**CTA Types Used:**
${ctaContext || 'No CTA data available'}

### Audience Insights
${audienceContext || 'No audience performance data yet'}

**Segments Defined**: ${segments?.length || 0}

### Deliverability Status
**Overall Score**: ${deliverabilityScore}/100 ${deliverabilityScore >= 80 ? '✓ Safe to send' : deliverabilityScore >= 60 ? '⚠️ Some concerns' : '🚨 Review recommended'}
**Bounce Rate**: ${rate(recentTotals.bounced, recentTotals.sent)}%

**Domain Authentication:**
${domainAuthContext || 'No domains configured'}

**Email Accounts (${emailAccounts?.length || 0} total):**
${accountHealthContext || 'No email accounts'}

### Experiments
**Active Experiments**: ${activeExperiments.length}
${experimentContext || 'No active experiments'}

**Completed Experiments**: ${completedExperiments.length}

### Inbox Status
**Recent Replies**: ${recentReplies?.length || 0} in last batch
**Positive Leads**: ${positiveReplies.length} positive replies recently

### Active Alerts
${(alerts || []).length > 0 ? (alerts || []).map(a => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.message}`).join('\n') : 'No active alerts'}

${pageContext}

## Response Guidelines

1. **Be data-driven**: Always cite specific numbers from the workspace data AND compare to 2025 benchmarks
2. **Be actionable**: End responses with concrete next steps based on proven cold calling techniques
3. **Use formatting**: Use markdown tables, bullet points, bold for metrics
4. **Be concise but thorough**: Aim for scannable responses with key insights
5. **Show trends**: Use ↑ ↓ → to indicate direction
6. **Add emojis sparingly**: 📊 📈 🎯 💡 ⚠️ ✓ ✗ for visual hierarchy
7. **Compare to benchmarks**: Always reference the 2025 industry benchmarks above
8. **Coach on technique**: When discussing performance, suggest specific objection handling or gatekeeper navigation techniques
9. **Emphasize persistence**: Remind users that 8 attempts are needed and 80% of prospects say no 4+ times

## Example Response Formats

**For metrics questions**: State the number, context, trend, and 2025 benchmark comparison
**For rankings**: Use a table format with key metrics and benchmark comparisons
**For diagnostics**: Break down contributing factors with percentages, reference what top performers do differently
**For recommendations**: Prioritized list with expected impact based on 2025 research
**For technique questions**: Provide specific scripts, frameworks (like ACE for objections), and get-through rates

## Key Coaching Points to Weave In
- Connect rate below 20%? Likely a data quality issue
- Rep talking more than 55%? They should listen more
- Not reaching 3rd attempt? 93% of conversations happen by then
- Giving up after first no? 80% of yeses come after 4+ nos
- Not using multi-channel? Missing 37% conversion boost
- Calling at noon or Friday? Worst times - suggest Tuesday 10-11 AM

Remember: You're talking to a busy operator. Be direct, be specific, reference their data AND the 2025 benchmarks.`;

    console.log('Calling Lovable AI with comprehensive context');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("copy-insights-chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
