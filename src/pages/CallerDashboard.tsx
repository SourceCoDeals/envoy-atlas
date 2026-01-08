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
      // Fetch rep profile
      const { data: profile } = await supabase
        .from('rep_profiles')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setRepProfile(profile);

        // Fetch today's metrics from engagement_daily_metrics
        const today = new Date().toISOString().split('T')[0];
        const { data: todayMetrics } = await supabase
          .from('engagement_daily_metrics')
          .select('*')
          .eq('rep_profile_id', profile.id)
          .eq('date', today);

        if (todayMetrics && todayMetrics.length > 0) {
          const totals = todayMetrics.reduce(
            (acc, m) => ({
              dials: acc.dials + (m.dials || 0),
              connects: acc.connects + (m.connects || 0),
              conversations: acc.conversations + (m.conversations || 0),
              meetings: acc.meetings + (m.meetings_set || 0),
              talkTimeSeconds: acc.talkTimeSeconds + (m.talk_time_seconds || 0),
            }),
            { dials: 0, connects: 0, conversations: 0, meetings: 0, talkTimeSeconds: 0 }
          );
          setTodayActivity(totals);
        }

        // Fetch goals
        const { data: repGoals } = await supabase
          .from('rep_goals')
          .select('*')
          .eq('rep_profile_id', profile.id);

        if (repGoals) {
          setGoals(
            repGoals.map((g) => ({
              label: g.goal_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
              current: 0, // Would calculate from actual data
              target: g.target_value,
              unit: g.goal_type === 'ai_score' ? 'pts' : g.goal_type.includes('rate') ? '%' : '',
            }))
          );
        }

        // Fetch coaching recommendations
        const { data: coaching } = await supabase
          .from('ai_coaching_recommendations')
          .select('*')
          .eq('rep_profile_id', profile.id)
          .eq('is_acknowledged', false)
          .order('created_at', { ascending: false })
          .limit(4);

        if (coaching) {
          setCoachingTips(
            coaching.map((c) => ({
              type: c.recommendation_type as 'strength' | 'improvement',
              title: c.title,
              description: c.description,
            }))
          );
        }
      }

      // Generate sample trend data (would come from real data)
      const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      setTrendData(
        weeks.map((week, i) => ({
          week,
          meetingRate: 3 + Math.random() * 2,
          aiScore: 65 + i * 5 + Math.random() * 5,
        }))
      );

      // Sample team rank
      setTeamRank({ rank: 3, total: 8, vsAvg: '+12%' });
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
