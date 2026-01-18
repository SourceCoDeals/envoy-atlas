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

// NOTE: generateChangeAnalysis has been REMOVED because it produced
// simulated/fake attribution data. The function was using hardcoded 
// percentages (55% audience, 35% copy, 10% timing) that were not 
// derived from actual data.
//
// To implement real change analysis, you would need:
// 1. Actual historical data for comparison periods
// 2. Real attribution logic based on variant/segment performance changes
// 3. Statistical significance testing
//
// Until that data infrastructure exists, this component should not be used.
