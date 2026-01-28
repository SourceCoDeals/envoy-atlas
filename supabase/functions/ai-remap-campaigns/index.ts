import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Engagement {
  id: string;
  name: string;
  portfolio_company: string | null;
  sponsor_name: string | null;
}

interface Campaign {
  id: string;
  name: string;
  engagement_id: string;
  total_sent: number;
  status: string | null;
}

interface ProposedMapping {
  campaignId: string;
  campaignName: string;
  currentEngagementId: string;
  currentEngagementName: string;
  proposedEngagementId: string;
  proposedEngagementName: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  totalSent: number;
  status: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspace_id, dry_run = true, apply_mappings, auto_apply = false, offset = 0 } = await req.json();

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If apply_mappings is provided, apply them and return
    if (apply_mappings && Array.isArray(apply_mappings) && apply_mappings.length > 0) {
      console.log(`Applying ${apply_mappings.length} campaign mappings...`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const mapping of apply_mappings) {
        const { error } = await supabase
          .from('campaigns')
          .update({ engagement_id: mapping.proposedEngagementId })
          .eq('id', mapping.campaignId);
        
        if (error) {
          console.error(`Failed to update campaign ${mapping.campaignId}:`, error);
          errorCount++;
        } else {
          successCount++;
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          applied: successCount, 
          errors: errorCount 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all engagements for this workspace
    const { data: engagements, error: engError } = await supabase
      .from('engagements')
      .select('id, name, portfolio_company, sponsor_name')
      .eq('client_id', workspace_id)
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Exclude unassigned placeholder

    if (engError) {
      throw new Error(`Failed to fetch engagements: ${engError.message}`);
    }

    if (!engagements || engagements.length === 0) {
      return new Response(
        JSON.stringify({ error: "No engagements found for this workspace" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${engagements.length} engagements`);

    // Fetch ALL campaigns for this workspace (via engagements)
    const engagementIds = engagements.map(e => e.id);
    
    // Also fetch campaigns from unassigned placeholder
    const { data: allCampaigns, error: campError } = await supabase
      .from('campaigns')
      .select('id, name, engagement_id, total_sent, status')
      .or(`engagement_id.in.(${engagementIds.join(',')}),engagement_id.eq.00000000-0000-0000-0000-000000000000`)
      .order('total_sent', { ascending: false });

    if (campError) {
      throw new Error(`Failed to fetch campaigns: ${campError.message}`);
    }

    console.log(`Found ${allCampaigns?.length || 0} campaigns`);

    if (!allCampaigns || allCampaigns.length === 0) {
      return new Response(
        JSON.stringify({ proposedMappings: [], message: "No campaigns found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build engagement lookup for current assignment names
    const engagementMap = new Map<string, Engagement>();
    for (const e of engagements) {
      engagementMap.set(e.id, e);
    }
    engagementMap.set('00000000-0000-0000-0000-000000000000', {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Unassigned',
      portfolio_company: null,
      sponsor_name: null
    });

    // Format engagements for AI prompt
    const engagementList = engagements.map(e => ({
      id: e.id,
      name: e.name,
      portfolio: e.portfolio_company || '',
      sponsor: e.sponsor_name || ''
    }));

    // Process campaigns in batches to avoid rate limits
    const BATCH_SIZE = 50;
    const proposedMappings: ProposedMapping[] = [];
    
    // Limit total campaigns processed to avoid timeout, with offset for pagination
    const CAMPAIGNS_PER_RUN = 200;
    const campaignsToProcess = allCampaigns.slice(offset, offset + CAMPAIGNS_PER_RUN);
    
    console.log(`Processing campaigns ${offset} to ${offset + campaignsToProcess.length} (of ${allCampaigns.length} total)`);
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Processing ${campaignsToProcess.length} campaigns in batches of ${BATCH_SIZE}`);
    
    for (let i = 0; i < campaignsToProcess.length; i += BATCH_SIZE) {
      const batch = campaignsToProcess.slice(i, i + BATCH_SIZE);
      
      const campaignNames = batch.map(c => ({
        id: c.id,
        name: c.name,
        currentEngagementId: c.engagement_id
      }));

      const prompt = `You are a data analyst helping to map email campaigns to their correct business engagements.

## Available Engagements
${JSON.stringify(engagementList, null, 2)}

## Campaign Names to Analyze
${JSON.stringify(campaignNames, null, 2)}

## Pattern Recognition Rules
Campaign names typically follow this structure:
1. First segment = Sponsor name (e.g., "Baum", "Alpine", "GP Partners", "Trivest", "Trinity", "Stadion", "Verde", "Arch City", "HTR")
2. Second segment = Portfolio company or service type (e.g., "Property Management", "Windows & Doors", "Collision", "HVAC")
3. Remaining segments = Rep initials (SD, JT, etc.), tier indicators, variations

## Your Task
For EACH campaign, determine the best matching engagement based on:
- Sponsor name match (strongest signal)
- Portfolio company name match
- Service type/industry keywords

Return a JSON array with one object per campaign:
{
  "mappings": [
    {
      "campaignId": "uuid",
      "proposedEngagementId": "uuid or null if no match",
      "confidence": "high|medium|low",
      "reasoning": "Brief explanation of why this match was made"
    }
  ]
}

Use "high" confidence when sponsor AND portfolio clearly match.
Use "medium" confidence when only sponsor matches.
Use "low" confidence when the match is uncertain.
Return null for proposedEngagementId if no reasonable match exists.`;

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a precise data analyst. Return only valid JSON." },
              { role: "user", content: prompt }
            ],
            temperature: 0.1,
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            console.warn("Rate limited, waiting before retry...");
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          const errorText = await response.text();
          console.error(`AI API error: ${response.status} - ${errorText}`);
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        
        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const mappings = parsed.mappings || parsed;

          for (const mapping of mappings) {
            const campaign = batch.find(c => c.id === mapping.campaignId);
            if (!campaign || !mapping.proposedEngagementId) continue;
            
            // Skip if already correctly assigned
            if (campaign.engagement_id === mapping.proposedEngagementId) continue;

            const currentEng = engagementMap.get(campaign.engagement_id);
            const proposedEng = engagementMap.get(mapping.proposedEngagementId);

            if (proposedEng) {
              proposedMappings.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                currentEngagementId: campaign.engagement_id,
                currentEngagementName: currentEng?.name || 'Unknown',
                proposedEngagementId: mapping.proposedEngagementId,
                proposedEngagementName: proposedEng.name,
                confidence: mapping.confidence || 'low',
                reasoning: mapping.reasoning || '',
                totalSent: campaign.total_sent || 0,
                status: campaign.status
              });
            }
          }
        } catch (parseErr) {
          console.error("Failed to parse AI response:", parseErr, content);
        }
      } catch (fetchErr) {
        console.error("Failed to call AI:", fetchErr);
      }

      // Small delay between batches
      if (i + BATCH_SIZE < campaignsToProcess.length) {
        console.log(`Batch ${Math.floor(i/BATCH_SIZE) + 1} complete. ${proposedMappings.length} mappings so far.`);
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Sort by confidence (high first) then by total_sent
    proposedMappings.sort((a, b) => {
      const confOrder = { high: 3, medium: 2, low: 1 };
      const confDiff = (confOrder[b.confidence] || 0) - (confOrder[a.confidence] || 0);
      if (confDiff !== 0) return confDiff;
      return b.totalSent - a.totalSent;
    });

    console.log(`Generated ${proposedMappings.length} proposed remappings`);

    // Auto-apply high confidence mappings if requested
    let applied = 0;
    let errors = 0;
    if (auto_apply) {
      const highConfidenceMappings = proposedMappings.filter(m => m.confidence === 'high');
      console.log(`Auto-applying ${highConfidenceMappings.length} high-confidence mappings...`);
      
      for (const mapping of highConfidenceMappings) {
        const { error } = await supabase
          .from('campaigns')
          .update({ engagement_id: mapping.proposedEngagementId })
          .eq('id', mapping.campaignId);
        
        if (error) {
          console.error(`Failed to update campaign ${mapping.campaignId}:`, error);
          errors++;
        } else {
          applied++;
        }
      }
      console.log(`Applied ${applied} mappings, ${errors} errors`);
    }

    const hasMore = offset + campaignsToProcess.length < allCampaigns.length;

    return new Response(
      JSON.stringify({
        proposedMappings,
        totalCampaigns: allCampaigns.length,
        totalEngagements: engagements.length,
        dryRun: dry_run,
        applied,
        errors,
        offset,
        processedCount: campaignsToProcess.length,
        hasMore,
        nextOffset: hasMore ? offset + CAMPAIGNS_PER_RUN : null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ai-remap-campaigns error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
