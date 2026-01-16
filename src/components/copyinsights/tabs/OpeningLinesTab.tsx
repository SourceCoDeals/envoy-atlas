import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, TrendingUp, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import type { BodyCopyAnalysis } from '@/hooks/useCopyAnalytics';
import { detectOpeningType } from '@/lib/patternTaxonomy';

interface OpeningLinesTabProps {
  bodyCopy: BodyCopyAnalysis[];
  baselineReplyRate: number;
}

export function OpeningLinesTab({ bodyCopy, baselineReplyRate }: OpeningLinesTabProps) {
  // Hook type performance
  const hookPerformance = useMemo(() => {
    const groups: Record<string, { sent: number; replies: number; positive: number }> = {};
    
    bodyCopy.forEach(b => {
      const openingType = detectOpeningType(b.email_body || b.body_preview || '');
      if (!groups[openingType]) {
        groups[openingType] = { sent: 0, replies: 0, positive: 0 };
      }
      groups[openingType].sent += b.sent_count;
      groups[openingType].replies += b.reply_count;
      groups[openingType].positive += b.positive_count;
    });

    const totalSent = Object.values(groups).reduce((sum, g) => sum + g.sent, 0);
    const totalReplies = Object.values(groups).reduce((sum, g) => sum + g.replies, 0);
    const baseline = totalSent > 0 ? (totalReplies / totalSent) * 100 : baselineReplyRate;

    return Object.entries(groups)
      .map(([hook, data]) => {
        const replyRate = data.sent > 0 ? (data.replies / data.sent) * 100 : 0;
        const lift = baseline > 0 ? ((replyRate - baseline) / baseline) * 100 : 0;
        const usage = totalSent > 0 ? (data.sent / totalSent) * 100 : 0;
        
        let status: 'best' | 'good' | 'ok' | 'bad' = 'ok';
        if (lift > 50) status = 'best';
        else if (lift > 20) status = 'good';
        else if (lift < -10) status = 'bad';

        return {
          type: hook,
          rate: replyRate,
          lift,
          usage,
          sample: data.sent,
          status,
        };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [bodyCopy, baselineReplyRate]);

  // Calculate current vs optimal distribution
  const currentDistribution = useMemo(() => {
    const total = hookPerformance.reduce((sum, h) => sum + h.sample, 0);
    return hookPerformance.map(h => ({
      type: h.type,
      current: h.usage,
      currentSample: h.sample,
    }));
  }, [hookPerformance]);

  // Optimal distribution targets
  const optimalDistribution = [
    { type: 'Timeline Hook', target: 40 },
    { type: 'Numbers Hook', target: 20 },
    { type: 'Compliment Hook', target: 15 },
    { type: 'Question Hook', target: 15 },
    { type: 'Problem Hook', target: 10 },
    { type: 'Generic Hook', target: 0 },
  ];

  // Calculate estimated impact of shifting to optimal
  const estimatedImpact = useMemo(() => {
    const currentAvg = hookPerformance.reduce((sum, h) => sum + (h.rate * h.usage / 100), 0);
    
    // Estimate optimal average based on best performers
    const bestRate = hookPerformance.length > 0 ? hookPerformance[0].rate : 5;
    const optimalAvg = bestRate * 0.4 + (bestRate * 0.7) * 0.35 + currentAvg * 0.25;
    
    return {
      current: currentAvg,
      projected: optimalAvg,
      lift: optimalAvg - currentAvg,
      liftPercent: currentAvg > 0 ? ((optimalAvg - currentAvg) / currentAvg) * 100 : 0,
    };
  }, [hookPerformance]);

  // Problem/Generic hook usage for alert
  const problemGenericUsage = hookPerformance
    .filter(h => h.type.toLowerCase().includes('problem') || h.type.toLowerCase().includes('generic'))
    .reduce((sum, h) => sum + h.usage, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'best': return 'bg-success';
      case 'good': return 'bg-success/70';
      case 'ok': return 'bg-yellow-500';
      case 'bad': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

  const formatLift = (lift: number) => {
    if (lift > 0) return `+${lift.toFixed(0)}%`;
    return `${lift.toFixed(0)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Hook Type Performance */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                🎯 Hook Type Performance
              </CardTitle>
              <CardDescription>The opening line has the BIGGEST impact on reply rates</CardDescription>
            </div>
            <Badge variant="destructive">Critical View</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {hookPerformance.map((hook, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-32 text-sm truncate">{hook.type}</div>
                <div className="flex-1 relative h-6 bg-muted rounded">
                  <div 
                    className={`absolute h-full rounded ${getStatusColor(hook.status)}`}
                    style={{ width: `${Math.min((hook.rate / 10) * 100, 100)}%` }}
                  />
                </div>
                <div className="w-14 text-sm font-medium">{hook.rate.toFixed(1)}%</div>
                <div className={`w-16 text-xs font-medium ${hook.lift > 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatLift(hook.lift)}
                </div>
                <div className="w-12 text-xs text-muted-foreground">{hook.usage.toFixed(0)}%</div>
                <Badge variant="outline" className="text-xs w-16 justify-center">
                  n={hook.sample.toLocaleString()}
                </Badge>
              </div>
            ))}
          </div>

          {problemGenericUsage > 40 && (
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-sm text-destructive">
                <strong>🚨 Alert:</strong> {problemGenericUsage.toFixed(0)}% of your emails use Problem or Generic hooks 
                which underperform. Shifting to Timeline hooks could add ~1.2% to your overall reply rate.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current vs Optimal Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Your Hook Mix vs Optimal</CardTitle>
          <CardDescription>How your opening lines are distributed compared to best practices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Current Distribution */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Current Distribution</h4>
              <div className="space-y-3">
                {currentDistribution.map((item, i) => {
                  const hook = hookPerformance.find(h => h.type === item.type);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-28 text-sm truncate">{item.type}</div>
                      <div className="flex-1 h-4 bg-muted rounded">
                        <div 
                          className={`h-full rounded ${getStatusColor(hook?.status || 'ok')}`}
                          style={{ width: `${Math.min(item.current * 2, 100)}%` }}
                        />
                      </div>
                      <div className="w-10 text-sm text-right">{item.current.toFixed(0)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Optimal Distribution */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Optimal Target</h4>
              <div className="space-y-3">
                {optimalDistribution.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-28 text-sm truncate">{item.type}</div>
                    <div className="flex-1 h-4 bg-muted rounded">
                      <div 
                        className={`h-full rounded ${
                          item.target >= 30 ? 'bg-success' : 
                          item.target >= 15 ? 'bg-success/70' :
                          item.target > 0 ? 'bg-yellow-500' : 'bg-muted'
                        }`}
                        style={{ width: `${Math.min(item.target * 2, 100)}%` }}
                      />
                    </div>
                    <div className="w-10 text-sm text-right">{item.target}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Estimated Impact */}
          <div className="mt-6 p-4 bg-success/10 rounded-lg border border-success/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="font-medium text-success">Estimated Impact</span>
            </div>
            <p className="text-sm">
              Current: <strong>{estimatedImpact.current.toFixed(1)}%</strong> → 
              Projected: <strong>{estimatedImpact.projected.toFixed(1)}%</strong>{' '}
              <span className="text-success">(+{estimatedImpact.liftPercent.toFixed(0)}%)</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              At 2,000 emails/month = ~{Math.round((estimatedImpact.lift / 100) * 2000)} additional replies per month
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Hook Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Best & Worst Hook Examples
          </CardTitle>
          <CardDescription>Learn from what works (and what doesn't)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium text-success mb-3">✅ High-Performing Hooks</h4>
              <div className="space-y-3">
                {[
                  { hook: 'Timeline', example: '"Saw Acme just closed their Series C—congrats! Quick thought..."', rate: 8.7 },
                  { hook: 'Numbers', example: '"Noticed you have 47 open roles—that\'s a lot of hiring ahead..."', rate: 6.4 },
                  { hook: 'Compliment', example: '"Really enjoyed your recent post on PE deal sourcing..."', rate: 5.2 },
                ].map((item, i) => (
                  <div key={i} className="p-3 bg-success/5 border border-success/20 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-xs text-success border-success/30">{item.hook}</Badge>
                      <span className="text-sm font-medium text-success">{item.rate}% reply</span>
                    </div>
                    <p className="text-sm text-muted-foreground italic">{item.example}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-destructive mb-3">❌ Avoid These Hooks</h4>
              <div className="space-y-3">
                {[
                  { hook: 'Problem', example: '"Most PE firms struggle with deal flow..."', rate: 2.7, issue: 'Presumptuous' },
                  { hook: 'Generic', example: '"I wanted to reach out to introduce..."', rate: 2.1, issue: 'Self-focused' },
                  { hook: 'Cold Intro', example: '"My name is John and I work at..."', rate: 1.8, issue: 'No value' },
                ].map((item, i) => (
                  <div key={i} className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs text-destructive border-destructive/30">{item.hook}</Badge>
                        <span className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {item.issue}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-destructive">{item.rate}% reply</span>
                    </div>
                    <p className="text-sm text-muted-foreground italic">{item.example}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
