import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useEngagementReport, DateRange } from '@/hooks/useEngagementReport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, Download, Share2, Calendar, 
  BarChart3, Mail, Phone, Target, Clock, Users
} from 'lucide-react';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { ExecutiveSummaryTab } from '@/components/engagementReport/ExecutiveSummaryTab';
import { EmailReportTab } from '@/components/engagementReport/EmailReportTab';
import { CallingReportTab } from '@/components/engagementReport/CallingReportTab';
import { PipelineMeetingsTab } from '@/components/engagementReport/PipelineMeetingsTab';
import { ActivityTimelineTab } from '@/components/engagementReport/ActivityTimelineTab';
import { TargetsListsTab } from '@/components/engagementReport/TargetsListsTab';

export default function EngagementReport() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: new Date(),
  });
  const [activeTab, setActiveTab] = useState('executive');

  const { data, loading, error } = useEngagementReport(engagementId || '', dateRange);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data?.engagement) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-muted-foreground">{error || 'Engagement not found'}</p>
          <Button onClick={() => navigate('/engagements')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Engagements
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const { engagement } = data;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/engagements')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{engagement.client_name}</h1>
                <Badge variant={engagement.status === 'active' ? 'default' : 'secondary'}>
                  {engagement.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">{engagement.engagement_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />
            <Button variant="outline" size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Engagement Overview */}
        <div className="rounded-lg border bg-card p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Start Date</p>
              <p className="font-medium">{new Date(engagement.start_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Industry Focus</p>
              <p className="font-medium">{engagement.industry_focus || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Geography</p>
              <p className="font-medium">{engagement.geography || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Deal Lead</p>
              <p className="font-medium">{engagement.deal_lead || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Sponsor</p>
              <p className="font-medium">{engagement.sponsor || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Linked Campaigns</p>
              <p className="font-medium">{data.linkedCampaigns.length}</p>
            </div>
          </div>
        </div>

        {/* Report Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
            <TabsTrigger value="executive" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Executive Summary</span>
              <span className="sm:hidden">Summary</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email Report</span>
              <span className="sm:hidden">Email</span>
            </TabsTrigger>
            <TabsTrigger value="calling" className="gap-2">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Calling Report</span>
              <span className="sm:hidden">Calling</span>
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Pipeline & Meetings</span>
              <span className="sm:hidden">Pipeline</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Activity Timeline</span>
              <span className="sm:hidden">Activity</span>
            </TabsTrigger>
            <TabsTrigger value="targets" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Targets & Lists</span>
              <span className="sm:hidden">Targets</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="executive">
            <ExecutiveSummaryTab data={data} />
          </TabsContent>
          <TabsContent value="email">
            <EmailReportTab data={data} />
          </TabsContent>
          <TabsContent value="calling">
            <CallingReportTab data={data} />
          </TabsContent>
          <TabsContent value="pipeline">
            <PipelineMeetingsTab data={data} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTimelineTab data={data} />
          </TabsContent>
          <TabsContent value="targets">
            <TargetsListsTab data={data} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
