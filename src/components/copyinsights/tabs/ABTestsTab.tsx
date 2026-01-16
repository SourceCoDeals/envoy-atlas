import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FlaskConical, Plus } from 'lucide-react';
import { ExecutiveSummary } from '../ExecutiveSummary';

interface ABTestsTabProps {}

export function ABTestsTab({}: ABTestsTabProps) {
  const mockTests = [
    { name: 'Timeline vs Problem Hook', status: 'running', progress: 67, variantA: 'Timeline', variantB: 'Problem', winner: null },
    { name: 'Short vs Long Body', status: 'complete', progress: 100, variantA: '<100 words', variantB: '150+ words', winner: 'A', lift: '+62%' },
    { name: 'Soft CTA vs Calendly', status: 'complete', progress: 100, variantA: 'Soft Interest', variantB: 'Calendly Link', winner: 'A', lift: '+89%' },
  ];

  const completedTests = mockTests.filter(t => t.status === 'complete');
  const runningTests = mockTests.filter(t => t.status === 'running');
  const avgLift = completedTests.length > 0 
    ? completedTests.reduce((sum, t) => sum + (parseFloat(t.lift?.replace(/[+%]/g, '') || '0')), 0) / completedTests.length
    : 0;

  const executiveInsights = [
    {
      type: runningTests.length > 0 ? 'neutral' as const : 'warning' as const,
      title: runningTests.length > 0 ? `${runningTests.length} test${runningTests.length > 1 ? 's' : ''} in progress` : 'No tests running',
      description: runningTests.length > 0
        ? `You have ${runningTests.length} active A/B test${runningTests.length > 1 ? 's' : ''} gathering data. Results should be ready when they reach statistical significance.`
        : 'You should always have at least one test running. Testing is how you find what works for YOUR audience.',
      impact: runningTests.length > 0 ? 'Keep going' : 'Start testing',
    },
    {
      type: avgLift > 0 ? 'positive' as const : 'neutral' as const,
      title: completedTests.length > 0 ? `Past tests averaged +${avgLift.toFixed(0)}% improvement` : 'No completed tests yet',
      description: completedTests.length > 0
        ? `Your completed tests have identified wins averaging +${avgLift.toFixed(0)}% lift. Each insight compounds—small wins add up.`
        : 'Once you complete some tests, you\'ll see the cumulative impact here.',
      impact: avgLift > 0 ? `+${avgLift.toFixed(0)}% avg lift` : undefined,
    },
    {
      type: 'positive' as const,
      title: 'Short emails and soft CTAs keep winning',
      description: 'Across your tests, the pattern is clear: shorter emails with low-friction CTAs outperform longer, pushy alternatives.',
    },
  ];

  const bottomLine = runningTests.length > 0
    ? 'Keep your tests running until they hit statistical significance. Don\'t stop early!'
    : 'Start a new test today. Try testing Timeline vs Problem hooks—that\'s a high-impact experiment.';

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <ExecutiveSummary
        title="A/B Testing: What You've Learned"
        subtitle="Controlled experiments reveal what actually works for your audience"
        insights={executiveInsights}
        bottomLine={bottomLine}
      />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">A/B Test Tracker</h3>
          <p className="text-sm text-muted-foreground">Monitor your active experiments</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-2" /> New Test</Button>
      </div>

      <div className="grid gap-4">
        {mockTests.map((test, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  {test.name}
                </CardTitle>
                <Badge variant={test.status === 'running' ? 'default' : 'secondary'}>
                  {test.status === 'running' ? 'Running' : 'Complete'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Variant A: {test.variantA}</span>
                    <span>Variant B: {test.variantB}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${test.progress}%` }} />
                  </div>
                </div>
                {test.winner && (
                  <div className="text-right">
                    <div className="text-sm font-medium text-success">Winner: {test.winner}</div>
                    <div className="text-xs text-success">{test.lift}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
