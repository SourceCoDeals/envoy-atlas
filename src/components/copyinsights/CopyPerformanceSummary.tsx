import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, AlertTriangle, BarChart3, Info } from 'lucide-react';
import type { SubjectLineAnalysis, PatternAnalysis } from '@/hooks/useCopyAnalytics';

interface CopyPerformanceSummaryProps {
  subjectLines: SubjectLineAnalysis[];
  patterns: PatternAnalysis[];
  previousPeriodScore?: number;
}

const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

export function CopyPerformanceSummary({ 
  subjectLines, 
  patterns,
  previousPeriodScore 
}: CopyPerformanceSummaryProps) {
  const summary = useMemo(() => {
    if (subjectLines.length === 0) return null;
    
    const totalSent = subjectLines.reduce((sum, s) => sum + s.sent_count, 0);
    const totalReplies = subjectLines.reduce((sum, s) => sum + s.reply_count, 0);
    const totalPositive = subjectLines.reduce((sum, s) => sum + s.positive_count, 0);
    const totalMeetings = subjectLines.reduce((sum, s) => sum + (s.meeting_count || 0), 0);
    
    const avgReplyRate = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;
    const avgPositiveRate = totalSent > 0 ? (totalPositive / totalSent) * 100 : 0;
    const avgMeetingRate = totalSent > 0 ? (totalMeetings / totalSent) * 100 : 0;
    
    // Calculate variance in performance
    const replyRates = subjectLines.filter(s => s.sent_count >= 100).map(s => s.reply_rate);
    const avgRate = replyRates.reduce((a, b) => a + b, 0) / replyRates.length || 0;
    const variance = replyRates.length > 1 
      ? replyRates.reduce((sum, r) => sum + Math.pow(r - avgRate, 2), 0) / replyRates.length
      : 0;
    const normalizedVariance = 1 - Math.min(1, variance / 10); // Lower variance is better
    
    // Get validated patterns
    const validatedPatterns = patterns.filter(p => p.is_validated);
    const topDriver = validatedPatterns.sort((a, b) => b.comparison_to_baseline - a.comparison_to_baseline)[0];
    const topRisk = validatedPatterns.sort((a, b) => a.comparison_to_baseline - b.comparison_to_baseline)[0];
    
    // Calculate copy score (0-100)
    // Components:
    // - Reply rate lift vs 3% baseline (30 points)
    // - Positive rate lift vs 1.5% baseline (30 points)
    // - Consistency (low variance) (20 points)
    // - Confidence (% high confidence variants) (20 points)
    
    const replyLiftScore = Math.min(30, Math.max(0, (avgReplyRate - 3) * 10 + 15));
    const positiveLiftScore = Math.min(30, Math.max(0, (avgPositiveRate - 1.5) * 15 + 15));
    const consistencyScore = normalizedVariance * 20;
    const highConfidenceCount = subjectLines.filter(s => s.confidence_level === 'high').length;
    const confidenceScore = (highConfidenceCount / subjectLines.length) * 20;
    
    const copyScore = Math.round(replyLiftScore + positiveLiftScore + consistencyScore + confidenceScore);
    
    return {
      totalVariants: subjectLines.length,
      totalSent,
      avgReplyRate,
      avgPositiveRate,
      avgMeetingRate,
      copyScore,
      topDriver,
      topRisk,
      highConfidenceCount,
      confidenceLevel: totalSent >= 10000 ? 'HIGH' : totalSent >= 5000 ? 'MEDIUM' : 'LOW',
      sendsNeeded: totalSent < 10000 ? 10000 - totalSent : 0,
    };
  }, [subjectLines, patterns]);

  if (!summary) {
    return null;
  }

  const scoreChange = previousPeriodScore !== undefined 
    ? summary.copyScore - previousPeriodScore 
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Copy Performance Summary</CardTitle>
        </div>
        <CardDescription>
          Overall health check on copy effectiveness
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Copy Score */}
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Overall Copy Score</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Score based on: Reply rate lift (30%), Positive rate lift (30%), 
                      Consistency (20%), Confidence level (20%)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold">{summary.copyScore}</span>
              <span className="text-lg text-muted-foreground">/100</span>
              {scoreChange !== 0 && (
                <span className={`flex items-center gap-1 text-sm ${scoreChange > 0 ? 'text-success' : 'text-destructive'}`}>
                  {scoreChange > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {scoreChange > 0 ? '+' : ''}{scoreChange} vs last month
                </span>
              )}
            </div>
            <Progress value={summary.copyScore} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Based on {summary.totalVariants} variants across {summary.totalSent.toLocaleString()} sends
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Badge 
              className={
                summary.confidenceLevel === 'HIGH' 
                  ? 'bg-success/10 text-success border-success/30' 
                  : summary.confidenceLevel === 'MEDIUM'
                  ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
                  : 'bg-muted text-muted-foreground'
              }
            >
              Confidence: {summary.confidenceLevel}
            </Badge>
            {summary.sendsNeeded > 0 && (
              <p className="text-xs text-muted-foreground">
                Need ~{summary.sendsNeeded.toLocaleString()} more sends for high confidence
              </p>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Reply Rate</p>
            <p className="text-xl font-bold font-mono">{formatRate(summary.avgReplyRate)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Positive Rate</p>
            <p className="text-xl font-bold font-mono">{formatRate(summary.avgPositiveRate)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Meeting Rate</p>
            <p className="text-xl font-bold font-mono">{formatRate(summary.avgMeetingRate)}</p>
          </div>
        </div>

        {/* Top Driver & Risk */}
        <div className="grid grid-cols-2 gap-4">
          {summary.topDriver && summary.topDriver.comparison_to_baseline > 0 && (
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-success" />
                <span className="text-xs font-medium text-success">Top Driver</span>
              </div>
              <p className="text-sm font-medium">{summary.topDriver.pattern}</p>
              <p className="text-xs text-muted-foreground">
                +{summary.topDriver.comparison_to_baseline.toFixed(0)}% lift
              </p>
            </div>
          )}
          {summary.topRisk && summary.topRisk.comparison_to_baseline < 0 && (
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-xs font-medium text-destructive">Top Risk</span>
              </div>
              <p className="text-sm font-medium">{summary.topRisk.pattern}</p>
              <p className="text-xs text-muted-foreground">
                {summary.topRisk.comparison_to_baseline.toFixed(0)}% drag
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
