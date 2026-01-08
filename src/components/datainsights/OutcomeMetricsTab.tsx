import { MetricCardWithBenchmark } from './MetricCardWithBenchmark';
import { ConversionFunnel } from './ConversionFunnel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface OutcomeMetrics {
  meetingsBooked: number;
  conversationToMeetingRate: number;
  leadQualityConversionRate: number;
  conversionToSale: number;
  followUpSuccessRate: number;
  funnel: { stage: string; count: number }[];
  meetingTrend: { date: string; meetings: number }[];
}

interface Benchmark {
  benchmark_value: number;
  benchmark_range_low: number | null;
  benchmark_range_high: number | null;
}

interface OutcomeMetricsTabProps {
  metrics: OutcomeMetrics;
  benchmarks: Record<string, Benchmark>;
}

export function OutcomeMetricsTab({ metrics, benchmarks }: OutcomeMetricsTabProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCardWithBenchmark
          label="Meetings Booked"
          value={metrics.meetingsBooked}
          unit="calls"
        />
        <MetricCardWithBenchmark
          label="Conv → Meeting Rate"
          value={metrics.conversationToMeetingRate}
          unit="percent"
          benchmark={benchmarks.conv_to_meeting_rate?.benchmark_value}
          benchmarkRangeLow={benchmarks.conv_to_meeting_rate?.benchmark_range_low}
          benchmarkRangeHigh={benchmarks.conv_to_meeting_rate?.benchmark_range_high}
        />
        <MetricCardWithBenchmark
          label="Lead Quality Conv"
          value={metrics.leadQualityConversionRate}
          unit="percent"
          benchmark={benchmarks.lead_quality_conv?.benchmark_value}
          benchmarkRangeLow={benchmarks.lead_quality_conv?.benchmark_range_low}
          benchmarkRangeHigh={benchmarks.lead_quality_conv?.benchmark_range_high}
        />
        <MetricCardWithBenchmark
          label="Conversion to Sale"
          value={metrics.conversionToSale}
          unit="percent"
          benchmark={benchmarks.cold_call_conversion?.benchmark_value}
          benchmarkRangeLow={benchmarks.cold_call_conversion?.benchmark_range_low}
          benchmarkRangeHigh={benchmarks.cold_call_conversion?.benchmark_range_high}
        />
        <MetricCardWithBenchmark
          label="Follow-Up Success"
          value={metrics.followUpSuccessRate}
          unit="percent"
        />
      </div>

      {/* Funnel and Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversionFunnel data={metrics.funnel} />

        {/* Meeting Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Meetings Booked Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.meetingTrend}>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    labelFormatter={formatDate}
                    formatter={(value: number) => [value, 'Meetings']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="meetings" 
                    stroke="hsl(142 76% 36%)" 
                    strokeWidth={2}
                    dot={{ r: 4, fill: 'hsl(142 76% 36%)' }}
                    name="Meetings Booked"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Conversion Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                {metrics.funnel.length > 0 ? metrics.funnel[0].count : 0}
              </div>
              <div className="text-sm text-muted-foreground">Total Dials</div>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <div className="text-3xl font-bold text-blue-500 mb-1">
                {metrics.funnel.length > 1 ? metrics.funnel[1].count : 0}
              </div>
              <div className="text-sm text-muted-foreground">Connects</div>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <div className="text-3xl font-bold text-emerald-500 mb-1">
                {metrics.meetingsBooked}
              </div>
              <div className="text-sm text-muted-foreground">Meetings</div>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {metrics.funnel.length > 5 ? metrics.funnel[5].count : 0}
              </div>
              <div className="text-sm text-muted-foreground">Closed Deals</div>
            </div>
          </div>
          
          {metrics.funnel.length > 0 && metrics.funnel[0].count > 0 && (
            <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="text-sm">
                <strong>Key Insight:</strong> Your dial-to-deal ratio is{' '}
                <span className="font-bold text-primary">
                  {Math.round(metrics.funnel[0].count / Math.max(metrics.funnel[5]?.count || 1, 1))}:1
                </span>
                {' '}— meaning you need approximately{' '}
                {Math.round(metrics.funnel[0].count / Math.max(metrics.funnel[5]?.count || 1, 1))} dials to close 1 deal.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
