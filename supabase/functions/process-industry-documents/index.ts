import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessRequest {
  documentPaths: string[];
  callTranscript?: string;
  targetIndustry: string;
  workspaceId: string;
}

interface ExtractedIntelligence {
  painPoints: { content: string; context: string }[];
  terminology: { content: string; context: string }[];
  buyingTriggers: { content: string; context: string }[];
  objections: { content: string; context: string }[];
  languagePatterns: { content: string; context: string }[];
  competitorMentions: { content: string; context: string }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ProcessRequest = await req.json();
    const { documentPaths, callTranscript, targetIndustry, workspaceId } = request;

    if (!workspaceId || (!documentPaths?.length && !callTranscript)) {
      return new Response(
        JSON.stringify({ error: 'workspaceId and at least one document or transcript required' }),
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

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Collect all document content
    let combinedContent = '';

    // Download and extract text from documents
    if (documentPaths?.length) {
      console.log(`Processing ${documentPaths.length} documents`);
      for (const path of documentPaths) {
        try {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('industry-documents')
            .download(path);

          if (downloadError) {
            console.error(`Error downloading ${path}:`, downloadError);
            continue;
          }

          // Extract text based on file type
          const fileName = path.toLowerCase();
          let text = '';

          if (fileName.endsWith('.txt')) {
            text = await fileData.text();
          } else if (fileName.endsWith('.pdf')) {
            // For PDF, we'll pass the base64 content to the AI for extraction
            const arrayBuffer = await fileData.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            text = `[PDF Document: ${path}]\nBase64 content for AI extraction:\n${base64.substring(0, 50000)}`;
          } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
            // For Word docs, pass as base64 for AI extraction
            const arrayBuffer = await fileData.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            text = `[Word Document: ${path}]\nBase64 content for AI extraction:\n${base64.substring(0, 50000)}`;
          }

          combinedContent += `\n\n--- DOCUMENT: ${path} ---\n${text}`;
        } catch (err) {
          console.error(`Error processing ${path}:`, err);
        }
      }
    }

    // Add call transcript
    if (callTranscript) {
      combinedContent += `\n\n--- CALL TRANSCRIPT ---\n${callTranscript}`;
    }

    if (!combinedContent.trim()) {
      return new Response(
        JSON.stringify({ error: 'No content could be extracted from documents' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending ${combinedContent.length} chars to AI for extraction`);

    // Use AI to extract structured intelligence
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
            content: `You are an expert at extracting sales and marketing intelligence from documents and call transcripts. 
Your job is to identify specific, actionable insights that can be used to write better cold outreach copy.

Focus on extracting:
1. PAIN POINTS - Specific challenges, problems, frustrations mentioned
2. TERMINOLOGY - Industry-specific jargon, acronyms, phrases used by prospects
3. BUYING TRIGGERS - Events or situations that cause prospects to consider purchasing
4. OBJECTIONS - Concerns, pushback, reasons for not buying
5. LANGUAGE PATTERNS - How prospects phrase things, their communication style
6. COMPETITOR MENTIONS - References to competing solutions or vendors

For each item, provide:
- The exact content/phrase/insight
- Brief context about where/how it was mentioned

Be specific and verbatim where possible. Quality over quantity.`
          },
          {
            role: 'user',
            content: `Extract industry intelligence from the following content for the ${targetIndustry || 'general'} industry:\n\n${combinedContent.substring(0, 100000)}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_intelligence',
              description: 'Extract structured intelligence from documents and transcripts',
              parameters: {
                type: 'object',
                properties: {
                  painPoints: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        content: { type: 'string', description: 'The pain point or challenge' },
                        context: { type: 'string', description: 'Where/how this was mentioned' }
                      },
                      required: ['content', 'context'],
                      additionalProperties: false
                    }
                  },
                  terminology: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        content: { type: 'string', description: 'Industry term, acronym, or phrase' },
                        context: { type: 'string', description: 'How it was used in context' }
                      },
                      required: ['content', 'context'],
                      additionalProperties: false
                    }
                  },
                  buyingTriggers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        content: { type: 'string', description: 'Event or situation that triggers buying' },
                        context: { type: 'string', description: 'Context or examples' }
                      },
                      required: ['content', 'context'],
                      additionalProperties: false
                    }
                  },
                  objections: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        content: { type: 'string', description: 'The objection or concern' },
                        context: { type: 'string', description: 'How the prospect phrased it' }
                      },
                      required: ['content', 'context'],
                      additionalProperties: false
                    }
                  },
                  languagePatterns: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        content: { type: 'string', description: 'Phrase or communication pattern' },
                        context: { type: 'string', description: 'Usage context' }
                      },
                      required: ['content', 'context'],
                      additionalProperties: false
                    }
                  },
                  competitorMentions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        content: { type: 'string', description: 'Competitor name or solution' },
                        context: { type: 'string', description: 'How it was mentioned' }
                      },
                      required: ['content', 'context'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['painPoints', 'terminology', 'buyingTriggers', 'objections', 'languagePatterns', 'competitorMentions'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_intelligence' } }
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error('No extraction result from AI');
    }

    const extracted: ExtractedIntelligence = JSON.parse(toolCall.function.arguments);
    console.log('Extracted intelligence:', JSON.stringify({
      painPoints: extracted.painPoints?.length || 0,
      terminology: extracted.terminology?.length || 0,
      buyingTriggers: extracted.buyingTriggers?.length || 0,
      objections: extracted.objections?.length || 0,
      languagePatterns: extracted.languagePatterns?.length || 0,
      competitorMentions: extracted.competitorMentions?.length || 0
    }));

    // Store extracted intelligence in database
    const intelRecords: Array<{
      workspace_id: string;
      industry: string;
      intel_type: string;
      content: string;
      context: string;
      source_document: string;
      created_by: string | null;
      is_global: boolean;
    }> = [];

    const sourceDoc = documentPaths?.join(', ') || 'call_transcript';
    const intelTypes = [
      { key: 'painPoints', type: 'pain_point' },
      { key: 'terminology', type: 'terminology' },
      { key: 'buyingTriggers', type: 'buying_trigger' },
      { key: 'objections', type: 'objection' },
      { key: 'languagePatterns', type: 'language_pattern' },
      { key: 'competitorMentions', type: 'competitor_mention' },
    ];

    for (const { key, type } of intelTypes) {
      const items = extracted[key as keyof ExtractedIntelligence] || [];
      for (const item of items) {
        intelRecords.push({
          workspace_id: workspaceId,
          industry: targetIndustry || 'general',
          intel_type: type,
          content: item.content,
          context: item.context,
          source_document: sourceDoc,
          created_by: userId,
          is_global: false
        });
      }
    }

    if (intelRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('industry_intelligence')
        .insert(intelRecords);

      if (insertError) {
        console.error('Error inserting intelligence:', insertError);
        // Continue anyway - we'll return the extracted data
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        extracted,
        stored_count: intelRecords.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing documents:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
