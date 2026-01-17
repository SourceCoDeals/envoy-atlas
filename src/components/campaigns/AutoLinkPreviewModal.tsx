import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Link2, Briefcase, AlertTriangle } from 'lucide-react';
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
  platform: string;
}

interface AutoLinkPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaigns: CampaignWithMetrics[];
  engagements: Engagement[];
  onConfirm: (matches: CampaignMatch[]) => Promise<void>;
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

  // Calculate matches
  const matches = useMemo(() => {
    const unlinkedCampaigns = campaigns.filter(c => !c.engagement_id);
    const results: CampaignMatch[] = [];

    // Sort engagements by name length (longer = more specific = higher priority)
    const sortedEngagements = [...engagements].sort(
      (a, b) => (b.engagement_name?.length || 0) - (a.engagement_name?.length || 0)
    );

    unlinkedCampaigns.forEach(campaign => {
      const campaignNameLower = campaign.name.toLowerCase();
      
      for (const engagement of sortedEngagements) {
        // Check engagement_name
        if (engagement.engagement_name && 
            campaignNameLower.includes(engagement.engagement_name.toLowerCase())) {
          results.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            engagementId: engagement.id,
            engagementName: engagement.engagement_name,
            matchType: 'engagement_name',
            platform: campaign.platform,
          });
          break;
        }
        
        // Check client_name
        if (engagement.client_name && 
            engagement.client_name.length >= 3 &&
            campaignNameLower.includes(engagement.client_name.toLowerCase())) {
          results.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            engagementId: engagement.id,
            engagementName: engagement.engagement_name,
            matchType: 'client_name',
            platform: campaign.platform,
          });
          break;
        }
        
        // Check sponsor
        if (engagement.sponsor && 
            engagement.sponsor.length >= 3 &&
            campaignNameLower.includes(engagement.sponsor.toLowerCase())) {
          results.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            engagementId: engagement.id,
            engagementName: engagement.engagement_name,
            matchType: 'sponsor',
            platform: campaign.platform,
          });
          break;
        }
      }
    });

    return results;
  }, [campaigns, engagements]);

  // Group matches by engagement
  const groupedMatches = useMemo(() => {
    const groups = new Map<string, CampaignMatch[]>();
    matches.forEach(match => {
      const existing = groups.get(match.engagementId) || [];
      existing.push(match);
      groups.set(match.engagementId, existing);
    });
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [matches]);

  const activeMatches = matches.filter(m => !excludedIds.has(m.campaignId));
  const unlinkedCount = campaigns.filter(c => !c.engagement_id).length;

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

  const getMatchTypeBadge = (type: CampaignMatch['matchType']) => {
    switch (type) {
      case 'engagement_name':
        return <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">Exact</Badge>;
      case 'client_name':
        return <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">Client</Badge>;
      case 'sponsor':
        return <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">Sponsor</Badge>;
    }
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
            Uncheck any you want to exclude.
          </DialogDescription>
        </DialogHeader>

        {matches.length === 0 ? (
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
                
                return (
                  <div key={engagementId} className="border rounded-lg p-3">
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
                          {getMatchTypeBadge(match.matchType)}
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
