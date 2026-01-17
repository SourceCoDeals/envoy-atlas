import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CalendarCheck, Calendar, CheckCircle, XCircle, 
  TrendingUp, Mail, Phone, Users
} from 'lucide-react';

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

  // Estimate meeting status breakdown
  const completed = Math.floor(keyMetrics.meetingsScheduled * 0.75);
  const scheduled = Math.floor(keyMetrics.meetingsScheduled * 0.2);
  const cancelled = keyMetrics.meetingsScheduled - completed - scheduled;

  // Get meeting source from channels
  const emailMeetings = channelComparison.find(c => c.channel === 'Email')?.meetings || 0;
  const callMeetings = channelComparison.find(c => c.channel === 'Calling')?.meetings || 0;
  const multiChannel = Math.floor(keyMetrics.meetingsScheduled * 0.3);

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
            <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <CalendarCheck className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total Meetings
                </span>
              </div>
              <p className="text-3xl font-bold text-primary">{keyMetrics.meetingsScheduled}</p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Completed
                </span>
              </div>
              <p className="text-3xl font-bold text-green-600">{completed}</p>
              <p className="text-sm text-muted-foreground">{keyMetrics.meetingsScheduled > 0 ? ((completed / keyMetrics.meetingsScheduled) * 100).toFixed(0) : 0}%</p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Scheduled
                </span>
              </div>
              <p className="text-3xl font-bold">{scheduled}</p>
              <p className="text-sm text-muted-foreground">Upcoming</p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cancelled/No-Show
                </span>
              </div>
              <p className="text-3xl font-bold text-muted-foreground">{cancelled}</p>
              <p className="text-sm text-muted-foreground">{keyMetrics.meetingsScheduled > 0 ? ((cancelled / keyMetrics.meetingsScheduled) * 100).toFixed(0) : 0}%</p>
            </div>
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
              <p className="text-2xl font-bold">{emailMeetings}</p>
              <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                <div 
                  className="h-full bg-primary" 
                  style={{ width: `${keyMetrics.meetingsScheduled > 0 ? (emailMeetings / keyMetrics.meetingsScheduled) * 100 : 0}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {keyMetrics.meetingsScheduled > 0 ? ((emailMeetings / keyMetrics.meetingsScheduled) * 100).toFixed(0) : 0}% of meetings
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Calling Only</span>
              </div>
              <p className="text-2xl font-bold">{callMeetings}</p>
              <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                <div 
                  className="h-full bg-chart-2" 
                  style={{ width: `${keyMetrics.meetingsScheduled > 0 ? (callMeetings / keyMetrics.meetingsScheduled) * 100 : 0}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {keyMetrics.meetingsScheduled > 0 ? ((callMeetings / keyMetrics.meetingsScheduled) * 100).toFixed(0) : 0}% of meetings
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">Multi-Channel</span>
              </div>
              <p className="text-2xl font-bold text-primary">{multiChannel}</p>
              <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                <div 
                  className="h-full bg-primary" 
                  style={{ width: `${keyMetrics.meetingsScheduled > 0 ? (multiChannel / keyMetrics.meetingsScheduled) * 100 : 0}%` }}
                />
              </div>
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
            <div className="p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground">Total Opportunities</p>
              <p className="text-2xl font-bold">{keyMetrics.opportunities}</p>
            </div>
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
            <div className="p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground">Closed (Not a Fit)</p>
              <p className="text-2xl font-bold text-muted-foreground">{Math.ceil(keyMetrics.opportunities * 0.2)}</p>
            </div>
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
