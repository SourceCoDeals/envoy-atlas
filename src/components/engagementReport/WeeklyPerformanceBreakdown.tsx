import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { WeeklyEnrollmentTrend } from '@/hooks/useEngagementReport';

export interface WeeklyPerformance {
  weekLabel: string;
  weekStart: string;
  sent: number;
  replied: number;
  positiveReplies: number;
  bounced: number;
}

interface WeeklyPerformanceBreakdownProps {
  weeklyData: WeeklyPerformance[];
  enrollmentTrend?: WeeklyEnrollmentTrend[];
  isEstimated?: boolean;
}

interface ChartDataPoint {
  weekLabel: string;
  weekStart: string;
  sent: number;
  enrolled: number;
  replied: number;
  positive: number;
}

export function WeeklyPerformanceBreakdown({ weeklyData, enrollmentTrend, isEstimated }: WeeklyPerformanceBreakdownProps) {
  // Merge performance and enrollment data by week
  const chartData: ChartDataPoint[] = weeklyData.map(week => {
    const enrollmentWeek = enrollmentTrend?.find(e => e.weekStart === week.weekStart);
    return {
      weekLabel: week.weekLabel.replace('Week of ', ''),
      weekStart: week.weekStart,
      sent: week.sent,
      enrolled: enrollmentWeek?.newLeadsEnrolled || 0,
      replied: week.replied,
      positive: week.positiveReplies,
    };
  });

  // Sort by date
  chartData.sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // Calculate totals for the summary
  const totals = chartData.reduce(
    (acc, week) => ({
      sent: acc.sent + week.sent,
      enrolled: acc.enrolled + week.enrolled,
      replied: acc.replied + week.replied,
      positive: acc.positive + week.positive,
    }),
    { sent: 0, enrolled: 0, replied: 0, positive: 0 }
  );

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Week-by-Week Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No weekly data available yet. Data will appear once syncs complete.
          </div>
        </CardContent>
      </Card>
    );
  }

  // If only 1 week of data, show summary view instead of a mostly empty chart
  if (chartData.length === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Week-by-Week Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-muted/30 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Sent</p>
              <p className="text-lg font-bold">{totals.sent.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Enrolled</p>
              <p className="text-lg font-bold">{totals.enrolled.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Replies</p>
              <p className="text-lg font-bold">{totals.replied.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Positive</p>
              <p className="text-lg font-bold text-success">{totals.positive.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4 p-3 rounded border border-warning/30 bg-warning/10 text-sm text-warning-foreground">
            Weekly trend chart requires at least 2 weeks of historical data. Currently showing cumulative totals from campaign metrics.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Week-by-Week Performance
          {isEstimated && (
            <span className="text-xs font-normal text-warning bg-warning/10 px-2 py-0.5 rounded">
              Estimated
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEstimated && (
          <Alert variant="default" className="mb-4 border-warning/30 bg-warning/10">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Weekly distribution is estimated from campaign totals. Actual day-by-day data was not available.
            </AlertDescription>
          </Alert>
        )}
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis 
              dataKey="weekLabel" 
              tick={{ fontSize: 11 }} 
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12 }} 
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number, name: string) => [value.toLocaleString(), name]}
            />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="sent" 
              name="Emails Sent"
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="enrolled" 
              name="New Enrolled"
              stroke="hsl(var(--chart-2))" 
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="replied" 
              name="Replies"
              stroke="hsl(var(--chart-3))" 
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="positive" 
              name="Positive Replies"
              stroke="hsl(var(--success))" 
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Summary Row */}
        <div className="mt-4 p-4 rounded-lg bg-muted/30 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Sent</p>
            <p className="text-lg font-bold">{totals.sent.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Enrolled</p>
            <p className="text-lg font-bold">{totals.enrolled.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Replies</p>
            <p className="text-lg font-bold">{totals.replied.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Positive</p>
            <p className="text-lg font-bold text-success">{totals.positive.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
