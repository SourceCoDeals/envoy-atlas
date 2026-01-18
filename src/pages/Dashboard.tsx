import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useSyncData } from '@/hooks/useSyncData';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CreateWorkspace } from '@/components/onboarding/CreateWorkspace';
import { TimeHeatmap } from '@/components/dashboard/TimeHeatmap';
import { SystemHealthScore, calculateSystemHealth } from '@/components/dashboard/SystemHealthScore';
// FailureModeClassification and WhatChangedAnalysis removed - were using simulated comparison data
import { ActionQueue, generateActionItems } from '@/components/dashboard/ActionQueue';
import { KPICard, getKPIStatus } from '@/components/dashboard/KPICard';
import { DateRangeFilter, getDateRange, type DateRangeOption } from '@/components/dashboard/DateRangeFilter';
import { ExecutiveSummary } from '@/components/copyinsights/ExecutiveSummary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// DataErrorFlag imported but only used for specific flagged metrics
import { DataStatusBanner } from '@/components/ui/data-status-banner';
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
  Mail,
  MessageSquare,
  Target,
  AlertTriangle,
  Zap,
  Users,
  Clock,
  RefreshCw,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { workspaces, currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('last30');
  const dateRange = getDateRange(dateRangeOption);
  const { loading: dataLoading, hasData, stats, trendData, topCampaigns, timeData, refetch } = useDashboardData(dateRange);
  const { syncing, triggerSync } = useSyncData();

  const handleRefresh = async () => {
    await triggerSync();
    refetch();
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Calculate system health with new 4-component model
  const healthData = useMemo(() => calculateSystemHealth({
    bounceRate: stats.bounceRate,
    spamRate: stats.spamRate,
    openRate: stats.openRate,
    replyRate: stats.replyRate,
    positiveReplyRate: stats.positiveRate,
    deliveredRate: stats.deliveredRate,
    expectedReplyRate: 3,
  }), [stats]);

  // NOTE: Failure mode classification removed - it was using simulated previous period data
  // The classifyFailureMode function requires real historical data for accurate comparison
  // Until we have real week-over-week data, we cannot provide accurate failure classification

  // Generate action items based only on current metrics (no simulated comparison)
  const actionItems = useMemo(() => generateActionItems(
    { spamRate: stats.spamRate, bounceRate: stats.bounceRate, replyRate: stats.replyRate },
    undefined // No failure mode - would require real historical data
  ), [stats]);

  // Generate executive summary insights
  const executiveInsights = useMemo(() => {
    const insights = [];
    
    // Overall health assessment
    if (healthData.overallScore >= 80) {
      insights.push({
        type: 'positive' as const,
        title: 'Your outbound program is healthy',
        description: `With a ${healthData.overallScore}/100 health score, your emails are reaching inboxes and getting responses. Keep monitoring to maintain this performance.`,
        impact: `${healthData.overallScore}/100 health`,
      });
    } else if (healthData.overallScore >= 60) {
      insights.push({
        type: 'warning' as const,
        title: 'Your program needs some attention',
        description: `A ${healthData.overallScore}/100 health score means there's room for improvement. Focus on the action items below to get back on track.`,
        impact: `${healthData.overallScore}/100 health`,
      });
    } else {
      insights.push({
        type: 'negative' as const,
        title: 'Urgent: Your outbound program needs help',
        description: `A ${healthData.overallScore}/100 health score indicates serious issues. Address the problems below immediately to avoid damaging your sender reputation.`,
        impact: `${healthData.overallScore}/100 health`,
      });
    }

    // Reply rate insight
    if (stats.replyRate >= 3) {
      insights.push({
        type: 'positive' as const,
        title: `${stats.replyRate.toFixed(1)}% of recipients are replying`,
        description: 'This is above the industry average of 3%. Your messaging is resonating with your audience.',
        impact: 'Above benchmark',
      });
    } else if (stats.replyRate >= 2) {
      insights.push({
        type: 'neutral' as const,
        title: `${stats.replyRate.toFixed(1)}% reply rate—room to grow`,
        description: 'You\'re close to the 3% benchmark. Small copy improvements could push you over. Check Copy Insights for specific recommendations.',
      });
    } else {
      insights.push({
        type: 'negative' as const,
        title: `Only ${stats.replyRate.toFixed(1)}% are replying`,
        description: 'This is below the 3% benchmark. Your messaging may not be resonating, or you could have deliverability issues. Check both.',
        impact: 'Below benchmark',
      });
    }

    // Deliverability insight
    if (stats.bounceRate > 5 || stats.spamRate > 0.3) {
      insights.push({
        type: 'negative' as const,
        title: 'Deliverability issues detected',
        description: stats.bounceRate > 5 
          ? `${stats.bounceRate.toFixed(1)}% bounce rate is too high. Clean your lists or you'll damage your sender reputation.`
          : `${stats.spamRate.toFixed(2)}% spam rate is concerning. Review your content and warm-up practices.`,
        impact: 'Fix immediately',
      });
    } else if (stats.deliveredRate >= 95) {
      insights.push({
        type: 'positive' as const,
        title: `${stats.deliveredRate.toFixed(0)}% of emails are reaching inboxes`,
        description: 'Your deliverability is solid. Your infrastructure is healthy and emails are getting through.',
        impact: 'Healthy',
      });
    }

    return insights;
  }, [healthData.overallScore, stats]);

  const bottomLine = useMemo(() => {
    if (stats.replyRate < 3) {
      return 'Your infrastructure is fine. Focus on improving your messaging—check Copy Insights for specific recommendations.';
    }
    return 'Things are running smoothly. Keep monitoring and continue testing new approaches.';
  }, [stats.replyRate]);

  const handleActionClick = (action: any, link?: string) => {
    if (link) navigate(link);
  };

  // Early returns AFTER all hooks
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
            <p className="text-muted-foreground">
              Strategic command center for your outbound program
            </p>
          </div>
          {hasData && (
            <div className="flex gap-2">
              <DateRangeFilter value={dateRangeOption} onChange={setDateRangeOption} />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={syncing || dataLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Refresh Data'}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/inbox">
                  View Inbox
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
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
                Connect your Smartlead or Reply.io account to see performance metrics.
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
            {/* Data Status Banner - All metrics are now from real synced data */}
            <DataStatusBanner
              status="healthy"
              title="Dashboard Data is Real"
              description="All email metrics (Sent, Opened, Replied, Bounced) come from synced platform data. Simulated trend comparisons and failure analysis have been removed."
              issues={[
                'Positive Rate classification varies by platform (some use AI, others manual tagging)',
                'Spam complaints may not be tracked by all platforms',
              ]}
            />

            {/* Executive Summary */}
            <ExecutiveSummary
              title="What's Happening With Your Outbound"
              subtitle="Here's a plain-English summary of your email program's health and performance"
              insights={executiveInsights}
              bottomLine={bottomLine}
            />

            {/* Health Score (Failure Mode Classification removed - requires historical data) */}
            <div className="grid gap-4 lg:grid-cols-1">
              <SystemHealthScore data={healthData} />
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <KPICard
                label="Total Sent"
                value={stats.totalSent}
                format="number"
                icon={Mail}
                iconColor="text-muted-foreground"
              />
              <KPICard
                label="Delivered"
                value={stats.deliveredRate}
                format="percent"
                target={{ value: 95 }}
                status={getKPIStatus(stats.deliveredRate, 95, 90)}
              />
              <KPICard
                label="Reply Rate"
                value={stats.replyRate}
                format="percent"
                target={{ value: 3.5 }}
                icon={MessageSquare}
                iconColor="text-chart-1"
                status={getKPIStatus(stats.replyRate, 3, 2)}
                onClick={() => navigate('/copy-insights')}
                actionLabel="Diagnose"
              />
              <KPICard
                label="Positive Rate"
                value={stats.positiveRate}
                format="percent"
                target={{ value: 1.8 }}
                icon={Target}
                iconColor="text-success"
                status={getKPIStatus(stats.positiveRate, 1.5, 1)}
                dataFlag={stats.positiveRate === 0 ? undefined : {
                  type: 'estimated',
                  tooltip: 'Positive reply classification may vary by platform. Some use AI, others use manual tagging.'
                }}
              />
              <KPICard
                label="Bounce Rate"
                value={stats.bounceRate}
                format="percent"
                target={{ value: 3 }}
                icon={AlertTriangle}
                iconColor={stats.bounceRate > 5 ? "text-destructive" : "text-muted-foreground"}
                status={getKPIStatus(stats.bounceRate, 2, 5, false)}
                onClick={() => navigate('/deliverability')}
                actionLabel="View Issues"
              />
              <KPICard
                label="Spam Rate"
                value={stats.spamRate}
                format="percent"
                decimals={2}
                target={{ value: 0.1 }}
                status={getKPIStatus(stats.spamRate, 0.1, 0.3, false)}
                dataFlag={stats.spamRate === 0 ? {
                  type: 'not-tracked',
                  tooltip: 'Spam complaints not tracked by connected platforms'
                } : undefined}
              />
            </div>

            {/* Action Queue (What Changed removed - was using simulated data) */}
            <div className="grid gap-4 lg:grid-cols-1">
              <ActionQueue 
                actions={actionItems}
                onActionClick={handleActionClick}
              />
            </div>

            {/* Performance Trend + Top Campaigns */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Trend</CardTitle>
                  <CardDescription>Daily sends and replies (last 30 days)</CardDescription>
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
                          <Area type="monotone" dataKey="replies" stroke="hsl(var(--success))" fill="url(#colorReplies)" strokeWidth={2} name="Replies" />
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
