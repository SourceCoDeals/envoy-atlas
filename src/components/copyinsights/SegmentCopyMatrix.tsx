import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SegmentCopyInteraction {
  segment: string;
  segment_type: 'seniority' | 'department' | 'industry';
  pattern: string;
  pattern_type: string;
  reply_rate: number;
  segment_avg_reply_rate: number;
  pattern_avg_reply_rate: number;
  sample_size: number;
  lift_vs_segment: number;
  lift_vs_pattern: number;
  is_significant: boolean;
}

interface SegmentCopyMatrixProps {
  interactions: SegmentCopyInteraction[];
  segments?: string[];
  patterns?: string[];
}

const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

const getInteractionColor = (lift: number, isSignificant: boolean) => {
  if (!isSignificant) return 'bg-muted text-muted-foreground';
  if (lift > 20) return 'bg-success/80 text-success-foreground';
  if (lift > 10) return 'bg-success/60 text-success-foreground';
  if (lift > 0) return 'bg-success/30 text-foreground';
  if (lift > -10) return 'bg-destructive/20 text-foreground';
  if (lift > -20) return 'bg-destructive/40 text-foreground';
  return 'bg-destructive/60 text-destructive-foreground';
};

export function SegmentCopyMatrix({ interactions, segments, patterns }: SegmentCopyMatrixProps) {
  // Group interactions by segment and pattern
  const matrix = useMemo(() => {
    const segmentList = segments || [...new Set(interactions.map(i => i.segment))];
    const patternList = patterns || [...new Set(interactions.map(i => i.pattern))];
    
    const matrixData: Record<string, Record<string, SegmentCopyInteraction | null>> = {};
    
    segmentList.forEach(seg => {
      matrixData[seg] = {};
      patternList.forEach(pat => {
        matrixData[seg][pat] = interactions.find(i => i.segment === seg && i.pattern === pat) || null;
      });
    });
    
    return { segmentList, patternList, matrixData };
  }, [interactions, segments, patterns]);

  // Find top matches and mismatches
  const topMatches = useMemo(() => {
    return [...interactions]
      .filter(i => i.is_significant && i.lift_vs_segment > 10)
      .sort((a, b) => b.lift_vs_segment - a.lift_vs_segment)
      .slice(0, 5);
  }, [interactions]);

  const topMismatches = useMemo(() => {
    return [...interactions]
      .filter(i => i.is_significant && i.lift_vs_segment < -10)
      .sort((a, b) => a.lift_vs_segment - b.lift_vs_segment)
      .slice(0, 5);
  }, [interactions]);

  if (interactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-chart-3" />
            <CardTitle className="text-lg">Segment × Copy Matrix</CardTitle>
          </div>
          <CardDescription>
            Discover which copy patterns work best for specific audiences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Need audience data to generate segment analysis</p>
              <p className="text-xs mt-1">Connect lead data with job titles and industries</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-chart-3" />
          <CardTitle className="text-lg">Segment × Copy Matrix</CardTitle>
        </div>
        <CardDescription>
          How copy patterns perform across different audience segments (darker green = better)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Matrix Heatmap */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground p-2 min-w-[100px]">Segment</th>
                {matrix.patternList.map(pattern => (
                  <th key={pattern} className="text-center font-medium text-muted-foreground p-2 min-w-[80px]">
                    {pattern.length > 15 ? pattern.slice(0, 15) + '...' : pattern}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.segmentList.map(segment => (
                <tr key={segment}>
                  <td className="font-medium p-2 whitespace-nowrap">{segment}</td>
                  {matrix.patternList.map(pattern => {
                    const interaction = matrix.matrixData[segment][pattern];
                    if (!interaction) {
                      return (
                        <td key={pattern} className="p-1">
                          <div className="h-10 rounded bg-muted/30 flex items-center justify-center text-muted-foreground">
                            —
                          </div>
                        </td>
                      );
                    }
                    
                    return (
                      <td key={pattern} className="p-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div 
                                className={`h-10 rounded flex items-center justify-center font-mono cursor-help ${getInteractionColor(interaction.lift_vs_segment, interaction.is_significant)}`}
                              >
                                {interaction.is_significant ? (
                                  <>
                                    {interaction.lift_vs_segment > 0 ? '+' : ''}{interaction.lift_vs_segment.toFixed(0)}%
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">~</span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-medium">{segment} × {pattern}</p>
                              <div className="text-xs space-y-1 mt-1">
                                <p>Reply rate: {formatRate(interaction.reply_rate)}</p>
                                <p>Segment avg: {formatRate(interaction.segment_avg_reply_rate)}</p>
                                <p>Pattern avg: {formatRate(interaction.pattern_avg_reply_rate)}</p>
                                <p>Sample: n={interaction.sample_size.toLocaleString()}</p>
                                {!interaction.is_significant && (
                                  <p className="text-muted-foreground italic">Not statistically significant</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Matches & Mismatches */}
        <div className="grid grid-cols-2 gap-4">
          {/* Matches */}
          <div className="p-4 rounded-lg bg-success/5 border border-success/20">
            <h4 className="flex items-center gap-2 font-medium text-sm text-success mb-3">
              <TrendingUp className="h-4 w-4" />
              Top Matches
            </h4>
            {topMatches.length > 0 ? (
              <div className="space-y-2">
                {topMatches.map((match, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{match.pattern}</span>
                      <Badge className="bg-success/10 text-success border-success/30 text-xs">
                        +{match.lift_vs_segment.toFixed(0)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      for {match.segment} (n={match.sample_size.toLocaleString()})
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No significant matches found</p>
            )}
          </div>

          {/* Mismatches */}
          <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
            <h4 className="flex items-center gap-2 font-medium text-sm text-destructive mb-3">
              <TrendingDown className="h-4 w-4" />
              Avoid For Segment
            </h4>
            {topMismatches.length > 0 ? (
              <div className="space-y-2">
                {topMismatches.map((mismatch, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{mismatch.pattern}</span>
                      <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                        {mismatch.lift_vs_segment.toFixed(0)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      for {mismatch.segment} (n={mismatch.sample_size.toLocaleString()})
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No significant mismatches found</p>
            )}
          </div>
        </div>

        {/* Explanation */}
        <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          <p className="font-medium mb-1">How to read this matrix:</p>
          <p>
            Each cell shows how much better (green) or worse (red) a pattern performs for that specific segment 
            compared to the segment's average. Use this to tailor your copy by audience.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
