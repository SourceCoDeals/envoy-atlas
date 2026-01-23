import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Mail, Link2, Plus, ArrowRight, Sparkles, 
  ChevronDown, ChevronUp, ExternalLink 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { LinkedCampaignWithStats } from '@/hooks/useEngagementReport';

interface SuggestedCampaign {
  id: string;
  name: string;
  platform: 'smartlead' | 'replyio';
  totalSent: number;
  status: string | null;
  matchReason: string;
}

interface LinkedCampaignsSectionProps {
  linkedCampaigns: LinkedCampaignWithStats[];
  engagementId: string;
  engagementName: string;
  sponsorName?: string | null;
  portfolioCompany?: string | null;
  onLinkCampaigns: () => void;
  onRefresh: () => void;
}

export function LinkedCampaignsSection({
  linkedCampaigns,
  engagementId,
  engagementName,
  sponsorName,
  portfolioCompany,
  onLinkCampaigns,
  onRefresh,
}: LinkedCampaignsSectionProps) {
  const [suggested, setSuggested] = useState<SuggestedCampaign[]>([]);
  const [loadingSuggested, setLoadingSuggested] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(linkedCampaigns.length <= 5);

  // Fetch suggested campaigns when no linked campaigns exist
  useEffect(() => {
    if (linkedCampaigns.length === 0) {
      fetchSuggestedCampaigns();
    }
  }, [linkedCampaigns.length, engagementId, engagementName, sponsorName, portfolioCompany]);

  const fetchSuggestedCampaigns = async () => {
    setLoadingSuggested(true);
    try {
      // Get unassigned campaigns
      const { data: unassigned } = await supabase
        .from('campaigns')
        .select('id, name, campaign_type, total_sent, status')
        .eq('engagement_id', '00000000-0000-0000-0000-000000000000')
        .order('total_sent', { ascending: false })
        .limit(100);

      if (!unassigned?.length) {
        setSuggested([]);
        return;
      }

      // Find matches based on engagement name, sponsor, or portfolio company
      const matches: SuggestedCampaign[] = [];
      const searchTerms: { term: string; reason: string }[] = [];

      if (portfolioCompany) {
        searchTerms.push({ term: portfolioCompany.toLowerCase(), reason: 'portfolio company' });
      }
      if (sponsorName) {
        searchTerms.push({ term: sponsorName.toLowerCase(), reason: 'sponsor' });
      }
      if (engagementName) {
        // Extract meaningful words from engagement name
        const words = engagementName.split(/[\s\-]+/).filter(w => w.length >= 3);
        words.forEach(word => {
          searchTerms.push({ term: word.toLowerCase(), reason: 'engagement name' });
        });
      }

      unassigned.forEach(campaign => {
        const nameLower = campaign.name.toLowerCase();
        
        for (const { term, reason } of searchTerms) {
          if (nameLower.includes(term)) {
            matches.push({
              id: campaign.id,
              name: campaign.name,
              platform: campaign.campaign_type as 'smartlead' | 'replyio',
              totalSent: campaign.total_sent || 0,
              status: campaign.status,
              matchReason: `Matches ${reason}: "${term}"`,
            });
            break; // Only add once per campaign
          }
        }
      });

      // Sort by totalSent descending
      matches.sort((a, b) => b.totalSent - a.totalSent);
      setSuggested(matches.slice(0, 10));
    } catch (err) {
      console.error('Error fetching suggested campaigns:', err);
    } finally {
      setLoadingSuggested(false);
    }
  };

  const handleQuickLink = async (campaignId: string) => {
    setLinking(campaignId);
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ engagement_id: engagementId })
        .eq('id', campaignId);

      if (error) throw error;
      
      // Remove from suggestions and refresh
      setSuggested(prev => prev.filter(c => c.id !== campaignId));
      onRefresh();
    } catch (err) {
      console.error('Error linking campaign:', err);
    } finally {
      setLinking(null);
    }
  };

  const displayedCampaigns = expanded ? linkedCampaigns : linkedCampaigns.slice(0, 5);
  const hasMore = linkedCampaigns.length > 5;

  // Empty state with suggestions
  if (linkedCampaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Linked Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Link2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No campaigns linked yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Link campaigns to see email performance metrics and trends.
              </p>
            </div>
            <Button onClick={onLinkCampaigns}>
              <Plus className="h-4 w-4 mr-2" />
              Link Campaigns
            </Button>
          </div>

          {/* Suggested Matches */}
          {loadingSuggested ? (
            <div className="mt-6 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : suggested.length > 0 ? (
            <div className="mt-6 border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-warning" />
                <h4 className="font-medium text-sm">Suggested Matches</h4>
                <Badge variant="outline" className="text-[10px]">
                  {suggested.length} found
                </Badge>
              </div>
              <div className="space-y-2">
                {suggested.slice(0, 5).map(campaign => (
                  <div 
                    key={campaign.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.totalSent.toLocaleString()} sent • {campaign.matchReason}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {campaign.platform === 'smartlead' ? 'SL' : 'R.io'}
                    </Badge>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleQuickLink(campaign.id)}
                      disabled={linking === campaign.id}
                    >
                      {linking === campaign.id ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <>
                          <Link2 className="h-3 w-3 mr-1" />
                          Link
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
              {suggested.length > 5 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full mt-2"
                  onClick={onLinkCampaigns}
                >
                  View all {suggested.length} suggestions
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  // Linked campaigns list
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Linked Campaigns
            <Badge variant="secondary">{linkedCampaigns.length}</Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onLinkCampaigns}>
            <Plus className="h-4 w-4 mr-2" />
            Link More
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {displayedCampaigns.map(campaign => (
            <div 
              key={campaign.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{campaign.name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{campaign.sent.toLocaleString()} sent</span>
                  <span>{campaign.replied.toLocaleString()} replied</span>
                  <span className="text-success">
                    {campaign.positiveReplies} positive ({campaign.positiveRate.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <Badge 
                variant="outline" 
                className={
                  campaign.platform === 'smartlead' 
                    ? 'bg-primary/10 text-primary border-primary/30' 
                    : 'bg-accent text-accent-foreground'
                }
              >
                {campaign.platform === 'smartlead' ? 'SL' : 'R.io'}
              </Badge>
              <Badge 
                variant="outline"
                className={
                  campaign.status?.toLowerCase() === 'active' || campaign.status?.toLowerCase() === 'running'
                    ? 'bg-success/10 text-success border-success/30'
                    : 'bg-muted text-muted-foreground'
                }
              >
                {campaign.status || 'Unknown'}
              </Badge>
            </div>
          ))}
        </div>
        
        {hasMore && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-2"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Show {linkedCampaigns.length - 5} more campaigns
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
