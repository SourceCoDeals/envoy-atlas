import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CreateWorkspace } from '@/components/onboarding/CreateWorkspace';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { TimeHeatmap } from '@/components/dashboard/TimeHeatmap';
import { EmailHealthScore, calculateHealthScore, getOverallHealthScore, getHealthLevel } from '@/components/dashboard/EmailHealthScore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { 
  Loader2, 
  ArrowRight,
  Plug,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Mail,
  MessageSquare,
  Users,
  Target,
  Zap,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { workspaces, currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { loading: dataLoading, hasData, stats, trendData, topCampaigns, timeData } = useDashboardData();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || workspaceLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (workspaces.length === 0) {
    return <CreateWorkspace />;
  }

  // Calculate health scores
  const healthScores = calculateHealthScore({
    bounceRate: stats.bounceRate,
    spamRate: stats.spamRate,
    replyRate: stats.replyRate,
    positiveReplyRate: stats.positiveRate,
    deliveredRate: stats.deliveredRate,
  });
  const overallHealth = getOverallHealthScore(healthScores);
  const healthLevel = getHealthLevel(overallHealth);

  // Quick diagnostic checks
  const diagnostics = [
    {
      label: 'Deliverability',
      value: stats.bounceRate < 2,
      message: stats.bounceRate < 2 ? 'Healthy' : `${stats.bounceRate.toFixed(1)}% bounce rate`,
      icon: stats.bounceRate < 2 ? CheckCircle : AlertTriangle,
    },
    {
      label: 'Reply Rate',
      value: stats.replyRate >= 3,
      message: stats.replyRate >= 3 ? 'On target' : 'Below 3% target',
      icon: stats.replyRate >= 3 ? CheckCircle : AlertTriangle,
    },
    {
      label: 'Positive Rate',
      value: stats.positiveRate >= 1,
      message: stats.positiveRate >= 1 ? 'Good conversion' : 'Needs improvement',
      icon: stats.positiveRate >= 1 ? CheckCircle : AlertTriangle,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground">
              Is your cold email program healthy? Check your vitals at a glance.
            </p>
          </div>
          {hasData && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/inbox">
                View Inbox
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !hasData ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Plug className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Data Yet</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Connect your Smartlead or Reply.io account and sync your campaigns to see performance metrics.
              </p>
              <Button asChild>
                <Link to="/connections">
                  Go to Connections
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Health Score + Quick Diagnostics */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Health Score */}
              <div className="lg:col-span-2">
                <EmailHealthScore {...healthScores} />
              </div>

              {/* Quick Diagnostics */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Quick Diagnostics</CardTitle>
                  <CardDescription>System health checks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {diagnostics.map((d, i) => (
                    <div key={i} className={`p-3 rounded-lg flex items-center gap-3 ${d.value ? 'bg-success/10' : 'bg-warning/10'}`}>
                      <d.icon className={`h-5 w-5 ${d.value ? 'text-success' : 'text-warning'}`} />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{d.label}</p>
                        <p className="text-xs text-muted-foreground">{d.message}</p>
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 border-t">
                    <Link 
                      to="/deliverability" 
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      View detailed health report
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Key Metrics Row */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Total Sent</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-chart-1" />
                      <span className="text-2xl font-bold">{stats.replyRate.toFixed(1)}%</span>
                    </div>
                    {stats.replyRate >= 5 && <TrendingUp className="h-4 w-4 text-success" />}
                  </div>
                  <p className="text-xs text-muted-foreground">Reply Rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-success" />
                      <span className="text-2xl font-bold text-success">{stats.positiveRate.toFixed(1)}%</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Positive Reply Rate</p>
                </CardContent>
              </Card>
              <Card className={stats.bounceRate > 5 ? 'border-destructive/50' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${stats.bounceRate > 5 ? 'text-destructive' : 'text-muted-foreground'}`} />
                      <span className={`text-2xl font-bold ${stats.bounceRate > 5 ? 'text-destructive' : ''}`}>
                        {stats.bounceRate.toFixed(1)}%
                      </span>
                    </div>
                    {stats.bounceRate > 5 && <TrendingDown className="h-4 w-4 text-destructive" />}
                  </div>
                  <p className="text-xs text-muted-foreground">Bounce Rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Performance Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Trend</CardTitle>
                  <CardDescription>Daily sends and positive replies (last 14 days)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    {trendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Area type="monotone" dataKey="sent" stroke="hsl(var(--chart-1))" fill="url(#colorSent)" strokeWidth={2} name="Sent" />
                          <Area type="monotone" dataKey="positiveReplies" stroke="hsl(var(--success))" fill="url(#colorReplies)" strokeWidth={2} name="Positive Replies" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No trend data available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Top Campaigns */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top Campaigns</CardTitle>
                  <CardDescription>By positive reply rate</CardDescription>
                </CardHeader>
                <CardContent>
                  {topCampaigns.length > 0 ? (
                    <div className="space-y-3">
                      {topCampaigns.map((campaign, index) => (
                        <Link
                          key={campaign.id}
                          to={`/campaigns/${campaign.id}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-lg font-bold ${index === 0 ? 'text-yellow-500' : 'text-muted-foreground'} w-6`}>
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-medium text-sm line-clamp-1">{campaign.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {campaign.sent.toLocaleString()} sent
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-medium text-success">
                              {campaign.positiveRate.toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground">positive</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                      No campaign data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Time Heatmap */}
            {timeData.some(t => t.value > 0) && (
              <TimeHeatmap 
                data={timeData}
                title="When Prospects Reply"
                description="Response distribution by day and hour"
              />
            )}

            {/* Quick Links */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/inbox')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Master Inbox</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Triage and respond to leads</p>
                </CardContent>
              </Card>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/copy-insights')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="h-5 w-5 text-chart-4" />
                    <h3 className="font-semibold">Copy Insights</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Analyze what messaging works</p>
                </CardContent>
              </Card>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/audience-insights')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="h-5 w-5 text-chart-2" />
                    <h3 className="font-semibold">Audience Insights</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Validate your ICP</p>
                </CardContent>
              </Card>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/deliverability')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Target className="h-5 w-5 text-chart-3" />
                    <h3 className="font-semibold">Deliverability</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Monitor inbox placement</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
