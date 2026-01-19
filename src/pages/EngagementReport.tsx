import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEngagementReport } from '@/hooks/useEngagementReport';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DataHealthIndicator } from '@/components/ui/data-health-indicator';
import { DateRangeFilter, getDateRange, type DateRangeOption } from '@/components/dashboard/DateRangeFilter';
import { Loader2, ArrowLeft, Share2, Mail, Phone, Target, Calendar } from 'lucide-react';

export default function EngagementReport() {
  const navigate = useNavigate();
  const { engagementId } = useParams<{ engagementId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('last30');
  const dateRange = getDateRange(dateRangeOption);
  
  const { data, loading, error } = useEngagementReport(engagementId || '', {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return null;
  
  if (error || !data || !data.engagement) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Engagement Not Found</h2>
          <p className="text-muted-foreground mb-4">
            {error || 'Unable to load engagement report data'}
          </p>
          <Button onClick={() => navigate('/engagements')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Engagements
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const { engagement, keyMetrics, emailMetrics, callingMetrics, linkedCampaigns } = data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/engagements')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{engagement.name}</h1>
                  <Badge variant={engagement.status === 'active' ? 'default' : 'secondary'}>
                    {engagement.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{engagement.description || 'No description'}</p>
              </div>
              <DataHealthIndicator 
                status={linkedCampaigns.length > 0 ? (emailMetrics.sent > 0 ? 'healthy' : 'degraded') : 'empty'} 
                tooltip={linkedCampaigns.length > 0 
                  ? (emailMetrics.sent > 0 
                    ? `${linkedCampaigns.length} campaigns, ${emailMetrics.sent.toLocaleString()} sent` 
                    : `${linkedCampaigns.length} campaigns linked but 0 sent emails`) 
                  : 'No campaigns linked to this engagement'}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DateRangeFilter value={dateRangeOption} onChange={setDateRangeOption} />
            <Button variant="outline" size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        {/* Engagement Overview */}
        <div className="rounded-lg border bg-card p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Start Date</p>
              <p className="font-medium">
                {engagement.start_date ? new Date(engagement.start_date).toLocaleDateString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">End Date</p>
              <p className="font-medium">
                {engagement.end_date ? new Date(engagement.end_date).toLocaleDateString() : 'Ongoing'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Meeting Goal</p>
              <p className="font-medium">{engagement.meeting_goal || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Linked Campaigns</p>
              <p className="font-medium">{linkedCampaigns.length}</p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Touchpoints</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keyMetrics.totalTouchpoints.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {keyMetrics.emailTouchpoints.toLocaleString()} emails + {keyMetrics.callTouchpoints.toLocaleString()} calls
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positive Responses</CardTitle>
              <Mail className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{keyMetrics.positiveResponses}</div>
              <p className="text-xs text-muted-foreground">
                {keyMetrics.responseRate.toFixed(1)}% response rate
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meetings Scheduled</CardTitle>
              <Calendar className="h-4 w-4 text-chart-1" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-chart-1">{keyMetrics.meetingsScheduled}</div>
              <p className="text-xs text-muted-foreground">
                {keyMetrics.meetingRate.toFixed(2)}% meeting rate
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Companies Contacted</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keyMetrics.companiesContacted}</div>
              <p className="text-xs text-muted-foreground">
                {keyMetrics.contactsReached} contacts reached
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Email & Calling Metrics Side by Side */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Email Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Sent</p>
                  <p className="text-xl font-bold">{emailMetrics.sent.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                  <p className="text-xl font-bold">{emailMetrics.deliveryRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Opened</p>
                  <p className="text-xl font-bold">{emailMetrics.openRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Replied</p>
                  <p className="text-xl font-bold">{emailMetrics.replyRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Positive</p>
                  <p className="text-xl font-bold text-success">{emailMetrics.positiveReplies}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bounce Rate</p>
                  <p className="text-xl font-bold text-destructive">{emailMetrics.bounceRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calling Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Calling Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                  <p className="text-xl font-bold">{callingMetrics.totalCalls.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Connections</p>
                  <p className="text-xl font-bold">{callingMetrics.connections}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Connect Rate</p>
                  <p className="text-xl font-bold">{callingMetrics.connectRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conversations</p>
                  <p className="text-xl font-bold">{callingMetrics.conversations}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Meetings</p>
                  <p className="text-xl font-bold text-success">{callingMetrics.meetings}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Duration</p>
                  <p className="text-xl font-bold">{Math.round(callingMetrics.avgDuration / 60)}m</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Linked Campaigns */}
        {linkedCampaigns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Linked Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {linkedCampaigns.map(campaign => (
                  <div key={campaign.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{campaign.platform}</Badge>
                      <span className="font-medium">{campaign.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
