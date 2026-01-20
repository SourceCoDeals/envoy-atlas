import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoPairResult {
  campaignsLinked: number;
  campaignsSkipped: number;
  skippedReasons: { name: string; reason: string }[];
  details: { engagement: string; campaigns: string[] }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { client_id, dry_run = false } = await req.json() as { 
      client_id: string;
      dry_run?: boolean;
    };

    if (!client_id) {
      return new Response(
        JSON.stringify({ error: 'Missing client_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Auto-pairing campaigns for client ${client_id}, dry_run: ${dry_run}`);

    // Fetch all campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, engagement_id')
      .order('name');

    if (campaignsError) {
      throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`);
    }

    // Fetch existing engagements
    const { data: existingEngagements, error: engagementsError } = await supabase
      .from('engagements')
      .select('id, name, sponsor_name, portfolio_company, industry, status')
      .eq('client_id', client_id);

    if (engagementsError) {
      throw new Error(`Failed to fetch engagements: ${engagementsError.message}`);
    }

    console.log(`Found ${campaigns?.length || 0} campaigns and ${existingEngagements?.length || 0} existing engagements`);

    const result: AutoPairResult = {
      campaignsLinked: 0,
      campaignsSkipped: 0,
      skippedReasons: [],
      details: [],
    };

    // Build matching patterns from existing engagements
    const engagementMatchers: { id: string; name: string; patterns: RegExp[] }[] = [];
    
    for (const eng of existingEngagements || []) {
      const patterns: RegExp[] = [];
      
      // Match by engagement name
      if (eng.name) {
        const escaped = eng.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        patterns.push(new RegExp(escaped, 'i'));
      }
      
      // Match by sponsor name
      if (eng.sponsor_name) {
        const escaped = eng.sponsor_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        patterns.push(new RegExp(escaped, 'i'));
      }
      
      // Match by portfolio company
      if (eng.portfolio_company) {
        const escaped = eng.portfolio_company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        patterns.push(new RegExp(escaped, 'i'));
      }
      
      // Match by industry keywords
      if (eng.industry) {
        const industryWords = eng.industry.split(/[\s\/\-,]+/).filter((w: string) => w.length > 3);
        for (const word of industryWords) {
          const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          patterns.push(new RegExp(`\\b${escaped}\\b`, 'i'));
        }
      }
      
      if (patterns.length > 0) {
        engagementMatchers.push({ id: eng.id, name: eng.name, patterns });
      }
    }

    // Group campaigns by matched engagement
    const engagementCampaigns: Map<string, { name: string; campaigns: { id: string; name: string }[] }> = new Map();

    for (const campaign of campaigns || []) {
      // Skip internal campaigns
      if (/sourceco|^new sequence|test/i.test(campaign.name)) {
        result.campaignsSkipped++;
        result.skippedReasons.push({ 
          name: campaign.name, 
          reason: 'Internal or test campaign'
        });
        continue;
      }

      // Find best matching engagement
      let bestMatch: { id: string; name: string; score: number } | null = null;
      
      for (const matcher of engagementMatchers) {
        let score = 0;
        for (const pattern of matcher.patterns) {
          if (pattern.test(campaign.name)) {
            score++;
          }
        }
        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { id: matcher.id, name: matcher.name, score };
        }
      }

      if (bestMatch) {
        if (!engagementCampaigns.has(bestMatch.id)) {
          engagementCampaigns.set(bestMatch.id, { name: bestMatch.name, campaigns: [] });
        }
        engagementCampaigns.get(bestMatch.id)!.campaigns.push({ id: campaign.id, name: campaign.name });
      } else {
        result.campaignsSkipped++;
        result.skippedReasons.push({ 
          name: campaign.name, 
          reason: 'No matching engagement found'
        });
      }
    }

    console.log(`Matched campaigns to ${engagementCampaigns.size} engagements`);

    // Link campaigns to engagements
    for (const [engagementId, group] of engagementCampaigns) {
      if (!dry_run) {
        const campaignIds = group.campaigns.map(c => c.id);
        
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({ engagement_id: engagementId })
          .in('id', campaignIds);

        if (updateError) {
          console.error(`Failed to link campaigns to ${group.name}:`, updateError);
          for (const c of group.campaigns) {
            result.campaignsSkipped++;
            result.skippedReasons.push({ name: c.name, reason: `Failed to link: ${updateError.message}` });
          }
          continue;
        }
      }

      result.campaignsLinked += group.campaigns.length;
      result.details.push({
        engagement: group.name,
        campaigns: group.campaigns.map(c => c.name),
      });
    }

    console.log(`Auto-pair complete: ${result.campaignsLinked} campaigns linked, ${result.campaignsSkipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        engagementsCreated: 0, // Never create new engagements
        ...result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in auto-pair-engagements:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
