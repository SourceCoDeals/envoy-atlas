import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CreateWorkspace } from '@/components/onboarding/CreateWorkspace';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { TimeHeatmap } from '@/components/dashboard/TimeHeatmap';
import { EmailHealthScore, calculateHealthScore } from '@/components/dashboard/EmailHealthScore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
} from 'recharts';
import { 
  Loader2, 
  ArrowRight,
  Plug,
  ExternalLink,
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground">Campaign performance at a glance</p>
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
              <h2 className="text-xl font-semibold mb-2">Connect Smartlead</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Connect your Smartlead account to start importing campaigns and tracking performance metrics.
              </p>
              <Button asChild>
                <Link to="/connections">
                  Connect Smartlead
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Health Score */}
            <div className="dashboard-grid dashboard-grid-cols-2">
              <EmailHealthScore 
                {...calculateHealthScore({
                  bounceRate: stats.bounceRate,
                  spamRate: stats.spamRate,
                  replyRate: stats.replyRate,
                  positiveReplyRate: stats.positiveRate,
                  deliveredRate: stats.deliveredRate,
                })}
              />
              
              {/* KPI Cards */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Key Metrics</CardTitle>
                  <CardDescription>Core performance indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Total Sent</p>
                      <p className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Reply Rate</p>
                      <p className="text-2xl font-bold">{stats.replyRate.toFixed(1)}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Positive Rate</p>
                      <p className="text-2xl font-bold text-success">{stats.positiveRate.toFixed(1)}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Bounce Rate</p>
                      <p className={`text-2xl font-bold ${stats.bounceRate > 5 ? 'text-destructive' : ''}`}>
                        {stats.bounceRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="dashboard-grid dashboard-grid-cols-2">
              {/* Performance Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Trend</CardTitle>
                  <CardDescription>Daily sends and replies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
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
                    <div className="space-y-4">
                      {topCampaigns.map((campaign, index) => (
                        <Link
                          key={campaign.id}
                          to={`/campaigns/${campaign.id}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-muted-foreground w-6">
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-medium text-sm">{campaign.name}</p>
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
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/inbox')}>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-1">Master Inbox</h3>
                  <p className="text-sm text-muted-foreground">View all responses in one place</p>
                </CardContent>
              </Card>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/copy-insights')}>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-1">Copy Insights</h3>
                  <p className="text-sm text-muted-foreground">Analyze subject line performance</p>
                </CardContent>
              </Card>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/audience-insights')}>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-1">Audience Insights</h3>
                  <p className="text-sm text-muted-foreground">Personal vs work email analysis</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
