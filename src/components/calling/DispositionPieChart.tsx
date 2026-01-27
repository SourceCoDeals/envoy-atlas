import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

/**
 * Simplified 4-category disposition grouping
 * Aligned with cold_calls.normalized_category values
 */
const SIMPLIFIED_CATEGORIES = {
  positive: {
    label: 'Positive Outcomes',
    color: 'hsl(142, 76%, 36%)', // Green
    dispositions: [
      'meeting booked', 'meeting_booked', 
      'callback requested', 'callback', 
      'positive - blacklist co', 'interested',
      'send email', 'send_email', 'connection'
    ],
  },
  contact_made: {
    label: 'Contact Made',
    color: 'hsl(217, 91%, 60%)', // Blue
    dispositions: [
      'receptionist', 'gatekeeper', 'gk',
      'not qualified', 'not_qualified',
      'negative - blacklist co', 'negative - blacklist contact',
      'hung up', 'hung_up', 'not interested', 'not_interested'
    ],
  },
  no_contact: {
    label: 'No Contact',
    color: 'hsl(215, 16%, 47%)', // Gray
    dispositions: [
      'voicemail', 'voicemail drop', 'live voicemail', 'vm',
      'no answer', 'no_answer', 'busy'
    ],
  },
  data_issues: {
    label: 'Data Issues',
    color: 'hsl(0, 84%, 60%)', // Red
    dispositions: [
      'bad phone', 'wrong number', 'disconnected', 
      'bad_phone', 'wrong_number', 'do not call'
    ],
  },
};

function classifyToSimplified(normalized_category: string | null): keyof typeof SIMPLIFIED_CATEGORIES | 'unknown' {
  if (!normalized_category) return 'unknown';
  const lower = normalized_category.toLowerCase().trim();
  
  for (const [key, cat] of Object.entries(SIMPLIFIED_CATEGORIES)) {
    if (cat.dispositions.some(d => lower === d || lower.startsWith(d))) {
      return key as keyof typeof SIMPLIFIED_CATEGORIES;
    }
  }
  
  // Fuzzy matching for edge cases
  if (lower.includes('voicemail') || lower.includes('vm') || lower.includes('no answer')) return 'no_contact';
  if (lower.includes('positive') || lower.includes('meeting') || lower.includes('callback') || lower.includes('interested')) return 'positive';
  if (lower.includes('negative') || lower.includes('gatekeeper') || lower.includes('receptionist') || lower.includes('hung')) return 'contact_made';
  if (lower.includes('bad') || lower.includes('wrong') || lower.includes('disconnect') || lower.includes('do not call')) return 'data_issues';
  
  return 'unknown';
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
    const counts: Record<string, number> = {
      positive: 0,
      contact_made: 0,
      no_contact: 0,
      data_issues: 0,
      unknown: 0,
    };
    
    // Also track detailed dispositions for breakdown
    const detailedCounts: Record<string, number> = {};
    
    calls.forEach(call => {
      const disposition = call.normalized_category || call.category;
      const category = classifyToSimplified(disposition);
      counts[category] = (counts[category] || 0) + 1;
      
      // Track detailed for breakdown
      const displayName = disposition?.toLowerCase().trim() || 'unknown';
      detailedCounts[displayName] = (detailedCounts[displayName] || 0) + 1;
    });

    const total = calls.length;
    
    // Build simplified 4-slice pie data
    const pieData = Object.entries(SIMPLIFIED_CATEGORIES).map(([key, cat]) => ({
      name: cat.label,
      value: counts[key] || 0,
      color: cat.color,
      key,
      percentage: total > 0 ? ((counts[key] || 0) / total) * 100 : 0,
    })).filter(d => d.value > 0);

    // Build breakdown with top dispositions per category
    const getTopDispositions = (categoryKey: string, limit = 3) => {
      const categoryDisps = SIMPLIFIED_CATEGORIES[categoryKey as keyof typeof SIMPLIFIED_CATEGORIES]?.dispositions || [];
      const items: { label: string; count: number }[] = [];
      
      Object.entries(detailedCounts).forEach(([disp, count]) => {
        if (categoryDisps.some(d => disp === d || disp.startsWith(d))) {
          items.push({ label: disp, count });
        }
      });
      
      return items.sort((a, b) => b.count - a.count).slice(0, limit);
    };

    const breakdown = {
      positive: {
        total: counts.positive,
        percentage: total > 0 ? (counts.positive / total) * 100 : 0,
        items: getTopDispositions('positive'),
      },
      contact_made: {
        total: counts.contact_made,
        percentage: total > 0 ? (counts.contact_made / total) * 100 : 0,
        items: getTopDispositions('contact_made'),
      },
      no_contact: {
        total: counts.no_contact,
        percentage: total > 0 ? (counts.no_contact / total) * 100 : 0,
        items: getTopDispositions('no_contact'),
      },
      data_issues: {
        total: counts.data_issues,
        percentage: total > 0 ? (counts.data_issues / total) * 100 : 0,
        items: getTopDispositions('data_issues'),
      },
    };

    // Generate insight
    const connectionsTotal = calls.filter(c => c.is_connection).length;
    const connectRate = total > 0 ? (connectionsTotal / total) * 100 : 0;
    
    let summary = '';
    if (breakdown.positive.percentage >= 5) {
      summary = `🎯 ${breakdown.positive.percentage.toFixed(1)}% positive outcomes. Strong performance!`;
    } else if (breakdown.no_contact.percentage > 65) {
      summary = `📞 ${breakdown.no_contact.percentage.toFixed(0)}% no contact. Try different call times.`;
    } else if (breakdown.data_issues.percentage > 10) {
      summary = `⚠️ ${breakdown.data_issues.percentage.toFixed(0)}% data issues. Review lead quality.`;
    } else if (connectRate >= 20) {
      summary = `✓ ${connectRate.toFixed(0)}% connect rate. Focus on converting to outcomes.`;
    } else {
      summary = `Mixed results. ${breakdown.positive.total} positive outcomes from ${total} calls.`;
    }

    return { pieData, breakdown, summary };
  }, [calls]);

  if (calls.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Disposition Breakdown</CardTitle>
          <CardDescription>How are calls ending?</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No call data available</p>
        </CardContent>
      </Card>
    );
  }

  const categoryConfig = [
    { key: 'positive', ...SIMPLIFIED_CATEGORIES.positive, data: breakdown.positive },
    { key: 'contact_made', ...SIMPLIFIED_CATEGORIES.contact_made, data: breakdown.contact_made },
    { key: 'no_contact', ...SIMPLIFIED_CATEGORIES.no_contact, data: breakdown.no_contact },
    { key: 'data_issues', ...SIMPLIFIED_CATEGORIES.data_issues, data: breakdown.data_issues },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Disposition Breakdown</CardTitle>
        <CardDescription>Simplified view of call outcomes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Simplified 4-slice Donut Chart */}
          <div className="flex items-center justify-center">
            <div className="h-48 w-full max-w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString()} (${((value / calls.length) * 100).toFixed(1)}%)`, 
                      name
                    ]}
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

          {/* Category Breakdown */}
          <div className="space-y-3">
            {categoryConfig.map(({ key, label, color, data }) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className="text-xs"
                    style={{ borderColor: color, color }}
                  >
                    {data.total.toLocaleString()} ({data.percentage.toFixed(1)}%)
                  </Badge>
                </div>
                {data.items.length > 0 && (
                  <div className="pl-5 text-xs text-muted-foreground space-y-0.5">
                    {data.items.slice(0, 2).map((item, i) => (
                      <div key={item.label} className="flex justify-between">
                        <span className="capitalize">{item.label}</span>
                        <span>{item.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Summary Insight */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm">{summary}</p>
        </div>
      </CardContent>
    </Card>
  );
}
