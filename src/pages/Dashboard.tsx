import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CreateWorkspace } from '@/components/onboarding/CreateWorkspace';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { HealthBadge } from '@/components/dashboard/HealthBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  TrendingUp, 
  TrendingDown, 
  Mail, 
  MessageSquare, 
  ThumbsUp,
  AlertTriangle,
  ArrowRight,
  Plug,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Mock data for demonstration
const mockTrendData = [
  { date: 'Dec 1', sent: 1200, replies: 48, positiveReplies: 32 },
  { date: 'Dec 8', sent: 1450, replies: 62, positiveReplies: 41 },
  { date: 'Dec 15', sent: 1380, replies: 55, positiveReplies: 38 },
  { date: 'Dec 22', sent: 980, replies: 42, positiveReplies: 29 },
  { date: 'Dec 29', sent: 1520, replies: 71, positiveReplies: 52 },
  { date: 'Jan 5', sent: 1680, replies: 84, positiveReplies: 61 },
];

const mockTopCampaigns = [
  { name: 'Q1 Enterprise Outreach', replyRate: 4.8, positiveRate: 3.2, sent: 2450 },
  { name: 'SMB Product Launch', replyRate: 3.9, positiveRate: 2.7, sent: 1890 },
  { name: 'Tech Decision Makers', replyRate: 3.5, positiveRate: 2.1, sent: 3200 },
  { name: 'Series A Founders', replyRate: 5.2, positiveRate: 3.8, sent: 1200 },
  { name: 'VP Sales Outreach', replyRate: 2.8, positiveRate: 1.9, sent: 2800 },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { workspaces, currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const [hasConnection, setHasConnection] = useState<boolean | null>(null);

  // Redirect to auth if not logged in
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

  // Show workspace creation if no workspaces
  if (workspaces.length === 0) {
    return <CreateWorkspace />;
  }

  // For now, show empty state prompting to connect Smartlead
  const showEmptyState = true; // Will be replaced with actual connection check

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground">
              Campaign performance at a glance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last 30 days</span>
          </div>
        </div>

        {showEmptyState ? (
          // Empty state - prompt to connect
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
            {/* KPI Cards */}
            <div className="dashboard-grid dashboard-grid-cols-4">
              <MetricCard
                label="Total Sent"
                value={8210}
                trend={{ value: 12.5, direction: 'up' }}
              />
              <MetricCard
                label="Reply Rate"
                value={4.12}
                format="percent"
                trend={{ value: 8.3, direction: 'up' }}
              />
              <MetricCard
                label="Positive Reply Rate"
                value={2.89}
                format="percent"
                trend={{ value: 15.2, direction: 'up' }}
              />
              <MetricCard
                label="Bounce Rate"
                value={1.24}
                format="percent"
                trend={{ value: 5.1, direction: 'down' }}
              />
            </div>

            {/* Charts Row */}
            <div className="dashboard-grid dashboard-grid-cols-2">
              {/* Performance Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Trend</CardTitle>
                  <CardDescription>Weekly sends and replies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mockTrendData}>
                        <defs>
                          <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="date" 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="sent"
                          stroke="hsl(var(--chart-1))"
                          fill="url(#colorSent)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="positiveReplies"
                          stroke="hsl(var(--chart-2))"
                          fill="url(#colorReplies)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
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
                  <div className="space-y-4">
                    {mockTopCampaigns
                      .sort((a, b) => b.positiveRate - a.positiveRate)
                      .slice(0, 5)
                      .map((campaign, index) => (
                        <div 
                          key={campaign.name}
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
                              {campaign.positiveRate}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              positive
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alerts / Issues Row */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Active Alerts</CardTitle>
                    <CardDescription>Issues requiring attention</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/alerts">View All</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">High bounce rate detected</p>
                      <p className="text-xs text-muted-foreground">
                        mailbox-03@outreach.io — 8.2% bounce rate (threshold: 5%)
                      </p>
                    </div>
                    <Button variant="outline" size="sm">Review</Button>
                  </div>
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Experiment ready for winner selection</p>
                      <p className="text-xs text-muted-foreground">
                        "Q1 Subject Line Test" has reached statistical significance
                      </p>
                    </div>
                    <Button variant="outline" size="sm">View</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}