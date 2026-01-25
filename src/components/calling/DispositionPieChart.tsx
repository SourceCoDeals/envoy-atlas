import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

/**
 * Disposition categories aligned with cold_calls.normalized_category values
 * Reference: src/lib/constants/dispositions.ts
 */
const DISPOSITION_CATEGORIES = {
  // POSITIVE OUTCOMES - Decision maker conversations with interest
  meeting_booked: {
    label: 'Meeting Booked',
    color: 'hsl(var(--chart-1))',
    category: 'positive',
    dispositions: ['meeting booked', 'meeting_booked', 'positive - blacklist co'],
  },
  callback: {
    label: 'Callback Requested',
    color: 'hsl(var(--chart-2))',
    category: 'positive',
    dispositions: ['callback requested', 'callback', 'interested'],
  },
  send_email: {
    label: 'Send Email',
    color: 'hsl(var(--chart-3))',
    category: 'positive',
    dispositions: ['send email', 'send_email', 'connection'],
  },
  
  // TARGETING/GATEKEEPER - Not reaching decision makers
  gatekeeper: {
    label: 'Gatekeeper',
    color: 'hsl(var(--chart-4))',
    category: 'targeting',
    dispositions: ['receptionist', 'gatekeeper', 'gk'],
  },
  not_qualified: {
    label: 'Not Qualified',
    color: 'hsl(var(--chart-5))',
    category: 'targeting',
    dispositions: ['not qualified', 'not_qualified', 'negative - blacklist co', 'negative - blacklist contact'],
  },
  
  // NO CONTACT - Didn't reach anyone
  voicemail: {
    label: 'Voicemail',
    color: 'hsl(var(--muted-foreground))',
    category: 'no_contact',
    dispositions: ['voicemail', 'voicemail drop', 'live voicemail', 'vm'],
  },
  no_answer: {
    label: 'No Answer',
    color: 'hsl(var(--muted))',
    category: 'no_contact',
    dispositions: ['no answer', 'no_answer', 'busy'],
  },
  
  // BAD DATA - Data quality issues
  bad_data: {
    label: 'Bad Data',
    color: 'hsl(var(--destructive))',
    category: 'bad_data',
    dispositions: ['bad phone', 'wrong number', 'disconnected', 'bad_phone', 'wrong_number', 'do not call'],
  },
  
  // REJECTION - Message/rep issues
  hung_up: {
    label: 'Hung Up',
    color: 'hsl(var(--destructive)/0.7)',
    category: 'rejection',
    dispositions: ['hung up', 'hung_up', 'not interested', 'not_interested'],
  },
};

function classifyDisposition(normalized_category: string | null): string {
  if (!normalized_category) return 'unknown';
  const lower = normalized_category.toLowerCase().trim();
  
  for (const [key, cat] of Object.entries(DISPOSITION_CATEGORIES)) {
    if (cat.dispositions.some(d => lower === d || lower.startsWith(d))) {
      return key;
    }
  }
  
  // Fuzzy matching for edge cases
  if (lower.includes('voicemail') || lower.includes('vm')) return 'voicemail';
  if (lower.includes('no answer')) return 'no_answer';
  if (lower.includes('positive')) return 'meeting_booked';
  if (lower.includes('negative')) return 'not_qualified';
  if (lower.includes('callback')) return 'callback';
  if (lower.includes('meeting') || lower.includes('booked')) return 'meeting_booked';
  if (lower.includes('gatekeeper') || lower.includes('receptionist')) return 'gatekeeper';
  if (lower.includes('bad') || lower.includes('wrong') || lower.includes('disconnect')) return 'bad_data';
  
  return 'other';
}

interface DispositionPieChartProps {
  calls: Array<{ 
    normalized_category?: string | null;
    category?: string | null;
    is_connection?: boolean;
    is_meeting?: boolean;
    is_voicemail?: boolean;
    is_bad_data?: boolean;
  }>;
}

export function DispositionPieChart({ calls }: DispositionPieChartProps) {
  const { pieData, breakdown, summary } = useMemo(() => {
    const counts: Record<string, number> = {};
    
    calls.forEach(call => {
      // Use normalized_category if available, otherwise fall back to category
      const disposition = call.normalized_category || call.category;
      const category = classifyDisposition(disposition);
      counts[category] = (counts[category] || 0) + 1;
    });

    const total = calls.length;
    
    // Build pie data for visible slices only (exclude voicemail/no_answer for clarity)
    const connectionDispositions = ['meeting_booked', 'callback', 'send_email', 'gatekeeper', 'not_qualified', 'hung_up', 'bad_data'];
    const pieData = connectionDispositions
      .map(key => {
        const cat = DISPOSITION_CATEGORIES[key as keyof typeof DISPOSITION_CATEGORIES];
        if (!cat) return null;
        return {
          name: cat.label,
          value: counts[key] || 0,
          color: cat.color,
          category: cat.category,
          percentage: total > 0 ? ((counts[key] || 0) / total) * 100 : 0,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null && d.value > 0);

    // Calculate category totals
    const positiveTotal = (counts.meeting_booked || 0) + (counts.callback || 0) + (counts.send_email || 0);
    const targetingTotal = (counts.gatekeeper || 0) + (counts.not_qualified || 0);
    const noContactTotal = (counts.voicemail || 0) + (counts.no_answer || 0);
    const badDataTotal = counts.bad_data || 0;
    const rejectionTotal = counts.hung_up || 0;
    const connectionsTotal = calls.filter(c => c.is_connection).length;

    const breakdown = {
      positive: {
        total: positiveTotal,
        percentage: total > 0 ? (positiveTotal / total) * 100 : 0,
        items: [
          { label: 'Meeting Booked', count: counts.meeting_booked || 0, pct: total > 0 ? ((counts.meeting_booked || 0) / total) * 100 : 0 },
          { label: 'Callback Requested', count: counts.callback || 0, pct: total > 0 ? ((counts.callback || 0) / total) * 100 : 0 },
          { label: 'Send Email', count: counts.send_email || 0, pct: total > 0 ? ((counts.send_email || 0) / total) * 100 : 0 },
        ],
      },
      targeting: {
        total: targetingTotal,
        percentage: total > 0 ? (targetingTotal / total) * 100 : 0,
        items: [
          { label: 'Gatekeeper', count: counts.gatekeeper || 0, pct: total > 0 ? ((counts.gatekeeper || 0) / total) * 100 : 0 },
          { label: 'Not Qualified', count: counts.not_qualified || 0, pct: total > 0 ? ((counts.not_qualified || 0) / total) * 100 : 0 },
        ],
      },
      no_contact: {
        total: noContactTotal,
        percentage: total > 0 ? (noContactTotal / total) * 100 : 0,
        items: [
          { label: 'Voicemail', count: counts.voicemail || 0, pct: total > 0 ? ((counts.voicemail || 0) / total) * 100 : 0 },
          { label: 'No Answer', count: counts.no_answer || 0, pct: total > 0 ? ((counts.no_answer || 0) / total) * 100 : 0 },
        ],
      },
      issues: {
        total: badDataTotal + rejectionTotal,
        percentage: total > 0 ? ((badDataTotal + rejectionTotal) / total) * 100 : 0,
        items: [
          { label: 'Bad Data', count: badDataTotal, pct: total > 0 ? (badDataTotal / total) * 100 : 0 },
          { label: 'Hung Up / Rejected', count: rejectionTotal, pct: total > 0 ? (rejectionTotal / total) * 100 : 0 },
        ],
      },
    };

    // Generate insight summary
    const connectRate = total > 0 ? (connectionsTotal / total) * 100 : 0;
    const summary = connectRate >= 15
      ? `${connectRate.toFixed(0)}% connect rate. Strong performance!`
      : breakdown.no_contact.percentage > 70
        ? `${breakdown.no_contact.percentage.toFixed(0)}% no contact. Consider timing adjustments.`
        : breakdown.targeting.percentage > 20
          ? `${breakdown.targeting.percentage.toFixed(0)}% gatekeeper calls. Work on bypass strategies.`
          : breakdown.issues.percentage > 10
            ? `${breakdown.issues.percentage.toFixed(0)}% bad data/rejection. Review lead quality.`
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
                    label={({ name, percentage }) => percentage > 3 ? `${name} ${percentage.toFixed(0)}%` : ''}
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
          <div className="space-y-3 text-sm">
            {/* Positive Outcomes */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-green-600 dark:text-green-400">POSITIVE OUTCOMES</span>
                <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-600/30">
                  {breakdown.positive.percentage.toFixed(0)}%
                </Badge>
              </div>
              <div className="space-y-0.5 pl-3 text-xs">
                {breakdown.positive.items.map(item => (
                  <div key={item.label} className="flex justify-between text-muted-foreground">
                    <span>├── {item.label}</span>
                    <span>{item.count.toLocaleString()} ({item.pct.toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Targeting/Gatekeeper */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-amber-600 dark:text-amber-400">TARGETING ISSUES</span>
                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-600/30">
                  {breakdown.targeting.percentage.toFixed(0)}%
                </Badge>
              </div>
              <div className="space-y-0.5 pl-3 text-xs">
                {breakdown.targeting.items.map(item => (
                  <div key={item.label} className="flex justify-between text-muted-foreground">
                    <span>├── {item.label}</span>
                    <span>{item.count.toLocaleString()} ({item.pct.toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* No Contact */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-muted-foreground">NO CONTACT</span>
                <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
                  {breakdown.no_contact.percentage.toFixed(0)}%
                </Badge>
              </div>
              <div className="space-y-0.5 pl-3 text-xs">
                {breakdown.no_contact.items.map(item => (
                  <div key={item.label} className="flex justify-between text-muted-foreground">
                    <span>├── {item.label}</span>
                    <span>{item.count.toLocaleString()} ({item.pct.toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Issues */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-red-600 dark:text-red-400">DATA/REP ISSUES</span>
                <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-600/30">
                  {breakdown.issues.percentage.toFixed(0)}%
                </Badge>
              </div>
              <div className="space-y-0.5 pl-3 text-xs">
                {breakdown.issues.items.map((item, i) => (
                  <div key={item.label} className="flex justify-between text-muted-foreground">
                    <span>{i === breakdown.issues.items.length - 1 ? '└──' : '├──'} {item.label}</span>
                    <span>{item.count.toLocaleString()} ({item.pct.toFixed(1)}%)</span>
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
