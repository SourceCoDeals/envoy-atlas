import { MetricCardWithBenchmark } from './MetricCardWithBenchmark';
import { CallTimingHeatmap } from './CallTimingHeatmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

interface ActivityMetrics {
  totalDials: number;
  callsPerHour: number;
  callsPerDay: number;
  voicemailsLeft: number;
  attemptsPerLead: number;
  dailyTrend: { date: string; calls: number; voicemails: number; connects: number }[];
  hourlyDistribution: { hour: number; calls: number; connects: number }[];
}

interface Benchmark {
  benchmark_value: number;
  benchmark_range_low: number | null;
  benchmark_range_high: number | null;
}

interface ActivityMetricsTabProps {
  metrics: ActivityMetrics;
  benchmarks: Record<string, Benchmark>;
}

export function ActivityMetricsTab({ metrics, benchmarks }: ActivityMetricsTabProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCardWithBenchmark
          label="Total Dials"
          value={metrics.totalDials}
          unit="calls"
        />
        <MetricCardWithBenchmark
          label="Calls Per Hour"
          value={metrics.callsPerHour}
          unit="calls"
          benchmark={benchmarks.calls_per_hour?.benchmark_value}
          benchmarkRangeLow={benchmarks.calls_per_hour?.benchmark_range_low}
          benchmarkRangeHigh={benchmarks.calls_per_hour?.benchmark_range_high}
        />
        <MetricCardWithBenchmark
          label="Calls Per Day"
          value={metrics.callsPerDay}
          unit="calls"
          benchmark={benchmarks.calls_per_day?.benchmark_value}
          benchmarkRangeLow={benchmarks.calls_per_day?.benchmark_range_low}
          benchmarkRangeHigh={benchmarks.calls_per_day?.benchmark_range_high}
        />
        <MetricCardWithBenchmark
          label="Voicemails Left"
          value={metrics.voicemailsLeft}
          unit="calls"
        />
        <MetricCardWithBenchmark
          label="Attempts per Lead"
          value={metrics.attemptsPerLead}
          unit="attempts"
          benchmark={benchmarks.attempts_per_lead?.benchmark_value}
          benchmarkRangeLow={benchmarks.attempts_per_lead?.benchmark_range_low}
          benchmarkRangeHigh={benchmarks.attempts_per_lead?.benchmark_range_high}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Call Volume Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.dailyTrend}>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    labelFormatter={formatDate}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="calls" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                    name="Total Calls"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="connects" 
                    stroke="hsl(142 76% 36%)" 
                    strokeWidth={2}
                    dot={false}
                    name="Connects"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="voicemails" 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    dot={false}
                    name="Voicemails"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Voicemail vs Connect Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Outcome Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.dailyTrend.slice(-14)}>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    labelFormatter={formatDate}
                  />
                  <Legend />
                  <Bar 
                    dataKey="connects" 
                    fill="hsl(142 76% 36%)" 
                    stackId="a"
                    name="Connects"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar 
                    dataKey="voicemails" 
                    fill="hsl(var(--muted-foreground))" 
                    stackId="a"
                    name="Voicemails"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Distribution */}
      <CallTimingHeatmap data={metrics.hourlyDistribution} />
    </div>
  );
}
