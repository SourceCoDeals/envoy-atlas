import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingDown, TrendingUp, Minus, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChangeContribution {
  factor: string;
  contribution: number; // Absolute change in percentage points
  direction: 'positive' | 'negative';
  confidence: 'high' | 'medium' | 'low';
  details: string;
  link?: string;
  linkLabel?: string;
}

export interface WhatChangedData {
  metric: string;
  previousValue: number;
  currentValue: number;
  totalChange: number;
  contributions: ChangeContribution[];
  interpretation: string;
  periodLabel: string;
}

interface WhatChangedAnalysisProps {
  data: WhatChangedData;
  onViewDetails?: (factor: string, link?: string) => void;
}

export function WhatChangedAnalysis({ data, onViewDetails }: WhatChangedAnalysisProps) {
  const isDecline = data.totalChange < 0;
  const maxContribution = Math.max(...data.contributions.map(c => Math.abs(c.contribution)));

  const getConfidenceColor = (confidence: ChangeContribution['confidence']) => {
    switch (confidence) {
      case 'high': return 'text-foreground';
      case 'medium': return 'text-muted-foreground';
      case 'low': return 'text-muted-foreground/60';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">What Changed</CardTitle>
        <CardDescription>{data.periodLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metric Change Summary */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
          <div>
            <p className="text-sm text-muted-foreground">{data.metric}</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-mono">{data.previousValue.toFixed(1)}%</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg font-mono">{data.currentValue.toFixed(1)}%</span>
            </div>
          </div>
          <div className={cn(
            "flex items-center gap-1 text-lg font-bold",
            isDecline ? "text-destructive" : "text-success"
          )}>
            {isDecline ? (
              <TrendingDown className="h-5 w-5" />
            ) : (
              <TrendingUp className="h-5 w-5" />
            )}
            {data.totalChange > 0 ? '+' : ''}{data.totalChange.toFixed(1)}%
          </div>
        </div>

        {/* Total Change Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Change Attribution</span>
            <span>{data.totalChange > 0 ? '+' : ''}{data.totalChange.toFixed(2)}% Total</span>
          </div>
          <div className={cn(
            "h-2 rounded-full",
            isDecline ? "bg-destructive/30" : "bg-success/30"
          )}>
            <div 
              className={cn(
                "h-full rounded-full",
                isDecline ? "bg-destructive" : "bg-success"
              )}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Contributing Factors */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Contributing Factors</h4>
          {data.contributions.map((contrib, i) => {
            const barWidth = maxContribution > 0 
              ? (Math.abs(contrib.contribution) / maxContribution) * 100 
              : 0;
            
            return (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-medium", getConfidenceColor(contrib.confidence))}>
                      {contrib.factor}
                    </span>
                    {contrib.confidence !== 'high' && (
                      <span className="text-xs text-muted-foreground">
                        ({contrib.confidence})
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "font-mono text-sm font-medium",
                    contrib.direction === 'negative' ? "text-destructive" : "text-success"
                  )}>
                    {contrib.direction === 'positive' ? '+' : '-'}{Math.abs(contrib.contribution).toFixed(2)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      contrib.direction === 'negative' ? "bg-destructive/60" : "bg-success/60"
                    )}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{contrib.details}</p>
                  {contrib.link && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs px-2"
                      onClick={() => onViewDetails?.(contrib.factor, contrib.link)}
                    >
                      {contrib.linkLabel || 'View'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Interpretation */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">{data.interpretation}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to generate mock change data from metrics
export function generateChangeAnalysis(
  currentStats: {
    replyRate: number;
    positiveRate: number;
    bounceRate: number;
  },
  previousStats: {
    replyRate: number;
    positiveRate: number;
    bounceRate: number;
  }
): WhatChangedData {
  const totalChange = currentStats.replyRate - previousStats.replyRate;
  const contributions: ChangeContribution[] = [];

  // Simulate attribution (in real implementation, this would be calculated from actual data)
  if (Math.abs(totalChange) > 0.1) {
    const audienceMixChange = totalChange * 0.55;
    const copyChange = totalChange * 0.35;
    const timingChange = totalChange * 0.1;

    if (Math.abs(audienceMixChange) > 0.05) {
      contributions.push({
        factor: 'Audience Mix',
        contribution: Math.abs(audienceMixChange),
        direction: audienceMixChange < 0 ? 'negative' : 'positive',
        confidence: 'high',
        details: audienceMixChange < 0 
          ? 'Higher volume to harder-to-reach segments'
          : 'Increased volume to high-performing segments',
        link: '/audience-insights',
        linkLabel: 'View Segments',
      });
    }

    if (Math.abs(copyChange) > 0.05) {
      contributions.push({
        factor: 'Copy Performance',
        contribution: Math.abs(copyChange),
        direction: copyChange < 0 ? 'negative' : 'positive',
        confidence: 'high',
        details: copyChange < 0 
          ? 'Top variants showing declining performance'
          : 'New high-performing variants added',
        link: '/copy-insights',
        linkLabel: 'View Copy',
      });
    }

    if (Math.abs(timingChange) > 0.02) {
      contributions.push({
        factor: 'Send Timing',
        contribution: Math.abs(timingChange),
        direction: timingChange < 0 ? 'negative' : 'positive',
        confidence: 'medium',
        details: timingChange < 0 
          ? 'More sends shifted to lower-performing windows'
          : 'Better send time optimization',
      });
    }
  }

  // If no significant changes, indicate stability
  if (contributions.length === 0) {
    contributions.push({
      factor: 'Stable Performance',
      contribution: Math.abs(totalChange),
      direction: totalChange >= 0 ? 'positive' : 'negative',
      confidence: 'high',
      details: 'No significant factors identified',
    });
  }

  const interpretation = totalChange < -0.3
    ? `The ${Math.abs(totalChange).toFixed(1)}% decline is primarily driven by ${contributions[0]?.factor.toLowerCase() || 'unknown factors'}. ${contributions.length > 1 ? `${contributions[1]?.factor} is a secondary contributor.` : ''} This is NOT a deliverability issue — inbox placement appears stable.`
    : totalChange > 0.3
    ? `Performance improved by ${totalChange.toFixed(1)}% driven by ${contributions[0]?.factor.toLowerCase() || 'various factors'}.`
    : 'Performance is relatively stable with no major changes to investigate.';

  return {
    metric: 'Reply Rate',
    previousValue: previousStats.replyRate,
    currentValue: currentStats.replyRate,
    totalChange,
    contributions,
    interpretation,
    periodLabel: 'Last 7 Days vs Previous 7 Days',
  };
}
