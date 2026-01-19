import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Loader2, Activity, Users, Target, Compass, UserCheck, PhoneOff, Filter } from 'lucide-react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { COLD_CALLING_BENCHMARKS } from '@/lib/coldCallingBenchmarks';
import {
  useExternalCalls,
  filterCalls,
  isConnection,
  isVoicemail,
  isMeeting,
  isQualityConversation,
  DATE_RANGE_OPTIONS,
  DateRangeOption,
  ExternalCall,
} from '@/hooks/useExternalCalls';

interface Benchmark {
  metric_name: string;
  metric_key: string;
  benchmark_value: number;
  benchmark_unit: string;
  benchmark_range_low: number | null;
  benchmark_range_high: number | null;
  description: string | null;
}

export default function DataInsights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { calls, analysts, loading: callsLoading, totalCount } = useExternalCalls();
  
  const [dateRange, setDateRange] = useState<DateRangeOption>('last_month');
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Build benchmarks from local constants
  const benchmarks = useMemo(() => {
    const benchmarkMap: Record<string, Benchmark> = {};
    const sdrMetrics = COLD_CALLING_BENCHMARKS.sdrMetrics;
    
    // Map SDR metrics to benchmark format
    if (sdrMetrics) {
      Object.entries(sdrMetrics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          benchmarkMap[key] = {
            metric_name: key.replace(/_/g, ' '),
            metric_key: key,
            benchmark_value: value,
            benchmark_unit: key.includes('rate') ? '%' : 'count',
            benchmark_range_low: null,
            benchmark_range_high: null,
            description: null,
          };
        }
      });
    }
    
    return benchmarkMap;
  }, []);

  // Compute all metrics from filtered calls
  const { activityMetrics, engagementMetrics, outcomeMetrics, prospectMetrics, gatekeeperMetrics, wrongNumberMetrics } = useMemo(() => {
    const filtered = filterCalls(calls, dateRange, selectedAnalyst);
    
    // Activity Metrics
    const totalDials = filtered.length;
    const dateMap = new Map<string, { calls: number; connects: number; voicemails: number }>();
    const hourlyMap = new Map<number, { calls: number; connects: number }>();
    
    filtered.forEach(call => {
      let date: string | null = null;
      if (call.date_time) {
        date = new Date(call.date_time).toISOString().split('T')[0];
      }
      
      if (date) {
        const existing = dateMap.get(date) || { calls: 0, connects: 0, voicemails: 0 };
        existing.calls += 1;
        if (isConnection(call)) existing.connects += 1;
        if (isVoicemail(call)) existing.voicemails += 1;
        dateMap.set(date, existing);
      }
      
      if (call.date_time) {
        const hour = new Date(call.date_time).getHours();
        const hourExisting = hourlyMap.get(hour) || { calls: 0, connects: 0 };
        hourExisting.calls += 1;
        if (isConnection(call)) hourExisting.connects += 1;
        hourlyMap.set(hour, hourExisting);
      }
    });

    const dailyTrend = Array.from(dateMap.entries())
      .map(([date, data]) => ({ date, calls: data.calls, voicemails: data.voicemails, connects: data.connects }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    const hourlyDistribution = Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({ hour, calls: data.calls, connects: data.connects }))
      .sort((a, b) => a.hour - b.hour);

    const uniqueDays = dateMap.size || 1;
    const totalConnects = filtered.filter(c => isConnection(c)).length;
    const voicemailCount = filtered.filter(c => isVoicemail(c)).length;
    const uniqueCompanies = new Set(filtered.map(c => c.company_name).filter(Boolean)).size || 1;

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
    const callsWithDuration = filtered.filter(c => c.talk_duration != null && c.talk_duration > 0);
    const avgDuration = callsWithDuration.length
      ? callsWithDuration.reduce((sum, c) => sum + (c.talk_duration || 0), 0) / callsWithDuration.length
      : 0;

    const durationBuckets = [
      { range: '0-1 min', min: 0, max: 60 },
      { range: '1-3 min', min: 60, max: 180 },
      { range: '3-5 min', min: 180, max: 300 },
      { range: '5-10 min', min: 300, max: 600 },
      { range: '10+ min', min: 600, max: Infinity },
    ];
    const durationDistribution = durationBuckets.map(bucket => ({
      range: bucket.range,
      count: callsWithDuration.filter(c => (c.talk_duration || 0) >= bucket.min && (c.talk_duration || 0) < bucket.max).length
    }));

    const connectTrend = Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        rate: data.calls > 0 ? Math.round((data.connects / data.calls) * 100) : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    const meaningfulConversations = filtered.filter(c => isQualityConversation(c)).length;
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

    // Outcome Metrics
    const highInterest = filtered.filter(c => isMeeting(c)).length;
    const meetingsByDate = new Map<string, number>();
    filtered.filter(c => isMeeting(c) && c.date_time).forEach(call => {
      const date = new Date(call.date_time!).toISOString().split('T')[0];
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
      { stage: 'High Interest', count: highInterest },
    ];

    const outcomeMetrics = {
      meetingsBooked: highInterest,
      conversationToMeetingRate: totalConnects > 0 ? Math.round((highInterest / totalConnects) * 100) : 0,
      leadQualityConversionRate: meaningfulConversations > 0 ? Math.round((highInterest / meaningfulConversations) * 100) : 0,
      conversionToSale: 0,
      followUpSuccessRate: 0,
      funnel,
      meetingTrend
    };

    // Prospect/Rep Metrics
    const repMap = new Map<string, { calls: number; connects: number; meetings: number }>();
    filtered.forEach(call => {
      let rep = call.caller_name || 'Unknown';
      if (rep.includes('Salesforce') || rep === 'Unknown') return;

      const existing = repMap.get(rep) || { calls: 0, connects: 0, meetings: 0 };
      existing.calls += 1;
      if (isConnection(call)) existing.connects += 1;
      if (isMeeting(call)) existing.meetings += 1;
      repMap.set(rep, existing);
    });

    const industryBreakdown = Array.from(repMap.entries())
      .map(([industry, data]) => ({ industry, ...data }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);

    const prospectMetrics = {
      industryBreakdown,
      openingTypeEffectiveness: [
        { type: 'Standard', successRate: highInterest > 0 ? Math.round((highInterest / totalDials) * 100) : 0, count: totalDials }
      ],
      topPainPoints: [],
      pendingFollowUps: 0
    };

    // Gatekeeper Metrics
    const gatekeeperCalls = filtered.filter(c => {
      const disposition = (c.disposition || '').toLowerCase();
      return disposition.includes('gatekeeper') || disposition === 'receptionist';
    });
    const transferred = gatekeeperCalls.filter(c => isConnection(c)).length;
    const blocked = gatekeeperCalls.filter(c => !isConnection(c)).length;
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

    // Wrong Number Metrics
    const wrongNumbers = filtered.filter(c =>
      (c.talk_duration || 0) < 30 && 
      (c.disposition?.toLowerCase().includes('wrong') || c.call_title?.toLowerCase().includes('wrong'))
    );

    const sourceMap = new Map<string, { wrong: number; total: number }>();
    filtered.forEach(call => {
      const source = call.caller_name || 'Unknown';
      const existing = sourceMap.get(source) || { wrong: 0, total: 0 };
      existing.total += 1;
      if (wrongNumbers.some(w => w.id === call.id)) existing.wrong += 1;
      sourceMap.set(source, existing);
    });
    const sourceQuality = Array.from(sourceMap.entries())
      .map(([source, data]) => ({
        source,
        wrongCount: data.wrong,
        totalCount: data.total,
        rate: data.total > 0 ? Math.round((data.wrong / data.total) * 100) : 0
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
  }, [calls, dateRange, selectedAnalyst]);

  const loading = authLoading || callsLoading;
  const dateRangeLabel = DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label || 'Selected Period';

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
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeOption)}>
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
