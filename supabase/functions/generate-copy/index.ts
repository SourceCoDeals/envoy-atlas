import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerationRequest {
  channel: string;
  sequenceStep: string;
  buyerName?: string;
  buyerWebsite?: string;
  targetIndustry?: string;
  painPoints?: string;
  emailGoal?: string;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: GenerationRequest = await req.json();
    const { 
      channel, 
      sequenceStep, 
      buyerName,
      buyerWebsite,
      targetIndustry, 
      painPoints,
      emailGoal,
      tone, 
      workspaceId,
      variationCount = 3
    } = request;

    if (!channel || !sequenceStep || !workspaceId) {
      return new Response(
        JSON.stringify({ error: 'channel, sequenceStep, and workspaceId are required' }),
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

    // Fetch best practices for the channel
    const { data: bestPractices } = await supabase
      .from('channel_best_practices')
      .select('*')
      .eq('channel', channel)
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
    const formatBestPractices = (practices: BestPractice[] | null) => {
      if (!practices?.length) return 'No specific best practices loaded.';
      
      const constraints = practices.filter(p => p.practice_type === 'constraint');
      const patterns = practices.filter(p => p.practice_type === 'pattern');
      const antiPatterns = practices.filter(p => p.practice_type === 'anti_pattern');
      const structures = practices.filter(p => p.practice_type === 'structure');

      let result = '';
      
      if (constraints.length) {
        result += '\n**CONSTRAINTS (Must Follow):**\n';
        constraints.forEach(c => {
          const cfg = c.config as Record<string, number | string>;
          result += `- ${c.name}: ${cfg.ideal_min || 0}-${cfg.ideal_max || cfg.hard_limit} ${cfg.unit || ''} (max: ${cfg.hard_limit || 'N/A'})\n`;
        });
      }

      if (patterns.length) {
        result += '\n**WINNING PATTERNS (Use These):**\n';
        patterns.forEach(p => {
          const cfg = p.config as Record<string, string>;
          result += `- ${p.name}: ${p.description || ''} (${p.performance_lift ? `+${p.performance_lift}% lift` : 'proven effective'})\n`;
          if (cfg.example) result += `  Example: "${cfg.example}"\n`;
        });
      }

      if (antiPatterns.length) {
        result += '\n**ANTI-PATTERNS (Never Use):**\n';
        antiPatterns.forEach(a => {
          const cfg = a.config as Record<string, string | string[]>;
          result += `- ${a.name}: ${a.description || ''} (${a.performance_lift ? `${a.performance_lift}% drag` : 'hurts performance'})\n`;
          if (cfg.example) result += `  Bad Example: "${cfg.example}"\n`;
          if (cfg.words) result += `  Avoid words: ${(cfg.words as string[]).join(', ')}\n`;
        });
      }

      if (structures.length) {
        const stepStructure = structures.find(s => s.name === sequenceStep.replace('_', ' ')) || structures[0];
        if (stepStructure) {
          const cfg = stepStructure.config as Record<string, string[] | number[]>;
          result += '\n**RECOMMENDED STRUCTURE:**\n';
          if (cfg.lines) {
            (cfg.lines as string[]).forEach((line, i) => {
              result += `${i + 1}. ${line}\n`;
            });
          }
          if (cfg.word_range) {
            result += `Target length: ${cfg.word_range[0]}-${cfg.word_range[1]} words\n`;
          }
        }
      }

      return result;
    };

    // Build the generation prompt
    const prompt = `You are an expert cold outreach copywriter. Generate ${variationCount} ${channel.replace('_', ' ')} variations for a ${sequenceStep.replace('_', ' ')} message.

## TARGET CONTEXT
- Buyer Company: ${buyerName || 'Not specified'}
- Buyer Website: ${buyerWebsite || 'Not specified'}
- Industry: ${targetIndustry || 'Not specified'}
- Pain Points: ${painPoints || 'Not specified'}
- Goal of Email: ${emailGoal || 'Book a meeting'}
- Tone: ${tone || 'conversational'}

## CHANNEL: ${channel.toUpperCase()}
## STEP: ${sequenceStep.toUpperCase()}

${formatBestPractices(bestPractices)}

${winningPatterns?.length ? `
## YOUR WORKSPACE'S WINNING PATTERNS:
${winningPatterns.map(p => `- ${p.pattern_name}: ${p.pattern_description || ''} (+${p.reply_rate_lift || 0}% reply lift, ${p.sample_size} samples, ${p.confidence_level} confidence)`).join('\n')}
` : ''}

${topCopy?.length ? `
## YOUR TOP PERFORMING COPY:
${topCopy.map((c, i) => `
${i + 1}. Subject: "${c.subject_line || 'N/A'}"
   Preview: "${(c.body_preview || '').substring(0, 100)}..."
   Performance: ${((c.reply_rate || 0) * 100).toFixed(1)}% reply, ${((c.positive_reply_rate || 0) * 100).toFixed(1)}% positive (${c.total_sent} sent)
`).join('')}
` : ''}

${industryIntel?.length ? `
## INDUSTRY INTELLIGENCE:
${industryIntel.map(i => `- ${i.intel_type}: ${i.content}`).join('\n')}
` : ''}

## GENERATION RULES:
1. Each variation must be unique in approach (different hook, angle, or CTA)
2. Use {first_name}, {company}, and other personalization variables
3. Follow all constraints strictly
4. Sound human, not AI-generated - no corporate buzzwords
5. Keep it scannable with short paragraphs
6. End with ONE clear CTA
7. For email: provide both subject line AND body

Generate ${variationCount} distinct variations. For each, include:
- The subject line (if email) or opening (if other channel)
- The full message body
- The specific patterns/techniques used
- A quality score estimate (0-100)`;

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
            content: `You are an elite cold outreach copywriter. You generate high-converting copy that sounds human and follows proven patterns. Always output structured JSON.`
          },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_copy_variations',
              description: 'Generate copy variations with metadata',
              parameters: {
                type: 'object',
                properties: {
                  variations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        subject_line: { type: 'string', description: 'Subject line for email, or first line for other channels' },
                        body: { type: 'string', description: 'Full message body' },
                        patterns_used: { 
                          type: 'array', 
                          items: { type: 'string' },
                          description: 'List of patterns/techniques used'
                        },
                        quality_score: { type: 'number', description: 'Quality score 0-100' },
                        word_count: { type: 'number', description: 'Total word count' },
                        variation_style: { type: 'string', description: 'Brief label: e.g., "Direct", "Curiosity-driven", "Social proof"' }
                      },
                      required: ['subject_line', 'body', 'patterns_used', 'quality_score', 'word_count', 'variation_style'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['variations'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_copy_variations' } }
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

    // Validate each variation against constraints
    const validatedVariations = result.variations.map((v: Record<string, unknown>, index: number) => {
      const issues: string[] = [];
      const warnings: string[] = [];

      // Check constraints
      const bodyConstraint = bestPractices?.find(p => p.category === 'body' && p.name === 'word_limit');
      if (bodyConstraint) {
        const cfg = bodyConstraint.config as Record<string, number>;
        const wordCount = v.word_count as number;
        if (cfg.hard_limit && wordCount > cfg.hard_limit) {
          issues.push(`Word count (${wordCount}) exceeds limit (${cfg.hard_limit})`);
        } else if (cfg.warning_threshold && wordCount > cfg.warning_threshold) {
          warnings.push(`Word count (${wordCount}) approaching limit`);
        }
      }

      const subjectConstraint = bestPractices?.find(p => p.category === 'subject_line' && p.name === 'character_limit');
      if (subjectConstraint && v.subject_line) {
        const cfg = subjectConstraint.config as Record<string, number>;
        const charCount = (v.subject_line as string).length;
        if (cfg.hard_limit && charCount > cfg.hard_limit) {
          issues.push(`Subject (${charCount} chars) exceeds limit (${cfg.hard_limit})`);
        } else if (cfg.warning_threshold && charCount > cfg.warning_threshold) {
          warnings.push(`Subject approaching limit (${charCount}/${cfg.hard_limit})`);
        }
      }

      return {
        ...v,
        index,
        validation: {
          is_valid: issues.length === 0,
          issues,
          warnings
        }
      };
    });

    // Sort by quality score
    validatedVariations.sort((a: Record<string, unknown>, b: Record<string, unknown>) => 
      (b.quality_score as number) - (a.quality_score as number)
    );

    return new Response(
      JSON.stringify({ 
        variations: validatedVariations,
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
