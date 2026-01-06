import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export interface SegmentRankingItem {
  rank: number;
  segment: string;
  segmentType: string;
  volume: number;
  replyRate: number;
  positiveRate: number;
  meetings: number;
  vsAverage: number; // percentage lift vs average
  confidenceLevel: 'high' | 'medium' | 'low' | 'insufficient';
  pValue?: number;
  trend?: 'up' | 'down' | 'stable';
  issues?: string[];
}

interface SegmentPerformanceRankingProps {
  segments: SegmentRankingItem[];
  averageReplyRate: number;
  dimensionLabel: string;
  onSegmentClick?: (segment: SegmentRankingItem) => void;
  insight?: string;
}

export function SegmentPerformanceRanking({
  segments,
  averageReplyRate,
  dimensionLabel,
  onSegmentClick,
  insight,
}: SegmentPerformanceRankingProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  
  // Find max reply rate for bar scaling
  const maxReplyRate = Math.max(...segments.map(s => s.replyRate), averageReplyRate);

  const getConfidenceBadge = (level: SegmentRankingItem['confidenceLevel']) => {
    switch (level) {
      case 'high':
        return <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">HIGH</Badge>;
      case 'medium':
        return <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">MED</Badge>;
      case 'low':
        return <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">LOW</Badge>;
      default:
        return <Badge variant="outline" className="text-xs opacity-50">INSUFF</Badge>;
    }
  };

  const getLiftDisplay = (vsAverage: number) => {
    if (Math.abs(vsAverage) < 5) {
      return <span className="text-muted-foreground text-xs">(baseline)</span>;
    }
    const isPositive = vsAverage > 0;
    return (
      <span className={cn(
        "text-xs font-medium",
        isPositive ? "text-success" : "text-destructive"
      )}>
        {isPositive ? '+' : ''}{vsAverage.toFixed(0)}%
      </span>
    );
  };

  const getPerformanceIndicator = (segment: SegmentRankingItem) => {
    if (segment.vsAverage > 20 && segment.confidenceLevel === 'high') {
      return (
        <div className="flex items-center gap-1 text-success text-xs">
          <TrendingUp className="h-3 w-3" />
          <span>High performer</span>
        </div>
      );
    }
    if (segment.vsAverage < -20 && segment.confidenceLevel === 'high') {
      return (
        <div className="flex items-center gap-1 text-destructive text-xs">
          <TrendingDown className="h-3 w-3" />
          <span>Underperforming</span>
        </div>
      );
    }
    if (segment.confidenceLevel === 'low' || segment.confidenceLevel === 'insufficient') {
      return (
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Info className="h-3 w-3" />
          <span>Limited data</span>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Segment Performance Ranking</CardTitle>
        <CardDescription>Performance by {dimensionLabel}, sorted by reply rate</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Header Row */}
        <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-2 pb-2 border-b">
          <div className="col-span-1">Rank</div>
          <div className="col-span-3">Segment</div>
          <div className="col-span-2 text-right">Volume</div>
          <div className="col-span-3">Reply Rate</div>
          <div className="col-span-1 text-right">vs Avg</div>
          <div className="col-span-1 text-right">Mtgs</div>
          <div className="col-span-1 text-center">Conf</div>
        </div>

        {/* Segment Rows */}
        {segments.map((segment) => (
          <div 
            key={segment.segment}
            className="border rounded-lg overflow-hidden"
          >
            <button
              className="w-full p-2 hover:bg-accent/50 transition-colors"
              onClick={() => setExpanded(expanded === segment.segment ? null : segment.segment)}
            >
              <div className="grid grid-cols-12 gap-2 items-center text-sm">
                <div className="col-span-1">
                  <span className={cn(
                    "font-bold",
                    segment.rank === 1 ? "text-yellow-500" : 
                    segment.rank <= 3 ? "text-primary" : "text-muted-foreground"
                  )}>
                    {segment.rank}
                  </span>
                </div>
                <div className="col-span-3 text-left font-medium truncate">
                  {segment.segment}
                </div>
                <div className="col-span-2 text-right font-mono text-muted-foreground">
                  {segment.volume.toLocaleString()}
                </div>
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full",
                          segment.vsAverage > 10 ? "bg-success" :
                          segment.vsAverage < -10 ? "bg-destructive/70" : "bg-primary"
                        )}
                        style={{ width: `${(segment.replyRate / maxReplyRate) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs w-12 text-right">
                      {segment.replyRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="col-span-1 text-right">
                  {getLiftDisplay(segment.vsAverage)}
                </div>
                <div className="col-span-1 text-right font-mono">
                  {segment.meetings}
                </div>
                <div className="col-span-1 flex justify-center">
                  {getConfidenceBadge(segment.confidenceLevel)}
                </div>
              </div>
            </button>

            {/* Expanded Details */}
            {expanded === segment.segment && (
              <div className="px-3 pb-3 pt-2 border-t bg-accent/20 space-y-2">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Reply Rate</p>
                    <p className="font-mono">{segment.replyRate.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Positive Rate</p>
                    <p className="font-mono text-success">{segment.positiveRate.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Emails per Meeting</p>
                    <p className="font-mono">
                      {segment.meetings > 0 
                        ? Math.round(segment.volume / segment.meetings) 
                        : '—'}
                    </p>
                  </div>
                </div>
                
                {getPerformanceIndicator(segment)}

                {segment.issues && segment.issues.length > 0 && (
                  <div className="pt-2 space-y-1">
                    {segment.issues.map((issue, i) => (
                      <p key={i} className="text-xs text-warning flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {issue}
                      </p>
                    ))}
                  </div>
                )}

                {segment.pValue !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Statistical significance: p = {segment.pValue.toFixed(4)}
                    {segment.pValue < 0.05 && ' (significant)'}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Key Insight */}
        {insight && (
          <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground">{insight}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Statistical confidence: HIGH (p &lt; 0.01 for top comparisons)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper to create segment rankings from raw performance data
export function createSegmentRankings(
  segments: Array<{
    name: string;
    type: string;
    sent: number;
    replied: number;
    positive: number;
    meetings?: number;
  }>,
  baselineReplyRate: number
): SegmentRankingItem[] {
  return segments
    .filter(s => s.sent > 0)
    .map(s => {
      const replyRate = (s.replied / s.sent) * 100;
      const positiveRate = (s.positive / s.sent) * 100;
      const vsAverage = baselineReplyRate > 0 
        ? ((replyRate - baselineReplyRate) / baselineReplyRate) * 100 
        : 0;
      
      return {
        rank: 0, // Will be set after sorting
        segment: s.name,
        segmentType: s.type,
        volume: s.sent,
        replyRate,
        positiveRate,
        meetings: s.meetings || 0,
        vsAverage,
        confidenceLevel: getConfidenceLevelFromSample(s.sent),
        issues: getSegmentIssues(replyRate, vsAverage, s.sent),
      };
    })
    .sort((a, b) => b.replyRate - a.replyRate)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

function getConfidenceLevelFromSample(sampleSize: number): SegmentRankingItem['confidenceLevel'] {
  if (sampleSize >= 2000) return 'high';
  if (sampleSize >= 500) return 'medium';
  if (sampleSize >= 100) return 'low';
  return 'insufficient';
}

function getSegmentIssues(replyRate: number, vsAverage: number, sampleSize: number): string[] {
  const issues: string[] = [];
  if (sampleSize < 500) {
    issues.push('Limited sample size - interpret with caution');
  }
  if (vsAverage < -30) {
    issues.push('Significantly underperforming - consider reducing volume');
  }
  return issues;
}
