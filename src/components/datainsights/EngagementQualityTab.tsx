import { MetricCardWithBenchmark } from './MetricCardWithBenchmark';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';

interface EngagementMetrics {
  connectRate: number;
  decisionMakerConnectRate: number;
  meaningfulConversationRate: number;
  avgCallDuration: number;
  objectionHandlingRate: number;
  connectTrend: { date: string; rate: number }[];
  durationDistribution: { range: string; count: number }[];
  dayHourHeatmap: { day: number; hour: number; connects: number }[];
}

interface Benchmark {
  benchmark_value: number;
  benchmark_range_low: number | null;
  benchmark_range_high: number | null;
}

interface EngagementQualityTabProps {
  metrics: EngagementMetrics;
  benchmarks: Record<string, Benchmark>;
}

export function EngagementQualityTab({ metrics, benchmarks }: EngagementQualityTabProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Color scale for duration distribution
  const durationColors = [
    'hsl(var(--muted-foreground))',
    'hsl(45 93% 47%)',
    'hsl(142 76% 36%)',
    'hsl(142 76% 36%)',
    'hsl(var(--primary))',
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCardWithBenchmark
          label="Connect Rate"
          value={metrics.connectRate}
          unit="percent"
          benchmark={benchmarks.connect_rate?.benchmark_value}
          benchmarkRangeLow={benchmarks.connect_rate?.benchmark_range_low}
          benchmarkRangeHigh={benchmarks.connect_rate?.benchmark_range_high}
        />
        <MetricCardWithBenchmark
          label="DM Connect Rate"
          value={metrics.decisionMakerConnectRate}
          unit="percent"
          benchmark={benchmarks.dm_connect_rate?.benchmark_value}
          benchmarkRangeLow={benchmarks.dm_connect_rate?.benchmark_range_low}
          benchmarkRangeHigh={benchmarks.dm_connect_rate?.benchmark_range_high}
        />
        <MetricCardWithBenchmark
          label="Meaningful Conv Rate"
          value={metrics.meaningfulConversationRate}
          unit="percent"
          benchmark={50}
          benchmarkRangeLow={40}
          benchmarkRangeHigh={60}
        />
        <MetricCardWithBenchmark
          label="Avg Call Duration"
          value={metrics.avgCallDuration}
          unit="min"
          benchmark={benchmarks.meaningful_duration?.benchmark_value}
          benchmarkRangeLow={benchmarks.meaningful_duration?.benchmark_range_low}
          benchmarkRangeHigh={benchmarks.meaningful_duration?.benchmark_range_high}
        />
        <MetricCardWithBenchmark
          label="Objection Handling"
          value={metrics.objectionHandlingRate}
          unit=""
          benchmark={7}
          benchmarkRangeLow={5}
          benchmarkRangeHigh={8}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connect Rate Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Connect Rate Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.connectTrend}>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    domain={[0, 'auto']}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    labelFormatter={formatDate}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Connect Rate']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                    name="Connect Rate"
                  />
                  {/* Benchmark line */}
                  {benchmarks.connect_rate && (
                    <Line 
                      type="monotone" 
                      dataKey={() => benchmarks.connect_rate.benchmark_value}
                      stroke="hsl(142 76% 36%)"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Target"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Call Duration Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Call Duration Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.durationDistribution}>
                  <XAxis 
                    dataKey="range"
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
                    formatter={(value: number) => [value, 'Calls']}
                  />
                  <Bar 
                    dataKey="count" 
                    radius={[4, 4, 0, 0]}
                  >
                    {metrics.durationDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={durationColors[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">
              Sweet spot: 2-5 min calls have the highest conversion rates
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quality Insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Engagement Quality Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="text-sm font-medium text-muted-foreground mb-1">Gatekeeper Rate</div>
              <div className="text-xl font-bold">
                {(100 - metrics.decisionMakerConnectRate).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                of connects are with gatekeepers
              </div>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="text-sm font-medium text-muted-foreground mb-1">Quality Ratio</div>
              <div className="text-xl font-bold">
                {metrics.meaningfulConversationRate > 0 
                  ? (metrics.meaningfulConversationRate / metrics.connectRate * 100).toFixed(0)
                  : 0}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                of connects become meaningful
              </div>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="text-sm font-medium text-muted-foreground mb-1">Objection Skill</div>
              <div className="text-xl font-bold">
                {metrics.objectionHandlingRate >= 7 ? 'Strong' : 
                 metrics.objectionHandlingRate >= 5 ? 'Average' : 'Needs Work'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Based on AI analysis score
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
