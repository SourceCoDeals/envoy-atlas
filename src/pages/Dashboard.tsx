import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useOverviewDashboard } from '@/hooks/useOverviewDashboard';
import { useSyncData } from '@/hooks/useSyncData';
import { useDataFreshness } from '@/hooks/useDataFreshness';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TodaysPulseBar } from '@/components/dashboard/TodaysPulseBar';
import { HeroMetricsGrid } from '@/components/dashboard/HeroMetricsGrid';
import { WeeklyPerformanceChart } from '@/components/dashboard/WeeklyPerformanceChart';
import { CampaignAlertsTable } from '@/components/dashboard/CampaignAlertsTable';
import { TopPerformersTable } from '@/components/dashboard/TopPerformersTable';
import { QuickActionsBar, MobileQuickActionsBar } from '@/components/dashboard/QuickActionsBar';
import { DataFreshness } from '@/components/ui/data-freshness';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Loader2, 
  ArrowRight,
  Plug,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export default function Dashboard() {
  const { loading: authLoading } = useAuth();
  const { loading: workspaceLoading } = useWorkspace();
  const { 
    loading: dataLoading, 
    hasData, 
    todaysPulse, 
    heroMetrics, 
    weeklyData, 
    alertCampaigns, 
    topCampaigns,
    dataCompleteness,
    dataSource,
    refetch 
  } = useOverviewDashboard();
  const { syncing, triggerSync } = useSyncData();
  const { data: freshnessData } = useDataFreshness();

  const handleRefresh = async () => {
    await triggerSync();
    refetch();
  };

  // Early returns AFTER all hooks
  if (authLoading || workspaceLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Overview</h1>
              <p className="text-sm text-muted-foreground">
                Email program performance at a glance
              </p>
            </div>
            {freshnessData && (
              <DataFreshness 
                lastSyncAt={freshnessData.lastSyncAt} 
                status={freshnessData.status}
              />
            )}
          </div>
          {hasData && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={syncing || dataLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Refresh'}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/inbox">
                  Inbox
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
            {/* 1. Today's Pulse Bar */}
            <TodaysPulseBar pulse={todaysPulse} />

            {/* 2. Hero Metrics (2x2 mobile, 1x4 desktop) */}
            <HeroMetricsGrid metrics={heroMetrics} />

            {/* Quick Actions (Desktop only - mobile has fixed bar) */}
            <div className="hidden sm:block">
              <QuickActionsBar />
            </div>

            {/* 3. Week-by-Week Performance Chart */}
            <WeeklyPerformanceChart data={weeklyData} dataCompleteness={dataCompleteness} dataSource={dataSource} />

            {/* 4. Campaign Tables: Alerts + Top Performers */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Needs Attention - only shows if there are alerts */}
              <div className={alertCampaigns.length === 0 ? 'lg:col-span-2' : ''}>
                {alertCampaigns.length > 0 && (
                  <CampaignAlertsTable campaigns={alertCampaigns} />
                )}
              </div>
              
              {/* Top Performers */}
              <div className={alertCampaigns.length === 0 ? 'lg:col-span-2' : ''}>
                <TopPerformersTable campaigns={topCampaigns} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile Fixed Bottom Bar */}
      {hasData && <MobileQuickActionsBar />}
    </DashboardLayout>
  );
}
