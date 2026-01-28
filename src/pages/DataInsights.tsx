import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Activity, Users, Clock, Filter, Settings } from 'lucide-react';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { useColdCallAnalytics, DateRange } from '@/hooks/useColdCallAnalytics';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { MetricCardWithBenchmark } from '@/components/datainsights/MetricCardWithBenchmark';
import { CallTimingHeatmap } from '@/components/datainsights/CallTimingHeatmap';
import { ConversionFunnel } from '@/components/datainsights/ConversionFunnel';
import { toEasternHour, BUSINESS_HOURS_ARRAY, isBusinessHour, formatHourLabel } from '@/lib/timezone';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell
} from 'recharts';

interface Benchmark {
  metric_name: string;
  metric_key: string;
  benchmark_value: number;
  benchmark_unit: string;
  benchmark_range_low: number | null;
  benchmark_range_high: number | null;
  description: string | null;
}

// Map DateRange to display labels
const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '14d', label: 'Last 14 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'all', label: 'All Time' },
];

export default function DataInsights() {
  const { loading: authLoading } = useAuth();
  const { config, isLoading: configLoading } = useCallingConfig();
  
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('all');
  
  const { data, isLoading: callsLoading } = useColdCallAnalytics(dateRange);

  // Build benchmarks from config
  const benchmarks = useMemo(() => {
    const benchmarkMap: Record<string, Benchmark> = {};
    
    benchmarkMap['calls_per_hour'] = {
      metric_name: 'Calls Per Hour',
      metric_key: 'calls_per_hour',
      benchmark_value: 12,
      benchmark_unit: 'calls',
      benchmark_range_low: 10,
      benchmark_range_high: 15,
      description: 'Target calls per hour',
    };
    
    benchmarkMap['calls_per_day'] = {
      metric_name: 'Calls Per Day',
      metric_key: 'calls_per_day',
      benchmark_value: 80,
      benchmark_unit: 'calls',
      benchmark_range_low: 60,
      benchmark_range_high: 100,
      description: 'Target calls per day',
    };
    
    benchmarkMap['connect_rate'] = {
      metric_name: 'Connect Rate',
      metric_key: 'connect_rate',
      benchmark_value: 15,
      benchmark_unit: '%',
      benchmark_range_low: 10,
      benchmark_range_high: 20,
      description: 'Target connect rate',
    };

    benchmarkMap['avg_call_duration'] = {
      metric_name: 'Avg Call Duration',
      metric_key: 'avg_call_duration',
      benchmark_value: config.callDurationMinOptimal,
      benchmark_unit: 'seconds',
      benchmark_range_low: config.callDurationMinOptimal,
      benchmark_range_high: config.callDurationMaxOptimal,
      description: 'Optimal call duration range',
    };
    
    return benchmarkMap;
  }, [config]);

  // Get analysts from data
  const analysts = useMemo(() => {
    if (!data?.calls) return [];
    const uniqueAnalysts = new Set<string>();
    data.calls.forEach(c => {
      if (c.analyst && c.analyst !== 'Unknown') {
        uniqueAnalysts.add(c.analyst);
      }
    });
    return Array.from(uniqueAnalysts).sort();
  }, [data?.calls]);

  // Compute all metrics from cold_calls data - filtered by analyst
  const metrics = useMemo(() => {
    const allCalls = data?.calls || [];
    
    // Filter by selected analyst if needed
    const filtered = selectedAnalyst === 'all' 
      ? allCalls
      : allCalls.filter(c => c.analyst === selectedAnalyst);
    
    // === ACTIVITY METRICS ===
    const totalDials = filtered.length;
    const dateMap = new Map<string, { calls: number; connects: number; voicemails: number; meetings: number }>();
    const hourlyMap = new Map<number, { calls: number; connects: number }>();
    
    // Initialize business hours
    BUSINESS_HOURS_ARRAY.forEach(h => hourlyMap.set(h, { calls: 0, connects: 0 }));
    
    filtered.forEach(call => {
      const date = call.called_date;
      
      if (date) {
        const existing = dateMap.get(date) || { calls: 0, connects: 0, voicemails: 0, meetings: 0 };
        existing.calls += 1;
        if (call.is_connection) existing.connects += 1;
        if (call.is_voicemail) existing.voicemails += 1;
        if (call.is_meeting) existing.meetings += 1;
        dateMap.set(date, existing);
      }
      
      // Parse time from nocodb_created_at for hourly distribution (more accurate timing)
      const timestamp = (call as any).nocodb_created_at || call.called_date_time;
      if (timestamp) {
        try {
          const dt = new Date(timestamp);
          const hour = toEasternHour(dt);
          if (isBusinessHour(hour)) {
            const hourExisting = hourlyMap.get(hour) || { calls: 0, connects: 0 };
            hourExisting.calls += 1;
            if (call.is_connection) hourExisting.connects += 1;
            hourlyMap.set(hour, hourExisting);
          }
        } catch {
          // Skip invalid dates
        }
      }
    });

    const dailyTrend = Array.from(dateMap.entries())
      .map(([date, d]) => ({ date, calls: d.calls, voicemails: d.voicemails, connects: d.connects, meetings: d.meetings }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    const hourlyDistribution = BUSINESS_HOURS_ARRAY.map(hour => {
      const d = hourlyMap.get(hour) || { calls: 0, connects: 0 };
      return { hour, calls: d.calls, connects: d.connects };
    });

    const uniqueDays = dateMap.size || 1;
    const totalConnects = filtered.filter(c => c.is_connection).length;
    const voicemailCount = filtered.filter(c => c.is_voicemail).length;
    const meetingsCount = filtered.filter(c => c.is_meeting).length;

    // === ENGAGEMENT METRICS ===
    const connectRate = totalDials > 0 ? (totalConnects / totalDials) * 100 : 0;
    const callsWithDuration = filtered.filter(c => (c.call_duration_sec || 0) > 0);
    const avgDuration = callsWithDuration.length
      ? callsWithDuration.reduce((sum, c) => sum + (c.call_duration_sec || 0), 0) / callsWithDuration.length
      : 0;

    // Duration buckets based on config thresholds
    const durationBuckets = [
      { range: `0-${Math.round(config.callDurationTooShort / 60)}m`, min: 0, max: config.callDurationTooShort },
      { range: `${Math.round(config.callDurationTooShort / 60)}-${Math.round(config.callDurationMinOptimal / 60)}m`, min: config.callDurationTooShort, max: config.callDurationMinOptimal },
      { range: `${Math.round(config.callDurationMinOptimal / 60)}-${Math.round(config.callDurationMaxOptimal / 60)}m`, min: config.callDurationMinOptimal, max: config.callDurationMaxOptimal },
      { range: `${Math.round(config.callDurationMaxOptimal / 60)}-${Math.round(config.callDurationTooLong / 60)}m`, min: config.callDurationMaxOptimal, max: config.callDurationTooLong },
      { range: `${Math.round(config.callDurationTooLong / 60)}m+`, min: config.callDurationTooLong, max: Infinity },
    ];
    const durationDistribution = durationBuckets.map(bucket => ({
      range: bucket.range,
      count: callsWithDuration.filter(c => (c.call_duration_sec || 0) >= bucket.min && (c.call_duration_sec || 0) < bucket.max).length,
      isOptimal: bucket.min === config.callDurationMinOptimal,
    }));

    const connectTrend = Array.from(dateMap.entries())
      .map(([date, d]) => ({
        date,
        rate: d.calls > 0 ? Math.round((d.connects / d.calls) * 100) : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    // Meaningful conversations - use config threshold
    const meaningfulConversations = filtered.filter(c => (c.call_duration_sec || 0) >= config.callDurationMinOptimal).length;
    const meaningfulRate = totalConnects > 0 ? (meaningfulConversations / totalConnects) * 100 : 0;

    // === OUTCOME METRICS ===
    const willingToSellCount = filtered.filter(c => c.interest_in_selling === 'yes').length;
    const funnel = [
      { stage: 'Total Dials', count: totalDials },
      { stage: 'Connections', count: totalConnects },
      { stage: 'Quality Conversations', count: meaningfulConversations },
      { stage: 'Owners Willing to Sell', count: willingToSellCount },
    ];

    // Day of week performance
    const dayOfWeekMap = new Map<number, { calls: number; connects: number }>();
    filtered.forEach(call => {
      if (call.called_date) {
        try {
          const dt = new Date(call.called_date);
          const dow = dt.getDay(); // 0-6
          const existing = dayOfWeekMap.get(dow) || { calls: 0, connects: 0 };
          existing.calls += 1;
          if (call.is_connection) existing.connects += 1;
          dayOfWeekMap.set(dow, existing);
        } catch {
          // Skip
        }
      }
    });

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeekData = dayLabels.map((label, i) => {
      const d = dayOfWeekMap.get(i) || { calls: 0, connects: 0 };
      return {
        day: label,
        calls: d.calls,
        connects: d.connects,
        connectRate: d.calls > 0 ? Math.round((d.connects / d.calls) * 100) : 0,
      };
    });

    return {
      // Activity
      totalDials,
      callsPerHour: Math.round((totalDials / uniqueDays / 8) * 10) / 10,
      callsPerDay: Math.round(totalDials / uniqueDays),
      voicemailsLeft: voicemailCount,
      dailyTrend,
      hourlyDistribution,
      // Engagement
      connectRate: Math.round(connectRate * 10) / 10,
      meaningfulConversationRate: Math.round(meaningfulRate * 10) / 10,
      avgCallDuration: Math.round(avgDuration),
      durationDistribution,
      connectTrend,
      // Outcomes
      meetings: meetingsCount,
      willingToSell: willingToSellCount,
      funnel,
      // Timing
      dayOfWeekData,
    };
  }, [data?.calls, selectedAnalyst, config]);

  const loading = authLoading || callsLoading || configLoading;
  const dateRangeLabel = DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label || 'Selected Period';
  const totalCount = data?.totalCalls || 0;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Duration distribution colors
  const durationColors = [
    'hsl(var(--muted-foreground))',
    'hsl(45 93% 47%)',
    'hsl(142 76% 36%)',
    'hsl(45 93% 47%)',
    'hsl(var(--muted-foreground))',
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Data Insights</h1>
            <p className="text-muted-foreground">
              {totalCount.toLocaleString()} total calls • Analyzing {dateRangeLabel.toLowerCase()}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings?tab=calling">
              <Settings className="h-4 w-4 mr-2" />
              Configure Thresholds
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedAnalyst} onValueChange={setSelectedAnalyst}>
                <SelectTrigger className="w-[200px]">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select analyst" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Analysts ({analysts.length})</SelectItem>
                  {analysts.map(analyst => (
                    <SelectItem key={analyst} value={analyst}>
                      {analyst}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="ml-auto text-sm text-muted-foreground">
                Showing {metrics.totalDials.toLocaleString()} calls
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Consolidated 3-Tab Layout */}
        <Tabs defaultValue="activity" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4 hidden sm:block" />Activity
            </TabsTrigger>
            <TabsTrigger value="engagement" className="gap-2">
              <Users className="h-4 w-4 hidden sm:block" />Engagement
            </TabsTrigger>
            <TabsTrigger value="timing" className="gap-2">
              <Clock className="h-4 w-4 hidden sm:block" />Timing
            </TabsTrigger>
          </TabsList>

          {/* ACTIVITY TAB */}
          <TabsContent value="activity">
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCardWithBenchmark
                  label="Total Dials"
                  value={metrics.totalDials}
                  unit="calls"
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
                  label="Meetings Booked"
                  value={metrics.meetings}
                  unit="meetings"
                />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Call Volume Trend */}
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
                            name="Calls"
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
                            dataKey="meetings" 
                            stroke="hsl(var(--chart-4))" 
                            strokeWidth={2}
                            dot={false}
                            name="Meetings"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Conversion Funnel */}
                <ConversionFunnel data={metrics.funnel} />
              </div>
            </div>
          </TabsContent>

          {/* ENGAGEMENT TAB */}
          <TabsContent value="engagement">
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCardWithBenchmark
                  label="Connect Rate"
                  value={metrics.connectRate}
                  unit="percent"
                  benchmark={benchmarks.connect_rate?.benchmark_value}
                  benchmarkRangeLow={benchmarks.connect_rate?.benchmark_range_low}
                  benchmarkRangeHigh={benchmarks.connect_rate?.benchmark_range_high}
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
                  value={Math.round(metrics.avgCallDuration / 60)}
                  unit="min"
                  benchmark={Math.round(config.callDurationMinOptimal / 60)}
                  benchmarkRangeLow={Math.round(config.callDurationMinOptimal / 60)}
                  benchmarkRangeHigh={Math.round(config.callDurationMaxOptimal / 60)}
                />
                <MetricCardWithBenchmark
                  label="Owners Willing to Sell"
                  value={metrics.willingToSell}
                  unit="leads"
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
                          <Line 
                            type="monotone" 
                            dataKey={() => benchmarks.connect_rate?.benchmark_value || 15}
                            stroke="hsl(142 76% 36%)"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            dot={false}
                            name="Target"
                          />
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
                            tick={{ fontSize: 11 }}
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
                            {metrics.durationDistribution.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.isOptimal ? 'hsl(142 76% 36%)' : durationColors[index]} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground text-center">
                      Optimal duration: {Math.round(config.callDurationMinOptimal / 60)}-{Math.round(config.callDurationMaxOptimal / 60)} minutes
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TIMING TAB */}
          <TabsContent value="timing">
            <div className="space-y-6">
              {/* Best Time to Call Heatmap */}
              <CallTimingHeatmap data={metrics.hourlyDistribution} />

              {/* Day of Week Performance */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Performance by Day of Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.dayOfWeekData}>
                        <XAxis 
                          dataKey="day"
                          tick={{ fontSize: 12 }}
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis 
                          yAxisId="left"
                          tick={{ fontSize: 12 }}
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 12 }}
                          stroke="hsl(var(--muted-foreground))"
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                          }}
                          formatter={(value: number, name: string) => {
                            if (name === 'Connect Rate') return [`${value}%`, name];
                            return [value, name];
                          }}
                        />
                        <Legend />
                        <Bar 
                          yAxisId="left"
                          dataKey="calls" 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]}
                          name="Calls"
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="connectRate" 
                          stroke="hsl(142 76% 36%)" 
                          strokeWidth={2}
                          dot={{ r: 4, fill: 'hsl(142 76% 36%)' }}
                          name="Connect Rate"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
