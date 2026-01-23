import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { startOfWeek, subWeeks, format, parseISO, isWithinInterval } from 'date-fns';

interface ColdCallData {
  called_date: string | null;
  is_connection: boolean;
  is_meeting: boolean;
}

interface WeeklyTrendChartProps {
  calls: ColdCallData[];
}

export function WeeklyTrendChart({ calls }: WeeklyTrendChartProps) {
  const { weeklyData, summary } = useMemo(() => {
    const now = new Date();
    const weeks: Array<{ start: Date; end: Date; label: string; weekLabel: string }> = [];
    
    // Generate last 10 weeks
    for (let i = 9; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weeks.push({
        start: weekStart,
        end: weekEnd,
        label: format(weekStart, 'MMM d'),
        weekLabel: `W${10 - i}`,
      });
    }

    // Group calls by week using called_date
    const weeklyData = weeks.map(week => {
      const weekCalls = calls.filter(call => {
        if (!call.called_date) return false;
        try {
          // called_date is in YYYY-MM-DD format
          const callDate = parseISO(call.called_date);
          return isWithinInterval(callDate, { start: week.start, end: week.end });
        } catch {
          return false;
        }
      });

      // Use pre-computed flags from cold_calls
      const connections = weekCalls.filter(c => c.is_connection).length;
      const meetings = weekCalls.filter(c => c.is_meeting).length;

      return {
        week: week.weekLabel,
        date: week.label,
        totalCalls: weekCalls.length,
        connections,
        meetings,
      };
    });

    // Calculate 10-week summary
    const totalCalls = weeklyData.reduce((sum, w) => sum + w.totalCalls, 0);
    const totalConnects = weeklyData.reduce((sum, w) => sum + w.connections, 0);
    const totalMeetings = weeklyData.reduce((sum, w) => sum + w.meetings, 0);

    // Calculate trend (compare last 5 weeks vs first 5 weeks)
    const firstHalf = weeklyData.slice(0, 5).reduce((sum, w) => sum + w.totalCalls, 0);
    const secondHalf = weeklyData.slice(5).reduce((sum, w) => sum + w.totalCalls, 0);
    const callsTrend = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

    const firstHalfConnects = weeklyData.slice(0, 5).reduce((sum, w) => sum + w.connections, 0);
    const secondHalfConnects = weeklyData.slice(5).reduce((sum, w) => sum + w.connections, 0);
    const connectsTrend = firstHalfConnects > 0 ? ((secondHalfConnects - firstHalfConnects) / firstHalfConnects) * 100 : 0;

    const firstHalfMeetings = weeklyData.slice(0, 5).reduce((sum, w) => sum + w.meetings, 0);
    const secondHalfMeetings = weeklyData.slice(5).reduce((sum, w) => sum + w.meetings, 0);
    const meetingsTrend = firstHalfMeetings > 0 ? ((secondHalfMeetings - firstHalfMeetings) / firstHalfMeetings) * 100 : 0;

    return {
      weeklyData,
      summary: {
        totalCalls,
        totalConnects,
        totalMeetings,
        avgCallsPerWeek: totalCalls / 10,
        avgConnectsPerWeek: totalConnects / 10,
        avgMeetingsPerWeek: totalMeetings / 10,
        callsTrend,
        connectsTrend,
        meetingsTrend,
      },
    };
  }, [calls]);

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 5) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (value < -5) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const formatTrend = (value: number) => {
    const prefix = value > 0 ? '↑' : value < 0 ? '↓' : '';
    return `${prefix} ${Math.abs(value).toFixed(0)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📈 10-Week Performance Trend
        </CardTitle>
        <CardDescription>
          Weekly totals for calls, connections, and meetings booked
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => [value, name]}
                labelFormatter={(label) => `Week of ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="totalCalls"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name="Total Calls"
              />
              <Line
                type="monotone"
                dataKey="connections"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name="Connections"
              />
              <Line
                type="monotone"
                dataKey="meetings"
                stroke="hsl(var(--chart-4))"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name="Meetings"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Calls</span>
              <TrendIcon value={summary.callsTrend} />
            </div>
            <p className="text-2xl font-bold">{summary.totalCalls.toLocaleString()}</p>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Avg/week: {summary.avgCallsPerWeek.toFixed(0)}</span>
              <span className={summary.callsTrend > 0 ? 'text-green-600' : summary.callsTrend < 0 ? 'text-red-600' : ''}>
                {formatTrend(summary.callsTrend)}
              </span>
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Connects</span>
              <TrendIcon value={summary.connectsTrend} />
            </div>
            <p className="text-2xl font-bold">{summary.totalConnects.toLocaleString()}</p>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Avg/week: {summary.avgConnectsPerWeek.toFixed(1)}</span>
              <span className={summary.connectsTrend > 0 ? 'text-green-600' : summary.connectsTrend < 0 ? 'text-red-600' : ''}>
                {formatTrend(summary.connectsTrend)}
              </span>
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Meetings</span>
              <TrendIcon value={summary.meetingsTrend} />
            </div>
            <p className="text-2xl font-bold">{summary.totalMeetings.toLocaleString()}</p>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Avg/week: {summary.avgMeetingsPerWeek.toFixed(1)}</span>
              <span className={summary.meetingsTrend > 0 ? 'text-green-600' : summary.meetingsTrend < 0 ? 'text-red-600' : ''}>
                {formatTrend(summary.meetingsTrend)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}