import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PatternData {
  pattern_name: string;
  pattern_description: string | null;
  reply_rate: number | null;
  positive_rate: number | null;
  reply_rate_lift: number | null;
  sample_size: number;
  is_validated: boolean | null;
  p_value: number | null;
  confidence_level: string | null;
}

interface VariantData {
  id: string;
  subject_line: string | null;
  body_preview: string | null;
  reply_rate: number;
  positive_rate: number;
  sent_count: number;
  campaign_name: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspace_id, variant_id } = await req.json();
    
    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: 'workspace_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching data for workspace:', workspace_id);

    // Fetch validated patterns
    const { data: patterns, error: patternsError } = await supabase
      .from('copy_patterns')
      .select('*')
      .eq('workspace_id', workspace_id)
      .order('reply_rate', { ascending: false })
      .limit(10);

    if (patternsError) {
      console.error('Error fetching patterns:', patternsError);
      throw patternsError;
    }

    // Fetch copy performance data (top and bottom performers)
    const { data: performance, error: perfError } = await supabase
      .from('copy_performance')
      .select('*')
      .eq('workspace_id', workspace_id)
      .gt('total_sent', 100);

    if (perfError) {
      console.error('Error fetching performance:', perfError);
      throw perfError;
    }

    // Sort and get top/bottom performers
    const sortedPerformance = (performance || [])
      .map(p => ({
        id: p.variant_id,
        subject_line: p.subject_line,
        body_preview: p.body_preview,
        reply_rate: p.reply_rate || 0,
        positive_rate: p.positive_reply_rate || 0,
        sent_count: p.total_sent || 0,
        campaign_name: p.campaign_name || 'Unknown',
      }))
      .sort((a, b) => b.reply_rate - a.reply_rate);

    const topPerformers = sortedPerformance.slice(0, 5);
    const bottomPerformers = sortedPerformance.filter(p => p.reply_rate < 1 && p.sent_count >= 200).slice(0, 5);

    // If variant_id is provided, get that specific variant
    let targetVariant: VariantData | null = null;
    if (variant_id) {
      targetVariant = sortedPerformance.find(p => p.id === variant_id) || null;
    }

    // Calculate baseline
    const totalSent = sortedPerformance.reduce((sum, p) => sum + p.sent_count, 0);
    const weightedReplyRate = totalSent > 0
      ? sortedPerformance.reduce((sum, p) => sum + p.reply_rate * p.sent_count, 0) / totalSent
      : 0;

    // Build the prompt
    const validatedPatterns = (patterns || []).filter((p: PatternData) => p.is_validated);
    const allPatterns = patterns || [];

    let prompt = `You are an expert cold email copywriter analyzing campaign performance data for a B2B sales team.

## Your Task
Analyze the provided data and generate specific, actionable recommendations to improve email copy performance.

## Performance Summary
- Baseline reply rate: ${weightedReplyRate.toFixed(2)}%
- Total variants analyzed: ${sortedPerformance.length}
- Validated patterns: ${validatedPatterns.length}

## Top Performing Patterns${validatedPatterns.length > 0 ? ' (Statistically Validated)' : ''}
${allPatterns.slice(0, 7).map((p: PatternData, i: number) => 
  `${i + 1}. "${p.pattern_name}" - ${(p.reply_rate || 0).toFixed(1)}% reply rate${p.is_validated ? ' ✓' : ''} (${p.sample_size.toLocaleString()} sends, ${p.reply_rate_lift ? `+${p.reply_rate_lift.toFixed(0)}% lift` : 'no lift data'})
   ${p.pattern_description || ''}`
).join('\n')}

## Top Performing Variants (What's Working)
${topPerformers.map((v, i) => 
  `${i + 1}. Subject: "${v.subject_line || 'N/A'}"
   Reply Rate: ${v.reply_rate.toFixed(1)}% | Sent: ${v.sent_count.toLocaleString()}
   Body Preview: "${(v.body_preview || '').substring(0, 100)}..."`
).join('\n\n')}

## Underperforming Variants (Need Improvement)
${bottomPerformers.length > 0 ? bottomPerformers.map((v, i) => 
  `${i + 1}. Subject: "${v.subject_line || 'N/A'}"
   Reply Rate: ${v.reply_rate.toFixed(1)}% | Sent: ${v.sent_count.toLocaleString()}
   Campaign: ${v.campaign_name}`
).join('\n\n') : 'No significant underperformers identified.'}
`;

    if (targetVariant) {
      prompt += `

## SPECIFIC VARIANT TO IMPROVE
Subject: "${targetVariant.subject_line || 'N/A'}"
Body Preview: "${targetVariant.body_preview || ''}"
Current Reply Rate: ${targetVariant.reply_rate.toFixed(1)}%
Sends: ${targetVariant.sent_count.toLocaleString()}

Please provide specific rewrites and improvements for this variant.`;
    }

    prompt += `

Based on this data, provide specific, actionable recommendations. Focus on:
1. What patterns to apply to underperforming variants
2. Specific copy rewrites using proven patterns
3. A/B test ideas to validate hypotheses`;

    console.log('Calling Lovable AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert cold email copywriter and data analyst. Provide specific, actionable recommendations based on performance data. Be concise and focus on high-impact changes.`
          },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'provide_recommendations',
              description: 'Provide structured copy recommendations based on the analysis.',
              parameters: {
                type: 'object',
                properties: {
                  summary: {
                    type: 'string',
                    description: 'A 2-3 sentence executive summary of the key findings and overall recommendation.'
                  },
                  recommendations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          enum: ['subject_improvement', 'body_improvement', 'new_variant', 'pattern_combination'],
                          description: 'Type of recommendation'
                        },
                        title: {
                          type: 'string',
                          description: 'Short title for the recommendation'
                        },
                        description: {
                          type: 'string',
                          description: 'Detailed explanation of the recommendation and why it should work'
                        },
                        confidence: {
                          type: 'string',
                          enum: ['high', 'medium', 'low'],
                          description: 'Confidence level based on supporting data'
                        },
                        supporting_patterns: {
                          type: 'array',
                          items: { type: 'string' },
                          description: 'Names of patterns that support this recommendation'
                        },
                        original_copy: {
                          type: 'string',
                          description: 'The original copy being improved (if applicable)'
                        },
                        suggested_copy: {
                          type: 'string',
                          description: 'The suggested improved copy'
                        },
                        expected_lift: {
                          type: 'string',
                          description: 'Expected improvement range (e.g., "+15-25%")'
                        }
                      },
                      required: ['type', 'title', 'description', 'confidence']
                    },
                    description: 'List of 3-5 specific recommendations'
                  },
                  experiment_ideas: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        hypothesis: {
                          type: 'string',
                          description: 'The hypothesis to test'
                        },
                        control_pattern: {
                          type: 'string',
                          description: 'The control (current) approach'
                        },
                        test_pattern: {
                          type: 'string',
                          description: 'The test (new) approach'
                        },
                        expected_outcome: {
                          type: 'string',
                          description: 'What success would look like'
                        }
                      },
                      required: ['hypothesis', 'control_pattern', 'test_pattern', 'expected_outcome']
                    },
                    description: 'List of 2-3 A/B test ideas'
                  }
                },
                required: ['summary', 'recommendations', 'experiment_ideas']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'provide_recommendations' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a few moments.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('AI response received');

    // Extract the tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'provide_recommendations') {
      // Fallback: try to parse from content if no tool call
      const content = aiResponse.choices?.[0]?.message?.content;
      if (content) {
        return new Response(
          JSON.stringify({ 
            summary: 'AI analysis complete',
            recommendations: [{
              type: 'pattern_combination',
              title: 'AI Analysis',
              description: content,
              confidence: 'medium',
              supporting_patterns: []
            }],
            experiment_ideas: [],
            raw_response: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('No valid response from AI');
    }

    const recommendations = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        ...recommendations,
        generated_at: new Date().toISOString(),
        patterns_analyzed: allPatterns.length,
        variants_analyzed: sortedPerformance.length,
        baseline_reply_rate: weightedReplyRate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-copy-recommendations:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
