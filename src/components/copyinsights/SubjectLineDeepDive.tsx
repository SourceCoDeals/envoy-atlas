import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Hash, TrendingUp, TrendingDown, AlertTriangle, Zap, Eye } from 'lucide-react';
import { 
  getFirstWordLabel, 
  FIRST_WORD_DESCRIPTIONS,
  CAPITALIZATION_LABELS,
  PUNCTUATION_LABELS,
} from '@/lib/patternTaxonomy';

interface SubjectLineMetrics {
  // First word analysis
  first_word_type?: string;
  // Capitalization
  capitalization_style?: string;
  // Punctuation
  has_question?: boolean;
  has_ellipsis?: boolean;
  has_emoji?: boolean;
  has_exclamation?: boolean;
  // Other
  has_number?: boolean;
  char_count?: number;
  word_count?: number;
  spam_score?: number;
  urgency_score?: number;
  // Performance
  reply_rate: number;
  sample_size: number;
}

interface PatternPerformance {
  pattern: string;
  pattern_type: string;
  reply_rate: number;
  sample_size: number;
  lift_vs_baseline: number;
}

interface SubjectLineDeepDiveProps {
  firstWordData: PatternPerformance[];
  capitalizationData: PatternPerformance[];
  punctuationData: PatternPerformance[];
  numberPresenceData: {
    has_number: boolean;
    reply_rate: number;
    sample_size: number;
  }[];
  previewTruncationData?: {
    truncation_point: string;
    reply_rate: number;
    sample_size: number;
  }[];
  spamScoreImpact?: {
    score_bucket: string;
    reply_rate: number;
    sample_size: number;
  }[];
  baselineReplyRate: number;
}

const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

export function SubjectLineDeepDive({
  firstWordData,
  capitalizationData,
  punctuationData,
  numberPresenceData,
  previewTruncationData,
  spamScoreImpact,
  baselineReplyRate,
}: SubjectLineDeepDiveProps) {
  const sortedFirstWord = useMemo(() => 
    [...firstWordData].sort((a, b) => b.reply_rate - a.reply_rate),
    [firstWordData]
  );
  
  const sortedCap = useMemo(() => 
    [...capitalizationData].sort((a, b) => b.reply_rate - a.reply_rate),
    [capitalizationData]
  );

  const numberImpact = useMemo(() => {
    const withNumber = numberPresenceData.find(d => d.has_number);
    const withoutNumber = numberPresenceData.find(d => !d.has_number);
    if (withNumber && withoutNumber && withoutNumber.reply_rate > 0) {
      return {
        lift: ((withNumber.reply_rate - withoutNumber.reply_rate) / withoutNumber.reply_rate) * 100,
        withRate: withNumber.reply_rate,
        withoutRate: withoutNumber.reply_rate,
        withSample: withNumber.sample_size,
        withoutSample: withoutNumber.sample_size,
      };
    }
    return null;
  }, [numberPresenceData]);

  return (
    <div className="space-y-4">
      {/* Quick Wins Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-chart-1" />
            <CardTitle className="text-lg">Subject Line Deep Dive</CardTitle>
          </div>
          <CardDescription>
            First word, capitalization, punctuation, and preview optimization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            {/* First Word Winner */}
            {sortedFirstWord[0] && (
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="text-xs font-medium text-muted-foreground mb-1">BEST FIRST WORD</div>
                <Badge variant="outline" className="mb-1">
                  {getFirstWordLabel(sortedFirstWord[0].pattern)}
                </Badge>
                <div className="text-lg font-bold">{formatRate(sortedFirstWord[0].reply_rate)}</div>
                {sortedFirstWord[0].lift_vs_baseline !== 0 && (
                  <div className={`text-xs ${sortedFirstWord[0].lift_vs_baseline > 0 ? 'text-success' : 'text-destructive'}`}>
                    {sortedFirstWord[0].lift_vs_baseline > 0 ? '+' : ''}{sortedFirstWord[0].lift_vs_baseline.toFixed(0)}% vs avg
                  </div>
                )}
              </div>
            )}
            
            {/* Capitalization Winner */}
            {sortedCap[0] && (
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="text-xs font-medium text-muted-foreground mb-1">BEST CASE STYLE</div>
                <Badge variant="outline" className="mb-1">
                  {CAPITALIZATION_LABELS[sortedCap[0].pattern] || sortedCap[0].pattern}
                </Badge>
                <div className="text-lg font-bold">{formatRate(sortedCap[0].reply_rate)}</div>
              </div>
            )}
            
            {/* Number Impact */}
            {numberImpact && (
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="text-xs font-medium text-muted-foreground mb-1">NUMBERS IN SUBJECT</div>
                <div className="flex items-center gap-1">
                  {numberImpact.lift > 0 ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  )}
                  <span className={`text-lg font-bold ${numberImpact.lift > 0 ? 'text-success' : 'text-destructive'}`}>
                    {numberImpact.lift > 0 ? '+' : ''}{numberImpact.lift.toFixed(0)}%
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatRate(numberImpact.withRate)} vs {formatRate(numberImpact.withoutRate)}
                </div>
              </div>
            )}
            
            {/* Preview Optimization */}
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="text-xs font-medium text-muted-foreground mb-1">PREVIEW LENGTH</div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">40-60 chars</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Shows fully on mobile inbox
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* First Word Analysis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">First Word Impact</CardTitle>
            <CardDescription className="text-xs">
              Opening word sets the frame and captures attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedFirstWord.slice(0, 6).map((item) => {
                const maxRate = Math.max(...firstWordData.map(d => d.reply_rate));
                const width = maxRate > 0 ? (item.reply_rate / maxRate) * 100 : 0;
                const isTop = item === sortedFirstWord[0];
                
                return (
                  <TooltipProvider key={item.pattern}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`space-y-1 p-2 rounded ${isTop ? 'bg-success/10 border border-success/20' : ''}`}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              {getFirstWordLabel(item.pattern)}
                              {isTop && <Badge className="text-[10px] bg-success/20 text-success border-success/30">Best</Badge>}
                            </span>
                            <span className="font-mono">
                              {formatRate(item.reply_rate)}
                              <span className="text-xs text-muted-foreground ml-1">
                                (n={item.sample_size.toLocaleString()})
                              </span>
                            </span>
                          </div>
                          <Progress value={width} className="h-1.5" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{FIRST_WORD_DESCRIPTIONS[item.pattern]}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Punctuation & Emoji Impact */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Punctuation & Emoji Impact</CardTitle>
            <CardDescription className="text-xs">
              Question marks, ellipsis, and emoji effects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Element</TableHead>
                  <TableHead className="text-right">Reply %</TableHead>
                  <TableHead className="text-right">vs Baseline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {punctuationData.map((item) => {
                  const lift = baselineReplyRate > 0 
                    ? ((item.reply_rate - baselineReplyRate) / baselineReplyRate) * 100 
                    : 0;
                  const isPositive = lift > 0;
                  
                  return (
                    <TableRow key={item.pattern}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {PUNCTUATION_LABELS[item.pattern] || item.pattern}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatRate(item.reply_rate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`flex items-center justify-end gap-1 text-sm ${isPositive ? 'text-success' : 'text-destructive'}`}>
                          {isPositive ? '+' : ''}{lift.toFixed(0)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {spamScoreImpact && spamScoreImpact.length > 0 && (
              <div className="mt-4 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium">Spam Trigger Warning</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Subjects with spam trigger words ("free", "guaranteed", "act now") see 
                  <span className="text-destructive font-medium"> -15-25% lower</span> reply rates.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Capitalization Styles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Capitalization Style Impact</CardTitle>
          <CardDescription className="text-xs">
            Title Case vs Sentence case vs lowercase affects perception
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            {sortedCap.map((item, index) => {
              const isTop = index === 0;
              return (
                <div 
                  key={item.pattern}
                  className={`p-3 rounded-lg border ${isTop ? 'bg-success/10 border-success/30' : 'bg-muted/30'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={isTop ? 'default' : 'outline'} className="text-xs">
                      {CAPITALIZATION_LABELS[item.pattern] || item.pattern}
                    </Badge>
                    {isTop && <Zap className="h-4 w-4 text-success" />}
                  </div>
                  <div className={`text-xl font-bold ${isTop ? 'text-success' : ''}`}>
                    {formatRate(item.reply_rate)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    n={item.sample_size.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
