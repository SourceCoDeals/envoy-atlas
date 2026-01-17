import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Mail, Eye, MessageSquare, ThumbsUp, X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface LinkedCampaign {
  id: string;
  name: string;
  platform: 'smartlead' | 'replyio';
  status: string | null;
  totalSent: number;
  totalOpened: number;
  totalReplied: number;
  totalPositive: number;
}

interface LinkedCampaignsListProps {
  campaigns: LinkedCampaign[];
  onUnlink: (campaignId: string, platform: 'smartlead' | 'replyio') => void;
  unlinking?: string | null;
}

export function LinkedCampaignsList({ campaigns, onUnlink, unlinking }: LinkedCampaignsListProps) {
  if (campaigns.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No campaigns linked yet</p>
        <p className="text-xs">Click "Link Campaigns" to add email campaigns to this engagement</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {campaigns.map((campaign) => {
        const openRate = campaign.totalSent > 0 ? (campaign.totalOpened / campaign.totalSent) * 100 : 0;
        const replyRate = campaign.totalSent > 0 ? (campaign.totalReplied / campaign.totalSent) * 100 : 0;
        const positiveRate = campaign.totalReplied > 0 ? (campaign.totalPositive / campaign.totalReplied) * 100 : 0;

        return (
          <div
            key={`${campaign.platform}-${campaign.id}`}
            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Badge
                variant="outline"
                className={campaign.platform === 'smartlead' 
                  ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' 
                  : 'bg-purple-500/10 text-purple-500 border-purple-500/30'
                }
              >
                {campaign.platform === 'smartlead' ? 'SL' : 'R.io'}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{campaign.name}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {campaign.totalSent.toLocaleString()} sent
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {openRate.toFixed(1)}% opens
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {replyRate.toFixed(1)}% replies
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" />
                    {positiveRate.toFixed(0)}% positive
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 ml-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                    asChild
                  >
                    <Link to={`/campaigns/${campaign.platform}/${campaign.id}/summary`}>
                      <ExternalLink className="h-4 w-4" />
                      <span className="text-xs font-medium">View</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Campaign Dashboard</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onUnlink(campaign.id, campaign.platform)}
                    disabled={unlinking === campaign.id}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Unlink Campaign</TooltipContent>
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}
