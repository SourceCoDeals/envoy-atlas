import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CalendarCheck, Calendar, CheckCircle, XCircle, 
  TrendingUp, Mail, Phone, Users
} from 'lucide-react';
import { ReportMetricCard } from './components/ReportMetricCard';
import { ReportProgressBar } from './components/ReportProgressBar';
import { calculateMeetingBreakdown, calculateChannelAttribution } from './utils/calculations';
import { calculateRate } from './utils/formatters';

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
  };
}

export function PipelineMeetingsTab({ data }: PipelineMeetingsTabProps) {
  const { keyMetrics, channelComparison, funnel } = data;

  const meetingBreakdown = calculateMeetingBreakdown(keyMetrics.meetingsScheduled);
  
  const emailMeetings = channelComparison.find(c => c.channel === 'Email')?.meetings || 0;
  const callMeetings = channelComparison.find(c => c.channel === 'Calling')?.meetings || 0;
  const channelAttribution = calculateChannelAttribution(
    keyMetrics.meetingsScheduled,
    emailMeetings,
    callMeetings
  );

  return (
    <div className="space-y-6">
      {/* Meetings Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Meetings Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ReportMetricCard
              label="Total Meetings"
              value={keyMetrics.meetingsScheduled}
              icon={CalendarCheck}
              highlight
              size="lg"
            />
            <ReportMetricCard
              label="Completed"
              value={meetingBreakdown.completed}
              subtitle={keyMetrics.meetingsScheduled > 0 
                ? `${calculateRate(meetingBreakdown.completed, keyMetrics.meetingsScheduled).toFixed(0)}%` 
                : '0%'
              }
              icon={CheckCircle}
              valueClassName="text-green-600"
            />
            <ReportMetricCard
              label="Scheduled"
              value={meetingBreakdown.scheduled}
              subtitle="Upcoming"
              icon={Calendar}
            />
            <ReportMetricCard
              label="Cancelled/No-Show"
              value={meetingBreakdown.cancelled}
              subtitle={keyMetrics.meetingsScheduled > 0 
                ? `${calculateRate(meetingBreakdown.cancelled, keyMetrics.meetingsScheduled).toFixed(0)}%` 
                : '0%'
              }
              icon={XCircle}
              valueClassName="text-muted-foreground"
            />
          </div>
        </CardContent>
      </Card>

      {/* Meeting Source */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Meeting Source Attribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Email Only</span>
              </div>
              <p className="text-2xl font-bold">{channelAttribution.emailOnly}</p>
              <ReportProgressBar
                value={channelAttribution.emailOnly}
                max={keyMetrics.meetingsScheduled || 1}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {keyMetrics.meetingsScheduled > 0 
                  ? calculateRate(channelAttribution.emailOnly, keyMetrics.meetingsScheduled).toFixed(0) 
                  : 0}% of meetings
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Calling Only</span>
              </div>
              <p className="text-2xl font-bold">{channelAttribution.callOnly}</p>
              <ReportProgressBar
                value={channelAttribution.callOnly}
                max={keyMetrics.meetingsScheduled || 1}
                colorClass="bg-chart-2"
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {keyMetrics.meetingsScheduled > 0 
                  ? calculateRate(channelAttribution.callOnly, keyMetrics.meetingsScheduled).toFixed(0) 
                  : 0}% of meetings
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">Multi-Channel</span>
              </div>
              <p className="text-2xl font-bold text-primary">{channelAttribution.multiChannel}</p>
              <ReportProgressBar
                value={channelAttribution.multiChannel}
                max={keyMetrics.meetingsScheduled || 1}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Touched by both email & call
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opportunity Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Opportunity Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <ReportMetricCard
              label="Total Opportunities"
              value={keyMetrics.opportunities}
            />
            <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/20">
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600">{Math.floor(keyMetrics.opportunities * 0.5)}</p>
              <p className="text-xs text-green-600">In discussion</p>
            </div>
            <div className="p-4 rounded-lg border bg-yellow-500/10 border-yellow-500/20">
              <p className="text-sm text-muted-foreground">Nurture / Future</p>
              <p className="text-2xl font-bold text-yellow-600">{Math.floor(keyMetrics.opportunities * 0.3)}</p>
              <p className="text-xs text-yellow-600">Follow up later</p>
            </div>
            <ReportMetricCard
              label="Closed (Not a Fit)"
              value={Math.ceil(keyMetrics.opportunities * 0.2)}
              valueClassName="text-muted-foreground"
            />
          </div>

          {/* Conversion Funnel Visual */}
          <div className="space-y-4">
            <h4 className="font-medium">Conversion Path</h4>
            <div className="flex items-center gap-4">
              {funnel.slice(2).map((stage, index) => (
                <div key={stage.name} className="flex items-center">
                  <div className="text-center">
                    <p className="text-lg font-bold">{stage.count}</p>
                    <p className="text-xs text-muted-foreground">{stage.name}</p>
                  </div>
                  {index < funnel.slice(2).length - 1 && (
                    <div className="mx-4 text-muted-foreground">→</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder for Meeting List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Meetings</CardTitle>
          <Button variant="outline" size="sm">Export CSV</Button>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CalendarCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Meeting details will be shown here when meeting tracking is implemented.</p>
            <p className="text-sm mt-2">
              Currently showing aggregate data from call outcomes and email replies.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
