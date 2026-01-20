import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { ExecutiveSummary } from '../ExecutiveSummary';
import { SequenceFlowChart } from '../SequenceFlowChart';
import { NoSequencesEmptyState } from '../ActionableEmptyState';
import { useSequenceAnalytics } from '@/hooks/useSequenceAnalytics';

export function SequencesTab() {
  const { 
    sequenceData, 
    loading, 
    hasData, 
    totalSteps,
    totalSent,
    totalReplies,
    step1ReplyShare,
    optimalLength,
  } = useSequenceAnalytics();

  // Generate executive insights from real data
  const executiveInsights = useMemo(() => {
    if (!hasData) {
      return [{
        type: 'neutral' as const,
        title: 'No sequence data available',
        description: 'Connect your email platform to see how multi-step sequences perform. We\'ll analyze reply patterns across steps.',
      }];
    }
    
    const insights = [];
    
    if (step1ReplyShare > 50) {
      insights.push({
        type: 'positive' as const,
        title: `${step1ReplyShare.toFixed(0)}% of replies come from the first email`,
        description: 'Most people who will reply do so quickly. Focus your best copy on Step 1.',
        impact: 'Step 1 focus',
      });
    } else if (step1ReplyShare > 30) {
      insights.push({
        type: 'neutral' as const,
        title: `${step1ReplyShare.toFixed(0)}% of replies come from the first email`,
        description: 'Your sequence is working well—follow-ups are generating meaningful engagement.',
      });
    }
    
    if (optimalLength && optimalLength <= 3) {
      insights.push({
        type: 'positive' as const,
        title: `Optimal sequence length: ${optimalLength} steps`,
        description: 'Most of your positive outcomes happen early. Consider focusing on the first few touchpoints.',
        impact: 'Efficiency opportunity',
      });
    } else if (optimalLength && optimalLength > 3) {
      insights.push({
        type: 'neutral' as const,
        title: `Best reply rate at step ${optimalLength}`,
        description: 'Your audience responds well to persistence. Your full sequence is working.',
      });
    }
    
    if (totalSteps >= 5) {
      const laterStepsReplies = sequenceData
        .filter(s => s.step_number > 3)
        .reduce((sum, s) => sum + s.replies, 0);
      const laterStepsPercent = totalReplies > 0 ? (laterStepsReplies / totalReplies) * 100 : 0;
      
      if (laterStepsPercent < 15) {
        insights.push({
          type: 'warning' as const,
          title: `Steps 4+ contribute only ${laterStepsPercent.toFixed(0)}% of replies`,
          description: 'Later sequence steps have diminishing returns. Consider shortening your sequences.',
        });
      }
    }
    
    return insights.length > 0 ? insights : [{
      type: 'neutral' as const,
      title: 'Analyzing your sequence patterns',
      description: 'We need more data to identify meaningful patterns in your multi-step sequences.',
    }];
  }, [hasData, step1ReplyShare, optimalLength, totalSteps, totalReplies, sequenceData]);

  const bottomLine = hasData 
    ? step1ReplyShare > 50
      ? 'Your first email does the heavy lifting—make it count. Focus A/B testing there.'
      : 'Your follow-ups are working. Keep refining your full sequence for maximum impact.'
    : 'Connect your email platform to analyze sequence performance.';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="space-y-6">
        <ExecutiveSummary
          title="Sequence Performance"
          subtitle="How your multi-step email sequences are performing"
          insights={executiveInsights}
          bottomLine={bottomLine}
        />
        <NoSequencesEmptyState />
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

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Sequence Steps</div>
            <div className="text-2xl font-bold">{totalSteps}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Step 1 Reply Share</div>
            <div className="text-2xl font-bold">{step1ReplyShare.toFixed(0)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Emails</div>
            <div className="text-2xl font-bold">{totalSent.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Replies</div>
            <div className="text-2xl font-bold">{totalReplies.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Sequence Flow Visualization */}
      <SequenceFlowChart data={sequenceData} />
    </div>
  );
}
