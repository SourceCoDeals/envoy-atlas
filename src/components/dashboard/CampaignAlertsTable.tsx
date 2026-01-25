import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ExternalLink, Pause } from 'lucide-react';
import type { AlertCampaign } from '@/hooks/useOverviewDashboard';

interface CampaignAlertsTableProps {
  campaigns: AlertCampaign[];
}

const issueConfig: Record<AlertCampaign['issue'], { label: string; color: string }> = {
  low_reply: { label: 'Low reply rate', color: 'bg-warning/20 text-warning border-warning/30' },
  declining: { label: 'Declining engagement', color: 'bg-warning/20 text-warning border-warning/30' },
  no_replies: { label: 'No replies', color: 'bg-destructive/20 text-destructive border-destructive/30' },
  low_positive: { label: 'Low positive rate', color: 'bg-warning/20 text-warning border-warning/30' },
};

export function CampaignAlertsTable({ campaigns }: CampaignAlertsTableProps) {
  const navigate = useNavigate();

  if (campaigns.length === 0) {
    return null; // Don't render if no alerts
  }

  return (
    <Card className="border-warning/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <CardTitle className="text-lg">Needs Attention</CardTitle>
          <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 ml-auto">
            {campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop Table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Sent (7d)</TableHead>
                <TableHead className="text-right">Reply %</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => {
                const config = issueConfig[campaign.issue];
                return (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      <Link 
                        to={`/campaigns/${campaign.id}`}
                        className="hover:text-primary transition-colors"
                      >
                        {campaign.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {campaign.sent7d.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {campaign.replyRate.toFixed(2)}%
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={config.color}>
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/campaigns/${campaign.id}`)}
                      >
                        Review
                        <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card Layout */}
        <div className="md:hidden space-y-3">
          {campaigns.map((campaign) => {
            const config = issueConfig[campaign.issue];
            return (
              <div 
                key={campaign.id}
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Link 
                    to={`/campaigns/${campaign.id}`}
                    className="font-medium text-sm line-clamp-2 hover:text-primary"
                  >
                    {campaign.name}
                  </Link>
                  <Badge variant="outline" className={`${config.color} shrink-0 text-xs`}>
                    {config.label}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{campaign.sent7d.toLocaleString()} sent • {campaign.replyRate.toFixed(2)}% reply</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2"
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                  >
                    Review
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
