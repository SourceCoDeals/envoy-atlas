import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Trash2,
  ChevronRight,
} from 'lucide-react';

interface BounceData {
  totalBounces: number;
  bounceRate: number;
  hardBounces: number;
  softBounces: number;
  byCampaign: {
    name: string;
    bounceRate: number;
    bounces: number;
    sent: number;
  }[];
  byReason: {
    reason: string;
    count: number;
    type: 'hard' | 'soft';
  }[];
  threshold: number;
}

interface BounceBreakdownProps {
  data: BounceData;
  onCleanLists?: () => void;
  onViewBounced?: () => void;
}

export function BounceBreakdown({ data, onCleanLists, onViewBounced }: BounceBreakdownProps) {
  const thresholdPercent = (data.bounceRate / data.threshold) * 100;
  const isNearThreshold = thresholdPercent > 80;
  const isOverThreshold = data.bounceRate >= data.threshold;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <XCircle className="h-5 w-5" />
          Bounce Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Bounce Rate */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Overall Bounce Rate</p>
              <p className={`text-2xl font-bold ${isOverThreshold ? 'text-destructive' : isNearThreshold ? 'text-warning' : 'text-foreground'}`}>
                {data.bounceRate.toFixed(2)}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Threshold</p>
              <p className="text-lg font-medium">{data.threshold}%</p>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span className={isNearThreshold ? 'text-warning font-medium' : ''}>
                {thresholdPercent.toFixed(0)}% of limit
              </span>
              <span>{data.threshold}%</span>
            </div>
            <Progress 
              value={Math.min(thresholdPercent, 100)} 
              className={`h-2 ${isOverThreshold ? '[&>div]:bg-destructive' : isNearThreshold ? '[&>div]:bg-warning' : ''}`}
            />
          </div>

          {isNearThreshold && !isOverThreshold && (
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span>Approaching threshold — take preventive action</span>
            </div>
          )}
        </div>

        {/* Hard vs Soft Breakdown */}
        <div>
          <h4 className="text-sm font-medium mb-3">Bounce Type Breakdown</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Hard Bounces</span>
                <Badge variant="destructive">{data.hardBounces}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Invalid addresses — remove immediately
              </p>
            </div>
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Soft Bounces</span>
                <Badge className="bg-warning/20 text-warning border-warning/30">{data.softBounces}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Temporary issues — will retry
              </p>
            </div>
          </div>
        </div>

        {/* By Campaign */}
        {data.byCampaign.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Bounces by Campaign</h4>
            <div className="space-y-2">
              {data.byCampaign.slice(0, 5).map((campaign) => (
                <div 
                  key={campaign.name} 
                  className={`flex items-center justify-between p-2 rounded-md ${
                    campaign.bounceRate > data.threshold ? 'bg-destructive/10' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.bounces} bounces / {campaign.sent.toLocaleString()} sent
                    </p>
                  </div>
                  <Badge 
                    variant={campaign.bounceRate > data.threshold ? 'destructive' : 'outline'}
                  >
                    {campaign.bounceRate.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By Reason */}
        {data.byReason.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Top Bounce Reasons</h4>
            <div className="space-y-2">
              {data.byReason.slice(0, 4).map((reason, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${reason.type === 'hard' ? 'bg-destructive' : 'bg-warning'}`} />
                    {reason.reason}
                  </span>
                  <span className="font-medium">{reason.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {onCleanLists && (
            <Button variant="outline" size="sm" onClick={onCleanLists} className="flex-1">
              <Trash2 className="h-4 w-4 mr-2" />
              Clean Lists
            </Button>
          )}
          {onViewBounced && (
            <Button variant="outline" size="sm" onClick={onViewBounced} className="flex-1">
              View Bounced
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
