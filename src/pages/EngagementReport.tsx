import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEngagementReport } from '@/hooks/useEngagementReport';
import { useCampaignLinking, UnlinkedCampaign } from '@/hooks/useCampaignLinking';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataHealthIndicator } from '@/components/ui/data-health-indicator';
import { DataErrorFlag } from '@/components/ui/data-error-flag';
import { DateRangeFilter, getDateRange, type DateRangeOption } from '@/components/dashboard/DateRangeFilter';
import { EmailReportTab } from '@/components/engagementReport/EmailReportTab';
import { CallingReportTab } from '@/components/engagementReport/CallingReportTab';
import { CampaignSummaryCard } from '@/components/engagementReport/CampaignSummaryCard';
import { LinkCampaignsDialog, UnlinkedCampaign as DialogCampaign } from '@/components/engagements/LinkCampaignsDialog';
import { ArrowLeft, Share2, Mail, Phone, Target, Calendar, Building2, Briefcase, Building, Link2, Plus } from 'lucide-react';

export default function EngagementReport() {
  const navigate = useNavigate();
  const { engagementId } = useParams<{ engagementId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('last30');
  const [activeTab, setActiveTab] = useState('email');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [unlinkedCampaigns, setUnlinkedCampaigns] = useState<UnlinkedCampaign[]>([]);
  const dateRange = getDateRange(dateRangeOption);
  
  const { linkCampaignsToEngagement, fetchCampaignsNotInEngagement } = useCampaignLinking();
  
  const { data, loading, error, refetch } = useEngagementReport(engagementId || '', {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  // Fetch unlinked campaigns when opening dialog
  const handleOpenLinkDialog = useCallback(async () => {
    if (!engagementId) return;
    const campaigns = await fetchCampaignsNotInEngagement(engagementId);
    setUnlinkedCampaigns(campaigns);
    setLinkDialogOpen(true);
  }, [engagementId, fetchCampaignsNotInEngagement]);

  // Handle linking campaigns
  const handleLinkCampaigns = useCallback(async (
    campaignIds: { id: string; platform: 'smartlead' | 'replyio' }[]
  ) => {
    if (!engagementId) return;
    const ids = campaignIds.map(c => c.id);
    const result = await linkCampaignsToEngagement(ids, engagementId);
    if (result.success) {
      refetch();
    }
  }, [engagementId, linkCampaignsToEngagement, refetch]);

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

  const { 
    engagement, 
    keyMetrics, 
    emailMetrics, 
    callingMetrics, 
    linkedCampaignsWithStats,
    callDispositions,
    callOutcomes,
    dataAvailability
  } = data;

  // Determine status styling using semantic tokens
  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }> = {
    active: { variant: 'default', className: 'bg-success/20 text-success border-success/30' },
    contracted: { variant: 'secondary', className: 'bg-primary/20 text-primary border-primary/30' },
    paused: { variant: 'outline', className: 'bg-warning/20 text-warning border-warning/30' },
    closed: { variant: 'secondary', className: 'bg-muted text-muted-foreground' },
    transitioned: { variant: 'secondary', className: 'bg-accent text-accent-foreground' },
  };

  const engagementStatus = statusConfig[engagement.status || 'active'] || statusConfig.active;

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
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{engagement.name}</h1>
                  <Badge variant={engagementStatus.variant} className={engagementStatus.className}>
                    {engagement.status}
                  </Badge>
                </div>
                {engagement.description && (
                  <p className="text-muted-foreground text-sm mt-1">{engagement.description}</p>
                )}
              </div>
              <DataHealthIndicator 
                status={linkedCampaignsWithStats.length > 0 ? (emailMetrics.sent > 0 ? 'healthy' : 'degraded') : 'empty'} 
                tooltip={linkedCampaignsWithStats.length > 0 
                  ? (emailMetrics.sent > 0 
                    ? `${linkedCampaignsWithStats.length} campaigns, ${emailMetrics.sent.toLocaleString()} sent` 
                    : `${linkedCampaignsWithStats.length} campaigns linked but 0 sent emails`) 
                  : 'No campaigns linked to this engagement'}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleOpenLinkDialog}>
              <Link2 className="mr-2 h-4 w-4" />
              Link Campaigns
            </Button>
            <DateRangeFilter value={dateRangeOption} onChange={setDateRangeOption} />
            <Button variant="outline" size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        {/* Engagement Overview */}
        <div className="rounded-lg border bg-card p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
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
              <p className="text-muted-foreground">Target List Size</p>
              <p className="font-medium">{engagement.target_list_size?.toLocaleString() || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Linked Campaigns</p>
              <p className="font-medium">{linkedCampaignsWithStats.length}</p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Touchpoints</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keyMetrics.totalTouchpoints.toLocaleString()}</div>
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {keyMetrics.emailTouchpoints.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {keyMetrics.callTouchpoints.toLocaleString()}
                  {!dataAvailability?.callingData && (
                    <DataErrorFlag type="not-tracked" size="sm" tooltip="No calling data synced yet" />
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positive Responses</CardTitle>
              <Mail className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{keyMetrics.positiveResponses}</div>
              <p className="text-xs text-muted-foreground">
                {keyMetrics.responseRate.toFixed(1)}% response rate
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Meetings Scheduled</CardTitle>
                <DataErrorFlag type="not-tracked" size="sm" tooltip="Only call meetings tracked. Email meetings require calendar integration." />
              </div>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{keyMetrics.meetingsScheduled}</div>
              <p className="text-xs text-muted-foreground">
                {keyMetrics.meetingRate.toFixed(2)}% meeting rate
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Companies Contacted</CardTitle>
                <DataErrorFlag type="not-tracked" size="sm" tooltip="Only companies from calls tracked. Email requires CRM integration." />
              </div>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keyMetrics.companiesContacted}</div>
              <p className="text-xs text-muted-foreground">
                {keyMetrics.contactsReached} contacts reached
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Channel Performance Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Performance
            </TabsTrigger>
            <TabsTrigger value="calling" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Calling Performance
              {!dataAvailability?.callingData && (
                <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0">0</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4">
            <EmailReportTab 
              data={{
                emailMetrics,
                linkedCampaigns: linkedCampaignsWithStats.map(c => ({ 
                  id: c.id, 
                  name: c.name, 
                  platform: c.platform as 'smartlead' | 'replyio'
                })),
                infrastructureMetrics: data.infrastructureMetrics,
                dataAvailability: dataAvailability,
              }}
            />
          </TabsContent>

          <TabsContent value="calling" className="space-y-4">
            {dataAvailability?.callingData ? (
              <CallingReportTab 
                data={{
                  callingMetrics,
                  callDispositions,
                  callOutcomes,
                }}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Calling Data Available</h3>
                  <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                    Connect a calling integration (like PhoneBurner) to track call metrics including:
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto text-sm text-muted-foreground">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="font-medium">Total Calls</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="font-medium">Connect Rate</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="font-medium">Conversations</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="font-medium">Meetings Booked</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="font-medium">Voicemail Rate</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="font-medium">Avg Duration</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="font-medium">Dispositions</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="font-medium">Call Outcomes</p>
                    </div>
                  </div>
                  <Button className="mt-6" onClick={() => navigate('/settings')}>
                    Connect Integration
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Linked Campaigns - Summary Cards */}
        {linkedCampaignsWithStats.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Linked Campaigns
                </CardTitle>
                <Badge variant="outline">{linkedCampaignsWithStats.length} campaigns</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {linkedCampaignsWithStats.slice(0, 6).map(campaign => (
                  <CampaignSummaryCard key={campaign.id} campaign={campaign} />
                ))}
              </div>
              {linkedCampaignsWithStats.length > 6 && (
                <div className="mt-4 text-center">
                  <Button variant="outline" onClick={() => navigate('/campaigns')}>
                    View All {linkedCampaignsWithStats.length} Campaigns
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Link Campaigns Dialog */}
        <LinkCampaignsDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          campaigns={unlinkedCampaigns.map(c => ({
            id: c.id,
            name: c.name,
            platform: c.platform,
            status: c.status,
            totalSent: c.totalSent,
          }))}
          onLink={handleLinkCampaigns}
          engagementName={engagement.name}
        />
      </div>
    </DashboardLayout>
  );
}
