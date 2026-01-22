import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Link2, Briefcase, AlertTriangle, Shield, ShieldAlert } from 'lucide-react';
import { CampaignWithMetrics } from '@/hooks/useCampaigns';

interface Engagement {
  id: string;
  engagement_name: string;
  client_name?: string | null;
  sponsor?: string | null;
}

interface CampaignMatch {
  campaignId: string;
  campaignName: string;
  engagementId: string;
  engagementName: string;
  matchType: 'engagement_name' | 'client_name' | 'sponsor';
  confidence: 'high' | 'medium';
  platform: string;
  score: number;
}

interface AutoLinkPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaigns: CampaignWithMetrics[];
  engagements: Engagement[];
  onConfirm: (matches: CampaignMatch[]) => Promise<void>;
}

// Minimum score threshold to consider a match valid
const MIN_SCORE_THRESHOLD = 12;
const MIN_TERM_LENGTH = 4;

/**
 * Creates a word-boundary regex pattern for matching
 */
function createWordBoundaryPattern(term: string): RegExp | null {
  const trimmed = term.trim();
  if (trimmed.length < MIN_TERM_LENGTH) return null;
  
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

/**
 * Extracts meaningful terms from a string
 */
function extractTerms(text: string | null | undefined): string[] {
  if (!text) return [];
  
  const terms: string[] = [];
  const trimmed = text.trim();
  
  if (trimmed.length >= MIN_TERM_LENGTH) {
    terms.push(trimmed);
  }
  
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

export function AutoLinkPreviewModal({
  open,
  onOpenChange,
  campaigns,
  engagements,
  onConfirm,
}: AutoLinkPreviewModalProps) {
  const [confirming, setConfirming] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [showMediumConfidence, setShowMediumConfidence] = useState(true);

  // Check for sponsors with multiple engagements (ambiguous)
  const ambiguousSponsors = useMemo(() => {
    const sponsorCount = new Map<string, number>();
    engagements.forEach(eng => {
      if (eng.sponsor) {
        const sponsor = eng.sponsor.toLowerCase();
        sponsorCount.set(sponsor, (sponsorCount.get(sponsor) || 0) + 1);
      }
    });
    return new Set(
      [...sponsorCount.entries()]
        .filter(([_, count]) => count > 1)
        .map(([sponsor]) => sponsor)
    );
  }, [engagements]);

  // Calculate matches with improved algorithm
  const matches = useMemo(() => {
    const unlinkedCampaigns = campaigns.filter(c => !c.engagement_id);
    const results: CampaignMatch[] = [];

    // Build patterns for each engagement
    const engagementMatchers = engagements.map(eng => {
      const patterns: { pattern: RegExp; weight: number; term: string; type: 'engagement_name' | 'client_name' | 'sponsor' }[] = [];
      
      // Priority 1: Engagement name (weight = 3)
      for (const term of extractTerms(eng.engagement_name)) {
        const pattern = createWordBoundaryPattern(term);
        if (pattern) {
          patterns.push({ pattern, weight: 3, term, type: 'engagement_name' });
        }
      }
      
      // Priority 2: Client/Portfolio name (weight = 2)
      for (const term of extractTerms(eng.client_name)) {
        const pattern = createWordBoundaryPattern(term);
        if (pattern) {
          patterns.push({ pattern, weight: 2, term, type: 'client_name' });
        }
      }
      
      // Priority 3: Sponsor name (weight = 1) - but only if not ambiguous
      if (eng.sponsor && !ambiguousSponsors.has(eng.sponsor.toLowerCase())) {
        for (const term of extractTerms(eng.sponsor)) {
          const pattern = createWordBoundaryPattern(term);
          if (pattern) {
            patterns.push({ pattern, weight: 1, term, type: 'sponsor' });
          }
        }
      }
      
      return { id: eng.id, name: eng.engagement_name, patterns };
    });

    unlinkedCampaigns.forEach(campaign => {
      // Skip internal/test campaigns
      if (/sourceco|^new sequence|^test\b/i.test(campaign.name)) {
        return;
      }

      let bestMatch: {
        id: string;
        name: string;
        score: number;
        confidence: 'high' | 'medium';
        matchType: 'engagement_name' | 'client_name' | 'sponsor';
      } | null = null;

      for (const matcher of engagementMatchers) {
        let totalScore = 0;
        let hasNameOrClientMatch = false;
        let primaryMatchType: 'engagement_name' | 'client_name' | 'sponsor' = 'sponsor';

        for (const { pattern, weight, term, type } of matcher.patterns) {
          if (pattern.test(campaign.name)) {
            const matchScore = weight * term.length;
            totalScore += matchScore;

            if (type === 'engagement_name' || type === 'client_name') {
              hasNameOrClientMatch = true;
            }

            // Track highest priority match type
            if (type === 'engagement_name') {
              primaryMatchType = 'engagement_name';
            } else if (type === 'client_name' && primaryMatchType !== 'engagement_name') {
              primaryMatchType = 'client_name';
            }
          }
        }

        if (totalScore < MIN_SCORE_THRESHOLD) continue;

        const confidence: 'high' | 'medium' = hasNameOrClientMatch ? 'high' : 'medium';

        if (!bestMatch ||
            totalScore > bestMatch.score ||
            (totalScore === bestMatch.score && confidence === 'high' && bestMatch.confidence === 'medium')) {
          bestMatch = {
            id: matcher.id,
            name: matcher.name,
            score: totalScore,
            confidence,
            matchType: primaryMatchType,
          };
        }
      }

      if (bestMatch) {
        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          engagementId: bestMatch.id,
          engagementName: bestMatch.name,
          matchType: bestMatch.matchType,
          confidence: bestMatch.confidence,
          platform: campaign.platform,
          score: bestMatch.score,
        });
      }
    });

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }, [campaigns, engagements, ambiguousSponsors]);

  // Group matches by engagement
  const groupedMatches = useMemo(() => {
    const filteredMatches = showMediumConfidence 
      ? matches 
      : matches.filter(m => m.confidence === 'high');
    
    const groups = new Map<string, CampaignMatch[]>();
    filteredMatches.forEach(match => {
      const existing = groups.get(match.engagementId) || [];
      existing.push(match);
      groups.set(match.engagementId, existing);
    });
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [matches, showMediumConfidence]);

  const visibleMatches = showMediumConfidence ? matches : matches.filter(m => m.confidence === 'high');
  const activeMatches = visibleMatches.filter(m => !excludedIds.has(m.campaignId));
  const unlinkedCount = campaigns.filter(c => !c.engagement_id).length;
  const highConfidenceCount = matches.filter(m => m.confidence === 'high').length;
  const mediumConfidenceCount = matches.filter(m => m.confidence === 'medium').length;

  const toggleExclude = (campaignId: string) => {
    const newExcluded = new Set(excludedIds);
    if (newExcluded.has(campaignId)) {
      newExcluded.delete(campaignId);
    } else {
      newExcluded.add(campaignId);
    }
    setExcludedIds(newExcluded);
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(activeMatches);
      onOpenChange(false);
    } finally {
      setConfirming(false);
    }
  };

  const getMatchTypeBadge = (match: CampaignMatch) => {
    const isHigh = match.confidence === 'high';
    
    if (match.matchType === 'engagement_name') {
      return (
        <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
          <Shield className="h-3 w-3 mr-1" />
          Exact
        </Badge>
      );
    }
    if (match.matchType === 'client_name') {
      return (
        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
          <Shield className="h-3 w-3 mr-1" />
          Client
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
        <ShieldAlert className="h-3 w-3 mr-1" />
        Sponsor
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Auto-Link Campaigns Preview
          </DialogTitle>
          <DialogDescription>
            Found {matches.length} potential matches out of {unlinkedCount} unlinked campaigns.
            <span className="ml-2 text-success">{highConfidenceCount} high</span>
            {mediumConfidenceCount > 0 && (
              <span className="ml-1 text-warning">/ {mediumConfidenceCount} medium</span>
            )} confidence.
          </DialogDescription>
        </DialogHeader>

        {mediumConfidenceCount > 0 && (
          <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-md">
            <Checkbox
              id="show-medium"
              checked={showMediumConfidence}
              onCheckedChange={(checked) => setShowMediumConfidence(!!checked)}
            />
            <label htmlFor="show-medium" className="text-sm cursor-pointer">
              Include sponsor-only matches (medium confidence)
            </label>
          </div>
        )}

        {visibleMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-warning mb-4" />
            <p className="text-lg font-medium">No Matches Found</p>
            <p className="text-sm text-muted-foreground max-w-sm mt-2">
              Could not find any campaigns with names matching your engagements. 
              Try linking them manually from the Engagements page.
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4">
              {groupedMatches.map(([engagementId, engagementMatches]) => {
                const engagementName = engagementMatches[0]?.engagementName || 'Unknown';
                const activeCount = engagementMatches.filter(m => !excludedIds.has(m.campaignId)).length;
                const hasHighConfidence = engagementMatches.some(m => m.confidence === 'high');
                
                return (
                  <div key={engagementId} className={`border rounded-lg p-3 ${hasHighConfidence ? 'border-success/30' : 'border-warning/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{engagementName}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {activeCount}/{engagementMatches.length}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {engagementMatches.map(match => (
                        <div 
                          key={match.campaignId}
                          className={`flex items-center gap-2 py-1.5 px-2 rounded text-sm ${
                            excludedIds.has(match.campaignId) ? 'opacity-50 bg-muted/50' : 'hover:bg-muted/50'
                          }`}
                        >
                          <Checkbox
                            checked={!excludedIds.has(match.campaignId)}
                            onCheckedChange={() => toggleExclude(match.campaignId)}
                          />
                          <span className="truncate flex-1">{match.campaignName}</span>
                          <Badge variant="outline" className="text-[10px]">{match.platform}</Badge>
                          {getMatchTypeBadge(match)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={confirming || activeMatches.length === 0}
          >
            {confirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Link {activeMatches.length} Campaign{activeMatches.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
