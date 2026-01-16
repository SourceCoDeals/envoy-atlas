import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface SequencesTabProps {
  // Add proper types when connecting to real data
}

export function SequencesTab({}: SequencesTabProps) {
  const replyDistribution = [
    { step: 'Step 1 - Initial', pct: 58, rate: 4.2 },
    { step: 'Step 2 - Follow-up #1', pct: 22, rate: 3.8 },
    { step: 'Step 3 - Follow-up #2', pct: 12, rate: 2.9 },
    { step: 'Step 4 - Follow-up #3', pct: 5, rate: 1.8 },
    { step: 'Step 5+', pct: 3, rate: 1.2 },
  ];

  const followUpStyles = [
    { type: 'Reply-Style', example: '"Quick follow-up on my note below—worth a look?"', rate: 5.2, lift: '+30%', status: 'best' },
    { type: 'New Angle', example: '"Another thought—we also help with X..."', rate: 4.4, lift: '+10%', status: 'good' },
    { type: 'Social Proof', example: '"Wanted to share how we helped [company]..."', rate: 4.2, lift: '+5%', status: 'good' },
    { type: 'Bump/Reminder', example: '"Just checking if you saw my email..."', rate: 3.2, lift: '-20%', status: 'bad' },
  ];

  return (
    <div className="space-y-6">
      {/* Sequence Overview */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Active Sequences</div><div className="text-2xl font-bold">698</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Avg Length</div><div className="text-2xl font-bold">4.2 emails</div><div className="text-xs text-success">✓ Good (Target: 4-7)</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Avg Duration</div><div className="text-2xl font-bold">16 days</div><div className="text-xs text-success">✓ Good</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Step 1 Reply Share</div><div className="text-2xl font-bold">58%</div></CardContent></Card>
      </div>

      {/* Reply Distribution */}
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
                <span className="absolute right-2 top-0.5 text-xs">{step.pct}%</span>
              </div>
              <div className="w-12 text-sm text-muted-foreground">{step.rate}%</div>
            </div>
          ))}
          <div className="mt-4 p-3 bg-primary/10 rounded-lg text-sm">
            📊 92% of replies come by Step 3. Steps 4+ contribute only 8% but may increase unsubscribe risk.
          </div>
        </CardContent>
      </Card>

      {/* Follow-Up Style */}
      <Card>
        <CardHeader>
          <CardTitle>Follow-Up Style Performance</CardTitle>
          <CardDescription>How you write follow-ups matters as much as when you send them</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {followUpStyles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50">
              <div className={`w-3 h-3 rounded-full ${f.status === 'best' ? 'bg-success' : f.status === 'good' ? 'bg-success/70' : 'bg-destructive'}`} />
              <div className="w-24 text-sm font-medium">{f.type}</div>
              <div className="flex-1 text-xs text-muted-foreground truncate">{f.example}</div>
              <div className="w-12 text-sm font-medium">{f.rate}%</div>
              <div className={`w-12 text-xs ${f.lift.startsWith('+') ? 'text-success' : 'text-destructive'}`}>{f.lift}</div>
            </div>
          ))}
          <div className="mt-3 p-3 bg-yellow-500/10 rounded-lg text-sm text-yellow-600">
            ⚠️ 58% of follow-ups are "Bump/Reminder" style (-20%). Switch to Reply-Style for +30%.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
