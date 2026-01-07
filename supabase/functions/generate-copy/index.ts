import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SequenceStepInput {
  id: string;
  channel: string;
  stepType: string;
  delayDays: number;
}

interface GenerationRequest {
  // Sequence mode
  sequenceSteps?: SequenceStepInput[];
  // Legacy single step mode
  channel?: string;
  sequenceStep?: string;
  // Common fields
  buyerName?: string;
  buyerWebsite?: string;
  targetIndustry?: string;
  painPoints?: string;
  emailGoal?: string;
  callTranscript?: string;
  documentPaths?: string[];
  tone: string;
  workspaceId: string;
  variationCount?: number;
}

interface BestPractice {
  channel: string;
  category: string;
  practice_type: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  performance_lift: number | null;
}

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  linkedin_connection: 'LinkedIn Connection Request',
  linkedin_inmail: 'LinkedIn InMail',
  linkedin_message: 'LinkedIn Message',
  phone_cold_call: 'Cold Call Script',
  phone_voicemail: 'Voicemail Script',
  sms: 'SMS',
};

const CHANNEL_CONSTRAINTS: Record<string, { maxChars?: number; maxWords?: number; notes: string }> = {
  email: { maxWords: 150, notes: 'Keep concise, 50-150 words ideal' },
  linkedin_connection: { maxChars: 300, notes: 'Must be under 300 characters' },
  linkedin_inmail: { maxWords: 200, notes: 'Keep under 200 words' },
  linkedin_message: { maxWords: 100, notes: 'Keep short and conversational' },
  phone_cold_call: { maxWords: 200, notes: 'Script for 30-60 second call opening' },
  phone_voicemail: { maxWords: 75, notes: 'Keep under 30 seconds' },
  sms: { maxChars: 160, notes: 'Standard SMS limit' },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: GenerationRequest = await req.json();
    const { 
      sequenceSteps,
      channel,
      sequenceStep,
      buyerName,
      buyerWebsite,
      targetIndustry, 
      painPoints,
      emailGoal,
      callTranscript,
      documentPaths,
      tone, 
      workspaceId,
      variationCount = 2
    } = request;

    // Build steps array - support both sequence mode and legacy single step
    const steps: SequenceStepInput[] = sequenceSteps?.length 
      ? sequenceSteps 
      : channel && sequenceStep 
        ? [{ id: 'single', channel, stepType: sequenceStep, delayDays: 0 }]
        : [];

    if (!steps.length || !workspaceId) {
      return new Response(
        JSON.stringify({ error: 'At least one step and workspaceId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get unique channels from sequence
    const uniqueChannels = [...new Set(steps.map(s => s.channel))];

    // Fetch best practices for all channels in the sequence
    const { data: bestPractices } = await supabase
      .from('channel_best_practices')
      .select('*')
      .in('channel', uniqueChannels)
      .eq('is_active', true);

    // Fetch winning patterns from copy_patterns
    const { data: winningPatterns } = await supabase
      .from('copy_patterns')
      .select('pattern_name, pattern_description, pattern_criteria, reply_rate_lift, positive_rate_lift, sample_size, confidence_level')
      .eq('workspace_id', workspaceId)
      .eq('is_validated', true)
      .order('positive_rate_lift', { ascending: false })
      .limit(5);

    // Fetch top performing copy from copy_performance view
    const { data: topCopy } = await supabase
      .from('copy_performance')
      .select('subject_line, body_preview, reply_rate, positive_reply_rate, total_sent')
      .eq('workspace_id', workspaceId)
      .gt('total_sent', 100)
      .order('positive_reply_rate', { ascending: false })
      .limit(3);

    // Fetch industry intelligence if available
    const { data: industryIntel } = await supabase
      .from('industry_intelligence')
      .select('intel_type, content, context')
      .or(`is_global.eq.true,workspace_id.eq.${workspaceId}`)
      .eq('industry', targetIndustry || 'general')
      .limit(20);

    // Format best practices for prompt
    const formatBestPractices = (practices: BestPractice[] | null, forChannel: string) => {
      if (!practices?.length) return 'No specific best practices loaded.';
      
      const channelPractices = practices.filter(p => p.channel === forChannel);
      if (!channelPractices.length) return 'No specific best practices for this channel.';
      
      const constraints = channelPractices.filter(p => p.practice_type === 'constraint');
      const patterns = channelPractices.filter(p => p.practice_type === 'pattern');
      const antiPatterns = channelPractices.filter(p => p.practice_type === 'anti_pattern');

      let result = '';
      
      if (constraints.length) {
        result += '\nConstraints:\n';
        constraints.forEach(c => {
          const cfg = c.config as Record<string, number | string>;
          result += `- ${c.name}: ${cfg.ideal_min || 0}-${cfg.ideal_max || cfg.hard_limit} ${cfg.unit || ''}\n`;
        });
      }

      if (patterns.length) {
        result += '\nWinning Patterns:\n';
        patterns.forEach(p => {
          result += `- ${p.name}: ${p.description || ''}\n`;
        });
      }

      if (antiPatterns.length) {
        result += '\nAvoid:\n';
        antiPatterns.forEach(a => {
          result += `- ${a.name}: ${a.description || ''}\n`;
        });
      }

      return result;
    };

    // Build sequence description for the prompt
    const sequenceDescription = steps.map((step, idx) => {
      const channelLabel = CHANNEL_LABELS[step.channel] || step.channel;
      const constraint = CHANNEL_CONSTRAINTS[step.channel] || { notes: '' };
      const delay = idx === 0 ? 'Day 1' : `+${step.delayDays} days`;
      return `Step ${idx + 1}: ${channelLabel} - ${step.stepType.replace('_', ' ')} (${delay})
  - Constraints: ${constraint.maxChars ? `Max ${constraint.maxChars} chars` : constraint.maxWords ? `Max ${constraint.maxWords} words` : 'Standard length'}
  - Notes: ${constraint.notes}
  ${formatBestPractices(bestPractices, step.channel)}`;
    }).join('\n\n');

    // Build the generation prompt
    const prompt = `You are an expert cold outreach copywriter. Generate a multi-channel outreach sequence with ${variationCount} variations per step.

## TARGET CONTEXT
- Buyer Company: ${buyerName || 'Not specified'}
- Buyer Website: ${buyerWebsite || 'Not specified'}
- Industry: ${targetIndustry || 'Not specified'}
- Pain Points: ${painPoints || 'Not specified'}
- Goal: ${emailGoal || 'Book a meeting'}
- Tone: ${tone || 'conversational'}

## SEQUENCE TO GENERATE (${steps.length} steps):
${sequenceDescription}

${winningPatterns?.length ? `
## YOUR WORKSPACE'S WINNING PATTERNS:
${winningPatterns.map(p => `- ${p.pattern_name}: ${p.pattern_description || ''} (+${p.reply_rate_lift || 0}% lift)`).join('\n')}
` : ''}

${topCopy?.length ? `
## YOUR TOP PERFORMING COPY:
${topCopy.map((c, i) => `${i + 1}. "${c.subject_line || 'N/A'}" - ${((c.positive_reply_rate || 0) * 100).toFixed(1)}% positive rate`).join('\n')}
` : ''}

${industryIntel?.length ? `
## INDUSTRY INTELLIGENCE:
${industryIntel.slice(0, 5).map(i => `- ${i.intel_type}: ${i.content}`).join('\n')}
` : ''}

${callTranscript ? `
## CALL TRANSCRIPT INSIGHTS (extract language patterns, objections, pain points):
${callTranscript.substring(0, 3000)}
` : ''}

## GENERATION RULES:
1. Generate ${variationCount} distinct variations for EACH step
2. Each variation must have a unique angle/hook
3. Use {first_name}, {company}, and other personalization variables
4. STRICTLY follow channel character/word limits
5. Sound human, not AI-generated
6. For email: provide subject line AND body
7. For LinkedIn connection: MUST be under 300 characters total
8. For SMS: MUST be under 160 characters
9. End each message with ONE clear CTA
10. Ensure the sequence flows naturally - reference previous touchpoints where appropriate`;

    console.log(`Generating sequence with ${steps.length} steps, ${variationCount} variations each`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an elite cold outreach copywriter. Generate multi-channel sequences that sound human and follow proven patterns. Always output structured JSON.'
          },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_sequence',
              description: 'Generate a multi-step outreach sequence with variations',
              parameters: {
                type: 'object',
                properties: {
                  steps: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        step_index: { type: 'number', description: '0-indexed step number' },
                        channel: { type: 'string' },
                        step_type: { type: 'string' },
                        delay_days: { type: 'number' },
                        variations: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              subject_line: { type: 'string', description: 'Subject line for email, opening line for other channels' },
                              body: { type: 'string', description: 'Full message body' },
                              patterns_used: { 
                                type: 'array', 
                                items: { type: 'string' }
                              },
                              quality_score: { type: 'number' },
                              word_count: { type: 'number' },
                              variation_style: { type: 'string' }
                            },
                            required: ['subject_line', 'body', 'patterns_used', 'quality_score', 'word_count', 'variation_style'],
                            additionalProperties: false
                          }
                        }
                      },
                      required: ['step_index', 'channel', 'step_type', 'delay_days', 'variations'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['steps'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_sequence' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error('No tool call response from AI');
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Validate and format each step's variations
    const validatedSteps = result.steps.map((step: Record<string, unknown>, stepIdx: number) => {
      const originalStep = steps[stepIdx];
      const constraint = CHANNEL_CONSTRAINTS[originalStep?.channel] || {};
      
      const validatedVariations = ((step.variations as Array<Record<string, unknown>>) || []).map((v, vIdx) => {
        const issues: string[] = [];
        const warnings: string[] = [];
        const wordCount = v.word_count as number;
        const body = v.body as string;

        // Check character limits
        if (constraint.maxChars && body.length > constraint.maxChars) {
          issues.push(`Exceeds ${constraint.maxChars} char limit (${body.length} chars)`);
        }

        // Check word limits
        if (constraint.maxWords && wordCount > constraint.maxWords) {
          issues.push(`Exceeds ${constraint.maxWords} word limit (${wordCount} words)`);
        }

        return {
          ...v,
          index: vIdx,
          validation: {
            is_valid: issues.length === 0,
            issues,
            warnings
          }
        };
      });

      return {
        stepIndex: stepIdx,
        channel: originalStep?.channel || step.channel,
        stepType: originalStep?.stepType || step.step_type,
        delayDays: originalStep?.delayDays ?? step.delay_days ?? 0,
        variations: validatedVariations
      };
    });

    return new Response(
      JSON.stringify({ 
        steps: validatedSteps,
        context_used: {
          best_practices_count: bestPractices?.length || 0,
          winning_patterns_count: winningPatterns?.length || 0,
          top_copy_count: topCopy?.length || 0,
          industry_intel_count: industryIntel?.length || 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating copy:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
