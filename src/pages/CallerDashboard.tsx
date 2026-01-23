import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useColdCallAnalytics, DateRange } from '@/hooks/useColdCallAnalytics';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import {
  Users,
  Loader2,
  Filter,
  RotateCcw,
} from 'lucide-react';
import {
  FunnelMetrics,
  WeeklyTrendChart,
  DispositionPieChart,
  InterestBreakdownCards,
  CallerPerformanceTable,
  CoachingInsightsPanel,
} from '@/components/calling';

export default function CallerDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [selectedRep, setSelectedRep] = useState<string>('all');
  
  const { data, isLoading } = useColdCallAnalytics(dateRange);
  const { config } = useCallingConfig();

  // Get unique reps for filter
  const uniqueReps = useMemo(() => {
    if (!data?.repPerformance) return [];
    return data.repPerformance.map(r => r.rep);
  }, [data?.repPerformance]);

  // Filter calls by selected rep (using analyst field)
  const filteredCalls = useMemo(() => {
    if (!data?.calls) return [];
    if (selectedRep === 'all') return data.calls;
    return data.calls.filter(c => c.analyst === selectedRep);
  }, [data?.calls, selectedRep]);

  // Calculate funnel metrics for filtered data
  const funnelStats = useMemo(() => {
    if (selectedRep === 'all' && data) {
      return {
        totalCalls: data.totalCalls,
        connections: data.connections,
        completed: data.conversations,
        meetings: data.meetings,
        talkTime: data.totalDuration,
        avgScore: data.avgScores.overallQuality,
        activated: data.positiveInterestCount,
      };
    }

    const repData = data?.repPerformance.find(r => r.rep === selectedRep);
    if (!repData) {
      return {
        totalCalls: filteredCalls.length,
        connections: filteredCalls.filter(c => c.is_connection).length,
        completed: filteredCalls.filter(c => c.is_connection).length,
        meetings: filteredCalls.filter(c => c.is_meeting).length,
        talkTime: filteredCalls.reduce((sum, c) => sum + (c.call_duration_sec || 0), 0),
        avgScore: null,
        activated: 0,
      };
    }

    return {
      totalCalls: repData.totalCalls,
      connections: repData.connections,
      completed: repData.connections, // approximate
      meetings: repData.meetings,
      talkTime: repData.avgDuration * repData.totalCalls,
      avgScore: repData.avgOverallScore,
      activated: repData.positiveInterestCount,
    };
  }, [data, selectedRep, filteredCalls]);

  // Reset filters
  const handleReset = () => {
    setDateRange('30d');
    setSelectedRep('all');
  };

  // Handle clicking on a caller in the table
  const handleCallerClick = (rep: string) => {
    setSelectedRep(rep);
  };

  // Map cold calls to format expected by WeeklyTrendChart
  const chartCalls = useMemo(() => {
    if (!data?.calls) return [];
    return data.calls.map(c => ({
      started_at: c.called_date_time,
      disposition: c.normalized_category,
      talk_duration: c.call_duration_sec,
      conversation_outcome: c.is_meeting ? 'meeting_booked' : null,
      callback_scheduled: c.is_meeting,
    }));
  }, [data?.calls]);

  // Map cold calls to format expected by DispositionPieChart
  const dispositionCalls = useMemo(() => {
    if (!filteredCalls) return [];
    return filteredCalls.map(c => ({
      disposition: c.normalized_category,
    }));
  }, [filteredCalls]);

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {selectedRep !== 'all' ? selectedRep : 'Caller Dashboard'}
            </h1>
            <p className="text-muted-foreground">
              {funnelStats.totalCalls} calls • Using workspace thresholds
            </p>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="14d">14 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedRep} onValueChange={setSelectedRep}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Reps" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reps</SelectItem>
                  {uniqueReps.map(rep => (
                    <SelectItem key={rep} value={rep}>
                      {rep}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(dateRange !== '30d' || selectedRep !== 'all') && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Section 1: Funnel Metrics */}
        <FunnelMetrics
          totalCalls={funnelStats.totalCalls}
          connections={funnelStats.connections}
          completed={funnelStats.completed}
          meetings={funnelStats.meetings}
          talkTimeSeconds={funnelStats.talkTime}
          avgScore={funnelStats.avgScore}
          activated={funnelStats.activated}
          config={config}
        />

        {/* Section 2: 10-Week Trend (always shows full 10 weeks regardless of date filter) */}
        {chartCalls.length > 0 && (
          <WeeklyTrendChart calls={chartCalls} />
        )}

        {/* Section 3 & 7: Disposition Pie + Interest Breakdown (side by side) */}
        <div className="grid gap-6 lg:grid-cols-2">
          <DispositionPieChart calls={dispositionCalls} />
          
          {data?.interestBreakdown && (
            <InterestBreakdownCards
              breakdown={data.interestBreakdown}
              totalCalls={funnelStats.totalCalls}
              positiveValues={config.interestValuesPositive}
            />
          )}
        </div>

        {/* Section 5: Caller Performance Table */}
        {data?.repPerformance && (
          <CallerPerformanceTable
            repPerformance={data.repPerformance}
            config={config}
            onCallerClick={handleCallerClick}
          />
        )}

        {/* Section 6: Coaching Insights */}
        {data && (
          <CoachingInsightsPanel
            topCalls={data.topCalls.map(c => ({
              id: c.id,
              to_name: c.to_name,
              caller_name: c.analyst,
              composite_score: c.composite_score,
            }))}
            needsCoaching={data.needsCoaching.map(c => ({
              id: c.id,
              to_name: c.to_name,
              caller_name: c.analyst,
              composite_score: c.composite_score,
            }))}
            topCallsThreshold={config.topCallsMinScore}
            coachingThreshold={config.coachingAlertOverallQuality}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
