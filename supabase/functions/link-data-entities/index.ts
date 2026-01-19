import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkResult {
  campaignsLinked: number;
  dealsLinked: number;
  contactsLinked: number;
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
      contactsLinked: 0,
      errors: [],
    };

    // Get client_id from workspace context - find engagements for the workspace's client
    const { data: clientData } = await supabase
      .from('clients')
      .select('id')
      .eq('id', workspace_id)
      .single();

    const clientId = clientData?.id || workspace_id;

    // Fetch all engagements for this client
    const { data: engagements, error: engErr } = await supabase
      .from('engagements')
      .select('id, name, description')
      .eq('client_id', clientId);

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
          name: eng.name || '' 
        });
      }

      // 1. Link unlinked campaigns (unified campaigns table)
      const { data: unlinkedCampaigns } = await supabase
        .from('campaigns')
        .select('id, name, campaign_type')
        .is('engagement_id', null);

      console.log(`Found ${unlinkedCampaigns?.length || 0} unlinked campaigns`);

      for (const campaign of unlinkedCampaigns || []) {
        let bestMatch: { engId: string; engName: string; score: number } | null = null;
        
        for (const [engId, eng] of engagementMatches) {
          const score = calculateMatchScore(campaign.name, eng.name);
          if (score >= min_score && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { engId, engName: eng.name, score };
          }
        }
        
        if (bestMatch) {
          console.log(`  Campaign Match: "${campaign.name}" (${campaign.campaign_type}) -> "${bestMatch.engName}" (score: ${bestMatch.score})`);
          
          if (!dry_run) {
            const { error } = await supabase
              .from('campaigns')
              .update({ engagement_id: bestMatch.engId })
              .eq('id', campaign.id);
            
            if (error) {
              result.errors.push(`Campaign ${campaign.id}: ${error.message}`);
            } else {
              result.campaignsLinked++;
            }
          } else {
            result.campaignsLinked++;
          }
        }
      }
    }

    // 2. Link orphaned deals to engagements/contacts
    if (hasEngagements) {
      const { data: orphanedDeals } = await supabase
        .from('deals')
        .select('id, project_name, client_name')
        .is('engagement_id', null);

      console.log(`Found ${orphanedDeals?.length || 0} unlinked deals`);

      if (orphanedDeals && orphanedDeals.length > 0) {
        for (const deal of orphanedDeals) {
          let bestMatch: { engId: string; engName: string; score: number } | null = null;
          
          // Try matching on project_name or client_name
          const dealName = deal.project_name || deal.client_name || '';
          
          for (const [engId, eng] of engagementMatches) {
            const score = calculateMatchScore(dealName, eng.name);
            if (score >= min_score && (!bestMatch || score > bestMatch.score)) {
              bestMatch = { engId, engName: eng.name, score };
            }
          }
          
          if (bestMatch) {
            console.log(`  Deal "${dealName}" -> Engagement "${bestMatch.engName}" (score: ${bestMatch.score})`);
            
            if (!dry_run) {
              const { error } = await supabase
                .from('deals')
                .update({ engagement_id: bestMatch.engId })
                .eq('id', deal.id);
              
              if (!error) {
                result.dealsLinked++;
              }
            } else {
              result.dealsLinked++;
            }
          }
        }
      }
    }

    // 3. Link orphaned contacts to companies
    const { data: orphanedContacts } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name')
      .is('company_id', null)
      .limit(500);

    console.log(`Found ${orphanedContacts?.length || 0} contacts without company_id`);

    if (orphanedContacts && orphanedContacts.length > 0) {
      // Get companies for matching
      const { data: companies } = await supabase
        .from('companies')
        .select('id, domain, name');

      const companiesByDomain = new Map(
        companies?.filter(c => c.domain).map(c => [c.domain.toLowerCase(), c]) || []
      );

      for (const contact of orphanedContacts) {
        if (!contact.email) continue;
        
        // Extract domain from email
        const emailDomain = contact.email.split('@')[1]?.toLowerCase();
        if (!emailDomain) continue;

        // Skip common email providers
        if (['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'].includes(emailDomain)) {
          continue;
        }

        const matchedCompany = companiesByDomain.get(emailDomain);
        
        if (matchedCompany) {
          console.log(`  Contact "${contact.email}" -> Company "${matchedCompany.name}"`);
          
          if (!dry_run) {
            const { error } = await supabase
              .from('contacts')
              .update({ company_id: matchedCompany.id })
              .eq('id', contact.id);
            
            if (!error) {
              result.contactsLinked++;
            }
          } else {
            result.contactsLinked++;
          }
        }
      }
    }

    console.log(`=== Link complete: ${result.campaignsLinked} campaigns, ${result.dealsLinked} deals, ${result.contactsLinked} contacts ===`);

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
