import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import type { CampaignBounceData } from '@/hooks/useDeliverabilityData';

interface CampaignBounceTableProps {
  campaigns: CampaignBounceData[];
  limit?: number;
}

export function CampaignBounceTable({ campaigns, limit = 10 }: CampaignBounceTableProps) {
  const criticalCampaigns = campaigns.filter(c => c.bounceRate > 5);
  const warningCampaigns = campaigns.filter(c => c.bounceRate > 2 && c.bounceRate <= 5);
  
  const displayCampaigns = campaigns.slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Campaign Bounce Rates
          </CardTitle>
          <div className="flex gap-1">
            {criticalCampaigns.length > 0 && (
              <Badge variant="destructive">{criticalCampaigns.length} critical</Badge>
            )}
            {warningCampaigns.length > 0 && (
              <Badge className="bg-warning/20 text-warning border-warning/30">
                {warningCampaigns.length} warning
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mb-2 text-success" />
            <p className="text-sm">No campaign bounce data available</p>
          </div>
        ) : (
          <>
            {/* Critical Alert Banner */}
            {criticalCampaigns.length > 0 && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    {criticalCampaigns.length} campaign{criticalCampaigns.length > 1 ? 's' : ''} with critical bounce rate (&gt;5%)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    High bounce rates damage sender reputation. Consider pausing affected campaigns and cleaning lists.
                  </p>
                </div>
              </div>
            )}

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-center">Platform</TableHead>
                    <TableHead className="text-center">Sent</TableHead>
                    <TableHead className="text-center">Bounced</TableHead>
                    <TableHead className="text-right">Bounce Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayCampaigns.map((campaign) => {
                    const isCritical = campaign.bounceRate > 5;
                    const isWarning = campaign.bounceRate > 2 && campaign.bounceRate <= 5;
                    
                    return (
                      <TableRow 
                        key={`${campaign.platform}-${campaign.id}`}
                        className={
                          isCritical ? 'bg-destructive/5' :
                          isWarning ? 'bg-warning/5' : ''
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isCritical && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                            {isWarning && <AlertTriangle className="h-4 w-4 text-warning shrink-0" />}
                            <span className="font-medium truncate max-w-[300px]" title={campaign.name}>
                              {campaign.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs capitalize">
                            {campaign.platform === 'smartlead' ? 'SmartLead' : 'Reply.io'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {campaign.sent.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {campaign.bounces.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress 
                              value={Math.min(campaign.bounceRate * 10, 100)} 
                              className="w-16 h-2"
                            />
                            <span className={`font-medium tabular-nums min-w-[60px] text-right ${
                              isCritical ? 'text-destructive' :
                              isWarning ? 'text-warning' :
                              'text-success'
                            }`}>
                              {campaign.bounceRate.toFixed(2)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {campaigns.length > limit && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Showing top {limit} of {campaigns.length} campaigns by bounce rate
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
