import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, workspaceId } = await req.json();
    
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

    // Fetch workspace copy analytics data
    console.log('Fetching copy analytics for workspace:', workspaceId);

    // Get top performing variants
    const { data: topPerformers } = await supabase
      .from('copy_performance')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gt('total_sent', 50)
      .order('reply_rate', { ascending: false })
      .limit(10);

    // Get bottom performing variants
    const { data: bottomPerformers } = await supabase
      .from('copy_performance')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gt('total_sent', 50)
      .order('reply_rate', { ascending: true })
      .limit(10);

    // Get validated patterns
    const { data: patterns } = await supabase
      .from('copy_patterns')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_validated', true)
      .order('reply_rate_lift', { ascending: false })
      .limit(10);

    // Get variant features for linguistic analysis
    const { data: features } = await supabase
      .from('campaign_variant_features')
      .select('*')
      .eq('workspace_id', workspaceId)
      .limit(100);

    // Get aggregate metrics
    const { data: metrics } = await supabase
      .from('daily_metrics')
      .select('sent_count, opened_count, clicked_count, replied_count, positive_reply_count')
      .eq('workspace_id', workspaceId);

    // Calculate totals
    const totals = (metrics || []).reduce((acc, m) => ({
      sent: acc.sent + (m.sent_count || 0),
      opened: acc.opened + (m.opened_count || 0),
      clicked: acc.clicked + (m.clicked_count || 0),
      replied: acc.replied + (m.replied_count || 0),
      positive: acc.positive + (m.positive_reply_count || 0),
    }), { sent: 0, opened: 0, clicked: 0, replied: 0, positive: 0 });

    const avgOpenRate = totals.sent > 0 ? ((totals.opened / totals.sent) * 100).toFixed(2) : '0';
    const avgReplyRate = totals.sent > 0 ? ((totals.replied / totals.sent) * 100).toFixed(2) : '0';
    const avgPositiveRate = totals.sent > 0 ? ((totals.positive / totals.sent) * 100).toFixed(2) : '0';

    // Get decaying variants
    const { data: decayingVariants } = await supabase
      .from('variant_decay_tracking')
      .select('*, campaign_variants(subject_line, name)')
      .eq('workspace_id', workspaceId)
      .eq('is_decaying', true)
      .limit(5);

    // Build context for the AI
    const topPerformersContext = (topPerformers || []).map((p, i) => 
      `${i + 1}. "${p.subject_line}" - ${p.reply_rate?.toFixed(2)}% reply rate, ${p.total_sent} sent`
    ).join('\n');

    const bottomPerformersContext = (bottomPerformers || []).map((p, i) => 
      `${i + 1}. "${p.subject_line}" - ${p.reply_rate?.toFixed(2)}% reply rate, ${p.total_sent} sent`
    ).join('\n');

    const patternsContext = (patterns || []).map((p, i) => 
      `${i + 1}. ${p.pattern_name}: ${p.pattern_description || 'No description'} (+${p.reply_rate_lift?.toFixed(1)}% lift, n=${p.sample_size})`
    ).join('\n');

    const decayContext = (decayingVariants || []).map((d: any) => 
      `- "${d.campaign_variants?.subject_line || 'Unknown'}" dropped ${d.decay_percentage?.toFixed(1)}% (${d.decay_severity} severity)`
    ).join('\n');

    // Analyze CTA types from features
    const ctaBreakdown: Record<string, { count: number; totalReplyRate: number }> = {};
    (features || []).forEach(f => {
      const cta = f.body_cta_type || 'none';
      if (!ctaBreakdown[cta]) ctaBreakdown[cta] = { count: 0, totalReplyRate: 0 };
      ctaBreakdown[cta].count++;
    });

    const ctaContext = Object.entries(ctaBreakdown)
      .map(([type, data]) => `- ${type}: ${data.count} variants`)
      .join('\n');

    const systemPrompt = `You are an expert cold email copywriter and data analyst helping a user optimize their outreach campaigns.

## Your Workspace Analytics Summary

**Overall Performance:**
- Total emails sent: ${totals.sent.toLocaleString()}
- Average open rate: ${avgOpenRate}%
- Average reply rate: ${avgReplyRate}%
- Average positive reply rate: ${avgPositiveRate}%

**Top 10 Performing Subject Lines:**
${topPerformersContext || 'No data yet - sync your campaigns first'}

**Bottom 10 Performing Subject Lines:**
${bottomPerformersContext || 'No data yet'}

**Validated Copy Patterns (what works):**
${patternsContext || 'No patterns discovered yet - need more campaign data'}

**Decaying Variants (losing performance):**
${decayContext || 'No decay detected'}

**CTA Types Used:**
${ctaContext || 'No CTA data available'}

## Your Role

1. Answer questions about the user's copy performance with specific data
2. Provide actionable recommendations based on their actual results
3. Generate new subject line or body copy variants when asked
4. Explain why certain patterns work or don't work
5. Help diagnose underperforming campaigns

## Guidelines

- Always reference specific data from the workspace when possible
- Provide concrete, actionable suggestions
- When generating copy variants, base them on patterns that work for THIS user
- Use metrics to support your recommendations
- Be concise but thorough
- Format responses with markdown for readability
- If asked about something you don't have data for, say so and suggest alternatives`;

    console.log('Calling Lovable AI with context');

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
