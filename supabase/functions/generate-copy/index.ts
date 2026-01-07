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
  sequenceSteps?: SequenceStepInput[];
  channel?: string;
  sequenceStep?: string;
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

// Complete channel constraints matrix with ideal ranges and hard limits
interface ChannelConstraint {
  hardLimit: { chars?: number; words?: number };
  idealRange: { min: number; max: number; unit: 'chars' | 'words' };
  subjectLimit?: { chars: number; idealRange: { min: number; max: number } };
  readingGrade?: { ideal: { min: number; max: number }; max: number };
  paragraphLimit?: number;
  notes: string;
}

const CHANNEL_CONSTRAINTS: Record<string, ChannelConstraint> = {
  email: {
    hardLimit: { words: 200 },
    idealRange: { min: 50, max: 120, unit: 'words' },
    subjectLimit: { chars: 80, idealRange: { min: 40, max: 60 } },
    readingGrade: { ideal: { min: 6, max: 8 }, max: 12 },
    paragraphLimit: 5,
    notes: 'Keep concise, 50-120 words ideal. Subject 40-60 chars. 6th-8th grade reading level.'
  },
  linkedin_connection: {
    hardLimit: { chars: 300 },
    idealRange: { min: 200, max: 280, unit: 'chars' },
    notes: 'MUST be under 300 characters total. Be personal and brief.'
  },
  linkedin_inmail: {
    hardLimit: { words: 300 },
    idealRange: { min: 100, max: 200, unit: 'words' },
    subjectLimit: { chars: 200, idealRange: { min: 30, max: 60 } },
    notes: 'Keep under 200 words. Subject line important for open rates.'
  },
  linkedin_message: {
    hardLimit: { words: 150 },
    idealRange: { min: 50, max: 100, unit: 'words' },
    notes: 'Keep short and conversational. Already connected, be casual.'
  },
  phone_cold_call: {
    hardLimit: { words: 250 },
    idealRange: { min: 100, max: 180, unit: 'words' },
    notes: 'Script for 30-60 second call opening. Get to point quickly.'
  },
  phone_voicemail: {
    hardLimit: { words: 75 },
    idealRange: { min: 50, max: 70, unit: 'words' },
    notes: 'Keep under 30 seconds. Clear CTA and callback number.'
  },
  sms: {
    hardLimit: { chars: 160 },
    idealRange: { min: 120, max: 155, unit: 'chars' },
    notes: 'Standard SMS limit. No emojis, clear CTA.'
  },
};

// Spam words to avoid
const SPAM_WORDS = [
  'free', 'guarantee', 'no obligation', 'act now', 'limited time',
  'once in a lifetime', 'winner', 'congratulations', 'urgent',
  'click here', 'buy now', 'order now', 'subscribe', 'deal',
  '100%', 'amazing', 'incredible', 'revolutionary', 'exclusive offer',
  'risk free', 'no cost', 'lowest price', 'save big', 'bonus',
];

// Calculate quality score for a variation
function calculateQualityScore(
  body: string,
  subjectLine: string | undefined,
  channel: string,
  patternsUsed: string[]
): { score: number; breakdown: { constraints: number; patterns: number; spam: number; readability: number }; issues: string[]; warnings: string[] } {
  const constraint = CHANNEL_CONSTRAINTS[channel];
  if (!constraint) {
    return { score: 75, breakdown: { constraints: 30, patterns: 20, spam: 15, readability: 10 }, issues: [], warnings: [] };
  }

  const issues: string[] = [];
  const warnings: string[] = [];
  let constraintScore = 40;
  let patternScore = 0;
  let spamScore = 15;
  let readabilityScore = 15;

  // Count words and chars
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const charCount = body.length;
  const subjectCharCount = subjectLine?.length || 0;

  // Constraint scoring (40 points max)
  if (constraint.hardLimit.words && wordCount > constraint.hardLimit.words) {
    constraintScore = 0;
    issues.push(`Exceeds ${constraint.hardLimit.words} word limit (${wordCount} words)`);
  } else if (constraint.hardLimit.chars && charCount > constraint.hardLimit.chars) {
    constraintScore = 0;
    issues.push(`Exceeds ${constraint.hardLimit.chars} char limit (${charCount} chars)`);
  } else {
    // Score based on ideal range
    const unit = constraint.idealRange.unit;
    const value = unit === 'words' ? wordCount : charCount;
    const { min, max } = constraint.idealRange;

    if (value >= min && value <= max) {
      constraintScore = 40; // Perfect range
    } else if (value < min) {
      const deficit = (min - value) / min;
      constraintScore = Math.max(20, 40 - Math.floor(deficit * 20));
      warnings.push(`Below ideal ${unit} count (${value}/${min}-${max})`);
    } else {
      const excess = (value - max) / max;
      constraintScore = Math.max(15, 40 - Math.floor(excess * 25));
      warnings.push(`Above ideal ${unit} count (${value}/${min}-${max})`);
    }
  }

  // Subject line check
  if (constraint.subjectLimit && subjectLine) {
    if (subjectCharCount > constraint.subjectLimit.chars) {
      constraintScore = Math.max(0, constraintScore - 10);
      issues.push(`Subject exceeds ${constraint.subjectLimit.chars} char limit`);
    } else if (subjectCharCount < constraint.subjectLimit.idealRange.min) {
      warnings.push(`Subject below ideal length (${subjectCharCount}/${constraint.subjectLimit.idealRange.min}-${constraint.subjectLimit.idealRange.max})`);
    } else if (subjectCharCount > constraint.subjectLimit.idealRange.max) {
      warnings.push(`Subject above ideal length (${subjectCharCount}/${constraint.subjectLimit.idealRange.min}-${constraint.subjectLimit.idealRange.max})`);
    }
  }

  // Pattern scoring (30 points max)
  patternScore = Math.min(30, patternsUsed.length * 10);

  // Spam word detection (15 points max, deduct for each spam word)
  const lowerBody = body.toLowerCase();
  const lowerSubject = (subjectLine || '').toLowerCase();
  const fullText = `${lowerSubject} ${lowerBody}`;
  
  let spamWordCount = 0;
  for (const word of SPAM_WORDS) {
    if (fullText.includes(word.toLowerCase())) {
      spamWordCount++;
    }
  }
  
  if (spamWordCount > 0) {
    spamScore = Math.max(0, 15 - spamWordCount * 5);
    if (spamWordCount >= 3) {
      warnings.push(`Contains ${spamWordCount} potential spam triggers`);
    }
  }

  // Check for excessive punctuation/caps
  const capsRatio = (body.match(/[A-Z]/g)?.length || 0) / body.length;
  const exclamationCount = (body.match(/!/g)?.length || 0);
  if (capsRatio > 0.3) {
    spamScore = Math.max(0, spamScore - 5);
    warnings.push('Excessive capitalization detected');
  }
  if (exclamationCount > 2) {
    spamScore = Math.max(0, spamScore - 3);
    warnings.push('Multiple exclamation marks detected');
  }

  // Readability scoring (15 points max) - simplified Flesch-Kincaid approximation
  const sentences = body.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const avgWordsPerSentence = wordCount / Math.max(1, sentences);
  
  if (constraint.readingGrade) {
    // Simplified: ideal is 15-20 words per sentence for 6-8 grade level
    if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 20) {
      readabilityScore = 15;
    } else if (avgWordsPerSentence < 10) {
      readabilityScore = 12; // A bit choppy but fine
    } else if (avgWordsPerSentence <= 25) {
      readabilityScore = 10;
      warnings.push('Sentences may be too long');
    } else {
      readabilityScore = 5;
      warnings.push('Very long sentences - consider breaking up');
    }
  }

  const totalScore = constraintScore + patternScore + spamScore + readabilityScore;

  return {
    score: totalScore,
    breakdown: {
      constraints: constraintScore,
      patterns: patternScore,
      spam: spamScore,
      readability: readabilityScore
    },
    issues,
    warnings
  };
}

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const uniqueChannels = [...new Set(steps.map(s => s.channel))];

    // Fetch best practices
    const { data: bestPractices } = await supabase
      .from('channel_best_practices')
      .select('*')
      .in('channel', uniqueChannels)
      .eq('is_active', true);

    // Fetch winning patterns
    const { data: winningPatterns } = await supabase
      .from('copy_patterns')
      .select('pattern_name, pattern_description, pattern_criteria, reply_rate_lift, positive_rate_lift, sample_size, confidence_level')
      .eq('workspace_id', workspaceId)
      .eq('is_validated', true)
      .order('positive_rate_lift', { ascending: false })
      .limit(5);

    // Fetch top performing copy
    const { data: topCopy } = await supabase
      .from('copy_performance')
      .select('subject_line, body_preview, reply_rate, positive_reply_rate, total_sent')
      .eq('workspace_id', workspaceId)
      .gt('total_sent', 100)
      .order('positive_reply_rate', { ascending: false })
      .limit(3);

    // Fetch industry intelligence (including processed documents)
    const { data: industryIntel } = await supabase
      .from('industry_intelligence')
      .select('intel_type, content, context')
      .or(`is_global.eq.true,workspace_id.eq.${workspaceId}`)
      .eq('industry', targetIndustry || 'general')
      .limit(30);

    // Group industry intel by type
    const groupedIntel: Record<string, Array<{ content: string; context: string | null }>> = {};
    if (industryIntel?.length) {
      for (const item of industryIntel) {
        if (!groupedIntel[item.intel_type]) {
          groupedIntel[item.intel_type] = [];
        }
        groupedIntel[item.intel_type].push({ content: item.content, context: item.context });
      }
    }

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

    // Build sequence description with enhanced constraints
    const sequenceDescription = steps.map((step, idx) => {
      const channelLabel = CHANNEL_LABELS[step.channel] || step.channel;
      const constraint = CHANNEL_CONSTRAINTS[step.channel];
      const delay = idx === 0 ? 'Day 1' : `+${step.delayDays} days`;
      
      let constraintInfo = '';
      if (constraint) {
        if (constraint.hardLimit.chars) {
          constraintInfo = `HARD LIMIT: ${constraint.hardLimit.chars} chars. Ideal: ${constraint.idealRange.min}-${constraint.idealRange.max} chars.`;
        } else if (constraint.hardLimit.words) {
          constraintInfo = `HARD LIMIT: ${constraint.hardLimit.words} words. Ideal: ${constraint.idealRange.min}-${constraint.idealRange.max} words.`;
        }
        if (constraint.subjectLimit) {
          constraintInfo += ` Subject: ${constraint.subjectLimit.idealRange.min}-${constraint.subjectLimit.idealRange.max} chars (max ${constraint.subjectLimit.chars}).`;
        }
      }
      
      return `Step ${idx + 1}: ${channelLabel} - ${step.stepType.replace('_', ' ')} (${delay})
  - ${constraintInfo}
  - Guidelines: ${constraint?.notes || 'Standard length'}
  ${formatBestPractices(bestPractices, step.channel)}`;
    }).join('\n\n');

    // Build industry intel section
    let industryIntelSection = '';
    if (Object.keys(groupedIntel).length > 0) {
      industryIntelSection = '\n## EXTRACTED INDUSTRY INTELLIGENCE:\n';
      
      if (groupedIntel['pain_point']?.length) {
        industryIntelSection += '\nPAIN POINTS (use these exact phrases when relevant):\n';
        groupedIntel['pain_point'].slice(0, 5).forEach(p => {
          industryIntelSection += `- "${p.content}"\n`;
        });
      }
      
      if (groupedIntel['terminology']?.length) {
        industryIntelSection += '\nINDUSTRY TERMINOLOGY (use naturally):\n';
        groupedIntel['terminology'].slice(0, 5).forEach(t => {
          industryIntelSection += `- ${t.content}\n`;
        });
      }
      
      if (groupedIntel['buying_trigger']?.length) {
        industryIntelSection += '\nBUYING TRIGGERS (reference when applicable):\n';
        groupedIntel['buying_trigger'].slice(0, 3).forEach(b => {
          industryIntelSection += `- ${b.content}\n`;
        });
      }
      
      if (groupedIntel['objection']?.length) {
        industryIntelSection += '\nCOMMON OBJECTIONS (preemptively address):\n';
        groupedIntel['objection'].slice(0, 3).forEach(o => {
          industryIntelSection += `- ${o.content}\n`;
        });
      }
      
      if (groupedIntel['language_pattern']?.length) {
        industryIntelSection += '\nLANGUAGE PATTERNS (mirror this style):\n';
        groupedIntel['language_pattern'].slice(0, 3).forEach(l => {
          industryIntelSection += `- "${l.content}"\n`;
        });
      }
    }

    // Build the generation prompt with enhanced instructions
    const prompt = `You are an elite cold outreach copywriter. Generate a multi-channel outreach sequence with ${variationCount} variations per step.

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

${industryIntelSection}

${callTranscript ? `
## CALL TRANSCRIPT INSIGHTS (extract language patterns, objections, pain points):
${callTranscript.substring(0, 3000)}
` : ''}

## CRITICAL GENERATION RULES:
1. Generate ${variationCount} distinct variations for EACH step
2. Each variation must have a unique angle/hook
3. Use {first_name}, {company}, and other personalization variables
4. **STRICTLY** follow channel character/word limits - THIS IS CRITICAL
5. Sound human, not AI-generated. Write like a real person.
6. For email: provide subject line AND body
7. For LinkedIn connection: MUST be under 300 characters total - COUNT CAREFULLY
8. For SMS: MUST be under 160 characters - COUNT CAREFULLY
9. For voicemail: MUST be under 75 words (30 seconds)
10. End each message with ONE clear CTA
11. Ensure the sequence flows naturally - reference previous touchpoints where appropriate
12. AVOID SPAM WORDS: ${SPAM_WORDS.slice(0, 10).join(', ')}, etc.
13. Use conversational, simple language (6th-8th grade reading level)
14. For Step 2+, vary the angle but maintain narrative consistency

## PERSONALIZATION VARIABLES:
- {first_name} - Prospect's first name
- {company} - Prospect's company name
- {title} - Prospect's job title
- {industry} - Their industry
- {pain_point} - Specific pain point if known`;

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
            content: 'You are an elite cold outreach copywriter. Generate multi-channel sequences that sound human and follow proven patterns. Always output structured JSON. CRITICAL: Respect all character and word limits exactly.'
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
                              variation_style: { type: 'string' }
                            },
                            required: ['subject_line', 'body', 'patterns_used', 'variation_style'],
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

    // Validate and score each step's variations
    const validatedSteps = result.steps.map((step: Record<string, unknown>, stepIdx: number) => {
      const originalStep = steps[stepIdx];
      
      const validatedVariations = ((step.variations as Array<Record<string, unknown>>) || []).map((v, vIdx) => {
        const body = (v.body as string) || '';
        const subjectLine = v.subject_line as string | undefined;
        const patternsUsed = (v.patterns_used as string[]) || [];
        const wordCount = body.split(/\s+/).filter(Boolean).length;
        const charCount = body.length;

        // Calculate quality score
        const scoring = calculateQualityScore(body, subjectLine, originalStep?.channel || '', patternsUsed);

        return {
          index: vIdx,
          subject_line: subjectLine,
          body,
          patterns_used: patternsUsed,
          quality_score: scoring.score,
          quality_breakdown: scoring.breakdown,
          word_count: wordCount,
          char_count: charCount,
          variation_style: v.variation_style || `Variation ${vIdx + 1}`,
          validation: {
            is_valid: scoring.issues.length === 0,
            issues: scoring.issues,
            warnings: scoring.warnings
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
