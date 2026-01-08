import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useDataInsights } from '@/hooks/useDataInsights';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityMetricsTab } from '@/components/datainsights/ActivityMetricsTab';
import { EngagementQualityTab } from '@/components/datainsights/EngagementQualityTab';
import { OutcomeMetricsTab } from '@/components/datainsights/OutcomeMetricsTab';
import { ProspectStrategyTab } from '@/components/datainsights/ProspectStrategyTab';
import { GatekeeperTrackingTab } from '@/components/datainsights/GatekeeperTrackingTab';
import { WrongNumberTrackingTab } from '@/components/datainsights/WrongNumberTrackingTab';
import { Loader2, Activity, Users, Target, Compass, UserCheck, PhoneOff } from 'lucide-react';

export default function DataInsights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { 
    loading, benchmarks, activityMetrics, engagementMetrics, 
    outcomeMetrics, prospectMetrics, gatekeeperMetrics, wrongNumberMetrics 
  } = useDataInsights();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Data Insights</h1>
          <p className="text-muted-foreground">Comprehensive cold calling metrics with industry benchmarks</p>
        </div>

        <Tabs defaultValue="activity" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4 hidden sm:block" />Activity
            </TabsTrigger>
            <TabsTrigger value="engagement" className="gap-2">
              <Users className="h-4 w-4 hidden sm:block" />Engagement
            </TabsTrigger>
            <TabsTrigger value="outcomes" className="gap-2">
              <Target className="h-4 w-4 hidden sm:block" />Outcomes
            </TabsTrigger>
            <TabsTrigger value="strategy" className="gap-2">
              <Compass className="h-4 w-4 hidden sm:block" />Strategy
            </TabsTrigger>
            <TabsTrigger value="gatekeeper" className="gap-2">
              <UserCheck className="h-4 w-4 hidden sm:block" />Gatekeeper
            </TabsTrigger>
            <TabsTrigger value="wrongnumber" className="gap-2">
              <PhoneOff className="h-4 w-4 hidden sm:block" />Wrong #
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity">
            <ActivityMetricsTab metrics={activityMetrics} benchmarks={benchmarks} />
          </TabsContent>
          <TabsContent value="engagement">
            <EngagementQualityTab metrics={engagementMetrics} benchmarks={benchmarks} />
          </TabsContent>
          <TabsContent value="outcomes">
            <OutcomeMetricsTab metrics={outcomeMetrics} benchmarks={benchmarks} />
          </TabsContent>
          <TabsContent value="strategy">
            <ProspectStrategyTab metrics={prospectMetrics} />
          </TabsContent>
          <TabsContent value="gatekeeper">
            <GatekeeperTrackingTab metrics={gatekeeperMetrics} />
          </TabsContent>
          <TabsContent value="wrongnumber">
            <WrongNumberTrackingTab metrics={wrongNumberMetrics} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
