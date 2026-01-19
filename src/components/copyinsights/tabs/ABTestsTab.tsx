import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FlaskConical, Plus, AlertCircle } from 'lucide-react';
import { ExecutiveSummary } from '../ExecutiveSummary';

interface ExperimentData {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'complete' | 'paused';
  progress: number;
  variants: {
    name: string;
    replyRate: number;
    sent: number;
  }[];
  winner?: string;
  lift?: number;
}

interface ABTestsTabProps {
  experiments?: ExperimentData[];
}

export function ABTestsTab({ experiments = [] }: ABTestsTabProps) {
  const completedTests = experiments.filter(t => t.status === 'complete');
  const runningTests = experiments.filter(t => t.status === 'running');
  
  const avgLift = useMemo(() => {
    if (completedTests.length === 0) return 0;
    const lifts = completedTests.filter(t => t.lift !== undefined).map(t => t.lift!);
    return lifts.length > 0 ? lifts.reduce((sum, l) => sum + l, 0) / lifts.length : 0;
  }, [completedTests]);

  const hasData = experiments.length > 0;

  const executiveInsights = useMemo(() => {
    if (!hasData) {
      return [{
        type: 'neutral' as const,
        title: 'No experiments tracked yet',
        description: 'A/B tests help you discover what works for YOUR audience. Set up experiments to start learning.',
      }];
    }
    
    const insights = [];
    
    if (runningTests.length > 0) {
      insights.push({
        type: 'neutral' as const,
        title: `${runningTests.length} test${runningTests.length > 1 ? 's' : ''} in progress`,
        description: `You have ${runningTests.length} active A/B test${runningTests.length > 1 ? 's' : ''} gathering data. Results should be ready when they reach statistical significance.`,
        impact: 'Keep going',
      });
    } else {
      insights.push({
        type: 'warning' as const,
        title: 'No tests running',
        description: 'You should always have at least one test running. Testing is how you find what works for YOUR audience.',
        impact: 'Start testing',
      });
    }
    
    if (completedTests.length > 0 && avgLift > 0) {
      insights.push({
        type: 'positive' as const,
        title: `Past tests averaged +${avgLift.toFixed(0)}% improvement`,
        description: `Your completed tests have identified wins averaging +${avgLift.toFixed(0)}% lift. Each insight compounds—small wins add up.`,
        impact: `+${avgLift.toFixed(0)}% avg lift`,
      });
    }
    
    return insights;
  }, [hasData, runningTests, completedTests, avgLift]);

  const bottomLine = runningTests.length > 0
    ? 'Keep your tests running until they hit statistical significance. Don\'t stop early!'
    : 'Start a new test today to discover what works for your audience.';

  if (!hasData) {
    return (
      <div className="space-y-6">
        <ExecutiveSummary
          title="A/B Testing"
          subtitle="Controlled experiments reveal what actually works for your audience"
          insights={executiveInsights}
          bottomLine={bottomLine}
        />

        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="text-center text-muted-foreground">
              <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Experiments Yet</p>
              <p className="text-sm mb-4">
                Start running A/B tests to discover what copy performs best for your audience.
                Visit the Experiments page to create your first test.
              </p>
              <Button asChild>
                <a href="/experiments">
                  <Plus className="h-4 w-4 mr-2" /> Go to Experiments
                </a>
              </Button>
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
        title="A/B Testing: What You've Learned"
        subtitle="Controlled experiments reveal what actually works for your audience"
        insights={executiveInsights}
        bottomLine={bottomLine}
      />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">A/B Test Tracker</h3>
          <p className="text-sm text-muted-foreground">
            {experiments.length} experiment{experiments.length !== 1 ? 's' : ''} • 
            {runningTests.length} running • {completedTests.length} complete
          </p>
        </div>
        <Button asChild>
          <a href="/experiments">
            <Plus className="h-4 w-4 mr-2" /> View All Experiments
          </a>
        </Button>
      </div>

      <div className="grid gap-4">
        {experiments.slice(0, 5).map((test) => (
          <Card key={test.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  {test.name}
                </CardTitle>
                <Badge variant={test.status === 'running' ? 'default' : test.status === 'complete' ? 'secondary' : 'outline'}>
                  {test.status === 'running' ? 'Running' : test.status === 'complete' ? 'Complete' : test.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    {test.variants.slice(0, 2).map((v, i) => (
                      <span key={i}>
                        Variant {String.fromCharCode(65 + i)}: {v.name}
                        {v.sent > 0 && ` (${v.replyRate.toFixed(1)}%)`}
                      </span>
                    ))}
                  </div>
                  <div className="h-2 bg-muted rounded-full">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${test.progress}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {test.variants.reduce((sum, v) => sum + v.sent, 0).toLocaleString()} total sends
                  </div>
                </div>
                {test.winner && test.lift !== undefined && (
                  <div className="text-right">
                    <div className="text-sm font-medium text-success">Winner: {test.winner}</div>
                    <div className="text-xs text-success">+{test.lift.toFixed(0)}%</div>
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
