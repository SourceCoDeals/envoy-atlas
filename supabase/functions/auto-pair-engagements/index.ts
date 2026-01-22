import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoPairResult {
  campaignsLinked: number;
  campaignsSkipped: number;
  skippedReasons: { name: string; reason: string }[];
  details: { engagement: string; campaigns: string[]; confidence: string }[];
}

interface MatchPattern {
  pattern: RegExp;
  weight: number; // name=3, portfolio=2, sponsor=1
  term: string;
  type: 'name' | 'portfolio' | 'sponsor';
}

interface EngagementMatcher {
  id: string;
  name: string;
  patterns: MatchPattern[];
}

// Minimum score threshold to consider a match valid
// A portfolio company match (weight=2) of 8 chars = 16 points minimum
const MIN_SCORE_THRESHOLD = 12;

// Minimum term length to create a pattern (avoids short word collisions)
const MIN_TERM_LENGTH = 4;

/**
 * Creates matching patterns for a term
 * Returns multiple patterns to handle different formats:
 * - Word boundary match for exact term
 * - Flexible space matching for compound words ("Broad Sky" matches "BroadSky")
 */
function createMatchPatterns(term: string): RegExp[] {
  const patterns: RegExp[] = [];
  const trimmed = term.trim();
  if (trimmed.length < MIN_TERM_LENGTH) return patterns;
  
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Standard word boundary pattern
  patterns.push(new RegExp(`\\b${escaped}\\b`, 'i'));
  
  // For multi-word terms, create pattern that allows optional/no spaces
  // "Broad Sky" should match "BroadSky", "Broad-Sky", "Broad Sky"
  if (trimmed.includes(' ')) {
    const noSpaceVersion = escaped.replace(/\\ /g, '[\\s\\-]*');
    patterns.push(new RegExp(noSpaceVersion, 'i'));
  }
  
  // For camelCase terms, create pattern that allows spaces
  // "BroadSky" should match "Broad Sky", "Broad-Sky"
  const camelSplit = trimmed.replace(/([a-z])([A-Z])/g, '$1 $2');
  if (camelSplit !== trimmed && camelSplit.length >= MIN_TERM_LENGTH) {
    const camelEscaped = camelSplit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flexibleCamel = camelEscaped.replace(/ /g, '[\\s\\-]*');
    patterns.push(new RegExp(flexibleCamel, 'i'));
  }
  
  return patterns;
}

/**
 * Extracts meaningful terms from a string (for multi-word matching)
 * Returns both the full string and significant individual words
 */
function extractTerms(text: string | null): string[] {
  if (!text) return [];
  
  const terms: string[] = [];
  const trimmed = text.trim();
  
  // Add full string if long enough
  if (trimmed.length >= MIN_TERM_LENGTH) {
    terms.push(trimmed);
  }
  
  // Add significant words (5+ chars) that aren't common words
  const commonWords = new Set(['capital', 'group', 'partners', 'holdings', 'management', 'services', 'company', 'corp', 'corporation', 'inc', 'llc', 'fund', 'funds']);
  const words = trimmed.split(/[\s\-\/]+/).filter(w => 
    w.length >= 5 && !commonWords.has(w.toLowerCase())
  );
  
  for (const word of words) {
    if (!terms.includes(word)) {
      terms.push(word);
    }
  }
  
  return terms;
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

    const { client_id, dry_run = false, fix_mislinks = false } = await req.json() as { 
      client_id: string;
      dry_run?: boolean;
      fix_mislinks?: boolean; // Re-evaluate all campaigns, not just unlinked ones
    };

    if (!client_id) {
      return new Response(
        JSON.stringify({ error: 'Missing client_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Auto-pairing campaigns for client ${client_id}, dry_run: ${dry_run}, fix_mislinks: ${fix_mislinks}`);

    // Fetch existing engagements for this client
    const { data: existingEngagements, error: engagementsError } = await supabase
      .from('engagements')
      .select('id, name, sponsor_name, portfolio_company')
      .eq('client_id', client_id);

    if (engagementsError) {
      throw new Error(`Failed to fetch engagements: ${engagementsError.message}`);
    }

    if (!existingEngagements || existingEngagements.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          dry_run,
          campaignsLinked: 0, 
          campaignsSkipped: 0,
          skippedReasons: [],
          details: [],
          message: 'No engagements found for this client'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const engagementIds = existingEngagements.map(e => e.id);

    // Fetch campaigns - either all linked to this client's engagements (fix_mislinks) or just for processing
    let campaignsQuery = supabase
      .from('campaigns')
      .select('id, name, engagement_id')
      .order('name');

    if (fix_mislinks) {
      // Get all campaigns linked to any engagement of this client
      campaignsQuery = campaignsQuery.in('engagement_id', engagementIds);
    } else {
      // Only get campaigns already linked (we can't create new links without an engagement_id due to NOT NULL)
      campaignsQuery = campaignsQuery.in('engagement_id', engagementIds);
    }

    const { data: campaigns, error: campaignsError } = await campaignsQuery;

    if (campaignsError) {
      throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`);
    }

    console.log(`Found ${campaigns?.length || 0} campaigns and ${existingEngagements.length} engagements`);

    // Check for sponsors with multiple engagements (ambiguous)
    const sponsorEngagementCount: Map<string, number> = new Map();
    for (const eng of existingEngagements) {
      if (eng.sponsor_name) {
        const sponsor = eng.sponsor_name.toLowerCase();
        sponsorEngagementCount.set(sponsor, (sponsorEngagementCount.get(sponsor) || 0) + 1);
      }
    }
    const ambiguousSponsors = new Set(
      [...sponsorEngagementCount.entries()]
        .filter(([_, count]) => count > 1)
        .map(([sponsor]) => sponsor)
    );

    console.log(`Ambiguous sponsors (multiple engagements): ${[...ambiguousSponsors].join(', ')}`);

    // Build matching patterns from existing engagements
    const engagementMatchers: EngagementMatcher[] = [];
    
    for (const eng of existingEngagements) {
      const patterns: MatchPattern[] = [];
      
      // Priority 1: Engagement name (weight = 3)
      for (const term of extractTerms(eng.name)) {
        for (const pattern of createMatchPatterns(term)) {
          patterns.push({ pattern, weight: 3, term, type: 'name' });
        }
      }
      
      // Priority 2: Portfolio company (weight = 2)
      for (const term of extractTerms(eng.portfolio_company)) {
        for (const pattern of createMatchPatterns(term)) {
          patterns.push({ pattern, weight: 2, term, type: 'portfolio' });
        }
      }
      
      // Priority 3: Sponsor name (weight = 1) - but only if not ambiguous
      if (eng.sponsor_name && !ambiguousSponsors.has(eng.sponsor_name.toLowerCase())) {
        for (const term of extractTerms(eng.sponsor_name)) {
          for (const pattern of createMatchPatterns(term)) {
            patterns.push({ pattern, weight: 1, term, type: 'sponsor' });
          }
        }
      }
      
      if (patterns.length > 0) {
        engagementMatchers.push({ id: eng.id, name: eng.name, patterns });
      }
    }

    const result: AutoPairResult = {
      campaignsLinked: 0,
      campaignsSkipped: 0,
      skippedReasons: [],
      details: [],
    };

    // Group campaigns by their best matched engagement
    const engagementCampaigns: Map<string, { 
      name: string; 
      campaigns: { id: string; name: string }[];
      confidence: 'high' | 'medium';
    }> = new Map();

    for (const campaign of campaigns || []) {
      // Skip internal/test campaigns
      if (/sourceco|^new sequence|^test\b/i.test(campaign.name)) {
        result.campaignsSkipped++;
        result.skippedReasons.push({ 
          name: campaign.name, 
          reason: 'Internal or test campaign'
        });
        continue;
      }

      // Find best matching engagement using weighted scoring
      let bestMatch: { 
        id: string; 
        name: string; 
        score: number; 
        confidence: 'high' | 'medium';
        matchedTerms: string[];
      } | null = null;
      
      for (const matcher of engagementMatchers) {
        let totalScore = 0;
        let hasNameOrPortfolioMatch = false;
        const matchedTerms: string[] = [];
        
        for (const { pattern, weight, term, type } of matcher.patterns) {
          if (pattern.test(campaign.name)) {
            // Score = weight * term length (longer matches score higher)
            const matchScore = weight * term.length;
            totalScore += matchScore;
            matchedTerms.push(`${type}:${term}`);
            
            if (type === 'name' || type === 'portfolio') {
              hasNameOrPortfolioMatch = true;
            }
          }
        }
        
        // Must meet minimum threshold
        if (totalScore < MIN_SCORE_THRESHOLD) continue;
        
        // Determine confidence level
        const confidence: 'high' | 'medium' = hasNameOrPortfolioMatch ? 'high' : 'medium';
        
        // Take best score, preferring higher confidence on ties
        if (!bestMatch || 
            totalScore > bestMatch.score || 
            (totalScore === bestMatch.score && confidence === 'high' && bestMatch.confidence === 'medium')) {
          bestMatch = { 
            id: matcher.id, 
            name: matcher.name, 
            score: totalScore, 
            confidence,
            matchedTerms 
          };
        }
      }

      if (bestMatch) {
        // Check if this is actually a change (for fix_mislinks mode)
        if (campaign.engagement_id === bestMatch.id) {
          // Already correctly linked, skip
          continue;
        }

        if (!engagementCampaigns.has(bestMatch.id)) {
          engagementCampaigns.set(bestMatch.id, { 
            name: bestMatch.name, 
            campaigns: [],
            confidence: bestMatch.confidence
          });
        }
        engagementCampaigns.get(bestMatch.id)!.campaigns.push({ 
          id: campaign.id, 
          name: campaign.name 
        });
        
        console.log(`Match: "${campaign.name}" → "${bestMatch.name}" (score: ${bestMatch.score}, confidence: ${bestMatch.confidence}, terms: ${bestMatch.matchedTerms.join(', ')})`);
      } else {
        result.campaignsSkipped++;
        result.skippedReasons.push({ 
          name: campaign.name, 
          reason: 'No matching engagement found (below threshold)'
        });
      }
    }

    console.log(`Matched campaigns to ${engagementCampaigns.size} engagements for relinking`);

    // Link/relink campaigns to their correct engagements
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
        confidence: group.confidence,
      });
    }

    console.log(`Auto-pair complete: ${result.campaignsLinked} campaigns ${dry_run ? 'would be ' : ''}linked, ${result.campaignsSkipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        fix_mislinks,
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
