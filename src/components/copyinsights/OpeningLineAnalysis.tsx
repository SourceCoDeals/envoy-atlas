import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatisticalConfidenceBadge } from '@/components/dashboard/StatisticalConfidenceBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { MessageSquareText, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { getOpeningLabel, OPENING_DESCRIPTIONS } from '@/lib/patternTaxonomy';

interface OpeningMetrics {
  opening_type: string;
  reply_rate: number;
  positive_rate: number;
  sample_size: number;
  lift_vs_baseline: number;
  examples?: string[];
}

interface OpeningLineAnalysisProps {
  openingMetrics: OpeningMetrics[];
  personalizationDepthData?: {
    depth: string;
    reply_rate: number;
    sample_size: number;
  }[];
  youIRatioData?: {
    ratio_bucket: string;
    reply_rate: number;
    sample_size: number;
  }[];
}

const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

const openingColors: Record<string, string> = {
  trigger_event: 'bg-success/20 text-success border-success/30',
  mutual_connection: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  personalized_observation: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
  compliment: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  direct_problem: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
  question_hook: 'bg-cyan-500/20 text-cyan-500 border-cyan-500/30',
  pattern_interrupt: 'bg-pink-500/20 text-pink-500 border-pink-500/30',
  social_proof_lead: 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
  statistic_lead: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  generic: 'bg-muted text-muted-foreground border-border',
};

export function OpeningLineAnalysis({ 
  openingMetrics, 
  personalizationDepthData,
  youIRatioData 
}: OpeningLineAnalysisProps) {
  const sortedMetrics = [...openingMetrics].sort((a, b) => b.reply_rate - a.reply_rate);
  const topOpening = sortedMetrics[0];
  const worstOpening = sortedMetrics[sortedMetrics.length - 1];
  
  // Find generic to compare against
  const genericMetric = openingMetrics.find(m => m.opening_type === 'generic');
  const genericRate = genericMetric?.reply_rate || 0;

  return (
    <div className="space-y-4">
      {/* Header Card with Key Insights */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-chart-3" />
            <CardTitle className="text-lg">Opening Line Analysis</CardTitle>
          </div>
          <CardDescription>
            First 1-2 sentences determine if they keep reading. Here's what's working.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Best Performer */}
            {topOpening && (
              <div className="p-3 rounded-lg border bg-success/5 border-success/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-xs font-medium text-muted-foreground">TOP PERFORMER</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`text-xs ${openingColors[topOpening.opening_type] || ''}`}>
                    {getOpeningLabel(topOpening.opening_type)}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-success">{formatRate(topOpening.reply_rate)}</div>
                <div className="text-xs text-muted-foreground">
                  {genericRate > 0 && topOpening.reply_rate > genericRate && (
                    <span className="text-success">
                      +{((topOpening.reply_rate - genericRate) / genericRate * 100).toFixed(0)}% vs generic
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* Avoid */}
            {worstOpening && worstOpening.opening_type === 'generic' && (
              <div className="p-3 rounded-lg border bg-destructive/5 border-destructive/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-xs font-medium text-muted-foreground">AVOID</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`text-xs ${openingColors.generic}`}>
                    {getOpeningLabel('generic')}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-destructive">{formatRate(worstOpening.reply_rate)}</div>
                <div className="text-xs text-muted-foreground">
                  "Hope this finds you well" hurts
                </div>
              </div>
            )}
            
            {/* Quick Insight */}
            <div className="p-3 rounded-lg border bg-muted/50">
              <div className="text-xs font-medium text-muted-foreground mb-2">KEY INSIGHT</div>
              <p className="text-sm">
                {topOpening && genericRate > 0 && (
                  <>
                    Switch from generic to <strong>{getOpeningLabel(topOpening.opening_type)}</strong> openers 
                    for a potential <span className="text-success font-semibold">
                      +{((topOpening.reply_rate - genericRate) / genericRate * 100).toFixed(0)}%
                    </span> lift.
                  </>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Opening Type Performance Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Opening Type Performance</CardTitle>
            <CardDescription className="text-xs">
              Reply rate by opening line classification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opening Type</TableHead>
                  <TableHead className="text-right">Reply %</TableHead>
                  <TableHead className="text-right">vs Generic</TableHead>
                  <TableHead className="text-right">Conf.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMetrics.slice(0, 8).map((metric) => {
                  const liftVsGeneric = genericRate > 0 
                    ? ((metric.reply_rate - genericRate) / genericRate) * 100 
                    : 0;
                  const isPositive = liftVsGeneric > 0;
                  
                  return (
                    <TableRow key={metric.opening_type} className={metric.opening_type === 'generic' ? 'bg-muted/30' : ''}>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge 
                                variant="outline" 
                                className={`text-xs cursor-help ${openingColors[metric.opening_type] || ''}`}
                              >
                                {getOpeningLabel(metric.opening_type)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p>{OPENING_DESCRIPTIONS[metric.opening_type]}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatRate(metric.reply_rate)}
                      </TableCell>
                      <TableCell className="text-right">
                        {metric.opening_type !== 'generic' && (
                          <span className={`flex items-center justify-end gap-1 text-sm font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
                            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {isPositive ? '+' : ''}{liftVsGeneric.toFixed(0)}%
                          </span>
                        )}
                        {metric.opening_type === 'generic' && (
                          <span className="text-xs text-muted-foreground">baseline</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatisticalConfidenceBadge sampleSize={metric.sample_size} size="sm" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Personalization Depth & You:I Ratio */}
        <div className="space-y-4">
          {/* Personalization Depth */}
          {personalizationDepthData && personalizationDepthData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Personalization Depth</CardTitle>
                <CardDescription className="text-xs">
                  Generic vs research-based vs hyper-personalized
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {personalizationDepthData.map((item) => {
                    const maxRate = Math.max(...personalizationDepthData.map(d => d.reply_rate));
                    const width = maxRate > 0 ? (item.reply_rate / maxRate) * 100 : 0;
                    
                    return (
                      <div key={item.depth} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{item.depth}</span>
                          <span className="font-mono text-muted-foreground">
                            {formatRate(item.reply_rate)}
                            <span className="text-xs ml-1">(n={item.sample_size.toLocaleString()})</span>
                          </span>
                        </div>
                        <Progress value={width} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* You:I Ratio */}
          {youIRatioData && youIRatioData.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">You:I Ratio Impact</CardTitle>
                <CardDescription className="text-xs">
                  Higher ratio = more recipient-focused language
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {youIRatioData.map((item) => {
                    const maxRate = Math.max(...youIRatioData.map(d => d.reply_rate));
                    const width = maxRate > 0 ? (item.reply_rate / maxRate) * 100 : 0;
                    
                    return (
                      <div key={item.ratio_bucket} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{item.ratio_bucket}</span>
                          <span className="font-mono text-muted-foreground">
                            {formatRate(item.reply_rate)}
                          </span>
                        </div>
                        <Progress value={width} className="h-2" />
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-3 p-2 bg-muted/50 rounded">
                  💡 Emails with 3:1 "you" to "I" ratio typically see 20-40% higher reply rates
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
