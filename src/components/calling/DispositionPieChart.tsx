import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// Disposition mapping per spec
const DISPOSITION_CATEGORIES = {
  meeting_set: {
    label: 'Meeting Set',
    color: 'hsl(var(--chart-1))',
    category: 'positive',
    dispositions: ['meeting_booked', 'appointment_set', 'scheduled', 'demo_scheduled', 'meeting_set'],
  },
  activation: {
    label: 'Activation',
    color: 'hsl(var(--chart-2))',
    category: 'positive',
    dispositions: ['interested', 'qualified', 'send_info', 'callback_requested', 'warm_lead'],
  },
  not_now: {
    label: 'Not Now',
    color: 'hsl(var(--chart-3))',
    category: 'positive',
    dispositions: ['not_now', 'bad_timing', 'call_back_later', 'nurture', 'future_opportunity'],
  },
  not_me: {
    label: 'Not Me',
    color: 'hsl(var(--chart-4))',
    category: 'targeting',
    dispositions: ['wrong_person', 'not_decision_maker', 'gatekeeper', 'wrong_contact'],
  },
  referred: {
    label: 'Referred',
    color: 'hsl(var(--chart-5))',
    category: 'targeting',
    dispositions: ['referred', 'referral', 'transferred', 'gave_contact'],
  },
  not_interested: {
    label: 'Not Interested',
    color: 'hsl(var(--destructive))',
    category: 'message',
    dispositions: ['not_interested', 'no_need', 'rejected', 'declined', 'hung_up'],
  },
};

function classifyDisposition(disposition: string | null): string {
  if (!disposition) return 'unknown';
  const lowerDisp = disposition.toLowerCase().replace(/[_-]/g, '_');
  
  for (const [key, cat] of Object.entries(DISPOSITION_CATEGORIES)) {
    if (cat.dispositions.some(d => lowerDisp.includes(d.replace(/[_-]/g, '_')))) {
      return key;
    }
  }
  return 'other';
}

interface DispositionPieChartProps {
  calls: Array<{ disposition: string | null }>;
}

export function DispositionPieChart({ calls }: DispositionPieChartProps) {
  const { pieData, breakdown, summary } = useMemo(() => {
    const counts: Record<string, number> = {};
    
    calls.forEach(call => {
      const category = classifyDisposition(call.disposition);
      counts[category] = (counts[category] || 0) + 1;
    });

    const total = calls.length;
    const pieData = Object.entries(DISPOSITION_CATEGORIES)
      .map(([key, cat]) => ({
        name: cat.label,
        value: counts[key] || 0,
        color: cat.color,
        category: cat.category,
        percentage: total > 0 ? ((counts[key] || 0) / total) * 100 : 0,
      }))
      .filter(d => d.value > 0);

    // Calculate category totals
    const positiveTotal = (counts.meeting_set || 0) + (counts.activation || 0) + (counts.not_now || 0);
    const targetingTotal = (counts.not_me || 0) + (counts.referred || 0);
    const messageTotal = counts.not_interested || 0;

    const breakdown = {
      positive: {
        total: positiveTotal,
        percentage: total > 0 ? (positiveTotal / total) * 100 : 0,
        items: [
          { label: 'Meeting Set', count: counts.meeting_set || 0, pct: total > 0 ? ((counts.meeting_set || 0) / total) * 100 : 0 },
          { label: 'Activation', count: counts.activation || 0, pct: total > 0 ? ((counts.activation || 0) / total) * 100 : 0 },
          { label: 'Not Now', count: counts.not_now || 0, pct: total > 0 ? ((counts.not_now || 0) / total) * 100 : 0 },
        ],
      },
      targeting: {
        total: targetingTotal,
        percentage: total > 0 ? (targetingTotal / total) * 100 : 0,
        items: [
          { label: 'Not Me', count: counts.not_me || 0, pct: total > 0 ? ((counts.not_me || 0) / total) * 100 : 0 },
          { label: 'Referred', count: counts.referred || 0, pct: total > 0 ? ((counts.referred || 0) / total) * 100 : 0 },
        ],
      },
      message: {
        total: messageTotal,
        percentage: total > 0 ? (messageTotal / total) * 100 : 0,
        items: [
          { label: 'Not Interested', count: counts.not_interested || 0, pct: total > 0 ? ((counts.not_interested || 0) / total) * 100 : 0 },
        ],
      },
    };

    const summary = breakdown.positive.percentage >= 50
      ? `${breakdown.positive.percentage.toFixed(0)}% positive outcomes. Great performance!`
      : breakdown.message.percentage > 30
        ? `${breakdown.message.percentage.toFixed(0)}% rejection rate. Consider messaging improvements.`
        : breakdown.targeting.percentage > 25
          ? `${breakdown.targeting.percentage.toFixed(0)}% targeting issues. Review lead quality.`
          : `Mixed results. Focus on improving positive outcomes.`;

    return { pieData, breakdown, summary };
  }, [calls]);

  if (calls.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Disposition Breakdown</CardTitle>
          <CardDescription>How are completed calls ending?</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No call data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          🥧 Disposition Breakdown
        </CardTitle>
        <CardDescription>How are completed calls ending? This tells you where to focus.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie Chart - Left side */}
          <div className="flex items-center justify-center">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percentage }) => `${name} ${percentage.toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} (${((value / calls.length) * 100).toFixed(1)}%)`, name]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Breakdown Table - Right side */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-green-600 dark:text-green-400">POSITIVE OUTCOMES</span>
                <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-600/30">{breakdown.positive.percentage.toFixed(0)}%</Badge>
              </div>
              <div className="space-y-0.5 pl-3 text-xs">
                {breakdown.positive.items.map(item => (
                  <div key={item.label} className="flex justify-between text-muted-foreground">
                    <span>├── {item.label}</span>
                    <span>{item.count} ({item.pct.toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-amber-600 dark:text-amber-400">TARGETING ISSUES</span>
                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-600/30">{breakdown.targeting.percentage.toFixed(0)}%</Badge>
              </div>
              <div className="space-y-0.5 pl-3 text-xs">
                {breakdown.targeting.items.map(item => (
                  <div key={item.label} className="flex justify-between text-muted-foreground">
                    <span>├── {item.label}</span>
                    <span>{item.count} ({item.pct.toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-red-600 dark:text-red-400">MESSAGE/REP ISSUES</span>
                <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-600/30">{breakdown.message.percentage.toFixed(0)}%</Badge>
              </div>
              <div className="space-y-0.5 pl-3 text-xs">
                {breakdown.message.items.map(item => (
                  <div key={item.label} className="flex justify-between text-muted-foreground">
                    <span>└── {item.label}</span>
                    <span>{item.count} ({item.pct.toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-3 p-2 bg-muted/50 rounded-lg">
          <p className="text-xs">💡 {summary}</p>
        </div>
      </CardContent>
    </Card>
  );
}
