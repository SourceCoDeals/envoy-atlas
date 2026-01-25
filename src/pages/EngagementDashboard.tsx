import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Plus, Building2, Loader2, Pencil, Trash2,
  Phone, Target, Archive, DollarSign, Search, Filter, X,
  Mail, ThumbsUp, Calendar
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { EngagementForm, EngagementFormData } from '@/components/engagements/EngagementForm';

// Updated interface to match the new unified schema with team assignments
interface Engagement {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  meeting_goal: number | null;
  target_list_size: number | null;
  sponsor_name: string | null;
  portfolio_company: string | null;
  fee_schedule: string | null;
  monthly_retainer: number | null;
  is_platform: boolean | null;
  deal_lead_id: string | null;
  associate_id: string | null;
  analyst_id: string | null;
  analyst_2_id: string | null;
  research_lead_id: string | null;
  research_mid_id: string | null;
}

interface EngagementMetrics {
  totalCalls: number;
  interestedLeads: number;
  conversations: number;
  meetingsSet: number;
  emailsSent: number;
  positiveReplies: number;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Live', variant: 'default' },
  contracted: { label: 'Contracted', variant: 'outline' },
  paused: { label: 'Paused', variant: 'secondary' },
  transitioned: { label: 'Transitioned', variant: 'secondary' },
  closed: { label: 'Complete', variant: 'secondary' },
};

export default function EngagementDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { teamMembers, getTeamMemberById, getTeamMemberName } = useTeamMembers();
  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [engagementMetrics, setEngagementMetrics] = useState<Record<string, EngagementMetrics>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDealLead, setFilterDealLead] = useState<string>('all');
  const [filterSponsor, setFilterSponsor] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');


  const emptyForm: EngagementFormData = {
    name: '',
    description: '',
    status: 'active',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    meeting_goal: 20,
    target_list_size: 500,
    sponsor_name: '',
    portfolio_company: '',
    fee_schedule: '',
    monthly_retainer: null,
    is_platform: true,
    deal_lead_id: null,
    associate_id: null,
    analyst_id: null,
    analyst_2_id: null,
    research_lead_id: null,
    research_mid_id: null,
  };

  const [formData, setFormData] = useState<EngagementFormData>(emptyForm);

  // Auth not required - public read access enabled

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchEngagements();
    }
  }, [currentWorkspace?.id]);

  const fetchEngagements = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('engagements')
        .select('*')
        .eq('client_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mappedEngagements: Engagement[] = (data || []).map(d => ({
        id: d.id,
        client_id: d.client_id,
        name: d.name,
        description: d.description,
        status: d.status,
        start_date: d.start_date,
        end_date: d.end_date,
        meeting_goal: d.meeting_goal,
        target_list_size: d.target_list_size,
        sponsor_name: d.sponsor_name,
        portfolio_company: d.portfolio_company,
        fee_schedule: d.fee_schedule,
        monthly_retainer: d.monthly_retainer,
        is_platform: d.is_platform,
        deal_lead_id: d.deal_lead_id,
        associate_id: d.associate_id,
        analyst_id: d.analyst_id,
        analyst_2_id: d.analyst_2_id,
        research_lead_id: d.research_lead_id,
        research_mid_id: d.research_mid_id,
      }));
      
      setEngagements(mappedEngagements);

      // Fetch metrics for each engagement
      if (mappedEngagements.length > 0) {
        await fetchEngagementMetrics(mappedEngagements);
      }
    } catch (err) {
      console.error('Error fetching engagements:', err);
      toast.error('Failed to load engagements');
    } finally {
      setLoading(false);
    }
  };

  const fetchEngagementMetrics = async (engagementList: Engagement[]) => {
    try {
      const engagementIds = engagementList.map(e => e.id);
      
      // Fetch all data in parallel
      const [callsRes, meetingsRes, campaignsRes, coldCallsRes] = await Promise.all([
        // Call activities
        supabase
          .from('call_activities')
          .select('engagement_id, disposition, talk_duration, conversation_outcome')
          .in('engagement_id', engagementIds),
        // Meetings
        supabase
          .from('meetings')
          .select('id, engagement_id')
          .in('engagement_id', engagementIds),
        // Campaigns for email metrics
        supabase
          .from('campaigns')
          .select('engagement_id, total_sent, positive_replies, total_meetings')
          .in('engagement_id', engagementIds),
        // Cold calls for additional call/meeting data
        supabase
          .from('cold_calls')
          .select('engagement_id, is_meeting, is_connection')
          .in('engagement_id', engagementIds),
      ]);

      const allCalls = callsRes.data || [];
      const allMeetings = meetingsRes.data || [];
      const allCampaigns = campaignsRes.data || [];
      const allColdCalls = coldCallsRes.data || [];

      const metricsMap: Record<string, EngagementMetrics> = {};
      
      // Initialize all engagements with zero metrics
      for (const eng of engagementList) {
        metricsMap[eng.id] = {
          totalCalls: 0,
          interestedLeads: 0,
          conversations: 0,
          meetingsSet: 0,
          emailsSent: 0,
          positiveReplies: 0,
        };
      }

      // Aggregate call_activities data
      for (const call of allCalls) {
        const m = metricsMap[call.engagement_id];
        if (m) {
          m.totalCalls++;
          if ((call.talk_duration || 0) > 30) {
            m.conversations++;
          }
          if (
            call.disposition?.toLowerCase().includes('interested') ||
            call.conversation_outcome?.toLowerCase().includes('interested')
          ) {
            m.interestedLeads++;
          }
        }
      }

      // Aggregate meetings data
      for (const meeting of allMeetings) {
        const m = metricsMap[meeting.engagement_id];
        if (m) {
          m.meetingsSet++;
        }
      }

      // Aggregate campaign/email data
      for (const campaign of allCampaigns) {
        const m = metricsMap[campaign.engagement_id];
        if (m) {
          m.emailsSent += campaign.total_sent || 0;
          m.positiveReplies += campaign.positive_replies || 0;
          m.meetingsSet += campaign.total_meetings || 0;
        }
      }

      // Aggregate cold_calls data (if engagement_id is set)
      for (const call of allColdCalls) {
        if (!call.engagement_id) continue;
        const m = metricsMap[call.engagement_id];
        if (m) {
          m.totalCalls++;
          if (call.is_meeting) m.meetingsSet++;
        }
      }
      
      setEngagementMetrics(metricsMap);
    } catch (err) {
      console.error('Error fetching engagement metrics:', err);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (engagement: Engagement) => {
    setEditingId(engagement.id);
    setFormData({
      name: engagement.name,
      description: engagement.description || '',
      status: engagement.status || 'active',
      start_date: engagement.start_date || new Date().toISOString().split('T')[0],
      end_date: engagement.end_date || '',
      meeting_goal: engagement.meeting_goal || 20,
      target_list_size: engagement.target_list_size || 500,
      sponsor_name: engagement.sponsor_name || '',
      portfolio_company: engagement.portfolio_company || '',
      fee_schedule: engagement.fee_schedule || '',
      monthly_retainer: engagement.monthly_retainer,
      is_platform: engagement.is_platform ?? true,
      deal_lead_id: engagement.deal_lead_id,
      associate_id: engagement.associate_id,
      analyst_id: engagement.analyst_id,
      analyst_2_id: engagement.analyst_2_id,
      research_lead_id: engagement.research_lead_id,
      research_mid_id: engagement.research_mid_id,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentWorkspace?.id) return;
    if (!formData.name) {
      toast.error('Engagement name is required');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        status: formData.status,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        meeting_goal: formData.meeting_goal,
        target_list_size: formData.target_list_size,
        sponsor_name: formData.sponsor_name || null,
        portfolio_company: formData.portfolio_company || null,
        fee_schedule: formData.fee_schedule || null,
        monthly_retainer: formData.monthly_retainer,
        is_platform: formData.is_platform,
        deal_lead_id: formData.deal_lead_id,
        associate_id: formData.associate_id,
        analyst_id: formData.analyst_id,
        analyst_2_id: formData.analyst_2_id,
        research_lead_id: formData.research_lead_id,
        research_mid_id: formData.research_mid_id,
      };

      if (editingId) {
        const { error } = await supabase
          .from('engagements')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Engagement updated');
      } else {
        const { error } = await supabase.from('engagements').insert({
          client_id: currentWorkspace.id,
          ...payload,
        });

        if (error) throw error;
        toast.success('Engagement created');
      }

      setDialogOpen(false);
      fetchEngagements();
    } catch (err) {
      console.error('Error saving engagement:', err);
      toast.error('Failed to save engagement');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this engagement?')) return;

    try {
      const { error } = await supabase.from('engagements').delete().eq('id', id);
      if (error) throw error;
      toast.success('Engagement deleted');
      fetchEngagements();
    } catch (err) {
      console.error('Error deleting engagement:', err);
      toast.error('Failed to delete engagement');
    }
  };

  // Toggle engagement status
  const handleToggleStatus = async (engagementId: string, currentStatus: string) => {
    const isActive = ['active', 'contracted', 'paused'].includes(currentStatus);
    const newStatus = isActive ? 'closed' : 'active';
    try {
      const { error } = await supabase
        .from('engagements')
        .update({ status: newStatus })
        .eq('id', engagementId);

      if (error) throw error;
      
      setEngagements(prev => 
        prev.map(e => e.id === engagementId ? { ...e, status: newStatus } : e)
      );
      toast.success(`Engagement marked as ${newStatus === 'closed' ? 'complete' : 'live'}`);
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Failed to update status');
    }
  };


  // Get unique filter options
  const filterOptions = useMemo(() => {
    const dealLeads = new Set<string>();
    const sponsors = new Set<string>();
    
    engagements.forEach(e => {
      if (e.deal_lead_id) dealLeads.add(e.deal_lead_id);
      if (e.sponsor_name) sponsors.add(e.sponsor_name);
    });
    
    return {
      dealLeads: Array.from(dealLeads),
      sponsors: Array.from(sponsors).sort(),
    };
  }, [engagements]);

  // Filter engagements by active tab, search, and column filters
  const filteredEngagements = useMemo(() => {
    return engagements.filter(e => {
      const status = e.status || 'active';
      const isActive = ['active', 'contracted', 'paused'].includes(status);
      const matchesTab = activeTab === 'active' ? isActive : !isActive;
      
      if (!matchesTab) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          e.name?.toLowerCase().includes(query) ||
          e.sponsor_name?.toLowerCase().includes(query) ||
          e.portfolio_company?.toLowerCase().includes(query) ||
          e.description?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Deal Lead filter
      if (filterDealLead !== 'all' && e.deal_lead_id !== filterDealLead) {
        return false;
      }
      
      // Sponsor filter
      if (filterSponsor !== 'all' && e.sponsor_name !== filterSponsor) {
        return false;
      }
      
      // Type filter
      if (filterType !== 'all') {
        const isPlatform = e.is_platform ?? true;
        if (filterType === 'platform' && !isPlatform) return false;
        if (filterType === 'addon' && isPlatform) return false;
      }
      
      return true;
    });
  }, [engagements, activeTab, searchQuery, filterDealLead, filterSponsor, filterType]);

  // Count by status
  const statusCounts = useMemo(() => {
    const active = engagements.filter(e => {
      const status = e.status || 'active';
      return ['active', 'contracted', 'paused'].includes(status);
    }).length;
    const closed = engagements.length - active;
    return { active, closed };
  }, [engagements]);

  // Calculate totals
  const totals = useMemo(() => {
    return Object.values(engagementMetrics).reduce(
      (acc, m) => ({
        calls: acc.calls + m.totalCalls,
        interested: acc.interested + m.interestedLeads,
        meetings: acc.meetings + m.meetingsSet,
        emailsSent: acc.emailsSent + m.emailsSent,
        positiveReplies: acc.positiveReplies + m.positiveReplies,
      }),
      { calls: 0, interested: 0, meetings: 0, emailsSent: 0, positiveReplies: 0 }
    );
  }, [engagementMetrics]);

  const totalRetainer = useMemo(() => {
    return engagements
      .filter(e => ['active', 'contracted', 'paused'].includes(e.status || 'active'))
      .reduce((sum, e) => sum + (e.monthly_retainer || 0), 0);
  }, [engagements]);

  // Helper to get initials
  const getInitials = (id: string | null) => {
    const member = getTeamMemberById(id);
    if (!member) return null;
    const first = member.first_name?.[0] || '';
    const last = member.last_name?.[0] || '';
    return (first + last).toUpperCase() || null;
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Engagements</h1>
            <p className="text-muted-foreground">
              Manage client engagements and track performance
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Engagement
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Engagements</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusCounts.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.emailsSent.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positive Replies</CardTitle>
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.positiveReplies.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.calls.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meetings Booked</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.meetings.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Retainer</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${totalRetainer.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Engagements Table with Tabs */}
        <Card>
          <CardHeader className="pb-3 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'closed')}>
                <TabsList>
                  <TabsTrigger value="active" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Active
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">{statusCounts.active}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="closed" className="flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    Closed
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">{statusCounts.closed}</Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search engagements..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            {/* Column Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>Filter:</span>
              </div>
              
              <Select value={filterSponsor} onValueChange={setFilterSponsor}>
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="Sponsor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sponsors</SelectItem>
                  {filterOptions.sponsors.map(sponsor => (
                    <SelectItem key={sponsor} value={sponsor}>{sponsor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterDealLead} onValueChange={setFilterDealLead}>
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="Deal Lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Deal Leads</SelectItem>
                  {filterOptions.dealLeads.map(id => {
                    const member = getTeamMemberById(id);
                    return (
                      <SelectItem key={id} value={id}>
                        {member ? getTeamMemberName(member) : id}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[130px] h-8">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="platform">Platform</SelectItem>
                  <SelectItem value="addon">Add-on</SelectItem>
                </SelectContent>
              </Select>
              
              {(searchQuery || filterSponsor !== 'all' || filterDealLead !== 'all' || filterType !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterSponsor('all');
                    setFilterDealLead('all');
                    setFilterType('all');
                  }}
                  className="h-8 px-2 text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
              
              {filteredEngagements.length !== engagements.filter(e => {
                const status = e.status || 'active';
                const isActive = ['active', 'contracted', 'paused'].includes(status);
                return activeTab === 'active' ? isActive : !isActive;
              }).length && (
                <span className="text-sm text-muted-foreground">
                  Showing {filteredEngagements.length} of {engagements.filter(e => {
                    const status = e.status || 'active';
                    const isActive = ['active', 'contracted', 'paused'].includes(status);
                    return activeTab === 'active' ? isActive : !isActive;
                  }).length}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEngagements.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {activeTab === 'active' ? 'No active engagements' : 'No closed engagements'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {activeTab === 'active' 
                    ? 'Create your first engagement to start tracking performance'
                    : 'Closed engagements will appear here'}
                </p>
                {activeTab === 'active' && (
                  <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Engagement
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Sponsor</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Deal Lead</TableHead>
                      <TableHead>Associate</TableHead>
                      <TableHead>Analyst</TableHead>
                      <TableHead>Research Lead</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEngagements.map((engagement) => {
                      const currentStatus = engagement.status || 'active';
                      const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.active;
                      const dealLead = getTeamMemberById(engagement.deal_lead_id);
                      const associate = getTeamMemberById(engagement.associate_id);
                      const analyst = getTeamMemberById(engagement.analyst_id);
                      const researchLead = getTeamMemberById(engagement.research_lead_id);

                      return (
                        <TableRow 
                          key={engagement.id} 
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => navigate(`/engagements/${engagement.id}/report`)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Badge 
                              variant={statusConfig.variant}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => handleToggleStatus(engagement.id, currentStatus)}
                            >
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {engagement.sponsor_name || engagement.name}
                          </TableCell>
                          <TableCell>
                            {engagement.portfolio_company || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {engagement.start_date 
                              ? new Date(engagement.start_date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  year: '2-digit' 
                                })
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={engagement.is_platform ? 'default' : 'secondary'}>
                              {engagement.is_platform ? 'Platform' : 'Add-on'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {dealLead ? (
                              <span className="text-sm">{getTeamMemberName(dealLead)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {associate ? (
                              <span className="text-sm">{getTeamMemberName(associate)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {analyst ? (
                              <Badge variant="outline" className="text-xs">
                                {getInitials(engagement.analyst_id)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {researchLead ? (
                              <Badge variant="outline" className="text-xs">
                                {getInitials(engagement.research_lead_id)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(engagement)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(engagement.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Engagement' : 'Create Engagement'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update engagement details' : 'Create a new client engagement'}
              </DialogDescription>
            </DialogHeader>

            <EngagementForm
              formData={formData}
              onChange={setFormData}
              onSave={handleSave}
              onCancel={() => setDialogOpen(false)}
              saving={creating}
              isEdit={!!editingId}
              teamMembers={teamMembers}
            />
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
