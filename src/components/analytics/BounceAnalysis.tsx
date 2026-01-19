import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, XCircle, RefreshCw, Mail, Building2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface BounceData {
  total_bounces: number;
  hard_bounces: number;
  soft_bounces: number;
  bounce_rate: number;
  top_reasons: { reason: string; count: number }[];
  by_domain: { domain: string; count: number; rate: number }[];
  by_campaign: { campaign: string; count: number; rate: number }[];
}

interface BounceAnalysisProps {
  data: BounceData;
  className?: string;
}

export function BounceAnalysis({ data, className }: BounceAnalysisProps) {
  const pieData = [
    { name: 'Hard Bounces', value: data.hard_bounces, color: 'hsl(var(--destructive))' },
    { name: 'Soft Bounces', value: data.soft_bounces, color: 'hsl(var(--primary))' },
  ].filter(d => d.value > 0);

  const getBounceRateColor = (rate: number) => {
    if (rate > 5) return 'text-destructive';
    if (rate > 2) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getBounceRateBadge = (rate: number) => {
    if (rate > 5) return <Badge variant="destructive">Critical</Badge>;
    if (rate > 2) return <Badge variant="secondary">Warning</Badge>;
    return <Badge variant="default">Healthy</Badge>;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Bounce Analysis
            </CardTitle>
            <CardDescription>
              Email bounce breakdown and list quality insights
            </CardDescription>
          </div>
          {getBounceRateBadge(data.bounce_rate)}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <Mail className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{data.total_bounces.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Bounces</div>
          </div>
          <div className="p-4 rounded-lg bg-destructive/10 text-center">
            <XCircle className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <div className="text-2xl font-bold text-destructive">{data.hard_bounces.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Hard Bounces</div>
          </div>
          <div className="p-4 rounded-lg bg-primary/10 text-center">
            <RefreshCw className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-primary">{data.soft_bounces.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Soft Bounces</div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <AlertTriangle className={`h-5 w-5 mx-auto mb-1 ${getBounceRateColor(data.bounce_rate)}`} />
            <div className={`text-2xl font-bold ${getBounceRateColor(data.bounce_rate)}`}>
              {data.bounce_rate.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground">Bounce Rate</div>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium mb-3">Bounce Type Distribution</h4>
            {pieData.length > 0 ? (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [value.toLocaleString(), 'Bounces']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))' 
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No bounce data</p>
            )}
          </div>

          {/* Top Reasons */}
          <div>
            <h4 className="text-sm font-medium mb-3">Top Bounce Reasons</h4>
            <div className="space-y-2">
              {data.top_reasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bounce reasons available</p>
              ) : (
                data.top_reasons.slice(0, 5).map((reason, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[200px]" title={reason.reason}>
                      {reason.reason || 'Unknown'}
                    </span>
                    <span className="font-medium">{reason.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* By Domain */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Highest Bounce Domains
          </h4>
          <div className="space-y-2">
            {data.by_domain.length === 0 ? (
              <p className="text-sm text-muted-foreground">No domain-level bounce data</p>
            ) : (
              data.by_domain.slice(0, 5).map((domain, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{domain.domain}</span>
                    <div className="flex items-center gap-2">
                      <span>{domain.count} bounces</span>
                      <Badge variant={domain.rate > 10 ? 'destructive' : 'secondary'} className="text-xs">
                        {domain.rate.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={Math.min(domain.rate * 10, 100)} className="h-1" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Hard Bounce Alert */}
        {data.hard_bounces > 100 && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <span className="font-medium">List Quality Issue</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              High hard bounce count ({data.hard_bounces.toLocaleString()}) indicates stale or invalid email addresses. 
              Consider validating your email lists before sending.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}