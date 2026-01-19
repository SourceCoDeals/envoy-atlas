import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Phone,
  PhoneCall,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  Star,
  AlertTriangle,
  ChevronRight,
  Trophy,
  Zap,
  Loader2,
  Users,
  Filter,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useExternalCalls, filterCalls, isConnection, DateRangeOption, DATE_RANGE_OPTIONS } from '@/hooks/useExternalCalls';

interface TodayActivity {
  dials: number;
  connects: number;
  conversations: number;
  meetings: number;
  talkTimeSeconds: number;
}

interface GoalProgress {
  label: string;
  current: number;
  target: number;
  unit: string;
}

interface CoachingTip {
  type: 'strength' | 'improvement';
  title: string;
  description: string;
}

interface RecentCall {
  id: string;
  time: string;
  contact: string;
  company: string;
  outcome: string;
  duration: number | null;
}

export default function CallerDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { calls: allCalls, analysts, loading, totalCount } = useExternalCalls();
  
  // Filters
  const [dateRange, setDateRange] = useState<DateRangeOption>('last_week');
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('all');

  // Auth not required - public read access enabled

  // Process data based on filters
  const { todayActivity, goals, coachingTips, trendData, teamRank, bestCall, worstCall } = useMemo(() => {
    const filteredCalls = filterCalls(allCalls, dateRange, selectedAnalyst);

    // Activity metrics for the selected period
    const dials = filteredCalls.length;
    const connects = filteredCalls.filter(c => isConnection(c)).length;
    const conversations = filteredCalls.filter(c => (c.talk_duration || 0) > 60).length;
    const meetings = filteredCalls.filter(c => 
      (c.conversation_outcome || '').toLowerCase().includes('meeting')
    ).length;
    const talkTimeSeconds = filteredCalls.reduce((sum, c) => sum + (c.talk_duration || 0), 0);

    const todayActivity: TodayActivity = { dials, connects, conversations, meetings, talkTimeSeconds };

    // Goals - calculated from filtered data
    const goals: GoalProgress[] = [
      { label: 'Total Dials', current: dials, target: 100, unit: '' },
      { label: 'Connects', current: connects, target: 30, unit: '' },
      { label: 'Meetings Set', current: meetings, target: 5, unit: '' },
      { label: 'Talk Time', current: Math.round(talkTimeSeconds / 60), target: 120, unit: 'min' },
    ];

    // Coaching tips from call patterns
    const tips: CoachingTip[] = [];

    const longCalls = filteredCalls.filter(c => (c.talk_duration || 0) > 120).length;
    if (longCalls > 0) {
      tips.push({
        type: 'strength',
        title: `${longCalls} quality conversations`,
        description: 'You had extended conversations. Keep building rapport early.',
      });
    }
    
    const shortCalls = filteredCalls.filter(c => (c.talk_duration || 0) < 30 && (c.talk_duration || 0) > 0).length;
    if (shortCalls > dials * 0.5 && dials > 5) {
      tips.push({
        type: 'improvement',
        title: 'Improve call duration',
        description: `${shortCalls} calls were under 30 seconds. Focus on stronger openers.`,
      });
    }
    
    if (connects > 0 && meetings === 0) {
      tips.push({
        type: 'improvement',
        title: 'Convert connections to meetings',
        description: 'Had connects but no meetings. Work on stronger closes.',
      });
    }

    // 4-week trend data
    const weeklyData: { week: string; dials: number; connects: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      
      const weekCalls = allCalls.filter(c => {
        const d = c.date_time ? new Date(c.date_time) : null;
        if (!d) return false;
        if (selectedAnalyst !== 'all' && c.caller_name !== selectedAnalyst) return false;
        return d >= weekStart && d < weekEnd;
      });
      
      weeklyData.push({
        week: `Week ${4 - i}`,
        dials: weekCalls.length,
        connects: weekCalls.filter(c => isConnection(c)).length,
      });
    }

    // Team rank calculation
    const repStats = new Map<string, { calls: number; totalDuration: number }>();
    allCalls.forEach(c => {
      const rep = c.caller_name || 'Unknown';
      if (!repStats.has(rep)) repStats.set(rep, { calls: 0, totalDuration: 0 });
      const stats = repStats.get(rep)!;
      stats.calls++;
      stats.totalDuration += c.talk_duration || 0;
    });

    const rankings = Array.from(repStats.entries())
      .map(([name, stats]) => ({
        name,
        avgDuration: stats.calls > 0 ? stats.totalDuration / stats.calls : 0,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration);

    const targetAnalyst = selectedAnalyst !== 'all' ? selectedAnalyst : null;
    const myRankIdx = rankings.findIndex(r => targetAnalyst ? r.name === targetAnalyst : false);
    
    const teamAvg = rankings.length > 0 ? rankings.reduce((sum, r) => sum + r.avgDuration, 0) / rankings.length : 0;
    const myAvg = myRankIdx >= 0 ? rankings[myRankIdx].avgDuration : 0;
    const vsAvgPct = teamAvg > 0 ? ((myAvg - teamAvg) / teamAvg) * 100 : 0;

    const teamRank = {
      rank: myRankIdx >= 0 ? myRankIdx + 1 : rankings.length,
      total: rankings.length,
      vsAvg: `${vsAvgPct >= 0 ? '+' : ''}${vsAvgPct.toFixed(0)}%`,
    };

    // Best and worst calls in the filtered period
    const sortedCalls = [...filteredCalls].sort((a, b) => (b.talk_duration || 0) - (a.talk_duration || 0));
    
    const bestCall: RecentCall | null = sortedCalls.length > 0 ? {
      id: sortedCalls[0].id,
      time: sortedCalls[0].date_time || '',
      contact: sortedCalls[0].contact_name || 'Unknown Contact',
      company: sortedCalls[0].company_name || 'Unknown Company',
      outcome: sortedCalls[0].disposition || 'Connected',
      duration: sortedCalls[0].talk_duration,
    } : null;

    const worstCall: RecentCall | null = sortedCalls.length > 1 ? {
      id: sortedCalls[sortedCalls.length - 1].id,
      time: sortedCalls[sortedCalls.length - 1].date_time || '',
      contact: sortedCalls[sortedCalls.length - 1].contact_name || 'Unknown Contact',
      company: sortedCalls[sortedCalls.length - 1].company_name || 'Unknown Company',
      outcome: sortedCalls[sortedCalls.length - 1].disposition || 'Short Call',
      duration: sortedCalls[sortedCalls.length - 1].talk_duration,
    } : null;

    return { 
      todayActivity, 
      goals, 
      coachingTips: tips.slice(0, 4), 
      trendData: weeklyData, 
      teamRank, 
      bestCall, 
      worstCall 
    };
  }, [allCalls, dateRange, selectedAnalyst]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const dateRangeLabel = DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label || 'Selected Period';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {selectedAnalyst !== 'all' ? selectedAnalyst : 'Caller Dashboard'}
            </h1>
            <p className="text-muted-foreground">Performance metrics for {dateRangeLabel.toLowerCase()}</p>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeOption)}>
                <SelectTrigger className="w-[140px]">
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
            </div>
            
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedAnalyst} onValueChange={setSelectedAnalyst}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select analyst" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Analysts</SelectItem>
                  {analysts.map(analyst => (
                    <SelectItem key={analyst} value={analyst}>
                      {analyst}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Activity for Selected Period */}
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{todayActivity.dials}</p>
                      <p className="text-sm text-muted-foreground">Total Dials</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                      <PhoneCall className="h-5 w-5 text-chart-2" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{todayActivity.connects}</p>
                      <p className="text-sm text-muted-foreground">Connects</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                      <Target className="h-5 w-5 text-chart-3" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{todayActivity.conversations}</p>
                      <p className="text-sm text-muted-foreground">Conversations</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-chart-4" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{todayActivity.meetings}</p>
                      <p className="text-sm text-muted-foreground">Meetings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-chart-5/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-chart-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{formatDuration(todayActivity.talkTimeSeconds)}</p>
                      <p className="text-sm text-muted-foreground">Talk Time</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Goal Progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Goal Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {goals.map((goal, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{goal.label}</span>
                        <span className="text-muted-foreground">
                          {goal.current} / {goal.target} {goal.unit}
                        </span>
                      </div>
                      <Progress value={Math.min((goal.current / goal.target) * 100, 100)} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Coaching Tips */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Coaching Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {coachingTips.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No insights available yet. Make more calls!</p>
                  ) : (
                    coachingTips.map((tip, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-lg ${
                          tip.type === 'strength' ? 'bg-green-500/10' : 'bg-amber-500/10'
                        }`}
                      >
                        {tip.type === 'strength' ? (
                          <Star className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{tip.title}</p>
                          <p className="text-xs text-muted-foreground">{tip.description}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Weekly Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    4-Week Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {trendData.length > 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="dials"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            name="Dials"
                          />
                          <Line
                            type="monotone"
                            dataKey="connects"
                            stroke="hsl(var(--chart-2))"
                            strokeWidth={2}
                            name="Connects"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No trend data available</p>
                  )}
                </CardContent>
              </Card>

              {/* Team Ranking */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Team Ranking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center gap-8 py-4">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-primary">#{teamRank.rank}</p>
                      <p className="text-sm text-muted-foreground">of {teamRank.total}</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${teamRank.vsAvg.startsWith('+') ? 'text-green-500' : 'text-amber-500'}`}>
                        {teamRank.vsAvg}
                      </p>
                      <p className="text-sm text-muted-foreground">vs team avg</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {bestCall && (
                      <div className="p-3 rounded-lg bg-green-500/10">
                        <p className="text-xs text-muted-foreground mb-1">Best Call</p>
                        <p className="font-medium text-sm">{bestCall.contact}</p>
                        <p className="text-xs text-muted-foreground">
                          {bestCall.duration ? `${Math.round(bestCall.duration / 60)}min` : 'N/A'}
                        </p>
                      </div>
                    )}
                    {worstCall && (
                      <div className="p-3 rounded-lg bg-amber-500/10">
                        <p className="text-xs text-muted-foreground mb-1">Shortest Call</p>
                        <p className="font-medium text-sm">{worstCall.contact}</p>
                        <p className="text-xs text-muted-foreground">
                          {worstCall.duration ? `${Math.round(worstCall.duration / 60)}min` : 'N/A'}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}