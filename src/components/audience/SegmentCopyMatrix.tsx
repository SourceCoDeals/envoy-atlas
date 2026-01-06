import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SegmentCopyInteraction {
  segmentName: string;
  copyPatterns: {
    patternName: string;
    replyRate: number;
    liftVsSegmentAvg: number; // percentage
    sampleSize: number;
    isBest?: boolean;
    isWorst?: boolean;
  }[];
  avgReplyRate: number;
}

export interface CopyInteractionInsight {
  segment: string;
  pattern: string;
  insight: string;
  recommendation: string;
  lift: number;
  isBest: boolean;
}

interface SegmentCopyMatrixProps {
  interactions: SegmentCopyInteraction[];
  copyPatterns: string[];
  insights: CopyInteractionInsight[];
}

export function SegmentCopyMatrix({
  interactions,
  copyPatterns,
  insights,
}: SegmentCopyMatrixProps) {
  const getCellColor = (lift: number) => {
    if (lift > 15) return 'bg-success/20 text-success';
    if (lift > 5) return 'bg-success/10 text-success';
    if (lift < -15) return 'bg-destructive/20 text-destructive';
    if (lift < -5) return 'bg-destructive/10 text-destructive';
    return 'text-muted-foreground';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">What Works for Whom</CardTitle>
        <CardDescription>Segment × Copy performance matrix - find the best copy for each audience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Matrix */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Header Row */}
            <div className="grid gap-1" style={{ gridTemplateColumns: `150px repeat(${copyPatterns.length}, 1fr)` }}>
              <div className="p-2 text-xs font-medium text-muted-foreground"></div>
              {copyPatterns.map(pattern => (
                <div key={pattern} className="p-2 text-xs font-medium text-center truncate">
                  {pattern}
                </div>
              ))}
            </div>

            {/* Data Rows */}
            {interactions.map(segment => (
              <div 
                key={segment.segmentName}
                className="grid gap-1 border-t" 
                style={{ gridTemplateColumns: `150px repeat(${copyPatterns.length}, 1fr)` }}
              >
                <div className="p-2 text-sm font-medium truncate">
                  {segment.segmentName}
                </div>
                {copyPatterns.map(patternName => {
                  const pattern = segment.copyPatterns.find(p => p.patternName === patternName);
                  if (!pattern || pattern.sampleSize < 50) {
                    return (
                      <div key={patternName} className="p-2 text-center text-xs text-muted-foreground/50">
                        —
                      </div>
                    );
                  }
                  return (
                    <div 
                      key={patternName}
                      className={cn(
                        "p-2 text-center rounded-sm text-sm font-mono",
                        getCellColor(pattern.liftVsSegmentAvg)
                      )}
                    >
                      <div className="font-medium">{pattern.replyRate.toFixed(1)}%</div>
                      {Math.abs(pattern.liftVsSegmentAvg) > 10 && (
                        <div className="text-xs">
                          {pattern.liftVsSegmentAvg > 0 ? '⬆️' : '⬇️'} {pattern.liftVsSegmentAvg > 0 ? '+' : ''}{pattern.liftVsSegmentAvg.toFixed(0)}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>⬆️</span>
            <span>= Best for segment (&gt;10% above avg)</span>
          </div>
          <div className="flex items-center gap-1">
            <span>⬇️</span>
            <span>= Worst for segment (&gt;10% below avg)</span>
          </div>
        </div>

        {/* Key Insights */}
        {insights.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-sm font-medium">Key Insights</h4>
            <div className="space-y-2">
              {insights.slice(0, 4).map((insight, i) => (
                <div 
                  key={i}
                  className="p-3 rounded-lg bg-muted/50 text-sm"
                >
                  <div className="flex items-start gap-2">
                    <span>{insight.isBest ? '●' : '○'}</span>
                    <div>
                      <p className="font-medium">
                        {insight.segment} + {insight.pattern}
                        <span className={cn(
                          "ml-2 text-xs",
                          insight.lift > 0 ? "text-success" : "text-destructive"
                        )}>
                          ({insight.lift > 0 ? '+' : ''}{insight.lift.toFixed(0)}%)
                        </span>
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        → {insight.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper to generate interaction matrix from data
export function generateSegmentCopyInteractions(
  segments: string[],
  patterns: string[],
  getPerformance: (segment: string, pattern: string) => { replyRate: number; sampleSize: number } | null
): { interactions: SegmentCopyInteraction[]; insights: CopyInteractionInsight[] } {
  const interactions: SegmentCopyInteraction[] = [];
  const insights: CopyInteractionInsight[] = [];

  for (const segment of segments) {
    const segmentPatterns: SegmentCopyInteraction['copyPatterns'] = [];
    let totalReplyRate = 0;
    let count = 0;

    for (const pattern of patterns) {
      const perf = getPerformance(segment, pattern);
      if (perf && perf.sampleSize >= 50) {
        segmentPatterns.push({
          patternName: pattern,
          replyRate: perf.replyRate,
          liftVsSegmentAvg: 0, // Will calculate after
          sampleSize: perf.sampleSize,
        });
        totalReplyRate += perf.replyRate;
        count++;
      } else {
        segmentPatterns.push({
          patternName: pattern,
          replyRate: 0,
          liftVsSegmentAvg: 0,
          sampleSize: 0,
        });
      }
    }

    const avgReplyRate = count > 0 ? totalReplyRate / count : 0;

    // Calculate lifts and find best/worst
    segmentPatterns.forEach(p => {
      if (p.sampleSize >= 50 && avgReplyRate > 0) {
        p.liftVsSegmentAvg = ((p.replyRate - avgReplyRate) / avgReplyRate) * 100;
      }
    });

    const validPatterns = segmentPatterns.filter(p => p.sampleSize >= 50);
    if (validPatterns.length > 0) {
      const best = validPatterns.reduce((a, b) => a.replyRate > b.replyRate ? a : b);
      const worst = validPatterns.reduce((a, b) => a.replyRate < b.replyRate ? a : b);
      best.isBest = true;
      worst.isWorst = true;

      if (best.liftVsSegmentAvg > 10) {
        insights.push({
          segment,
          pattern: best.patternName,
          insight: `"${best.patternName}" performs ${best.liftVsSegmentAvg.toFixed(0)}% better than average for ${segment}`,
          recommendation: `Prioritize ${best.patternName} copy when targeting ${segment}`,
          lift: best.liftVsSegmentAvg,
          isBest: true,
        });
      }

      if (worst.liftVsSegmentAvg < -10) {
        insights.push({
          segment,
          pattern: worst.patternName,
          insight: `"${worst.patternName}" underperforms by ${Math.abs(worst.liftVsSegmentAvg).toFixed(0)}% for ${segment}`,
          recommendation: `Avoid ${worst.patternName} copy for ${segment}`,
          lift: worst.liftVsSegmentAvg,
          isBest: false,
        });
      }
    }

    interactions.push({
      segmentName: segment,
      copyPatterns: segmentPatterns,
      avgReplyRate,
    });
  }

  // Sort insights by absolute lift
  insights.sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));

  return { interactions, insights };
}
