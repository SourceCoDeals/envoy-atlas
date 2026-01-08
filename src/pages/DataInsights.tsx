import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  Phone,
  PhoneCall,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
  BarChart3,
  Target,
  Users,
  Zap,
} from 'lucide-react';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface OverviewMetrics {
  totalCalls: number;
  totalConnects: number;
  totalMeetings: number;
  avgCallDuration: number;
  connectRate: number;
  meetingRate: number;
}

interface DispositionBreakdown {
  name: string;
  value: number;
}

interface AIScoreDistribution {
  range: string;
  count: number;
}

interface TrendData {
  week: string;
  calls: number;
  connects: number;
  meetings: number;
}

export default function DataInsights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [dispositions, setDispositions] = useState<DispositionBreakdown[]>([]);
  const [aiScores, setAIScores] = useState<AIScoreDistribution[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [topPerformers, setTopPerformers] = useState<{ name: string; score: number; calls: number }[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchDataInsights();
    }
  }, [currentWorkspace?.id]);

  const fetchDataInsights = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Fetch aggregate metrics from phoneburner_daily_metrics
      const { data: metrics } = await supabase
        .from('phoneburner_daily_metrics')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (metrics && metrics.length > 0) {
        const totals = metrics.reduce(
          (acc, m) => ({
            calls: acc.calls + (m.total_calls || 0),
            connects: acc.connects + (m.calls_connected || 0),
            meetings: acc.meetings + 0, // Would track meetings separately
            duration: acc.duration + (m.total_talk_time_seconds || 0),
          }),
          { calls: 0, connects: 0, meetings: 0, duration: 0 }
        );

        setOverview({
          totalCalls: totals.calls,
          totalConnects: totals.connects,
          totalMeetings: totals.meetings,
          avgCallDuration: totals.connects > 0 ? totals.duration / totals.connects : 0,
          connectRate: totals.calls > 0 ? (totals.connects / totals.calls) * 100 : 0,
          meetingRate: totals.connects > 0 ? (totals.meetings / totals.connects) * 100 : 0,
        });

        // Generate disposition breakdown (sample data)
        setDispositions([
          { name: 'Connected', value: totals.connects },
          { name: 'Voicemail', value: Math.floor(totals.calls * 0.4) },
          { name: 'No Answer', value: Math.floor(totals.calls * 0.25) },
          { name: 'Busy', value: Math.floor(totals.calls * 0.05) },
          { name: 'Other', value: Math.floor(totals.calls * 0.07) },
        ]);

        // Group by week for trends
        const weeklyData = new Map<string, { calls: number; connects: number; meetings: number }>();
        metrics.forEach((m) => {
          const week = new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const existing = weeklyData.get(week) || { calls: 0, connects: 0, meetings: 0 };
          weeklyData.set(week, {
            calls: existing.calls + (m.total_calls || 0),
            connects: existing.connects + (m.calls_connected || 0),
            meetings: existing.meetings,
          });
        });

        setTrends(
          Array.from(weeklyData.entries())
            .slice(-8)
            .map(([week, data]) => ({ week, ...data }))
        );
      }

      // Fetch AI score distribution
      const { data: scores } = await supabase
        .from('call_ai_scores')
        .select('composite_score')
        .eq('workspace_id', currentWorkspace.id);

      if (scores) {
        const ranges = [
          { range: '0-20', min: 0, max: 20, count: 0 },
          { range: '21-40', min: 21, max: 40, count: 0 },
          { range: '41-60', min: 41, max: 60, count: 0 },
          { range: '61-80', min: 61, max: 80, count: 0 },
          { range: '81-100', min: 81, max: 100, count: 0 },
        ];

        scores.forEach((s) => {
          const score = s.composite_score || 0;
          const range = ranges.find((r) => score >= r.min && score <= r.max);
          if (range) range.count++;
        });

        setAIScores(ranges.map(({ range, count }) => ({ range, count })));
      }

      // Fetch top performers (sample)
      setTopPerformers([
        { name: 'Sarah Johnson', score: 82, calls: 245 },
        { name: 'Mike Chen', score: 78, calls: 312 },
        { name: 'Emily Davis', score: 75, calls: 198 },
        { name: 'James Wilson', score: 72, calls: 276 },
        { name: 'Lisa Anderson', score: 70, calls: 234 },
      ]);
    } catch (err) {
      console.error('Error fetching data insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          <h1 className="text-2xl font-bold tracking-tight">Data Insights</h1>
          <p className="text-muted-foreground">Deep analytics on all calling data</p>
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
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="ai-scores">AI Scores</TabsTrigger>
              <TabsTrigger value="objections">Objections</TabsTrigger>
              <TabsTrigger value="timing">Timing</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-2xl font-bold">{overview?.totalCalls.toLocaleString() || 0}</p>
                        <p className="text-sm text-muted-foreground">Total Calls</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <PhoneCall className="h-5 w-5 text-chart-2" />
                      <div>
                        <p className="text-2xl font-bold">{overview?.totalConnects.toLocaleString() || 0}</p>
                        <p className="text-sm text-muted-foreground">Connects</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-success" />
                      <div>
                        <p className="text-2xl font-bold">{overview?.totalMeetings || 0}</p>
                        <p className="text-sm text-muted-foreground">Meetings</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-chart-4" />
                      <div>
                        <p className="text-2xl font-bold">{formatDuration(overview?.avgCallDuration || 0)}</p>
                        <p className="text-sm text-muted-foreground">Avg Duration</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Target className="h-5 w-5 text-chart-1" />
                      <div>
                        <p className="text-2xl font-bold">{overview?.connectRate.toFixed(1) || 0}%</p>
                        <p className="text-sm text-muted-foreground">Connect Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Zap className="h-5 w-5 text-chart-3" />
                      <div>
                        <p className="text-2xl font-bold">{overview?.meetingRate.toFixed(1) || 0}%</p>
                        <p className="text-sm text-muted-foreground">Meeting Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Disposition Breakdown</CardTitle>
                    <CardDescription>Call outcomes distribution</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dispositions}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {dispositions.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Weekly Volume</CardTitle>
                    <CardDescription>Calls and connects over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trends}>
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
                          <Bar dataKey="calls" fill="hsl(var(--chart-1))" name="Calls" />
                          <Bar dataKey="connects" fill="hsl(var(--chart-2))" name="Connects" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Performers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Top Performers by AI Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topPerformers.map((performer, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <span className="text-lg font-bold text-muted-foreground w-6">{index + 1}</span>
                        <div className="flex-1">
                          <p className="font-medium">{performer.name}</p>
                          <p className="text-sm text-muted-foreground">{performer.calls} calls</p>
                        </div>
                        <div className="w-32">
                          <Progress value={performer.score} className="h-2" />
                        </div>
                        <Badge variant="outline">{performer.score}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai-scores" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>AI Score Distribution</CardTitle>
                  <CardDescription>Breakdown of composite scores across all calls</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiScores}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" name="Calls" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="objections">
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Objection analysis coming soon</p>
                  <p className="text-sm">AI will identify and categorize objections from call transcripts</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timing">
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Timing analysis coming soon</p>
                  <p className="text-sm">Connect rate by day/hour heatmap</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Trends</CardTitle>
                  <CardDescription>Week-over-week changes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends}>
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
                          dataKey="calls"
                          stroke="hsl(var(--chart-1))"
                          strokeWidth={2}
                          name="Calls"
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
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
