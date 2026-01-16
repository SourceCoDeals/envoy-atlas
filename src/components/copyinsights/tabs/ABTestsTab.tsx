import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FlaskConical, Plus } from 'lucide-react';

interface ABTestsTabProps {}

export function ABTestsTab({}: ABTestsTabProps) {
  const mockTests = [
    { name: 'Timeline vs Problem Hook', status: 'running', progress: 67, variantA: 'Timeline', variantB: 'Problem', winner: null },
    { name: 'Short vs Long Body', status: 'complete', progress: 100, variantA: '<100 words', variantB: '150+ words', winner: 'A', lift: '+62%' },
    { name: 'Soft CTA vs Calendly', status: 'complete', progress: 100, variantA: 'Soft Interest', variantB: 'Calendly Link', winner: 'A', lift: '+89%' },
  ];

  return (
    <div className="space-y-6">
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
