import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActivityMetricsTab } from '@/components/datainsights/ActivityMetricsTab';
import { EngagementQualityTab } from '@/components/datainsights/EngagementQualityTab';
import { OutcomeMetricsTab } from '@/components/datainsights/OutcomeMetricsTab';
import { ProspectStrategyTab } from '@/components/datainsights/ProspectStrategyTab';
import { GatekeeperTrackingTab } from '@/components/datainsights/GatekeeperTrackingTab';
import { WrongNumberTrackingTab } from '@/components/datainsights/WrongNumberTrackingTab';
import { Loader2, Activity, Users, Target, Compass, UserCheck, PhoneOff, Filter, Settings } from 'lucide-react';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { useColdCallAnalytics, DateRange } from '@/hooks/useColdCallAnalytics';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { toEasternHour, BUSINESS_HOURS_ARRAY, isBusinessHour } from '@/lib/timezone';
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
    
    benchmarkMap['attempts_per_lead'] = {
      metric_name: 'Attempts Per Lead',
      metric_key: 'attempts_per_lead',
      benchmark_value: 6,
      benchmark_unit: 'attempts',
      benchmark_range_low: 4,
      benchmark_range_high: 8,
      description: 'Target attempts per lead',
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

  // Compute all metrics from cold_calls data
  const { activityMetrics, engagementMetrics, outcomeMetrics, prospectMetrics, gatekeeperMetrics, wrongNumberMetrics } = useMemo(() => {
    const allCalls = data?.calls || [];
    
    // Filter by selected analyst if needed
    const filtered = selectedAnalyst === 'all' 
      ? allCalls
      : allCalls.filter(c => c.analyst === selectedAnalyst);
    
    // Activity Metrics
    const totalDials = filtered.length;
    const dateMap = new Map<string, { calls: number; connects: number; voicemails: number }>();
    const hourlyMap = new Map<number, { calls: number; connects: number }>();
    
    filtered.forEach(call => {
      const date = call.called_date;
      
      if (date) {
        const existing = dateMap.get(date) || { calls: 0, connects: 0, voicemails: 0 };
        existing.calls += 1;
        if (call.is_connection) existing.connects += 1;
        if (call.is_voicemail) existing.voicemails += 1;
        dateMap.set(date, existing);
      }
      
      if (call.called_date_time) {
        const hour = toEasternHour(new Date(call.called_date_time));
        // Only track business hours (8 AM - 7 PM ET)
        if (isBusinessHour(hour)) {
          const hourExisting = hourlyMap.get(hour) || { calls: 0, connects: 0 };
          hourExisting.calls += 1;
          if (call.is_connection) hourExisting.connects += 1;
          hourlyMap.set(hour, hourExisting);
        }
      }
    });

    const dailyTrend = Array.from(dateMap.entries())
      .map(([date, d]) => ({ date, calls: d.calls, voicemails: d.voicemails, connects: d.connects }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    // Ensure all business hours are represented, even if zero
    const hourlyDistribution = BUSINESS_HOURS_ARRAY.map(hour => {
      const d = hourlyMap.get(hour) || { calls: 0, connects: 0 };
      return { hour, calls: d.calls, connects: d.connects };
    });

    const uniqueDays = dateMap.size || 1;
    const totalConnects = filtered.filter(c => c.is_connection).length;
    const voicemailCount = filtered.filter(c => c.is_voicemail).length;
    const uniqueCompanies = new Set(filtered.map(c => c.to_company).filter(Boolean)).size || 1;

    const activityMetrics = {
      totalDials,
      callsPerHour: Math.round((totalDials / uniqueDays / 8) * 10) / 10,
      callsPerDay: Math.round(totalDials / uniqueDays),
      voicemailsLeft: voicemailCount,
      attemptsPerLead: Math.round((totalDials / uniqueCompanies) * 10) / 10,
      dailyTrend,
      hourlyDistribution,
    };

    // Engagement Metrics
    const connectRate = totalDials > 0 ? (totalConnects / totalDials) * 100 : 0;
    const callsWithDuration = filtered.filter(c => (c.call_duration_sec || 0) > 0);
    const avgDuration = callsWithDuration.length
      ? callsWithDuration.reduce((sum, c) => sum + (c.call_duration_sec || 0), 0) / callsWithDuration.length
      : 0;

    // Duration buckets based on config thresholds
    const durationBuckets = [
      { range: `0-${Math.round(config.callDurationTooShort / 60)}m`, min: 0, max: config.callDurationTooShort },
      { range: `${Math.round(config.callDurationTooShort / 60)}-${Math.round(config.callDurationMinOptimal / 60)}m`, min: config.callDurationTooShort, max: config.callDurationMinOptimal },
      { range: `${Math.round(config.callDurationMinOptimal / 60)}-${Math.round(config.callDurationMaxOptimal / 60)}m (Optimal)`, min: config.callDurationMinOptimal, max: config.callDurationMaxOptimal },
      { range: `${Math.round(config.callDurationMaxOptimal / 60)}-${Math.round(config.callDurationTooLong / 60)}m`, min: config.callDurationMaxOptimal, max: config.callDurationTooLong },
      { range: `${Math.round(config.callDurationTooLong / 60)}m+`, min: config.callDurationTooLong, max: Infinity },
    ];
    const durationDistribution = durationBuckets.map(bucket => ({
      range: bucket.range,
      count: callsWithDuration.filter(c => (c.call_duration_sec || 0) >= bucket.min && (c.call_duration_sec || 0) < bucket.max).length
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

    const engagementMetrics = {
      connectRate: Math.round(connectRate * 10) / 10,
      decisionMakerConnectRate: 0,
      meaningfulConversationRate: Math.round(meaningfulRate * 10) / 10,
      avgCallDuration: Math.round(avgDuration),
      objectionHandlingRate: 0,
      connectTrend,
      durationDistribution,
      dayHourHeatmap: [],
    };

    // Outcome Metrics - use pre-computed flags
    const willingToSellCount = filtered.filter(c => c.interest_in_selling === 'yes').length;
    const meetingsByDate = new Map<string, number>();
    filtered.filter(c => c.is_meeting && c.called_date).forEach(call => {
      const date = call.called_date!;
      meetingsByDate.set(date, (meetingsByDate.get(date) || 0) + 1);
    });
    const meetingTrend = Array.from(meetingsByDate.entries())
      .map(([date, meetings]) => ({ date, meetings }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    const funnel = [
      { stage: 'Total Dials', count: totalDials },
      { stage: 'Connections', count: totalConnects },
      { stage: 'Quality Conversations', count: meaningfulConversations },
      { stage: 'Owners Willing to Sell', count: willingToSellCount },
    ];

    const outcomeMetrics = {
      meetingsBooked: willingToSellCount,
      conversationToMeetingRate: totalConnects > 0 ? Math.round((willingToSellCount / totalConnects) * 100) : 0,
      leadQualityConversionRate: meaningfulConversations > 0 ? Math.round((willingToSellCount / meaningfulConversations) * 100) : 0,
      conversionToSale: 0,
      followUpSuccessRate: 0,
      funnel,
      meetingTrend
    };

    // Prospect/Rep Metrics
    const repMap = new Map<string, { calls: number; connects: number; meetings: number }>();
    filtered.forEach(call => {
      const rep = call.analyst || 'Unknown';
      if (rep === 'Unknown') return;

      const existing = repMap.get(rep) || { calls: 0, connects: 0, meetings: 0 };
      existing.calls += 1;
      if (call.is_connection) existing.connects += 1;
      if (call.interest_in_selling === 'yes') existing.meetings += 1;
      repMap.set(rep, existing);
    });

    const industryBreakdown = Array.from(repMap.entries())
      .map(([industry, d]) => ({ industry, ...d }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);

    const prospectMetrics = {
      industryBreakdown,
      openingTypeEffectiveness: [
        { type: 'Standard', successRate: willingToSellCount > 0 ? Math.round((willingToSellCount / totalDials) * 100) : 0, count: totalDials }
      ],
      topPainPoints: [],
      pendingFollowUps: 0
    };

    // Gatekeeper Metrics
    const gatekeeperCalls = filtered.filter(c => {
      const disposition = (c.normalized_category || '').toLowerCase();
      return disposition.includes('gatekeeper') || disposition === 'receptionist';
    });
    const transferred = gatekeeperCalls.filter(c => c.is_connection).length;
    const blocked = gatekeeperCalls.filter(c => !c.is_connection).length;
    const info = gatekeeperCalls.length - transferred - blocked;

    const gatekeeperOutcomes = [
      { outcome: 'Transferred', count: transferred, percentage: gatekeeperCalls.length > 0 ? Math.round((transferred / gatekeeperCalls.length) * 100) : 0 },
      { outcome: 'Got Info', count: Math.max(0, info), percentage: gatekeeperCalls.length > 0 ? Math.round((Math.max(0, info) / gatekeeperCalls.length) * 100) : 0 },
      { outcome: 'Blocked', count: blocked, percentage: gatekeeperCalls.length > 0 ? Math.round((blocked / gatekeeperCalls.length) * 100) : 0 },
    ].filter(o => o.count > 0);

    const gatekeeperMetrics = {
      totalGatekeeperCalls: gatekeeperCalls.length,
      outcomes: gatekeeperOutcomes,
      techniques: [],
      avgHandlingScore: 6.5,
      transferRate: gatekeeperCalls.length > 0 ? Math.round((transferred / gatekeeperCalls.length) * 100) : 0,
      blockedRate: gatekeeperCalls.length > 0 ? Math.round((blocked / gatekeeperCalls.length) * 100) : 0,
    };

    // Wrong Number Metrics - use is_bad_data flag
    const wrongNumbers = filtered.filter(c => c.is_bad_data);

    const sourceMap = new Map<string, { wrong: number; total: number }>();
    filtered.forEach(call => {
      const source = call.analyst || 'Unknown';
      const existing = sourceMap.get(source) || { wrong: 0, total: 0 };
      existing.total += 1;
      if (call.is_bad_data) existing.wrong += 1;
      sourceMap.set(source, existing);
    });
    const sourceQuality = Array.from(sourceMap.entries())
      .map(([source, d]) => ({
        source,
        wrongCount: d.wrong,
        totalCount: d.total,
        rate: d.total > 0 ? Math.round((d.wrong / d.total) * 100) : 0
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10);

    const wrongNumberMetrics = {
      totalWrongNumbers: wrongNumbers.length,
      wrongNumberRate: totalDials > 0 ? Math.round((wrongNumbers.length / totalDials) * 100) : 0,
      typeBreakdown: [],
      sourceQuality,
      correctedCount: 0,
      timeWasted: wrongNumbers.length * 30,
    };

    return { activityMetrics, engagementMetrics, outcomeMetrics, prospectMetrics, gatekeeperMetrics, wrongNumberMetrics };
  }, [data?.calls, selectedAnalyst, config]);

  const loading = authLoading || callsLoading || configLoading;
  const dateRangeLabel = DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label || 'Selected Period';
  const totalCount = data?.totalCalls || 0;

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
                Showing {activityMetrics.totalDials.toLocaleString()} calls
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="activity" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4 hidden sm:block" />Activity
            </TabsTrigger>
            <TabsTrigger value="engagement" className="gap-2">
              <Users className="h-4 w-4 hidden sm:block" />Engagement
            </TabsTrigger>
            <TabsTrigger value="outcomes" className="gap-2">
              <Target className="h-4 w-4 hidden sm:block" />Outcomes
            </TabsTrigger>
            <TabsTrigger value="strategy" className="gap-2">
              <Compass className="h-4 w-4 hidden sm:block" />Strategy
            </TabsTrigger>
            <TabsTrigger value="gatekeeper" className="gap-2">
              <UserCheck className="h-4 w-4 hidden sm:block" />Gatekeeper
            </TabsTrigger>
            <TabsTrigger value="wrongnumber" className="gap-2">
              <PhoneOff className="h-4 w-4 hidden sm:block" />Wrong #
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity">
            <ActivityMetricsTab metrics={activityMetrics} benchmarks={benchmarks} />
          </TabsContent>

          <TabsContent value="engagement">
            <EngagementQualityTab metrics={engagementMetrics} benchmarks={benchmarks} />
          </TabsContent>

          <TabsContent value="outcomes">
            <OutcomeMetricsTab metrics={outcomeMetrics} benchmarks={benchmarks} />
          </TabsContent>

          <TabsContent value="strategy">
            <ProspectStrategyTab metrics={prospectMetrics} />
          </TabsContent>

          <TabsContent value="gatekeeper">
            <GatekeeperTrackingTab metrics={gatekeeperMetrics} />
          </TabsContent>

          <TabsContent value="wrongnumber">
            <WrongNumberTrackingTab metrics={wrongNumberMetrics} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
