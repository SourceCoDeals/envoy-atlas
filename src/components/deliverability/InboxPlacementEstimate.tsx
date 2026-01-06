import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Inbox, AlertTriangle, Ban, Mail, Info } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface PlacementBreakdown {
  inbox: number;
  promotions: number;
  spam: number;
  blocked: number;
}

interface ISPPlacement {
  name: string;
  estimatedInboxRate: number;
  volume: number;
  deliveryRate: number;
}

interface InboxPlacementEstimateProps {
  overallInboxRate: number;
  breakdown: PlacementBreakdown;
  byISP: ISPPlacement[];
  confidence: 'estimated' | 'measured';
}

export function InboxPlacementEstimate({
  overallInboxRate,
  breakdown,
  byISP,
  confidence,
}: InboxPlacementEstimateProps) {
  const chartData = [
    { name: 'Primary Inbox', value: breakdown.inbox * 100, color: 'hsl(var(--success))' },
    { name: 'Promotions', value: breakdown.promotions * 100, color: 'hsl(var(--warning))' },
    { name: 'Spam', value: breakdown.spam * 100, color: 'hsl(var(--destructive))' },
    { name: 'Blocked', value: breakdown.blocked * 100, color: 'hsl(var(--muted-foreground))' },
  ].filter(d => d.value > 0);

  const getPlacementBadge = (rate: number) => {
    if (rate >= 0.9) return <Badge className="bg-success/20 text-success border-success/30">Excellent</Badge>;
    if (rate >= 0.75) return <Badge className="bg-warning/20 text-warning border-warning/30">Good</Badge>;
    if (rate >= 0.5) return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">Fair</Badge>;
    return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Poor</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Inbox Placement Estimate
            </CardTitle>
            <CardDescription>
              Where your emails are landing
            </CardDescription>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Info className="h-3 w-3" />
            {confidence === 'estimated' ? 'Estimated' : 'Measured'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Rate */}
        <div className="flex items-center gap-6">
          <div className="w-40 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Overall Inbox Rate</span>
              {getPlacementBadge(overallInboxRate)}
            </div>
            <p className="text-3xl font-bold text-success mb-4">
              {(overallInboxRate * 100).toFixed(1)}%
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  Primary Inbox
                </span>
                <span className="font-medium">{(breakdown.inbox * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  Promotions Tab
                </span>
                <span className="font-medium">{(breakdown.promotions * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  Spam Folder
                </span>
                <span className="font-medium">{(breakdown.spam * 100).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                  Blocked/Bounced
                </span>
                <span className="font-medium">{(breakdown.blocked * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* By ISP */}
        <div>
          <h4 className="text-sm font-medium mb-3">Placement by Provider</h4>
          <div className="space-y-3">
            {byISP.map(isp => (
              <div key={isp.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    {isp.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {isp.volume.toLocaleString()} sent
                    </span>
                    <span className={`font-medium ${isp.estimatedInboxRate >= 0.8 ? 'text-success' : isp.estimatedInboxRate >= 0.6 ? 'text-warning' : 'text-destructive'}`}>
                      {(isp.estimatedInboxRate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <Progress 
                  value={isp.estimatedInboxRate * 100} 
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Warning */}
        {breakdown.spam > 0.1 && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">High Spam Rate Detected</p>
              <p className="text-muted-foreground">
                Over 10% of emails are landing in spam. Review your content for spam triggers and authentication setup.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
