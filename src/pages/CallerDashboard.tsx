import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

export default function CallerDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [repProfile, setRepProfile] = useState<RepProfile | null>(null);
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
      fetchCallerData();
    }
  }, [currentWorkspace?.id, user?.id]);

  const fetchCallerData = async () => {
    if (!currentWorkspace?.id || !user?.id) return;
    setLoading(true);

    try {
      // Get user's email for matching with external_calls host_email or rep_name
      const userEmail = user.email || '';

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
      const { data: allCalls } = await supabase
        .from('external_calls')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .not('composite_score', 'is', null);

      if (!allCalls || allCalls.length === 0) {
        setLoading(false);
        return;
      }

      // Filter for user's calls - match by rep_name (Analyst field from NocoDB) or host_email
      const userNamePrefix = userEmail.toLowerCase().split('@')[0] || '';
      const profileName = profile ? `${profile.first_name} ${profile.last_name}`.toLowerCase() : '';
      
      const myCalls = allCalls.filter(c => {
        // Match by rep_name (Analyst from NocoDB)
        const repName = (c.rep_name || '').toLowerCase();
        // Match by host_email
        const hostEmail = (c.host_email || '').toLowerCase();
        
        return (
          repName.includes(userNamePrefix) ||
          repName.includes(profileName) ||
          hostEmail.includes(userNamePrefix)
        );
      });

      // Today's activity - use call_category for more accurate categorization
      const today = new Date().toISOString().split('T')[0];
      const todayCalls = myCalls.filter(c => 
        c.date_time?.startsWith(today) || c.call_date === today
      );
      
      const dials = todayCalls.length;
      // Connections = calls with category "Connection" or seller_interest >= 3
      const connects = todayCalls.filter(c => 
        c.call_category?.toLowerCase() === 'connection' || (c.seller_interest_score || 0) >= 3
      ).length;
      // Conversations = high quality calls (score >= 5) or specific categories
      const conversations = todayCalls.filter(c => 
        (c.composite_score || 0) >= 5 || 
        ['conversation', 'interested', 'meeting'].includes((c.call_category || '').toLowerCase())
      ).length;
      // Meetings = high interest calls (seller_interest >= 7)
      const meetings = todayCalls.filter(c => (c.seller_interest_score || 0) >= 7).length;
      const talkTimeSeconds = todayCalls.reduce((sum, c) => sum + (c.duration || 0), 0);

      setTodayActivity({ dials, connects, conversations, meetings, talkTimeSeconds });

      // Goals - calculate from actual data
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekCalls = myCalls.filter(c => 
        (c.date_time && new Date(c.date_time) >= weekAgo) ||
        (c.call_date && new Date(c.call_date) >= weekAgo)
      );
      const weekDials = weekCalls.length;
      const weekConnects = weekCalls.filter(c => 
        c.call_category?.toLowerCase() === 'connection' || (c.seller_interest_score || 0) >= 3
      ).length;
      const weekMeetings = weekCalls.filter(c => (c.seller_interest_score || 0) >= 7).length;
      const avgScore = weekCalls.length > 0 
        ? weekCalls.reduce((sum, c) => sum + (c.composite_score || 0), 0) / weekCalls.length 
        : 0;

      setGoals([
        { label: 'Weekly Dials', current: weekDials, target: 100, unit: '' },
        { label: 'Connects', current: weekConnects, target: 30, unit: '' },
        { label: 'Meetings Set', current: weekMeetings, target: 5, unit: '' },
        { label: 'AI Score Avg', current: Math.round(avgScore * 10) / 10, target: 7, unit: 'pts' },
      ]);

      // Coaching tips from call patterns
      const lowScoreCalls = weekCalls.filter(c => (c.composite_score || 0) < 5);
      const highScoreCalls = weekCalls.filter(c => (c.composite_score || 0) >= 7);
      const tips: CoachingTip[] = [];

      if (highScoreCalls.length > 0) {
        tips.push({
          type: 'strength',
          title: `${highScoreCalls.length} high-quality calls this week`,
          description: 'Your conversation quality is strong. Keep building rapport early.',
        });
      }
      if (lowScoreCalls.length > 3) {
        tips.push({
          type: 'improvement',
          title: 'Focus on objection handling',
          description: `${lowScoreCalls.length} calls scored below 5. Review objection responses.`,
        });
      }
      if (weekConnects > 0 && weekMeetings === 0) {
        tips.push({
          type: 'improvement',
          title: 'Convert connections to meetings',
          description: 'You had connects but no meetings. Work on stronger closes.',
        });
      }
      if (avgScore >= 6.5) {
        tips.push({
          type: 'strength',
          title: `Strong AI score: ${avgScore.toFixed(1)}`,
          description: 'Your call quality is above average. Great work!',
        });
      }
      setCoachingTips(tips.slice(0, 4));

      // 4-week trend data
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const recentTrendCalls = myCalls.filter(c => 
        (c.date_time && new Date(c.date_time) >= fourWeeksAgo) ||
        (c.call_date && new Date(c.call_date) >= fourWeeksAgo)
      );
      
      const weeklyData: { week: string; meetingRate: number; aiScore: number }[] = [];
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        
        const weekTrendCalls = recentTrendCalls.filter(c => {
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

      // Team rank calculation - use rep_name for grouping
      const repStats = new Map<string, { calls: number; totalScore: number }>();
      allCalls.forEach(c => {
        // Use rep_name if available, otherwise host_email
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

      // Match user by rep_name or host_email
      const myRankIdx = rankings.findIndex(r => {
        const repLower = r.name.toLowerCase();
        return (
          repLower.includes(userNamePrefix) ||
          repLower.includes(profileName)
        );
      });
      const teamAvg = rankings.reduce((sum, r) => sum + r.avgScore, 0) / rankings.length;
      const myAvg = myRankIdx >= 0 ? rankings[myRankIdx].avgScore : 0;
      const vsAvgPct = teamAvg > 0 ? ((myAvg - teamAvg) / teamAvg) * 100 : 0;

      setTeamRank({
        rank: myRankIdx >= 0 ? myRankIdx + 1 : rankings.length,
        total: rankings.length,
        vsAvg: `${vsAvgPct >= 0 ? '+' : ''}${vsAvgPct.toFixed(0)}%`,
      });

      // Best and worst calls this week
      const sortedWeekCalls = [...weekCalls].sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0));
      
      if (sortedWeekCalls.length > 0) {
        const best = sortedWeekCalls[0];
        setBestCall({
          id: best.id,
          time: best.date_time || '',
          contact: best.contact_name || 'Unknown Contact',
          company: best.company_name || 'Unknown Company',
          outcome: best.call_category || 'Scored',
          aiScore: best.composite_score,
        });
      }

      if (sortedWeekCalls.length > 1) {
        const worst = sortedWeekCalls[sortedWeekCalls.length - 1];
        setWorstCall({
          id: worst.id,
          time: worst.date_time || '',
          contact: worst.contact_name || 'Unknown Contact',
          company: worst.company_name || 'Unknown Company',
          outcome: worst.call_category || 'Needs Review',
          aiScore: worst.composite_score,
        });
      }

    } catch (err) {
      console.error('Error fetching caller data:', err);
    } finally {
      setLoading(false);
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {repProfile ? `Welcome back, ${repProfile.first_name}` : 'Caller Dashboard'}
          </h1>
          <p className="text-muted-foreground">Your personal performance command center</p>
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
            {/* Today's Activity */}
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{todayActivity.dials}</p>
                      <p className="text-sm text-muted-foreground">Dials Today</p>
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
                  <CardTitle className="text-lg">Goal Progress</CardTitle>
                  <CardDescription>Your targets this week</CardDescription>
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
                    Best Call This Week
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
