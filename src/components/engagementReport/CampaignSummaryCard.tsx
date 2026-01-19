import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Mail, TrendingUp, MessageSquare } from 'lucide-react';

interface CampaignSummaryCardProps {
  campaign: {
    id: string;
    name: string;
    platform: string;
    status?: string | null;
    sent?: number;
    openRate?: number;
    replyRate?: number;
  };
}

export function CampaignSummaryCard({ campaign }: CampaignSummaryCardProps) {
  const navigate = useNavigate();

  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
    active: { variant: 'default', label: 'Active' },
    completed: { variant: 'secondary', label: 'Completed' },
    paused: { variant: 'outline', label: 'Paused' },
    draft: { variant: 'outline', label: 'Draft' },
  };

  const status = statusConfig[campaign.status || 'active'] || statusConfig.active;

  const platformColor = campaign.platform?.toLowerCase().includes('smartlead') 
    ? 'bg-purple-500/10 text-purple-600 border-purple-500/30'
    : campaign.platform?.toLowerCase().includes('reply')
    ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
    : 'bg-muted text-muted-foreground';

  return (
    <Card 
      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => navigate(`/campaigns/${campaign.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate pr-2">{campaign.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={`text-[10px] ${platformColor}`}>
              {campaign.platform}
            </Badge>
            <Badge variant={status.variant} className="text-[10px]">
              {status.label}
            </Badge>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded bg-muted/50">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Mail className="h-3 w-3 text-muted-foreground" />
          </div>
          <p className="text-xs font-bold">{(campaign.sent || 0).toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Sent</p>
        </div>
        <div className="p-2 rounded bg-muted/50">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
          </div>
          <p className="text-xs font-bold">{(campaign.openRate || 0).toFixed(1)}%</p>
          <p className="text-[10px] text-muted-foreground">Open</p>
        </div>
        <div className="p-2 rounded bg-muted/50">
          <div className="flex items-center justify-center gap-1 mb-1">
            <MessageSquare className="h-3 w-3 text-muted-foreground" />
          </div>
          <p className="text-xs font-bold">{(campaign.replyRate || 0).toFixed(1)}%</p>
          <p className="text-[10px] text-muted-foreground">Reply</p>
        </div>
      </div>
    </Card>
  );
}
