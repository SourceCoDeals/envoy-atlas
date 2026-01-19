import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { ExecutiveSummary } from '../ExecutiveSummary';

interface SequenceStepData {
  step_number: number;
  sent: number;
  replies: number;
}

interface SequencesTabProps {
  sequenceData?: SequenceStepData[];
}

export function SequencesTab({ sequenceData = [] }: SequencesTabProps) {
  // Calculate reply distribution from real data
  const replyDistribution = useMemo(() => {
    if (sequenceData.length === 0) return [];
    
    const totalReplies = sequenceData.reduce((sum, s) => sum + s.replies, 0);
    
    return sequenceData.map(step => ({
      step: step.step_number === 1 ? 'Step 1 - Initial' : 
            step.step_number >= 5 ? 'Step 5+' : 
            `Step ${step.step_number} - Follow-up #${step.step_number - 1}`,
      pct: totalReplies > 0 ? (step.replies / totalReplies) * 100 : 0,
      rate: step.sent > 0 ? (step.replies / step.sent) * 100 : 0,
      sent: step.sent,
    }));
  }, [sequenceData]);

  // Calculate summary metrics from real data
  const summaryMetrics = useMemo(() => {
    if (sequenceData.length === 0) {
      return {
        activeSequences: 0,
        avgLength: 0,
        step1ReplyShare: 0,
        hasData: false,
      };
    }
    
    const totalReplies = sequenceData.reduce((sum, s) => sum + s.replies, 0);
    const step1Replies = sequenceData.find(s => s.step_number === 1)?.replies || 0;
    
    return {
      activeSequences: sequenceData.length,
      avgLength: sequenceData.length,
      step1ReplyShare: totalReplies > 0 ? (step1Replies / totalReplies) * 100 : 0,
      hasData: true,
    };
  }, [sequenceData]);

  const hasData = sequenceData.length > 0;

  // Generate executive insights only from real data
  const executiveInsights = useMemo(() => {
    if (!hasData) {
      return [{
        type: 'neutral' as const,
        title: 'No sequence data available',
        description: 'Connect your email platform to see how multi-step sequences perform. We\'ll analyze reply patterns across steps.',
      }];
    }
    
    const insights = [];
    
    if (summaryMetrics.step1ReplyShare > 50) {
      insights.push({
        type: 'positive' as const,
        title: `${summaryMetrics.step1ReplyShare.toFixed(0)}% of replies come from the first email`,
        description: 'Most people who will reply do so quickly. Focus your best copy on Step 1.',
        impact: 'Step 1 focus',
      });
    }
    
    if (replyDistribution.length > 3) {
      const laterStepReplies = replyDistribution.slice(3).reduce((sum, s) => sum + s.pct, 0);
      if (laterStepReplies < 15) {
        insights.push({
          type: 'neutral' as const,
          title: `Steps 4+ contribute only ${laterStepReplies.toFixed(0)}% of replies`,
          description: 'Later sequence steps have diminishing returns. Consider keeping sequences shorter.',
        });
      }
    }
    
    return insights.length > 0 ? insights : [{
      type: 'neutral' as const,
      title: 'Analyzing your sequence patterns',
      description: 'We need more data to identify meaningful patterns in your multi-step sequences.',
    }];
  }, [hasData, summaryMetrics, replyDistribution]);

  const bottomLine = hasData 
    ? `Focus your best copy on early sequence steps where most replies happen.`
    : 'Connect your email platform to analyze sequence performance.';

  if (!hasData) {
    return (
      <div className="space-y-6">
        <ExecutiveSummary
          title="Sequence Performance"
          subtitle="How your multi-step email sequences are performing"
          insights={executiveInsights}
          bottomLine={bottomLine}
        />
        
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Sequence Data Available</p>
              <p className="text-sm">
                Sequence analytics require step-level tracking from your email platform.
                This data will populate once available.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <ExecutiveSummary
        title="Sequence Performance: The Big Picture"
        subtitle="How your multi-step email sequences are performing"
        insights={executiveInsights}
        bottomLine={bottomLine}
      />

      {/* Sequence Overview - Real Data Only */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Sequence Steps</div>
            <div className="text-2xl font-bold">{summaryMetrics.avgLength}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Step 1 Reply Share</div>
            <div className="text-2xl font-bold">{summaryMetrics.step1ReplyShare.toFixed(0)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Emails</div>
            <div className="text-2xl font-bold">
              {sequenceData.reduce((sum, s) => sum + s.sent, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Replies</div>
            <div className="text-2xl font-bold">
              {sequenceData.reduce((sum, s) => sum + s.replies, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reply Distribution - Real Data */}
      <Card>
        <CardHeader>
          <CardTitle>Reply Distribution by Step</CardTitle>
          <CardDescription>Where do your replies come from?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {replyDistribution.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-40 text-sm">{step.step}</div>
              <div className="flex-1 relative h-6 bg-muted rounded">
                <div className="absolute h-full bg-primary rounded" style={{ width: `${step.pct}%` }} />
                <span className="absolute right-2 top-0.5 text-xs">{step.pct.toFixed(0)}%</span>
              </div>
              <div className="w-12 text-sm text-muted-foreground">{step.rate.toFixed(1)}%</div>
              <Badge variant="outline" className="text-xs">n={step.sent.toLocaleString()}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
