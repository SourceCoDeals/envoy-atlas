import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useColdCallAnalytics, DateRange, ColdCall } from '@/hooks/useColdCallAnalytics';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { TopStatsRow, TopStatsData } from '@/components/calling/TopStatsRow';
import { TopCallsFilters, TopCallsFiltersState, DispositionFilter } from '@/components/calling/TopCallsFilters';
import { ExpandableCallRow } from '@/components/calling/ExpandableCallRow';
import { RepLeaderboard, RepStats } from '@/components/calling/RepLeaderboard';
import { EnhancedPatternAnalysis } from '@/components/calling/EnhancedPatternAnalysis';
import { TrendsMiniCharts } from '@/components/calling/TrendsMiniCharts';
import { CallsNeedingReview } from '@/components/calling/CallsNeedingReview';
import { ScoringInfoTooltip } from '@/components/calling/ScoringInfoTooltip';
import { calculateScoreBreakdown } from '@/lib/callScoring';
import { formatScore, formatCallingDuration } from '@/lib/callingConfig';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Trophy,
  Play,
  FileText,
  BookOpen,
  Star,
  Loader2,
  Phone,
  Flame,
  Calendar,
  Clock,
} from 'lucide-react';
import { format, parseISO, subWeeks, startOfWeek, endOfWeek } from 'date-fns';

type LeaderboardTab = 'top_scored' | 'meetings' | 'longest' | 'hot_leads';

export default function TopCallsWeek() {
  // Filters state
  const [filters, setFilters] = useState<TopCallsFiltersState>({
    dateRange: '7d',
    selectedReps: [],
    disposition: 'all',
    minScore: 0,
  });
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('top_scored');
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  // Data hooks - use current and previous period for WoW comparison
  const { data, isLoading } = useColdCallAnalytics(filters.dateRange);
  const prevPeriod = filters.dateRange === '7d' ? '14d' : 
                     filters.dateRange === '14d' ? '30d' : 
                     filters.dateRange === '30d' ? '90d' : 'all';
  const { data: prevData } = useColdCallAnalytics(prevPeriod);
  const { config } = useCallingConfig();

  // Get unique reps for filter
  const availableReps = useMemo(() => {
    if (!data?.calls) return [];
    const reps = new Set<string>();
    data.calls.forEach(c => {
      if (c.analyst) reps.add(c.analyst);
    });
    return Array.from(reps).sort();
  }, [data?.calls]);

  // Apply filters to calls
  const filteredCalls = useMemo(() => {
    if (!data?.calls) return [];
    
    return data.calls.filter(call => {
      // Rep filter
      if (filters.selectedReps.length > 0 && !filters.selectedReps.includes(call.analyst || '')) {
        return false;
      }
      
      // Disposition filter
      if (filters.disposition === 'dm_only' && !(call.is_connection && call.seller_interest_score !== null)) {
        return false;
      }
      if (filters.disposition === 'meetings_only' && !call.is_meeting) {
        return false;
      }
      if (filters.disposition === 'connections' && !call.is_connection) {
        return false;
      }
      
      // Min score filter
      if (filters.minScore > 0 && (call.composite_score || 0) < filters.minScore) {
        return false;
      }
      
      return true;
    });
  }, [data?.calls, filters]);

  // Compute top stats with WoW comparison
  const topStats: TopStatsData = useMemo(() => {
    const current = filteredCalls;
    const prev = prevData?.calls || [];
    
    const currentConnections = current.filter(c => c.is_connection).length;
    const currentMeetings = current.filter(c => c.is_meeting).length;
    const currentDmConvos = current.filter(c => c.is_connection && c.seller_interest_score !== null).length;
    const currentAvgDuration = current.length > 0 
      ? current.reduce((sum, c) => sum + (c.call_duration_sec || 0), 0) / current.length 
      : 0;
    const currentAvgScore = current.length > 0
      ? current.reduce((sum, c) => sum + (c.composite_score || 0), 0) / current.length
      : 0;
    
    const prevConnections = prev.filter(c => c.is_connection).length;
    const prevMeetings = prev.filter(c => c.is_meeting).length;
    const prevDmConvos = prev.filter(c => c.is_connection && c.seller_interest_score !== null).length;
    const prevAvgDuration = prev.length > 0 
      ? prev.reduce((sum, c) => sum + (c.call_duration_sec || 0), 0) / prev.length 
      : 0;
    const prevAvgScore = prev.length > 0
      ? prev.reduce((sum, c) => sum + (c.composite_score || 0), 0) / prev.length
      : 0;

    return {
      totalCalls: current.length,
      totalCallsPrev: prev.length,
      dmConnectRate: current.length > 0 ? (currentDmConvos / current.length) * 100 : 0,
      dmConnectRatePrev: prev.length > 0 ? (prevDmConvos / prev.length) * 100 : 0,
      meetingsSet: currentMeetings,
      meetingsSetPrev: prevMeetings,
      avgDuration: currentAvgDuration,
      avgDurationPrev: prevAvgDuration,
      avgScore: currentAvgScore,
      avgScorePrev: prevAvgScore,
    };
  }, [filteredCalls, prevData?.calls]);

  // Get calls for each tab
  const tabCalls = useMemo(() => {
    const topScored = [...filteredCalls]
      .sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0))
      .slice(0, 10);
    
    const meetings = filteredCalls
      .filter(c => c.is_meeting)
      .sort((a, b) => new Date(b.called_date || 0).getTime() - new Date(a.called_date || 0).getTime())
      .slice(0, 10);
    
    const longest = [...filteredCalls]
      .sort((a, b) => (b.call_duration_sec || 0) - (a.call_duration_sec || 0))
      .slice(0, 10);
    
    const hotLeads = filteredCalls
      .filter(c => (c.seller_interest_score || 0) >= 7)
      .sort((a, b) => (b.seller_interest_score || 0) - (a.seller_interest_score || 0))
      .slice(0, 10);
    
    return { top_scored: topScored, meetings, longest, hot_leads: hotLeads };
  }, [filteredCalls]);

  // Rep leaderboard stats
  const repStats: RepStats[] = useMemo(() => {
    if (!data?.repPerformance) return [];
    
    return data.repPerformance.map(rep => ({
      analyst: rep.rep,
      totalCalls: rep.totalCalls,
      dmConnections: rep.connections,
      connectRate: rep.totalCalls > 0 ? (rep.connections / rep.totalCalls) * 100 : 0,
      meetingsSet: rep.meetings,
      avgScore: rep.avgOverallScore || 0,
      avgDuration: rep.avgDuration,
      trend: 0, // Would need previous period data per rep
    }));
  }, [data?.repPerformance]);

  // Weekly trends for mini charts
  const weeklyTrends = useMemo(() => {
    if (!data?.dailyTrends || data.dailyTrends.length === 0) return [];
    
    // Group by week
    const weekMap = new Map<string, { calls: ColdCall[]; dates: string[] }>();
    
    data.dailyTrends.forEach(day => {
      const weekStart = format(startOfWeek(parseISO(day.date)), 'MMM d');
      if (!weekMap.has(weekStart)) {
        weekMap.set(weekStart, { calls: [], dates: [] });
      }
      weekMap.get(weekStart)!.dates.push(day.date);
    });

    // Match calls to weeks
    filteredCalls.forEach(call => {
      if (call.called_date) {
        const weekStart = format(startOfWeek(parseISO(call.called_date)), 'MMM d');
        if (weekMap.has(weekStart)) {
          weekMap.get(weekStart)!.calls.push(call);
        }
      }
    });

    return Array.from(weekMap.entries())
      .map(([week, { calls }]) => ({
        week,
        avgScore: calls.length > 0 
          ? calls.reduce((sum, c) => sum + (c.composite_score || 0), 0) / calls.length 
          : 0,
        connectRate: calls.length > 0 
          ? (calls.filter(c => c.is_connection).length / calls.length) * 100 
          : 0,
        meetings: calls.filter(c => c.is_meeting).length,
      }))
      .slice(-8); // Last 8 weeks
  }, [data?.dailyTrends, filteredCalls]);

  // Get best call for "Call of the Week"
  const callOfTheWeek = tabCalls.top_scored[0];

  // Handle rep click to filter
  const handleRepClick = (analyst: string) => {
    const newReps = filters.selectedReps.includes(analyst)
      ? filters.selectedReps.filter(r => r !== analyst)
      : [...filters.selectedReps, analyst];
    setFilters({ ...filters, selectedReps: newReps });
  };

  const currentTabCalls = tabCalls[activeTab];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Top Calls</h1>
            <p className="text-muted-foreground">
              Performance dashboard for cold calling excellence
            </p>
          </div>
          <ScoringInfoTooltip variant="button" />
        </div>

        {/* Top Stats Row */}
        <TopStatsRow data={topStats} isLoading={isLoading} />

        {/* Filters */}
        <TopCallsFilters
          filters={filters}
          onFiltersChange={setFilters}
          availableReps={availableReps}
          isLoading={isLoading}
        />

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content - Leaderboard */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      Call Leaderboard
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {filteredCalls.length} calls
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Tabs */}
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LeaderboardTab)}>
                    <TabsList className="grid w-full grid-cols-4 mb-4">
                      <TabsTrigger value="top_scored" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Top Scored
                      </TabsTrigger>
                      <TabsTrigger value="meetings" className="text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        Meetings
                      </TabsTrigger>
                      <TabsTrigger value="longest" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Longest
                      </TabsTrigger>
                      <TabsTrigger value="hot_leads" className="text-xs">
                        <Flame className="h-3 w-3 mr-1" />
                        Hot Leads
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab Content */}
                    <ScrollArea className="h-[600px] pr-2">
                      <div className="space-y-3">
                        {currentTabCalls.length > 0 ? (
                          currentTabCalls.map((call, index) => (
                            <ExpandableCallRow
                              key={call.id}
                              call={call}
                              rank={index + 1}
                            />
                          ))
                        ) : (
                          <div className="text-center py-12 text-muted-foreground">
                            <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No calls match the current filters</p>
                            <p className="text-sm mt-1">Try adjusting your filter criteria</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Calls Needing Review */}
              <CallsNeedingReview 
                calls={filteredCalls} 
                isLoading={isLoading}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Rep Leaderboard */}
              <RepLeaderboard
                reps={repStats}
                onRepClick={handleRepClick}
                selectedReps={filters.selectedReps}
                isLoading={isLoading}
              />

              {/* Pattern Analysis */}
              <EnhancedPatternAnalysis
                topCalls={tabCalls.top_scored}
                allCalls={filteredCalls}
                isLoading={isLoading}
              />

              {/* Trends Mini Charts */}
              <TrendsMiniCharts data={weeklyTrends} isLoading={isLoading} />

              {/* Hot Leads Quick View */}
              {tabCalls.hot_leads.length > 0 && (
                <Card className="border-orange-500/30 bg-orange-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Flame className="h-5 w-5 text-orange-500" />
                      Hot Leads
                    </CardTitle>
                    <CardDescription>
                      Interest score ≥ {config.hotLeadInterestScore}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {tabCalls.hot_leads.slice(0, 5).map(lead => (
                        <div key={lead.id} className="flex items-center justify-between text-sm p-2 rounded hover:bg-accent/50 transition-colors">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{lead.to_name || lead.to_number}</p>
                            <p className="text-xs text-muted-foreground">{lead.analyst?.split('@')[0]}</p>
                          </div>
                          <Badge variant="outline" className="text-orange-500 shrink-0">
                            {formatScore(lead.seller_interest_score, config)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Call of the Week */}
              {callOfTheWeek && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Star className="h-5 w-5 text-yellow-500" />
                      Call of the Week
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium">{callOfTheWeek.to_name || callOfTheWeek.to_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {callOfTheWeek.analyst?.split('@')[0]}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-yellow-500">
                          Score: {formatScore(callOfTheWeek.composite_score, config)}
                        </Badge>
                        <Badge variant="outline">
                          {formatCallingDuration(callOfTheWeek.call_duration_sec)}
                        </Badge>
                        {callOfTheWeek.is_meeting && (
                          <Badge className="bg-blue-500">Meeting Set</Badge>
                        )}
                      </div>
                      {callOfTheWeek.call_recording_url && (
                        <Button variant="outline" className="w-full" asChild>
                          <a href={callOfTheWeek.call_recording_url} target="_blank" rel="noopener noreferrer">
                            <Play className="h-4 w-4 mr-2" />
                            Listen to Call
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Training Module CTA */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Create Training</CardTitle>
                  <CardDescription>Turn patterns into learning modules</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Create Training Module
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Generate from top call patterns
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
