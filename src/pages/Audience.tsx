import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Loader2, MousePointer } from 'lucide-react';
import { useEnrollmentData } from '@/hooks/useEnrollmentData';
import { EnrollmentTracker, ClickAnalytics, LeadJourney } from '@/components/analytics';

export default function Audience() {
  const { 
    loading, 
    enrollmentData, 
    stepData, 
    finishReasons, 
    clickData 
  } = useEnrollmentData();

  const hasEnrollmentData = enrollmentData.total > 0;
  const hasStepData = stepData.length > 0;
  const hasClickData = clickData.total_clicks > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audience</h1>
          <p className="text-muted-foreground">
            Lead enrollment, journey progression, and click analytics
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !hasEnrollmentData && !hasStepData && !hasClickData ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-info/10 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-info" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Audience Data Yet</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Sync your campaigns to see enrollment tracking, lead journeys, and click analytics.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Enrollment Tracker - Shows lead distribution across stages */}
            {hasEnrollmentData && (
              <EnrollmentTracker data={enrollmentData} />
            )}

            {/* Two Column Layout for Journey and Clicks */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Lead Journey Analysis */}
              {hasStepData && (
                <LeadJourney 
                  steps={stepData}
                  finishReasons={finishReasons}
                  totalLeads={enrollmentData.total}
                  completedLeads={enrollmentData.completed}
                  activeLeads={enrollmentData.in_progress}
                />
              )}

              {/* Click Analytics */}
              {hasClickData ? (
                <ClickAnalytics 
                  totalClicks={clickData.total_clicks}
                  uniqueClicks={clickData.unique_clicks}
                  clickToReplyRate={clickData.click_to_reply_rate}
                  topLinks={clickData.top_links}
                  clicksByHour={clickData.clicks_by_hour}
                />
              ) : (
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MousePointer className="h-5 w-5" />
                      Click Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <p className="text-muted-foreground text-center">
                      No click data available yet. Clicks are tracked when link tracking is enabled.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}