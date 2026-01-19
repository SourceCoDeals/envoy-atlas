import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Client detection patterns - order matters for specificity
const clientPatterns = [
  { name: 'Trivest', pattern: /trivest/i },
  { name: 'O2', pattern: /\bO2\b/i },
  { name: 'Alpine', pattern: /alpine/i },
  { name: 'Trinity', pattern: /trinity/i },
  { name: 'Audax', pattern: /audax/i },
  { name: 'New Heritage', pattern: /new heritage|newheritage/i },
  { name: 'Gemspring', pattern: /gemspring/i },
  { name: 'Tamarix', pattern: /tamarix/i },
  { name: 'Revelstoke', pattern: /revelstoke/i },
  { name: 'TouchSuite', pattern: /touchsuite/i },
  { name: '3RC', pattern: /\b3rc\b/i },
  { name: 'Shore', pattern: /\bshore\b/i },
  { name: 'BDV Solutions', pattern: /\bbdv\b/i },
  { name: 'Riverside', pattern: /riverside/i },
  { name: 'Opexus', pattern: /opexus/i },
  { name: 'NCR', pattern: /\bncr\b/i },
  { name: 'MSCP', pattern: /\bmscp\b/i },
  { name: 'Renovus Capital', pattern: /renovus/i },
  { name: 'Northern Yard', pattern: /northern yard/i },
  { name: 'Invision', pattern: /invision/i },
  { name: 'Cameron Connect', pattern: /cameron/i },
  { name: 'Polaris', pattern: /polaris/i },
  { name: 'Arsenal', pattern: /arsenal/i },
  { name: 'Kingswood', pattern: /kingswood/i },
  { name: 'Harvest', pattern: /harvest/i },
  { name: 'Huron', pattern: /huron/i },
  { name: 'Blue Point', pattern: /blue point|bluepoint/i },
  { name: 'MidOcean', pattern: /midocean/i },
  { name: 'Prospect Partners', pattern: /prospect/i },
  { name: 'American Securities', pattern: /american securities/i },
  { name: 'Pfingsten', pattern: /pfingsten/i },
  { name: 'Olympus', pattern: /olympus/i },
  { name: 'Kohlberg', pattern: /kohlberg/i },
  { name: 'Gryphon', pattern: /gryphon/i },
  { name: 'Flexis', pattern: /flexis/i },
  { name: 'Falfurrias', pattern: /falfurrias/i },
  { name: 'Centerfield', pattern: /centerfield/i },
  { name: 'Align', pattern: /\balign\b/i },
  { name: null, pattern: /sourceco/i }, // Skip internal
  { name: null, pattern: /^new sequence/i }, // Skip generic
];

// Industry detection patterns
const industryPatterns: { industry: string; pattern: RegExp }[] = [
  // Services
  { industry: 'Pool Services', pattern: /pool|pools/i },
  { industry: 'Roofing', pattern: /roofing|roofer|roof\b/i },
  { industry: 'Landscaping', pattern: /landscaping|landscape|lawn/i },
  { industry: 'Janitorial', pattern: /janitorial|janitor|cleaning service/i },
  { industry: 'Painting', pattern: /painting|painter/i },
  { industry: 'HVAC', pattern: /hvac|heating|cooling|air condition/i },
  { industry: 'Plumbing', pattern: /plumbing|plumber/i },
  { industry: 'Electrical', pattern: /electrical|electrician/i },
  { industry: 'Pest Control', pattern: /pest control|exterminator/i },
  { industry: 'Car Wash', pattern: /car wash|carwash/i },
  { industry: 'Auto Repair', pattern: /auto repair|auto -|automotive/i },
  { industry: 'Pet Services', pattern: /pet service|pet care|dog daycare|doggy|grooming/i },
  { industry: 'Funeral Services', pattern: /funeral|mortuary|cemetery/i },
  
  // Healthcare
  { industry: 'Med Spa', pattern: /med spa|medspa|medical spa/i },
  { industry: 'Dental', pattern: /dental|dentist/i },
  { industry: 'Senior Living', pattern: /senior living|assisted living|nursing home/i },
  { industry: 'ENT', pattern: /\bent\b|elevate ent/i },
  { industry: 'Veterinary', pattern: /veterinary|vet clinic|animal hospital/i },
  
  // Personal Services
  { industry: 'Nail Salons', pattern: /nail salon|nails|manicure/i },
  { industry: 'Hair Salons', pattern: /hair salon|salon|barbershop/i },
  
  // Manufacturing & Industrial
  { industry: 'Chemical Manufacturing', pattern: /chemical|chemicals/i },
  { industry: 'Thermal', pattern: /thermal/i },
  { industry: 'Manufacturing', pattern: /manufacturing|fabrication/i },
  { industry: 'Composting', pattern: /composting|compost/i },
  
  // Technology & SaaS
  { industry: 'Construction SaaS', pattern: /construction saas|construction software/i },
  { industry: 'HRIS', pattern: /\bhris\b|hr software/i },
  { industry: 'Software', pattern: /software|saas|tech\b/i },
  
  // Financial & Professional
  { industry: 'Accounting', pattern: /accountant|accounting|cpa\b/i },
  { industry: 'Insurance', pattern: /insurance/i },
  { industry: 'Legal', pattern: /legal|law firm|attorney/i },
  
  // Food & Beverage
  { industry: 'F&B', pattern: /f&b|food.+beverage|restaurant/i },
  { industry: 'Pet Foods', pattern: /pet food/i },
  
  // Real Estate & Construction
  { industry: 'Construction', pattern: /construction|contractor|builder/i },
  { industry: 'Real Estate', pattern: /real estate|property/i },
  
  // Other
  { industry: 'Education', pattern: /education|educate|school|training/i },
  { industry: 'Bilingual', pattern: /bilingual/i },
];

interface AutoPairResult {
  engagementsCreated: number;
  campaignsLinked: number;
  campaignsSkipped: number;
  skippedReasons: { name: string; reason: string }[];
  details: { engagement: string; campaigns: string[] }[];
}

function extractClientName(campaignName: string): string | null {
  for (const { name, pattern } of clientPatterns) {
    if (pattern.test(campaignName)) {
      return name; // Returns null for skip patterns
    }
  }
  return null;
}

function extractIndustry(campaignName: string): string | null {
  for (const { industry, pattern } of industryPatterns) {
    if (pattern.test(campaignName)) {
      return industry;
    }
  }
  return null;
}

function cleanCampaignName(name: string): string {
  // Remove common prefixes/suffixes
  return name
    .replace(/^\[?(PAUSED|Completed|Ended|Scheduled|Draft)\]?\s*/i, '')
    .replace(/\s*-\s*[A-Z]{2}\s*-?\s*$/i, '') // Remove rep initials like "- TK -"
    .replace(/\s*\([^)]*\)\s*$/, '') // Remove trailing parenthetical
    .trim();
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

    // Fetch all campaigns without engagement_id (unlinked)
    // Note: engagement_id is required in the schema, so we look for a default/placeholder engagement
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, engagement_id, campaign_type')
      .order('name');

    if (campaignsError) {
      throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`);
    }

    // Fetch existing engagements
    const { data: existingEngagements, error: engagementsError } = await supabase
      .from('engagements')
      .select('id, name, client_id, industry')
      .eq('client_id', client_id);

    if (engagementsError) {
      throw new Error(`Failed to fetch engagements: ${engagementsError.message}`);
    }

    console.log(`Found ${campaigns?.length || 0} campaigns and ${existingEngagements?.length || 0} existing engagements`);

    const result: AutoPairResult = {
      engagementsCreated: 0,
      campaignsLinked: 0,
      campaignsSkipped: 0,
      skippedReasons: [],
      details: [],
    };

    // Group campaigns by client + industry
    const groupedCampaigns: Map<string, { clientName: string; industry: string | null; campaigns: { id: string; name: string }[] }> = new Map();

    for (const campaign of campaigns || []) {
      const cleanName = cleanCampaignName(campaign.name);
      const clientName = extractClientName(cleanName);
      
      // Skip if no client identified (internal or ambiguous)
      if (!clientName) {
        result.campaignsSkipped++;
        result.skippedReasons.push({ 
          name: campaign.name, 
          reason: /sourceco/i.test(campaign.name) ? 'Internal (SourceCo)' : 'Unidentifiable client' 
        });
        continue;
      }

      const industry = extractIndustry(cleanName);
      const groupKey = `${clientName}|${industry || 'General'}`;

      if (!groupedCampaigns.has(groupKey)) {
        groupedCampaigns.set(groupKey, { clientName, industry, campaigns: [] });
      }
      groupedCampaigns.get(groupKey)!.campaigns.push({ id: campaign.id, name: campaign.name });
    }

    console.log(`Grouped into ${groupedCampaigns.size} client-industry pairs`);

    // Create/find engagements and link campaigns
    const engagementMap: Map<string, string> = new Map(); // groupKey -> engagement_id

    // Build map of existing engagements
    for (const eng of existingEngagements || []) {
      // Try to match by name pattern
      const nameLower = eng.name.toLowerCase();
      for (const { name: clientName } of clientPatterns) {
        if (clientName && nameLower.includes(clientName.toLowerCase())) {
          const industry = eng.industry || extractIndustry(eng.name) || 'General';
          const key = `${clientName}|${industry}`;
          engagementMap.set(key, eng.id);
        }
      }
    }

    // Process each group
    for (const [groupKey, group] of groupedCampaigns) {
      const { clientName, industry, campaigns: groupCampaigns } = group;
      let engagementId = engagementMap.get(groupKey);

      // Create new engagement if needed
      if (!engagementId && !dry_run) {
        const engagementName = industry 
          ? `${clientName} - ${industry}`
          : clientName;

        const { data: newEngagement, error: createError } = await supabase
          .from('engagements')
          .insert({
            client_id,
            name: engagementName,
            industry,
            status: 'active',
            auto_created: true,
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`Failed to create engagement ${engagementName}:`, createError);
          // Add campaigns to skipped
          for (const c of groupCampaigns) {
            result.campaignsSkipped++;
            result.skippedReasons.push({ name: c.name, reason: `Failed to create engagement: ${createError.message}` });
          }
          continue;
        }

        engagementId = newEngagement.id;
        result.engagementsCreated++;
        console.log(`Created engagement: ${engagementName}`);
      } else if (!engagementId && dry_run) {
        // Simulate creation
        engagementId = 'dry-run-' + groupKey;
        result.engagementsCreated++;
      }

      // Link campaigns to engagement
      if (!dry_run && engagementId) {
        const campaignIds = groupCampaigns.map(c => c.id);
        
        const { error: updateError } = await supabase
          .from('campaigns')
          .update({ engagement_id: engagementId })
          .in('id', campaignIds);

        if (updateError) {
          console.error(`Failed to link campaigns to ${groupKey}:`, updateError);
          for (const c of groupCampaigns) {
            result.campaignsSkipped++;
            result.skippedReasons.push({ name: c.name, reason: `Failed to link: ${updateError.message}` });
          }
          continue;
        }
      }

      result.campaignsLinked += groupCampaigns.length;
      result.details.push({
        engagement: industry ? `${clientName} - ${industry}` : clientName,
        campaigns: groupCampaigns.map(c => c.name),
      });
    }

    console.log(`Auto-pair complete: ${result.engagementsCreated} engagements created, ${result.campaignsLinked} campaigns linked, ${result.campaignsSkipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
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
