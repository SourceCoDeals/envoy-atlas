import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject_line, email_body, category } = await req.json();

    if (!subject_line) {
      return new Response(
        JSON.stringify({ error: 'subject_line is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const prompt = `Analyze this cold email copy and generate descriptive tags for a copy library.

SUBJECT LINE:
${subject_line}

${email_body ? `EMAIL BODY:
${email_body}` : ''}

${category ? `CATEGORY: ${category}` : ''}

Generate tags that describe:
1. TONE: The voice/tone (e.g., casual, formal, friendly, direct, intriguing, urgent)
2. TECHNIQUES: Copywriting techniques used (e.g., question-opener, social-proof, pain-point, curiosity-hook, personalization, urgency, scarcity)
3. STRUCTURE: Format/structure (e.g., short-form, long-form, bulleted, numbered, no-links, soft-cta, hard-cta)
4. PERSONALIZATION: Type of personalization (e.g., company-name, first-name, role-based, industry-specific)

Also suggest the most appropriate category and provide a quality score (0-100) based on cold email best practices.`;

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
            content: 'You are an expert cold email copywriter. Analyze email copy and generate accurate, descriptive tags.'
          },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_tags',
              description: 'Generate descriptive tags for email copy',
              parameters: {
                type: 'object',
                properties: {
                  ai_tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of descriptive tags (5-10 tags)'
                  },
                  suggested_category: {
                    type: 'string',
                    enum: ['intro', 'follow_up', 'breakup', 'meeting_request', 'value_add', 'case_study', 're_engage', 'custom'],
                    description: 'Most appropriate category for this email'
                  },
                  quality_score: {
                    type: 'number',
                    description: 'Quality score from 0-100 based on cold email best practices'
                  }
                },
                required: ['ai_tags', 'suggested_category', 'quality_score'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_tags' } }
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
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data, null, 2));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error('No tool call response from AI');
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating tags:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
