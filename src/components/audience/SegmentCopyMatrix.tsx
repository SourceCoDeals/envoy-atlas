import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertTriangle, TrendingUp, TrendingDown, Info, BarChart3 } from 'lucide-react';
import {
  FORMAT_LABELS,
  CTA_LABELS,
  OPENING_LABELS,
  PERSONALIZATION_LABELS,
} from '@/lib/patternTaxonomy';

// Unified pattern labels for matrix display - matches Copy Insights page
const MATRIX_PATTERN_LABELS: Record<string, string> = {
  question_subject: 'Question Subject',
  personalized_open: 'Personalized Open',
  value_first: 'Value First',
  direct_cta: 'Direct CTA',
  soft_cta: 'Soft CTA',
  intrigue: 'Intrigue Format',
  social_proof: 'Social Proof',
  // Fallback mappings
  question: 'Question',
  statement: 'Statement',
  how_to: 'How-To',
};

export interface SegmentCopyInteractionData {
  segment: string;
  segmentType: 'seniority' | 'department' | 'industry';
  pattern: string;
  patternType: string;
  replyRate: number;
  segmentAvgReplyRate: number;
  patternAvgReplyRate: number;
  sampleSize: number;
  liftVsSegment: number;
  liftVsPattern: number;
  isSignificant: boolean;
}

interface SegmentCopyMatrixProps {
  interactions: SegmentCopyInteractionData[];
  minSampleSize?: number;
}

export function SegmentCopyMatrix({ 
  interactions,
  minSampleSize = 30
}: SegmentCopyMatrixProps) {
  // Build matrix data structure from flat interactions
  const segments = [...new Set(interactions.map(i => i.segment))];
  const patterns = [...new Set(interactions.map(i => i.pattern))];
  
  // Filter out 'other' patterns
  const validPatterns = patterns.filter(p => p !== 'other');
  
  // Create lookup map
  const dataMap = new Map<string, SegmentCopyInteractionData>();
  interactions.forEach(i => {
    dataMap.set(`${i.segment}::${i.pattern}`, i);
  });

  // Calculate overall stats
  const totalSampleSize = interactions.reduce((sum, i) => sum + i.sampleSize, 0);
  const avgReplyRate = totalSampleSize > 0
    ? interactions.reduce((sum, i) => sum + i.replyRate * i.sampleSize, 0) / totalSampleSize
    : 0;

  // Extract insights
  const significantInsights = interactions
    .filter(i => i.isSignificant && Math.abs(i.liftVsSegment) > 10)
    .sort((a, b) => Math.abs(b.liftVsSegment) - Math.abs(a.liftVsSegment))
    .slice(0, 4);

  const getCellColor = (lift: number, isSignificant: boolean, sampleSize: number) => {
    if (sampleSize < minSampleSize) return 'bg-muted/30 text-muted-foreground';
    if (!isSignificant && Math.abs(lift) < 15) return 'text-foreground';
    if (lift > 15) return 'bg-success/20 text-success';
    if (lift > 5) return 'bg-success/10 text-success';
    if (lift < -15) return 'bg-destructive/20 text-destructive';
    if (lift < -5) return 'bg-destructive/10 text-destructive';
    return 'text-foreground';
  };

  const getPatternLabel = (pattern: string): string => {
    return MATRIX_PATTERN_LABELS[pattern] || 
           FORMAT_LABELS[pattern] || 
           CTA_LABELS[pattern] || 
           OPENING_LABELS[pattern] ||
           pattern.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  // Show empty state if no data
  if (interactions.length === 0 || segments.length === 0 || validPatterns.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Segment × Copy Matrix
          </CardTitle>
          <CardDescription>
            Discover which copy patterns work best for each audience segment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-warning mb-4" />
            <h3 className="text-lg font-semibold mb-2">Insufficient Data for Matrix</h3>
            <p className="text-muted-foreground max-w-md mb-4">
              The Segment × Copy matrix requires:
            </p>
            <ul className="text-sm text-muted-foreground text-left space-y-1 mb-6">
              <li>• <strong>Lead enrichment:</strong> Titles/seniority to create segments</li>
              <li>• <strong>Variant features:</strong> Copy patterns from variant analysis</li>
              <li>• <strong>Event tracking:</strong> Send/reply events linked to leads</li>
            </ul>
            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <strong>Current status:</strong> {segments.length} segments, {validPatterns.length} patterns, {totalSampleSize} total sends
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Segment × Copy Matrix
            </CardTitle>
            <CardDescription>
              Find what copy works for each audience — color indicates performance vs segment average
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {totalSampleSize.toLocaleString()} emails analyzed
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Matrix */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Header Row */}
            <div 
              className="grid gap-1" 
              style={{ gridTemplateColumns: `160px repeat(${validPatterns.length}, minmax(100px, 1fr)) 80px` }}
            >
              <div className="p-2 text-xs font-medium text-muted-foreground">Segment</div>
              {validPatterns.map(pattern => (
                <TooltipProvider key={pattern}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 text-xs font-medium text-center truncate cursor-help">
                        {getPatternLabel(pattern)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{pattern}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
              <div className="p-2 text-xs font-medium text-center text-muted-foreground">Sample</div>
            </div>

            {/* Data Rows */}
            {segments.map(segment => {
              const segmentData = interactions.filter(i => i.segment === segment);
              const segmentTotal = segmentData.reduce((sum, d) => sum + d.sampleSize, 0);
              
              return (
                <div 
                  key={segment}
                  className="grid gap-1 border-t" 
                  style={{ gridTemplateColumns: `160px repeat(${validPatterns.length}, minmax(100px, 1fr)) 80px` }}
                >
                  <div className="p-2 text-sm font-medium truncate flex items-center gap-2">
                    {segment}
                  </div>
                  
                  {validPatterns.map(pattern => {
                    const data = dataMap.get(`${segment}::${pattern}`);
                    
                    if (!data || data.sampleSize < minSampleSize) {
                      return (
                        <TooltipProvider key={pattern}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="p-2 text-center text-xs text-muted-foreground/40 cursor-help">
                                —
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                {data ? `Only ${data.sampleSize} sends (need ${minSampleSize}+)` : 'No data'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    }

                    return (
                      <TooltipProvider key={pattern}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div 
                              className={cn(
                                "p-2 text-center rounded-sm cursor-help transition-colors",
                                getCellColor(data.liftVsSegment, data.isSignificant, data.sampleSize)
                              )}
                            >
                              <div className="font-mono text-sm font-medium">
                                {data.replyRate.toFixed(1)}%
                              </div>
                              {data.isSignificant && Math.abs(data.liftVsSegment) > 10 && (
                                <div className="text-xs flex items-center justify-center gap-0.5">
                                  {data.liftVsSegment > 0 ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {data.liftVsSegment > 0 ? '+' : ''}{data.liftVsSegment.toFixed(0)}%
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-1 text-xs">
                              <p><strong>{segment}</strong> + <strong>{getPatternLabel(pattern)}</strong></p>
                              <p>Reply rate: {data.replyRate.toFixed(2)}%</p>
                              <p>Sample: {data.sampleSize} sends</p>
                              <p>vs segment avg: {data.liftVsSegment > 0 ? '+' : ''}{data.liftVsSegment.toFixed(1)}%</p>
                              <p>Significant: {data.isSignificant ? 'Yes' : 'No'}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                  
                  <div className="p-2 text-center text-xs text-muted-foreground font-mono">
                    {segmentTotal.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground border-t pt-4">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-sm bg-success/20" />
            <span>Best for segment (&gt;15% above avg)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-sm bg-destructive/20" />
            <span>Worst for segment (&gt;15% below avg)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-sm bg-muted/30" />
            <span>Insufficient data (&lt;{minSampleSize} sends)</span>
          </div>
        </div>

        {/* Key Insights */}
        {significantInsights.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Info className="h-4 w-4" />
              Key Insights
            </h4>
            <div className="grid gap-2 md:grid-cols-2">
              {significantInsights.map((insight, i) => (
                <div 
                  key={i}
                  className={cn(
                    "p-3 rounded-lg text-sm",
                    insight.liftVsSegment > 0 ? "bg-success/5 border border-success/20" : "bg-destructive/5 border border-destructive/20"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {insight.liftVsSegment > 0 ? (
                      <TrendingUp className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium">
                        {insight.segment} + {getPatternLabel(insight.pattern)}
                        <span className={cn(
                          "ml-2 text-xs",
                          insight.liftVsSegment > 0 ? "text-success" : "text-destructive"
                        )}>
                          ({insight.liftVsSegment > 0 ? '+' : ''}{insight.liftVsSegment.toFixed(0)}%)
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {insight.liftVsSegment > 0 
                          ? `→ Prioritize "${getPatternLabel(insight.pattern)}" copy for ${insight.segment}`
                          : `→ Avoid "${getPatternLabel(insight.pattern)}" for ${insight.segment}`
                        }
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