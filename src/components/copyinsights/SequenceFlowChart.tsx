import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRight, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Line, ComposedChart, Bar } from 'recharts';

interface SequenceStep {
  step_number: number;
  sent: number;
  replies: number;
  positive_replies?: number;
  opens?: number;
}

interface SequenceFlowChartProps {
  data: SequenceStep[];
  className?: string;
}

export function SequenceFlowChart({ data, className }: SequenceFlowChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    let cumulativeReplies = 0;
    const totalReplies = data.reduce((sum, step) => sum + step.replies, 0);
    
    return data.map((step, index) => {
      cumulativeReplies += step.replies;
      const replyRate = step.sent > 0 ? (step.replies / step.sent) * 100 : 0;
      const dropOffRate = index > 0 && data[index - 1].sent > 0 
        ? ((data[index - 1].sent - step.sent) / data[index - 1].sent) * 100 
        : 0;
      
      return {
        step: `Step ${step.step_number}`,
        stepNumber: step.step_number,
        sent: step.sent,
        replies: step.replies,
        positiveReplies: step.positive_replies || 0,
        replyRate: parseFloat(replyRate.toFixed(2)),
        cumulativeReplies,
        cumulativePercent: totalReplies > 0 ? parseFloat(((cumulativeReplies / totalReplies) * 100).toFixed(1)) : 0,
        dropOffRate: parseFloat(dropOffRate.toFixed(1)),
        contributionPercent: totalReplies > 0 ? parseFloat(((step.replies / totalReplies) * 100).toFixed(1)) : 0,
      };
    });
  }, [data]);

  // Find optimal sequence length
  const optimalLength = useMemo(() => {
    if (chartData.length < 2) return null;
    
    // Find the step after which reply rate drops significantly
    let bestStep = 1;
    let maxRate = 0;
    
    chartData.forEach((step, index) => {
      if (step.replyRate > maxRate) {
        maxRate = step.replyRate;
        bestStep = step.stepNumber;
      }
    });
    
    // Also consider diminishing returns
    const last3StepsAvg = chartData.slice(-3).reduce((sum, s) => sum + s.replyRate, 0) / Math.min(3, chartData.length);
    const first3StepsAvg = chartData.slice(0, 3).reduce((sum, s) => sum + s.replyRate, 0) / Math.min(3, chartData.length);
    
    if (last3StepsAvg < first3StepsAvg * 0.5) {
      // Later steps are much worse - recommend shorter sequences
      const cutoff = chartData.findIndex(s => s.replyRate < first3StepsAvg * 0.5);
      return cutoff > 0 ? cutoff : bestStep;
    }
    
    return bestStep;
  }, [chartData]);

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No sequence data available</p>
            <p className="text-sm mt-1">Sync your campaigns to see step-by-step performance</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Sequence Flow Visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Sequence Flow</CardTitle>
          <CardDescription>How leads progress through your sequence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {chartData.map((step, index) => (
              <TooltipProvider key={step.step}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center">
                      <div className={`relative flex flex-col items-center p-3 rounded-lg min-w-[100px] transition-all ${
                        step.stepNumber === optimalLength ? 'bg-success/10 border-2 border-success' :
                        step.replyRate > 3 ? 'bg-primary/10 border border-primary/30' :
                        'bg-muted/50 border border-border'
                      }`}>
                        <div className="text-xs font-medium text-muted-foreground">{step.step}</div>
                        <div className="text-lg font-bold">{step.replyRate}%</div>
                        <div className="text-xs text-muted-foreground">{step.sent.toLocaleString()} sent</div>
                        <div className="text-xs mt-1">
                          <Badge variant="outline" className="text-xs px-1">
                            {step.replies} replies
                          </Badge>
                        </div>
                        {step.stepNumber === optimalLength && (
                          <Badge className="absolute -top-2 -right-2 bg-success text-xs">Best</Badge>
                        )}
                      </div>
                      {index < chartData.length - 1 && (
                        <div className="flex flex-col items-center mx-1">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          {step.dropOffRate > 0 && (
                            <span className="text-[10px] text-destructive">-{step.dropOffRate}%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      <p><strong>Sent:</strong> {step.sent.toLocaleString()}</p>
                      <p><strong>Replies:</strong> {step.replies}</p>
                      <p><strong>Reply Rate:</strong> {step.replyRate}%</p>
                      <p><strong>Contribution:</strong> {step.contributionPercent}% of total replies</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reply Rate by Step Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Reply Rate by Step</CardTitle>
          <CardDescription>Compare performance across sequence steps</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="step" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => v.toLocaleString()} />
                <RechartsTooltip 
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border rounded-lg p-3 shadow-lg">
                        <p className="font-medium">{data.step}</p>
                        <p className="text-sm">Reply Rate: <strong>{data.replyRate}%</strong></p>
                        <p className="text-sm text-muted-foreground">Sent: {data.sent.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Replies: {data.replies}</p>
                      </div>
                    );
                  }}
                />
                <Bar yAxisId="right" dataKey="sent" fill="hsl(var(--muted))" opacity={0.3} />
                <Line yAxisId="left" type="monotone" dataKey="replyRate" stroke="hsl(var(--primary))" strokeWidth={2} dot />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cumulative Replies Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Cumulative Reply Distribution</CardTitle>
          <CardDescription>When do most replies come in?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="step" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <RechartsTooltip 
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border rounded-lg p-3 shadow-lg">
                        <p className="font-medium">{data.step}</p>
                        <p className="text-sm">{data.cumulativePercent}% of all replies by this step</p>
                        <p className="text-xs text-muted-foreground">({data.cumulativeReplies} cumulative replies)</p>
                      </div>
                    );
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="cumulativePercent" 
                  stroke="hsl(var(--success))" 
                  fill="hsl(var(--success) / 0.2)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
            <strong>💡 Insight:</strong> {chartData.length > 0 && chartData[0].cumulativePercent > 50 
              ? `${chartData[0].cumulativePercent}% of replies come from the first email. Focus your best copy there.`
              : 'Replies are distributed across steps. A full sequence is working well for you.'}
          </div>
        </CardContent>
      </Card>

      {/* Optimal Length Recommendation */}
      {optimalLength && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Optimal Sequence Length: {optimalLength} steps</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Based on your data, most of your replies come within the first {optimalLength} steps. 
                  Consider focusing your efforts here for maximum efficiency.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
