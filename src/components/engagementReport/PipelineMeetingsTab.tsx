import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CalendarCheck, AlertTriangle, Settings
} from 'lucide-react';
import { ReportMetricCard } from './components/ReportMetricCard';
import { MeetingTrackingNotConfigured } from '@/components/ui/data-status-banner';
import { DataErrorFlag } from '@/components/ui/data-error-flag';

interface PipelineMeetingsTabProps {
  data: {
    keyMetrics: {
      meetingsScheduled: number;
      opportunities: number;
    };
    channelComparison: Array<{
      channel: string;
      meetings: number;
    }>;
    funnel: Array<{ name: string; count: number; percentage: number }>;
    callingMetrics?: {
      meetings: number;
    };
  };
}

export function PipelineMeetingsTab({ data }: PipelineMeetingsTabProps) {
  const { keyMetrics, channelComparison, funnel, callingMetrics } = data;

  // Get actual meeting data from calling
  const actualCallMeetings = callingMetrics?.meetings || 0;
  const emailMeetings = channelComparison.find(c => c.channel === 'Email')?.meetings || 0;
  const callMeetings = channelComparison.find(c => c.channel === 'Calling')?.meetings || 0;

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <MeetingTrackingNotConfigured />

      {/* Actual Data Available */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Meetings Data Available
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-green-500/10 border-green-500/20">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Call Meetings</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{actualCallMeetings}</p>
              <p className="text-xs text-green-600 mt-1">✓ Actual tracked data</p>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Email Meetings</p>
                <DataErrorFlag type="estimated" size="sm" />
              </div>
              <p className="text-3xl font-bold mt-1">{emailMeetings}</p>
              <p className="text-xs text-muted-foreground mt-1">Estimated: positive × 0.3</p>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Meetings</p>
                <DataErrorFlag type="estimated" size="sm" />
              </div>
              <p className="text-3xl font-bold mt-1">{keyMetrics.meetingsScheduled}</p>
              <p className="text-xs text-muted-foreground mt-1">Actual + Estimated</p>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Opportunities</p>
                <DataErrorFlag type="estimated" size="sm" />
              </div>
              <p className="text-3xl font-bold mt-1">{keyMetrics.opportunities}</p>
              <p className="text-xs text-muted-foreground mt-1">meetings × 0.35</p>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Not Tracked Section */}
      <Card className="border-dashed border-muted-foreground/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-5 w-5" />
            Data Not Being Tracked
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-muted-foreground">Meeting Breakdown</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Completed Meetings</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Scheduled (Upcoming)</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Cancelled / No-Show</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Requires calendar integration to track meeting outcomes.
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-muted-foreground">Opportunity Pipeline</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Active Opportunities</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Nurture / Future</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Closed (Won/Lost)</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Requires CRM integration to track opportunity stages.
              </p>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-muted-foreground">Multi-Channel Attribution</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Email Only Meetings</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Call Only Meetings</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span>Multi-Touch Meetings</span>
                  <DataErrorFlag type="not-tracked" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Requires contact-level tracking across channels.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Path - Only show actual data */}
      {funnel.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conversion Path (Partial Data)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 flex-wrap">
              {funnel.slice(0, 3).map((stage, index) => (
                <div key={stage.name} className="flex items-center">
                  <div className="text-center">
                    <p className="text-lg font-bold">{stage.count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{stage.name}</p>
                  </div>
                  {index < 2 && (
                    <div className="mx-4 text-muted-foreground">→</div>
                  )}
                </div>
              ))}
              {funnel.slice(3).map((stage, index) => (
                <div key={stage.name} className="flex items-center opacity-50">
                  <div className="mx-4 text-muted-foreground">→</div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <p className="text-lg font-bold">{stage.count.toLocaleString()}</p>
                      <DataErrorFlag type="estimated" size="sm" />
                    </div>
                    <p className="text-xs text-muted-foreground">{stage.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
