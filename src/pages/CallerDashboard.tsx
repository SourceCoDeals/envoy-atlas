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
import { supabase } from '@/integrations/supabase/client';
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

interface RepProfile {
  id: string;
  first_name: string;
  last_name: string;
}

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
  aiScore: number | null;
}

type DateRangeOption = 'today' | 'last_week' | 'last_2_weeks' | 'last_month' | 'all_time';

const DATE_RANGE_OPTIONS: { value: DateRangeOption; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last_week', label: 'Last 7 Days' },
  { value: 'last_2_weeks', label: 'Last 14 Days' },
  { value: 'last_month', label: 'Last 30 Days' },
  { value: 'all_time', label: 'All Time' },
];

export default function CallerDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [repProfile, setRepProfile] = useState<RepProfile | null>(null);
  const [allCalls, setAllCalls] = useState<any[]>([]);
  const [analysts, setAnalysts] = useState<string[]>([]);
  
  // Filters
  const [dateRange, setDateRange] = useState<DateRangeOption>('last_week');
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('all');
  
  const [todayActivity, setTodayActivity] = useState<TodayActivity>({
    dials: 0,
    connects: 0,
    conversations: 0,
    meetings: 0,
    talkTimeSeconds: 0,
  });
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [coachingTips, setCoachingTips] = useState<CoachingTip[]>([]);
  const [trendData, setTrendData] = useState<{ week: string; meetingRate: number; aiScore: number }[]>([]);
  const [teamRank, setTeamRank] = useState<{ rank: number; total: number; vsAvg: string } | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [bestCall, setBestCall] = useState<RecentCall | null>(null);
  const [worstCall, setWorstCall] = useState<RecentCall | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id && user?.id) {
      fetchAllCalls();
    }
  }, [currentWorkspace?.id, user?.id]);

  // Re-process data when filters change
  useEffect(() => {
    if (allCalls.length > 0) {
      processCallerData();
    }
  }, [dateRange, selectedAnalyst, allCalls]);

  const getDateRangeStart = (range: DateRangeOption): Date | null => {
    const now = new Date();
    switch (range) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'last_week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return weekAgo;
      case 'last_2_weeks':
        const twoWeeksAgo = new Date(now);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        return twoWeeksAgo;
      case 'last_month':
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return monthAgo;
      case 'all_time':
        return null;
    }
  };

  const fetchAllCalls = async () => {
    if (!currentWorkspace?.id || !user?.id) return;
    setLoading(true);

    try {
      // Fetch rep profile
      const { data: profile } = await supabase
        .from('rep_profiles')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile) {
        setRepProfile(profile);
      }

      // Fetch all calls from external_calls
      const { data: calls } = await supabase
        .from('external_calls')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .not('composite_score', 'is', null);

      if (!calls || calls.length === 0) {
        setLoading(false);
        return;
      }

      setAllCalls(calls);

      // Extract unique analysts
      const uniqueAnalysts = new Set<string>();
      calls.forEach(c => {
        const analyst = c.rep_name || c.host_email;
        if (analyst) {
          uniqueAnalysts.add(analyst);
        }
      });
      setAnalysts(Array.from(uniqueAnalysts).sort());

    } catch (err) {
      console.error('Error fetching calls:', err);
    } finally {
      setLoading(false);
    }
  };

  const processCallerData = () => {
    if (allCalls.length === 0) return;

    const rangeStart = getDateRangeStart(dateRange);
    
    // Filter calls by date range and analyst
    let filteredCalls = allCalls.filter(c => {
      const callDate = c.date_time ? new Date(c.date_time) : c.call_date ? new Date(c.call_date) : null;
      if (!callDate) return false;
      if (rangeStart && callDate < rangeStart) return false;
      return true;
    });

    // Filter by selected analyst
    if (selectedAnalyst !== 'all') {
      filteredCalls = filteredCalls.filter(c => {
        const analyst = c.rep_name || c.host_email || '';
        return analyst === selectedAnalyst;
      });
    }

    // Activity metrics for the selected period
    const dials = filteredCalls.length;
    const connects = filteredCalls.filter(c => 
      c.call_category?.toLowerCase() === 'connection' || (c.seller_interest_score || 0) >= 3
    ).length;
    const conversations = filteredCalls.filter(c => 
      (c.composite_score || 0) >= 5 || 
      ['conversation', 'interested', 'meeting'].includes((c.call_category || '').toLowerCase())
    ).length;
    const meetings = filteredCalls.filter(c => (c.seller_interest_score || 0) >= 7).length;
    const talkTimeSeconds = filteredCalls.reduce((sum, c) => sum + (c.duration || 0), 0);

    setTodayActivity({ dials, connects, conversations, meetings, talkTimeSeconds });

    // Goals - calculated from filtered data
    const avgScore = filteredCalls.length > 0 
      ? filteredCalls.reduce((sum, c) => sum + (c.composite_score || 0), 0) / filteredCalls.length 
      : 0;

    setGoals([
      { label: 'Total Dials', current: dials, target: 100, unit: '' },
      { label: 'Connects', current: connects, target: 30, unit: '' },
      { label: 'Meetings Set', current: meetings, target: 5, unit: '' },
      { label: 'AI Score Avg', current: Math.round(avgScore * 10) / 10, target: 7, unit: 'pts' },
    ]);

    // Coaching tips from call patterns
    const lowScoreCalls = filteredCalls.filter(c => (c.composite_score || 0) < 5);
    const highScoreCalls = filteredCalls.filter(c => (c.composite_score || 0) >= 7);
    const tips: CoachingTip[] = [];

    if (highScoreCalls.length > 0) {
      tips.push({
        type: 'strength',
        title: `${highScoreCalls.length} high-quality calls`,
        description: 'Conversation quality is strong. Keep building rapport early.',
      });
    }
    if (lowScoreCalls.length > 3) {
      tips.push({
        type: 'improvement',
        title: 'Focus on objection handling',
        description: `${lowScoreCalls.length} calls scored below 5. Review objection responses.`,
      });
    }
    if (connects > 0 && meetings === 0) {
      tips.push({
        type: 'improvement',
        title: 'Convert connections to meetings',
        description: 'Had connects but no meetings. Work on stronger closes.',
      });
    }
    if (avgScore >= 6.5) {
      tips.push({
        type: 'strength',
        title: `Strong AI score: ${avgScore.toFixed(1)}`,
        description: 'Call quality is above average. Great work!',
      });
    }
    setCoachingTips(tips.slice(0, 4));

    // 4-week trend data (uses all calls, respecting analyst filter only)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    let trendBaseCalls = allCalls.filter(c => {
      const callDate = c.date_time ? new Date(c.date_time) : c.call_date ? new Date(c.call_date) : null;
      return callDate && callDate >= fourWeeksAgo;
    });

    if (selectedAnalyst !== 'all') {
      trendBaseCalls = trendBaseCalls.filter(c => {
        const analyst = c.rep_name || c.host_email || '';
        return analyst === selectedAnalyst;
      });
    }
    
    const weeklyData: { week: string; meetingRate: number; aiScore: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      
      const weekTrendCalls = trendBaseCalls.filter(c => {
        const d = c.date_time ? new Date(c.date_time) : c.call_date ? new Date(c.call_date) : null;
        return d && d >= weekStart && d < weekEnd;
      });
      
      const weekTrendConnects = weekTrendCalls.filter(c => 
        c.call_category?.toLowerCase() === 'connection' || (c.seller_interest_score || 0) >= 3
      ).length;
      const weekTrendMeetings = weekTrendCalls.filter(c => (c.seller_interest_score || 0) >= 7).length;
      const avgTrendScore = weekTrendCalls.length > 0 
        ? weekTrendCalls.reduce((sum, c) => sum + (c.composite_score || 0), 0) / weekTrendCalls.length 
        : 0;
      
      weeklyData.push({
        week: `Week ${4 - i}`,
        meetingRate: weekTrendConnects > 0 ? (weekTrendMeetings / weekTrendConnects) * 100 : 0,
        aiScore: avgTrendScore,
      });
    }
    setTrendData(weeklyData);

    // Team rank calculation - use all calls (not filtered by date)
    const repStats = new Map<string, { calls: number; totalScore: number }>();
    allCalls.forEach(c => {
      const rep = c.rep_name || c.host_email || 'Unknown';
      if (!repStats.has(rep)) repStats.set(rep, { calls: 0, totalScore: 0 });
      const stats = repStats.get(rep)!;
      stats.calls++;
      stats.totalScore += c.composite_score || 0;
    });

    const rankings = Array.from(repStats.entries())
      .map(([name, stats]) => ({
        name,
        avgScore: stats.calls > 0 ? stats.totalScore / stats.calls : 0,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    // Find selected analyst's rank or current user's rank
    const targetAnalyst = selectedAnalyst !== 'all' ? selectedAnalyst : null;
    const myRankIdx = rankings.findIndex(r => {
      if (targetAnalyst) {
        return r.name === targetAnalyst;
      }
      // Fall back to matching by user email
      const userEmail = user?.email || '';
      const userNamePrefix = userEmail.toLowerCase().split('@')[0] || '';
      const repLower = r.name.toLowerCase();
      return repLower.includes(userNamePrefix);
    });
    
    const teamAvg = rankings.length > 0 ? rankings.reduce((sum, r) => sum + r.avgScore, 0) / rankings.length : 0;
    const myAvg = myRankIdx >= 0 ? rankings[myRankIdx].avgScore : 0;
    const vsAvgPct = teamAvg > 0 ? ((myAvg - teamAvg) / teamAvg) * 100 : 0;

    setTeamRank({
      rank: myRankIdx >= 0 ? myRankIdx + 1 : rankings.length,
      total: rankings.length,
      vsAvg: `${vsAvgPct >= 0 ? '+' : ''}${vsAvgPct.toFixed(0)}%`,
    });

    // Best and worst calls in the filtered period
    const sortedCalls = [...filteredCalls].sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0));
    
    if (sortedCalls.length > 0) {
      const best = sortedCalls[0];
      setBestCall({
        id: best.id,
        time: best.date_time || '',
        contact: best.contact_name || 'Unknown Contact',
        company: best.company_name || 'Unknown Company',
        outcome: best.call_category || 'Scored',
        aiScore: best.composite_score,
      });
    } else {
      setBestCall(null);
    }

    if (sortedCalls.length > 1) {
      const worst = sortedCalls[sortedCalls.length - 1];
      setWorstCall({
        id: worst.id,
        time: worst.date_time || '',
        contact: worst.contact_name || 'Unknown Contact',
        company: worst.company_name || 'Unknown Company',
        outcome: worst.call_category || 'Needs Review',
        aiScore: worst.composite_score,
      });
    } else {
      setWorstCall(null);
    }
  };

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
              {selectedAnalyst !== 'all' ? selectedAnalyst : repProfile ? `Welcome back, ${repProfile.first_name}` : 'Caller Dashboard'}
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
                    <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{todayActivity.meetings}</p>
                      <p className="text-sm text-muted-foreground">Meetings Set</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-chart-4" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{formatDuration(todayActivity.talkTimeSeconds)}</p>
                      <p className="text-sm text-muted-foreground">Talk Time</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Goal Progress + AI Coaching */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Goal Progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Summary</CardTitle>
                  <CardDescription>Metrics for {dateRangeLabel.toLowerCase()}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {goals.length > 0 ? (
                    goals.map((goal, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{goal.label}</span>
                          <span className="text-muted-foreground">
                            {goal.current} / {goal.target} {goal.unit}
                          </span>
                        </div>
                        <Progress value={(goal.current / goal.target) * 100} className="h-2" />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No goals set yet</p>
                      <Button variant="outline" size="sm" className="mt-2">
                        Set Goals
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Coaching Focus */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-chart-4" />
                    AI Coaching Focus
                  </CardTitle>
                  <CardDescription>Personalized insights from your calls</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {coachingTips.length > 0 ? (
                    coachingTips.map((tip, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          tip.type === 'strength'
                            ? 'border-success/30 bg-success/5'
                            : 'border-warning/30 bg-warning/5'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {tip.type === 'strength' ? (
                            <TrendingUp className="h-4 w-4 text-success mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                          )}
                          <div>
                            <p className="font-medium text-sm">{tip.title}</p>
                            <p className="text-xs text-muted-foreground">{tip.description}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Complete more calls for AI insights</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Trends + Team Comparison */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* My Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">My Trends</CardTitle>
                  <CardDescription>4-week performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="meetingRate"
                          stroke="hsl(var(--success))"
                          strokeWidth={2}
                          name="Meeting Rate %"
                          dot={{ fill: 'hsl(var(--success))' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="aiScore"
                          stroke="hsl(var(--chart-4))"
                          strokeWidth={2}
                          name="AI Score"
                          dot={{ fill: 'hsl(var(--chart-4))' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Team Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Team Comparison
                  </CardTitle>
                  <CardDescription>How you stack up</CardDescription>
                </CardHeader>
                <CardContent>
                  {teamRank ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-4 py-4">
                        <div className="text-center">
                          <p className="text-4xl font-bold">#{teamRank.rank}</p>
                          <p className="text-sm text-muted-foreground">of {teamRank.total} reps</p>
                        </div>
                        <div className="h-16 w-px bg-border" />
                        <div className="text-center">
                          <p className="text-2xl font-bold text-success">{teamRank.vsAvg}</p>
                          <p className="text-sm text-muted-foreground">vs team avg</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="p-2 rounded-lg bg-accent/50">
                          <p className="font-medium">Connect Rate</p>
                          <p className="text-muted-foreground">Top 20%</p>
                        </div>
                        <div className="p-2 rounded-lg bg-accent/50">
                          <p className="font-medium">Meeting Rate</p>
                          <p className="text-muted-foreground">Top 30%</p>
                        </div>
                        <div className="p-2 rounded-lg bg-accent/50">
                          <p className="font-medium">AI Score</p>
                          <p className="text-muted-foreground">Top 25%</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Team data loading...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Best/Worst This Week */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-success/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="h-5 w-5 text-success" />
                    Best Call ({dateRangeLabel})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {bestCall ? (
                    <div className="space-y-2">
                      <p className="font-medium">{bestCall.contact}</p>
                      <p className="text-sm text-muted-foreground">{bestCall.company}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                          Score: {bestCall.aiScore}
                        </Badge>
                        <Badge variant="outline">{bestCall.outcome}</Badge>
                      </div>
                      <Button variant="ghost" size="sm" className="mt-2">
                        Listen <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No scored calls this week</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-warning/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Learning Opportunity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {worstCall ? (
                    <div className="space-y-2">
                      <p className="font-medium">{worstCall.contact}</p>
                      <p className="text-sm text-muted-foreground">{worstCall.company}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                          Score: {worstCall.aiScore}
                        </Badge>
                        <Badge variant="outline">{worstCall.outcome}</Badge>
                      </div>
                      <Button variant="ghost" size="sm" className="mt-2">
                        Review <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No calls to review</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
