import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkResult {
  campaignsLinked: number;
  dealsLinked: number;
  errors: string[];
}

// Normalize text for matching
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate match score between campaign name and engagement name
function calculateMatchScore(campaignName: string, engagementName: string): number {
  const campaignNorm = normalizeText(campaignName);
  const engagementNorm = normalizeText(engagementName);
  
  if (!engagementNorm || !campaignNorm) return 0;
  
  // Exact match
  if (campaignNorm === engagementNorm) return 100;
  
  // Contains full engagement name
  if (campaignNorm.includes(engagementNorm)) return 90;
  if (engagementNorm.includes(campaignNorm)) return 85;
  
  // Word overlap
  const campaignWords = new Set(campaignNorm.split(' ').filter(w => w.length > 2));
  const engagementWords = new Set(engagementNorm.split(' ').filter(w => w.length > 2));
  
  let matchingWords = 0;
  for (const word of campaignWords) {
    if (engagementWords.has(word)) matchingWords++;
    // Check partial match for longer words
    for (const engWord of engagementWords) {
      if (word.length > 4 && engWord.length > 4) {
        if (word.includes(engWord) || engWord.includes(word)) {
          matchingWords += 0.5;
        }
      }
    }
  }
  
  if (matchingWords > 0) {
    const totalWords = Math.max(campaignWords.size, engagementWords.size);
    return Math.min(80, Math.round((matchingWords / totalWords) * 80));
  }
  
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspace_id, dry_run = false, min_score = 60 } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`=== Link Data Entities for workspace ${workspace_id} ===`);
    console.log(`Mode: ${dry_run ? 'DRY RUN' : 'EXECUTE'}, Min score: ${min_score}`);

    const result: LinkResult = {
      campaignsLinked: 0,
      dealsLinked: 0,
      errors: [],
    };

    // Fetch all engagements
    const { data: engagements, error: engErr } = await supabase
      .from('engagements')
      .select('id, engagement_name, client_name, sponsor, industry_focus')
      .eq('workspace_id', workspace_id);

    if (engErr) {
      console.log('Error fetching engagements:', engErr.message);
    }
    
    const hasEngagements = engagements && engagements.length > 0;
    console.log(`Found ${engagements?.length || 0} engagements`);

    // Build engagement lookup
    const engagementMatches: Map<string, { id: string; name: string }> = new Map();
    if (hasEngagements) {
      for (const eng of engagements) {
        engagementMatches.set(eng.id, { 
          id: eng.id, 
          name: eng.engagement_name || eng.client_name || '' 
        });
      }

      // 1. Link SmartLead campaigns
      const { data: slCampaigns } = await supabase
        .from('smartlead_campaigns')
        .select('id, name')
        .eq('workspace_id', workspace_id)
        .is('engagement_id', null);

      console.log(`Found ${slCampaigns?.length || 0} unlinked SmartLead campaigns`);

      for (const campaign of slCampaigns || []) {
        let bestMatch: { engId: string; engName: string; score: number } | null = null;
        
        for (const [engId, eng] of engagementMatches) {
          const score = calculateMatchScore(campaign.name, eng.name);
          if (score >= min_score && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { engId, engName: eng.name, score };
          }
        }
        
        if (bestMatch) {
          console.log(`  SL Match: "${campaign.name}" -> "${bestMatch.engName}" (score: ${bestMatch.score})`);
          
          if (!dry_run) {
            const { error } = await supabase
              .from('smartlead_campaigns')
              .update({ engagement_id: bestMatch.engId })
              .eq('id', campaign.id);
            
            if (error) {
              result.errors.push(`SmartLead ${campaign.id}: ${error.message}`);
            } else {
              result.campaignsLinked++;
            }
          } else {
            result.campaignsLinked++;
          }
        }
      }

      // 2. Link Reply.io campaigns
      const { data: rioCampaigns } = await supabase
        .from('replyio_campaigns')
        .select('id, name')
        .eq('workspace_id', workspace_id)
        .is('engagement_id', null);

      console.log(`Found ${rioCampaigns?.length || 0} unlinked Reply.io campaigns`);

      for (const campaign of rioCampaigns || []) {
        let bestMatch: { engId: string; engName: string; score: number } | null = null;
        
        for (const [engId, eng] of engagementMatches) {
          const score = calculateMatchScore(campaign.name, eng.name);
          if (score >= min_score && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { engId, engName: eng.name, score };
          }
        }
        
        if (bestMatch) {
          console.log(`  RIO Match: "${campaign.name}" -> "${bestMatch.engName}" (score: ${bestMatch.score})`);
          
          if (!dry_run) {
            const { error } = await supabase
              .from('replyio_campaigns')
              .update({ engagement_id: bestMatch.engId })
              .eq('id', campaign.id);
            
            if (error) {
              result.errors.push(`Reply.io ${campaign.id}: ${error.message}`);
            } else {
              result.campaignsLinked++;
            }
          } else {
            result.campaignsLinked++;
          }
        }
      }
    }

    // 3. Link calling_deals to leads
    const { data: orphanedDeals } = await supabase
      .from('calling_deals')
      .select('id, company_name, contact_name, contact_email, contact_phone')
      .eq('workspace_id', workspace_id)
      .is('lead_id', null);

    console.log(`Found ${orphanedDeals?.length || 0} unlinked calling_deals`);

    if (orphanedDeals && orphanedDeals.length > 0) {
      // Get all leads for matching
      const { data: leads } = await supabase
        .from('leads')
        .select('id, email, first_name, last_name, company')
        .eq('workspace_id', workspace_id);

      const leadsByEmail = new Map(leads?.map(l => [l.email?.toLowerCase(), l]) || []);
      const leadsByCompany = new Map(leads?.filter(l => l.company).map(l => [normalizeText(l.company), l]) || []);

      for (const deal of orphanedDeals) {
        let matchedLead: any = null;

        // Try email match first
        if (deal.contact_email && leadsByEmail.has(deal.contact_email.toLowerCase())) {
          matchedLead = leadsByEmail.get(deal.contact_email.toLowerCase());
        }
        
        // Try company name match
        if (!matchedLead && deal.company_name) {
          const normalizedCompany = normalizeText(deal.company_name);
          if (leadsByCompany.has(normalizedCompany)) {
            matchedLead = leadsByCompany.get(normalizedCompany);
          }
        }

        if (matchedLead) {
          console.log(`  Deal "${deal.company_name}" -> Lead ${matchedLead.id}`);
          
          if (!dry_run) {
            const { error } = await supabase
              .from('calling_deals')
              .update({ lead_id: matchedLead.id })
              .eq('id', deal.id);
            
            if (error) {
              result.errors.push(`Deal ${deal.id}: ${error.message}`);
            } else {
              result.dealsLinked++;
            }
          } else {
            result.dealsLinked++;
          }
        }
      }
    }

    // 4. Link calling_deals to engagements
    if (hasEngagements) {
      const { data: dealsForEngagement } = await supabase
        .from('calling_deals')
        .select('id, company_name')
        .eq('workspace_id', workspace_id)
        .is('engagement_id', null);

      if (dealsForEngagement && dealsForEngagement.length > 0) {
        for (const deal of dealsForEngagement) {
          let bestMatch: { engId: string; engName: string; score: number } | null = null;
          
          for (const [engId, eng] of engagementMatches) {
            const score = calculateMatchScore(deal.company_name, eng.name);
            if (score >= min_score && (!bestMatch || score > bestMatch.score)) {
              bestMatch = { engId, engName: eng.name, score };
            }
          }
          
          if (bestMatch) {
            console.log(`  Deal "${deal.company_name}" -> Engagement "${bestMatch.engName}" (score: ${bestMatch.score})`);
            
            if (!dry_run) {
              const { error } = await supabase
                .from('calling_deals')
                .update({ engagement_id: bestMatch.engId })
                .eq('id', deal.id);
              
              if (!error) {
                result.dealsLinked++;
              }
            }
          }
        }
      }
    }

    console.log(`=== Link complete: ${result.campaignsLinked} campaigns, ${result.dealsLinked} deals ===`);

    return new Response(JSON.stringify({
      success: true,
      dry_run,
      ...result,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('link-data-entities error:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message 
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
