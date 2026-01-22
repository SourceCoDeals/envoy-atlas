import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoPairResult {
  campaignsLinked: number;
  campaignsUnlinked: number;
  ambiguous: { name: string; reason: string }[];
  linkedDetails: { engagement: string; campaigns: string[] }[];
}

interface Engagement {
  id: string;
  name: string;
  sponsor_name: string | null;
  portfolio_company: string | null;
}

/**
 * Strips status prefixes from campaign names like [Ended], [paused], {PAUSED}, (Archive), etc.
 */
function stripStatusPrefix(name: string): string {
  return name
    .replace(/^\s*[\[\(\{][^\]\)\}]*[\]\)\}]\s*/gi, '') // Remove [Ended], (Archive), {PAUSED} etc.
    .replace(/^\s*\*+\s*/, '') // Remove leading asterisks
    .trim();
}

/**
 * Normalizes text for matching:
 * - Lowercase
 * - Remove LLC, Inc, Partners, Corp, etc.
 * - Replace & with 'and'
 * - Trim whitespace
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(llc|inc|incorporated|partners|corp|corporation|holdings|group|management|fund|funds|capital|equity)\b/gi, '')
    .replace(/&/g, 'and')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two strings match with high confidence
 * Handles:
 * - Exact match (case insensitive)
 * - Abbreviations (Capital vs Cap, Education vs Ed)
 * - One contained in the other (Baum matches Baum Capital)
 */
function isHighConfidenceMatch(a: string, b: string): boolean {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  
  if (!normA || !normB) return false;
  
  // Exact match after normalization
  if (normA === normB) return true;
  
  // One contained in the other (for short forms)
  if (normA.length >= 3 && normB.includes(normA)) return true;
  if (normB.length >= 3 && normA.includes(normB)) return true;
  
  // Handle common abbreviations
  const abbreviations: Record<string, string[]> = {
    'capital': ['cap', 'capitol'],
    'investment': ['inv', 'invest', 'investments'],
    'partners': ['ptnrs', 'part'],
    'management': ['mgmt', 'mgt'],
    'associates': ['assoc', 'assocs'],
    'technology': ['tech'],
    'services': ['svcs', 'svc'],
    'financial': ['fin'],
    'industries': ['ind', 'indus'],
    'international': ['intl', 'int'],
    'american': ['amer'],
    'education': ['edu', 'ed'],
    'senior': ['sr'],
    'junior': ['jr'],
    'living': ['liv'],
    'nexcore': ['nexcore', 'nex core', 'nex-core'],
    'touchsuite': ['touch suite', 'touch-suite'],
  };
  
  let expandedA = normA;
  let expandedB = normB;
  
  for (const [full, abbrevs] of Object.entries(abbreviations)) {
    for (const abbrev of abbrevs) {
      expandedA = expandedA.replace(new RegExp(`\\b${abbrev}\\b`, 'g'), full);
      expandedB = expandedB.replace(new RegExp(`\\b${abbrev}\\b`, 'g'), full);
    }
  }
  
  if (expandedA === expandedB) return true;
  if (expandedA.length >= 3 && expandedB.includes(expandedA)) return true;
  if (expandedB.length >= 3 && expandedA.includes(expandedB)) return true;
  
  return false;
}

/**
 * Parse campaign name and extract potential sponsor/client segments
 * Returns all meaningful segments for flexible matching
 */
function parseCampaignSegments(name: string): string[] {
  const cleaned = stripStatusPrefix(name);
  const parts = cleaned.split(/\s+-\s+/).map(p => p.trim()).filter(p => p.length >= 2);
  
  // Filter out common non-entity parts (initials, tier indicators, etc.)
  const skipPatterns = [
    /^[A-Z]{1,3}$/,                    // Single initials like JF, SD, TM
    /^tier\s*\d/i,                     // Tier 1, Tier 2, etc.
    /^t\d/i,                           // T1, T2, etc.
    /^all\s*tiers/i,                   // All Tiers
    /^no\s*name/i,                     // No Name
    /^\d+$/,                           // Just numbers
    /^re-?engage/i,                    // Re-engagement
    /^retarget/i,                      // Retargeting
    /^gifting/i,                       // Gifting Sequence
    /^top\s*targets/i,                 // Top Targets
    /^highly\s*personalized/i,         // Highly Personalized
    /new\s*script/i,                   // New Script
    /^part\s*\d/i,                     // Part 2
    /^copy$/i,                         // Copy
    /^short$/i,                        // Short
    /hov\s*\(prev/i,                   // Hov (prev AK)
    /^\d{2}\.\d{2}\.\d{2}$/,           // Dates like 05.20.24
    /email/i,                          // Email references
    /gmail/i,                          // Gmail references
    /call/i,                           // Call references
    /^li\s*\+/i,                       // LI + Email
  ];
  
  return parts.filter(part => {
    const cleaned = part.replace(/\|.*$/, '').trim(); // Remove pipe and after
    return !skipPatterns.some(pattern => pattern.test(cleaned));
  });
}

/**
 * Find matching engagement for a campaign using POSITIONAL matching:
 * - Segment 0 (first part) MUST match sponsor_name
 * - Segment 1 (second part) MUST match portfolio_company
 */
function findMatchingEngagement(
  segments: string[], 
  rawCampaignName: string,
  engagements: Engagement[]
): { match: Engagement | null; ambiguous: boolean; reason?: string } {
  if (segments.length < 2) {
    return { match: null, ambiguous: false, reason: 'Need at least 2 segments for sponsor+client' };
  }

  const sponsorSegment = segments[0]; // First segment = Sponsor
  const clientSegment = segments[1];  // Second segment = Client
  
  const matches: { eng: Engagement; score: number }[] = [];
  
  for (const eng of engagements) {
    if (!eng.sponsor_name || !eng.portfolio_company) continue;
    
    let score = 0;
    
    // Segment 0 MUST match sponsor_name
    const sponsorMatches = isHighConfidenceMatch(sponsorSegment, eng.sponsor_name);
    if (sponsorMatches) {
      score += 10;
    }
    
    // Segment 1 MUST match portfolio_company
    const clientMatches = isHighConfidenceMatch(clientSegment, eng.portfolio_company);
    if (clientMatches) {
      score += 20;
    }
    
    // BOTH must match - require score of 30 (10 for sponsor + 20 for client)
    if (score === 30) {
      matches.push({ eng, score });
    }
  }
  
  if (matches.length === 0) {
    return { 
      match: null, 
      ambiguous: false, 
      reason: `No match: sponsor="${sponsorSegment}" client="${clientSegment}"` 
    };
  }
  
  if (matches.length > 1) {
    return { 
      match: null, 
      ambiguous: true, 
      reason: `Multiple matches: ${matches.map(m => m.eng.name).join(', ')}` 
    };
  }
  
  return { match: matches[0].eng, ambiguous: false };
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

    // Fetch existing engagements (excluding Unassigned placeholder)
    const { data: existingEngagements, error: engagementsError } = await supabase
      .from('engagements')
      .select('id, name, sponsor_name, portfolio_company')
      .eq('client_id', client_id)
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (engagementsError) {
      throw new Error(`Failed to fetch engagements: ${engagementsError.message}`);
    }

    console.log(`Found ${existingEngagements?.length || 0} engagements`);
    for (const eng of existingEngagements || []) {
      console.log(`  Engagement: "${eng.name}" | Sponsor: "${eng.sponsor_name}" | Client: "${eng.portfolio_company}"`);
    }

    // Fetch ALL unassigned campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, engagement_id')
      .eq('engagement_id', '00000000-0000-0000-0000-000000000000')
      .order('name');

    if (campaignsError) {
      throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`);
    }

    console.log(`Found ${campaigns?.length || 0} unassigned campaigns to process`);

    const result: AutoPairResult = {
      campaignsLinked: 0,
      campaignsUnlinked: 0,
      ambiguous: [],
      linkedDetails: [],
    };

    const engagementCampaigns: Map<string, { name: string; campaigns: { id: string; name: string }[] }> = new Map();

    for (const campaign of campaigns || []) {
      const segments = parseCampaignSegments(campaign.name);
      
      if (segments.length < 2) {
        result.campaignsUnlinked++;
        result.ambiguous.push({ 
          name: campaign.name, 
          reason: `Only ${segments.length} meaningful segment(s) found: [${segments.join(', ')}]` 
        });
        continue;
      }

      console.log(`Parsing: "${campaign.name}" → Segments: [${segments.join(' | ')}]`);

      const { match, ambiguous, reason } = findMatchingEngagement(segments, campaign.name, existingEngagements || []);

      if (ambiguous) {
        result.campaignsUnlinked++;
        result.ambiguous.push({ name: campaign.name, reason: reason || 'Ambiguous match' });
        continue;
      }

      if (!match) {
        result.campaignsUnlinked++;
        result.ambiguous.push({ name: campaign.name, reason: reason || 'No match found' });
        continue;
      }

      if (!engagementCampaigns.has(match.id)) {
        engagementCampaigns.set(match.id, { name: match.name, campaigns: [] });
      }
      engagementCampaigns.get(match.id)!.campaigns.push({ id: campaign.id, name: campaign.name });

      console.log(`✓ Match: "${campaign.name}" → "${match.name}"`);
    }

    // Execute batch updates
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
            result.campaignsUnlinked++;
            result.ambiguous.push({ name: c.name, reason: `DB error: ${updateError.message}` });
          }
          continue;
        }
      }

      result.campaignsLinked += group.campaigns.length;
      result.linkedDetails.push({
        engagement: group.name,
        campaigns: group.campaigns.map(c => c.name),
      });
    }

    console.log(`\n=== AUTO-PAIR RESULTS ===`);
    console.log(`Campaigns linked: ${result.campaignsLinked}`);
    console.log(`Campaigns unlinked: ${result.campaignsUnlinked}`);
    console.log(`Ambiguous/problematic: ${result.ambiguous.length}`);

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
