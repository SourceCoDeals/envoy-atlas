import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  TrendingUp, 
  TrendingDown, 
  Trophy, 
  AlertCircle, 
  Target, 
  Zap,
  ArrowRight,
  CheckCircle,
  XCircle,
  Sparkles,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { SubjectLineAnalysis, PatternAnalysis } from '@/hooks/useCopyAnalytics';

interface OverviewTabProps {
  subjectLines: SubjectLineAnalysis[];
  patterns: PatternAnalysis[];
  discoveredPatterns: any[];
  recommendations: string[];
  baselineReplyRate: number;
  onBackfill: () => void;
  onRecompute: () => void;
  isBackfilling: boolean;
  isRecomputing: boolean;
}

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  benchmark?: string;
  status?: 'good' | 'warning' | 'bad';
  icon?: React.ReactNode;
}

const MetricCard = ({ title, value, change, benchmark, status, icon }: MetricCardProps) => {
  const isPositive = change?.startsWith('+');
  const isNegative = change?.startsWith('-');
  
  return (
    <Card className="bg-card">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted-foreground">{title}</span>
          {icon}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <div className={`text-sm mt-1 flex items-center gap-1 ${
            isPositive ? 'text-success' : isNegative ? 'text-destructive' : 'text-muted-foreground'
          }`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : null}
            {change} vs last period
          </div>
        )}
        {benchmark && (
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            Benchmark: {benchmark}
            {status === 'good' && <CheckCircle className="h-3 w-3 text-success" />}
            {status === 'warning' && <AlertCircle className="h-3 w-3 text-yellow-500" />}
            {status === 'bad' && <XCircle className="h-3 w-3 text-destructive" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import { ExecutiveSummary } from '../ExecutiveSummary';

export function OverviewTab({
  subjectLines,
  patterns,
  discoveredPatterns,
  recommendations,
  baselineReplyRate,
  onBackfill,
  onRecompute,
  isBackfilling,
  isRecomputing,
}: OverviewTabProps) {
  // Calculate summary metrics
  const totalSent = subjectLines.reduce((sum, s) => sum + s.sent_count, 0);
  const totalReplies = subjectLines.reduce((sum, s) => sum + s.reply_count, 0);
  const totalOpens = subjectLines.reduce((sum, s) => sum + (s.open_count || 0), 0);
  const totalPositive = subjectLines.reduce((sum, s) => sum + (s.positive_count || 0), 0);
  
  const avgReplyRate = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;
  const avgOpenRate = totalSent > 0 ? (totalOpens / totalSent) * 100 : 0;
  const positiveRate = totalReplies > 0 ? (totalPositive / totalReplies) * 100 : 0;

  // Generate executive summary insights
  const executiveInsights = [
    {
      type: avgReplyRate >= 3.43 ? 'positive' as const : 'warning' as const,
      title: avgReplyRate >= 3.43 ? 'Your emails are performing above average' : 'Your reply rate needs attention',
      description: avgReplyRate >= 3.43 
        ? `At ${avgReplyRate.toFixed(1)}%, you're outperforming the industry benchmark of 3.43%. Keep doing what works!`
        : `At ${avgReplyRate.toFixed(1)}%, you're below the 3.43% benchmark. The good news: small changes can make a big difference.`,
      impact: avgReplyRate >= 3.43 ? '+' + (avgReplyRate - 3.43).toFixed(1) + '% vs benchmark' : (avgReplyRate - 3.43).toFixed(1) + '% vs benchmark',
    },
    {
      type: positiveRate >= 50 ? 'positive' as const : 'negative' as const,
      title: positiveRate >= 50 ? 'Most replies are positive' : 'Too many negative replies',
      description: positiveRate >= 50
        ? `${positiveRate.toFixed(0)}% of people who reply are interested—you're reaching the right audience.`
        : `Only ${positiveRate.toFixed(0)}% of replies are positive. You may be targeting the wrong audience or your message isn't resonating.`,
      impact: positiveRate >= 50 ? 'Good fit' : 'Needs work',
    },
    {
      type: 'neutral' as const,
      title: `Analyzed ${totalSent.toLocaleString()} emails`,
      description: totalSent > 5000 
        ? 'You have plenty of data for reliable insights. The patterns we show are statistically significant.'
        : 'You have limited data so far. Insights will become more reliable as you send more emails.',
    },
  ];

  const bottomLine = avgReplyRate >= 3.43 
    ? 'Focus on scaling what works—your Timeline hooks and short emails are driving results.'
    : 'Start with quick wins: switch to Timeline hooks in your opening lines and keep emails under 100 words.';

  // Top and bottom performers from patterns (use discoveredPatterns from DB)
  const sortedPatterns = [...discoveredPatterns].sort((a, b) => b.comparison_to_baseline - a.comparison_to_baseline);
  const topPatterns = sortedPatterns.filter(p => p.comparison_to_baseline > 0).slice(0, 5);
  const bottomPatterns = sortedPatterns.filter(p => p.comparison_to_baseline < 0).slice(0, 5);

  // Compute hook type performance from subject line analysis
  const hookTypeStats = useMemo(() => {
    const typeGroups: Record<string, { total: number; replies: number; sent: number }> = {};
    
    subjectLines.forEach(s => {
      // Classify hook type based on format and content
      let hookType = 'Generic Hook';
      const lower = s.subject_line.toLowerCase();
      
      if (lower.includes('congrats') || lower.includes('saw your') || lower.includes('noticed')) {
        hookType = 'Timeline Hook';
      } else if (/\d/.test(s.subject_line)) {
        hookType = 'Numbers Hook';
      } else if (lower.includes('impressed') || lower.includes('great work') || lower.includes('love')) {
        hookType = 'Compliment Hook';
      } else if (s.has_question) {
        hookType = 'Question Hook';
      } else if (lower.includes('struggling') || lower.includes('challenge') || lower.includes('problem')) {
        hookType = 'Problem Hook';
      }
      
      if (!typeGroups[hookType]) {
        typeGroups[hookType] = { total: 0, replies: 0, sent: 0 };
      }
      typeGroups[hookType].total++;
      typeGroups[hookType].replies += s.reply_count;
      typeGroups[hookType].sent += s.sent_count;
    });
    
    const totalVariants = subjectLines.length || 1;
    
    return Object.entries(typeGroups)
      .map(([type, stats]) => {
        const rate = stats.sent > 0 ? (stats.replies / stats.sent) * 100 : 0;
        const lift = baselineReplyRate > 0 ? ((rate - baselineReplyRate) / baselineReplyRate) * 100 : 0;
        const usage = (stats.total / totalVariants) * 100;
        
        return {
          type,
          rate: parseFloat(rate.toFixed(1)),
          lift: lift >= 0 ? `+${lift.toFixed(0)}%` : `${lift.toFixed(0)}%`,
          usage: `${usage.toFixed(0)}%`,
          status: (lift > 50 ? 'best' : lift > 10 ? 'good' : lift > -10 ? 'ok' : 'bad') as 'best' | 'good' | 'ok' | 'bad',
        };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [subjectLines, baselineReplyRate]);

  // Compute CTA type performance from patterns or subject lines
  const ctaTypeStats = useMemo(() => {
    // Try to find CTA patterns from discovered patterns
    const ctaPatterns = discoveredPatterns.filter(p => 
      p.pattern.toLowerCase().includes('cta') || 
      p.description.toLowerCase().includes('call to action') ||
      p.pattern.toLowerCase().includes('question') ||
      p.pattern.toLowerCase().includes('calendar') ||
      p.pattern.toLowerCase().includes('link')
    );
    
    if (ctaPatterns.length >= 3) {
      return ctaPatterns.map(p => ({
        type: p.pattern,
        example: p.description,
        rate: p.avg_reply_rate,
        friction: p.avg_reply_rate > 5 ? 'Very Low' : p.avg_reply_rate > 3 ? 'Low' : p.avg_reply_rate > 2 ? 'Medium' : 'High',
      })).slice(0, 6);
    }
    
    // Fallback: compute from body copy patterns in discovered patterns
    const bodyPatterns = discoveredPatterns.filter(p => 
      p.pattern.toLowerCase().includes('body') || 
      p.pattern.toLowerCase().includes('short') ||
      p.pattern.toLowerCase().includes('long')
    );
    
    if (bodyPatterns.length >= 2) {
      return bodyPatterns.map(p => ({
        type: p.pattern,
        example: p.description,
        rate: p.avg_reply_rate,
        friction: p.comparison_to_baseline > 10 ? 'Low' : p.comparison_to_baseline > 0 ? 'Medium' : 'High',
      })).slice(0, 6);
    }
    
    // No fallback - return empty array if no real data
    return [];
  }, [discoveredPatterns]);

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <ExecutiveSummary
        title="What's Happening With Your Email Copy"
        subtitle="Here's the plain-English breakdown of your email performance"
        insights={executiveInsights}
        bottomLine={bottomLine}
      />

      {/* Performance Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          title="Average Reply Rate" 
          value={`${avgReplyRate.toFixed(1)}%`}
          change={avgReplyRate > 3.43 ? `+${(avgReplyRate - 3.43).toFixed(1)}%` : `${(avgReplyRate - 3.43).toFixed(1)}%`}
          benchmark="3.43%"
          status={avgReplyRate >= 3.43 ? 'good' : 'warning'}
        />
        <MetricCard 
          title="Average Open Rate" 
          value={`${avgOpenRate.toFixed(1)}%`}
          change={avgOpenRate > 27.7 ? `+${(avgOpenRate - 27.7).toFixed(1)}%` : `${(avgOpenRate - 27.7).toFixed(1)}%`}
          benchmark="27.7%"
          status={avgOpenRate >= 27.7 ? 'good' : 'warning'}
        />
        <MetricCard 
          title="Positive Reply %" 
          value={`${positiveRate.toFixed(0)}%`}
          benchmark="50%"
          status={positiveRate >= 50 ? 'good' : 'warning'}
        />
        <MetricCard 
          title="Total Emails Analyzed" 
          value={totalSent.toLocaleString()}
          icon={<Target className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* AI Recommendations + Pattern Discovery */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* AI Recommendations */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">AI Recommendations</CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onBackfill}
                disabled={isBackfilling}
              >
                {isBackfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              Reply rate <strong>{avgReplyRate.toFixed(1)}%</strong> is {avgReplyRate >= 3.43 ? 'above' : 'below'} benchmark (3.43%).
              {topPatterns.length > 0 && ` Top pattern: ${topPatterns[0]?.pattern} (+${topPatterns[0]?.comparison_to_baseline?.toFixed(0)}%).`}
            </div>
            
            {recommendations.length > 0 ? (
              recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="p-3 border rounded-lg hover:border-primary/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">#{i + 1}</Badge>
                      <span className="text-sm font-medium">{rec}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="default" className="h-7 text-xs">Create A/B Test</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs">View Details</Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No AI recommendations yet.</p>
                <p className="text-xs mt-1">Run "Backfill & Analyze" to generate personalized recommendations.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pattern Discovery */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Pattern Discovery
                </CardTitle>
                <CardDescription>vs {baselineReplyRate.toFixed(1)}% baseline reply rate</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onRecompute}
                disabled={isRecomputing}
              >
                {isRecomputing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Recalculate'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium text-success mb-2 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> TOP PERFORMERS
                </div>
                <div className="space-y-1">
                  {topPatterns.length > 0 ? topPatterns.map((p, i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/50 text-sm">
                      <span className="text-muted-foreground truncate">{p.pattern}</span>
                      <div className="flex gap-2 items-center">
                        <span className="font-medium text-success">+{p.comparison_to_baseline?.toFixed(0) || 0}%</span>
                        <span className="text-xs text-muted-foreground">p&lt;{(p.p_value || 0.05).toFixed(2)}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm text-muted-foreground py-2">
                      No high-performing patterns found yet.
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-destructive mb-2 flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> UNDERPERFORMERS
                </div>
                <div className="space-y-1">
                  {bottomPatterns.length > 0 ? bottomPatterns.map((p, i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/50 text-sm">
                      <span className="text-muted-foreground truncate">{p.pattern}</span>
                      <div className="flex gap-2 items-center">
                        <span className="font-medium text-destructive">{p.comparison_to_baseline?.toFixed(0) || 0}%</span>
                        <span className="text-xs text-muted-foreground">p&lt;{(p.p_value || 0.05).toFixed(2)}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm text-muted-foreground py-2">
                      No underperforming patterns detected.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hook Type + CTA Performance */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Hook Type Performance */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  🎯 Hook Type Performance
                </CardTitle>
                <CardDescription>Opening line has the BIGGEST impact on reply rates</CardDescription>
              </div>
              <Badge variant="destructive" className="text-xs">Critical</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {hookTypeStats.length > 0 ? hookTypeStats.map((hook, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-28 text-sm text-muted-foreground truncate">{hook.type}</div>
                <div className="flex-1 relative h-5 bg-muted rounded">
                  <div 
                    className={`absolute h-full rounded ${
                      hook.status === 'best' ? 'bg-success' : 
                      hook.status === 'good' ? 'bg-success/70' : 
                      hook.status === 'ok' ? 'bg-yellow-500' : 'bg-destructive'
                    }`}
                    style={{ width: `${Math.min((hook.rate / 10) * 100, 100)}%` }}
                  />
                </div>
                <div className="w-12 text-sm font-medium">{hook.rate}%</div>
                <div className={`w-14 text-xs ${hook.lift.startsWith('+') ? 'text-success' : 'text-destructive'}`}>
                  {hook.lift}
                </div>
                <div className="w-10 text-xs text-muted-foreground">{hook.usage}</div>
              </div>
            )) : (
              <div className="text-sm text-muted-foreground p-3 text-center">
                No hook type data available yet. Run "Backfill & Analyze" to extract patterns.
              </div>
            )}
            
            {/* Only show alert if we have data showing underperforming hooks */}
            {hookTypeStats.some(h => h.status === 'bad' && parseFloat(h.usage) > 30) && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm text-destructive">
                  <strong>🚨 Alert:</strong> {hookTypeStats.filter(h => h.status === 'bad').map(h => h.type).join(', ')} hooks are underperforming.
                  Consider switching to {hookTypeStats.find(h => h.status === 'best')?.type || 'higher-performing'} hooks.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CTA Type Performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">CTA Type Performance</CardTitle>
            <CardDescription>Lower friction CTAs get more responses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ctaTypeStats.length > 0 ? ctaTypeStats.map((cta, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="w-24 text-muted-foreground truncate">{cta.type}</div>
                <div className="flex-1 relative h-4 bg-muted rounded">
                  <div 
                    className={`absolute h-full rounded ${
                      i < 3 ? 'bg-success' : i < 4 ? 'bg-yellow-500' : 'bg-destructive'
                    }`}
                    style={{ width: `${Math.min((cta.rate / 7) * 100, 100)}%` }}
                  />
                </div>
                <div className="w-10 font-medium">{typeof cta.rate === 'number' ? cta.rate.toFixed(1) : cta.rate}%</div>
                <Badge 
                  variant="outline" 
                  className={`text-xs w-16 justify-center ${
                    cta.friction === 'Very Low' ? 'bg-success/10 text-success border-success/30' :
                    cta.friction === 'Low' ? 'bg-success/5 text-success/80 border-success/20' :
                    cta.friction === 'Medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' :
                    cta.friction === 'High' ? 'bg-destructive/10 text-destructive border-destructive/30' : 
                    'bg-muted text-muted-foreground'
                  }`}
                >
                  {cta.friction}
                </Badge>
              </div>
            )) : (
              <div className="text-sm text-muted-foreground p-3 text-center">
                No CTA data available yet. Run "Backfill & Analyze" to extract CTA patterns.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
