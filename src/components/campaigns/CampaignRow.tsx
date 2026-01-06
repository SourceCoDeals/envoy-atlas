import { Link } from 'react-router-dom';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CampaignWithMetrics } from '@/hooks/useCampaigns';

interface CampaignRowProps {
  campaign: CampaignWithMetrics;
}

export function CampaignRow({ campaign }: CampaignRowProps) {
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'started':
        return 'default';
      case 'paused':
        return 'secondary';
      case 'completed':
      case 'stopped':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  return (
    <TableRow className="cursor-pointer hover:bg-accent/50">
      <TableCell className="font-medium">
        <Link to={`/campaigns/${campaign.id}`} className="block">
          <div className="flex flex-col">
            <span className="truncate max-w-[280px] hover:text-primary">{campaign.name}</span>
            <span className="text-xs text-muted-foreground">{campaign.platform}</span>
          </div>
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant={getStatusVariant(campaign.status)}>
          {campaign.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatNumber(campaign.total_sent)}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatPercent(campaign.open_rate)}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatPercent(campaign.click_rate)}
      </TableCell>
      <TableCell className="text-right font-mono">
        <span className={campaign.reply_rate >= 5 ? 'text-green-600' : ''}>
          {formatPercent(campaign.reply_rate)}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono">
        <span className={campaign.bounce_rate >= 5 ? 'text-destructive' : ''}>
          {formatPercent(campaign.bounce_rate)}
        </span>
      </TableCell>
    </TableRow>
  );
}
