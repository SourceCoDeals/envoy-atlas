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

interface SponsorAlias {
  alias: string;
  canonical_name: string;
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
 * Expands abbreviations using alias map
 */
function expandAbbreviations(text: string, aliasMap: Map<string, string>): string {
  let expanded = text;
  
  // Try exact alias match first
  const textLower = text.toLowerCase().trim();
  const aliasMatch = aliasMap.get(textLower);
  if (aliasMatch) {
    return aliasMatch.toLowerCase();
  }
  
  // Try word-by-word expansion
  const words = text.split(/[\s\-]+/);
  const expandedWords = words.map(word => {
    const wordLower = word.toLowerCase();
    return aliasMap.get(wordLower) || word;
  });
  
  return expandedWords.join(' ').toLowerCase();
}

/**
 * Check if two strings match with high confidence
 * Handles:
 * - Exact match (case insensitive)
 * - Abbreviations (Capital vs Cap, Education vs Ed)
 * - One contained in the other (Baum matches Baum Capital)
 */
function isHighConfidenceMatch(a: string, b: string, aliasMap: Map<string, string>): boolean {
  const normA = normalizeText(expandAbbreviations(a, aliasMap));
  const normB = normalizeText(expandAbbreviations(b, aliasMap));
  
  if (!normA || !normB) return false;
  
  // Exact match after normalization and alias expansion
  if (normA === normB) return true;
  
  // One contained in the other (for short forms)
  if (normA.length >= 3 && normB.includes(normA)) return true;
  if (normB.length >= 3 && normA.includes(normB)) return true;
  
  // Handle common built-in abbreviations
  const abbreviations: Record<string, string[]> = {
    'capital': ['cap', 'capitol'],
    'investment': ['inv', 'invest', 'investments'],
    'partners': ['ptnrs', 'part'],
    'management': ['mgmt', 'mgt', 'prop mgmt', 'property management'],
    'associates': ['assoc', 'assocs'],
    'technology': ['tech'],
    'services': ['svcs', 'svc'],
    'financial': ['fin'],
    'industries': ['ind', 'indus'],
    'international': ['intl', 'int'],
    'american': ['amer'],
    'education': ['edu', 'ed', 'k12', 'k-12'],
    'senior': ['sr', 'sr.'],
    'junior': ['jr', 'jr.'],
    'living': ['liv'],
    'property': ['prop'],
    'heritage': ['her'],
    'new heritage': ['nh', 'new her'],
    'gp partners': ['gp'],
    'o2 investment partners': ['o2'],
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
    /^[A-Z]{1,2}$/,                    // Single initials like JF, SD (but allow NH, GP which are 2 chars)
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
    // Special case: allow known sponsor abbreviations like NH, GP, O2
    if (/^(NH|GP|O2|FMS)$/i.test(cleaned)) return true;
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
  engagements: Engagement[],
  aliasMap: Map<string, string>
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
    
    // Segment 0 MUST match sponsor_name (with alias expansion)
    const sponsorMatches = isHighConfidenceMatch(sponsorSegment, eng.sponsor_name, aliasMap);
    if (sponsorMatches) {
      score += 10;
    }
    
    // Segment 1 MUST match portfolio_company (with alias expansion)
    const clientMatches = isHighConfidenceMatch(clientSegment, eng.portfolio_company, aliasMap);
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

    // Step 0: Fetch sponsor aliases for this workspace
    const { data: aliases } = await supabase
      .from('sponsor_aliases')
      .select('alias, canonical_name')
      .eq('workspace_id', client_id);

    const aliasMap = new Map<string, string>();
    (aliases || []).forEach((a: SponsorAlias) => {
      aliasMap.set(a.alias.toLowerCase(), a.canonical_name.toLowerCase());
    });
    console.log(`Loaded ${aliasMap.size} sponsor aliases`);

    // Step 1: Upsert NocoDB campaigns into campaigns table WITH METRICS
    const [smartleadRes, replyioRes] = await Promise.all([
      supabase.from('nocodb_smartlead_campaigns').select(`
        campaign_id, campaign_name, status, campaign_created_date, updated_at,
        total_emails_sent, unique_emails_sent, total_replies, total_leads,
        leads_not_started, leads_in_progress, leads_completed, leads_blocked, leads_paused, leads_interested
      `),
      supabase.from('nocodb_replyio_campaigns').select(`
        campaign_id, campaign_name, status, campaign_created_date, updated_at,
        deliveries, bounces, total_replies, total_people
      `),
    ]);

    interface NocoDBCampaign {
      external_id: string;
      name: string;
      status: string;
      campaign_type: string;
      created_at: string;
      updated_at: string;
      total_sent: number;
      total_replied: number;
      total_leads: number;
      settings: Record<string, unknown>;
    }

    const nocodbCampaigns: NocoDBCampaign[] = [];
    
    (smartleadRes.data || []).forEach(row => {
      if (row.campaign_id && row.campaign_name) {
        nocodbCampaigns.push({
          external_id: row.campaign_id,
          name: row.campaign_name,
          status: row.status || 'unknown',
          campaign_type: 'smartlead',
          created_at: row.campaign_created_date || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
          total_sent: row.total_emails_sent || 0,
          total_replied: row.total_replies || 0,
          total_leads: row.total_leads || 0,
          settings: {
            leads_not_started: row.leads_not_started || 0,
            leads_in_progress: row.leads_in_progress || 0,
            leads_completed: row.leads_completed || 0,
            leads_blocked: row.leads_blocked || 0,
            leads_paused: row.leads_paused || 0,
            leads_interested: row.leads_interested || 0,
            campaign_created_date: row.campaign_created_date,
          },
        });
      }
    });
    
    (replyioRes.data || []).forEach(row => {
      if (row.campaign_id && row.campaign_name) {
        // Reply.io: total_sent = deliveries + bounces (since deliveries is after bounces)
        const totalSent = (row.deliveries || 0) + (row.bounces || 0);
        nocodbCampaigns.push({
          external_id: row.campaign_id,
          name: row.campaign_name,
          status: row.status || 'unknown',
          campaign_type: 'replyio',
          created_at: row.campaign_created_date || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
          total_sent: totalSent,
          total_replied: row.total_replies || 0,
          total_leads: row.total_people || 0,
          settings: {
            deliveries: row.deliveries || 0,
            bounces: row.bounces || 0,
            campaign_created_date: row.campaign_created_date,
          },
        });
      }
    });
    console.log(`Found ${nocodbCampaigns.length} NocoDB campaigns to sync`);

    // Sync NocoDB campaigns to campaigns table WITH METRICS using upsert
    let syncedCount = 0;
    let updatedCount = 0;
    if (!dry_run && nocodbCampaigns.length > 0) {
      // Get existing campaigns by external_id to decide insert vs update
      const { data: existingCampaigns } = await supabase
        .from('campaigns')
        .select('id, external_id, name');
      
      const existingByExternalId = new Map((existingCampaigns || [])
        .filter(c => c.external_id)
        .map(c => [c.external_id, c]));
      const existingNames = new Set((existingCampaigns || []).map(c => c.name?.toLowerCase().trim()));
      
      // Separate into updates (existing external_id) and inserts (new campaigns)
      const toUpdate: NocoDBCampaign[] = [];
      const toInsert: NocoDBCampaign[] = [];
      
      for (const c of nocodbCampaigns) {
        if (existingByExternalId.has(c.external_id)) {
          toUpdate.push(c);
        } else if (!existingNames.has(c.name?.toLowerCase().trim())) {
          toInsert.push(c);
        }
      }
      
      console.log(`${toInsert.length} new campaigns to insert, ${toUpdate.length} existing campaigns to update metrics`);

      // Insert new campaigns in batches of 100
      for (let i = 0; i < toInsert.length; i += 100) {
        const batch = toInsert.slice(i, i + 100);
        const insertData = batch.map(c => {
          // Extract positive_replies from settings.leads_interested
          const leadsInterested = (c.settings?.leads_interested as number) || 0;
          const totalSent = c.total_sent || 0;
          
          return {
            external_id: c.external_id,
            name: c.name,
            status: c.status,
            campaign_type: c.campaign_type,
            created_at: c.created_at,
            updated_at: c.updated_at,
            total_sent: totalSent,
            total_replied: c.total_replied,
            positive_replies: leadsInterested, // Map leads_interested → positive_replies
            positive_rate: totalSent > 0 ? leadsInterested / totalSent : 0,
            reply_rate: totalSent > 0 ? (c.total_replied || 0) / totalSent : 0,
            settings: c.settings,
            engagement_id: '00000000-0000-0000-0000-000000000000',
          };
        });

        const { data: inserted, error: insertError } = await supabase
          .from('campaigns')
          .insert(insertData)
          .select();

        if (insertError) {
          console.error('Insert error:', insertError);
        } else {
          syncedCount += (inserted?.length || 0);
        }
      }

      // Update existing campaigns with metrics in batches
      for (let i = 0; i < toUpdate.length; i += 50) {
        const batch = toUpdate.slice(i, i + 50);
        
        for (const c of batch) {
          const existing = existingByExternalId.get(c.external_id);
          if (!existing) continue;

          // Extract positive_replies from settings.leads_interested
          const leadsInterested = (c.settings?.leads_interested as number) || 0;
          const totalSent = c.total_sent || 0;

          const { error: updateError } = await supabase
            .from('campaigns')
            .update({
              total_sent: totalSent,
              total_replied: c.total_replied,
              positive_replies: leadsInterested, // Map leads_interested → positive_replies
              positive_rate: totalSent > 0 ? leadsInterested / totalSent : 0,
              reply_rate: totalSent > 0 ? (c.total_replied || 0) / totalSent : 0,
              settings: c.settings,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`Update error for ${c.name}:`, updateError);
          } else {
            updatedCount++;
          }
        }
      }
      
      console.log(`Synced ${syncedCount} new campaigns, updated metrics for ${updatedCount} existing campaigns`);
    }

    // Step 2: Fetch existing engagements (excluding Unassigned placeholder)
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

    // Step 3: Fetch ALL unassigned campaigns
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

      const { match, ambiguous, reason } = findMatchingEngagement(
        segments, 
        campaign.name, 
        existingEngagements || [],
        aliasMap
      );

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
    console.log(`NocoDB campaigns synced: ${syncedCount} new, ${updatedCount} updated`);
    console.log(`Campaigns linked: ${result.campaignsLinked}`);
    console.log(`Campaigns unlinked: ${result.campaignsUnlinked}`);
    console.log(`Ambiguous/problematic: ${result.ambiguous.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        nocodb_synced: syncedCount,
        nocodb_updated: updatedCount,
        aliases_loaded: aliasMap.size,
        ...result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Auto-pair error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
