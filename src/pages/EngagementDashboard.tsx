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
  Phone, Target, BarChart3, Wand2, Check, X, Archive, DollarSign
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  // Auto-pair state
  const [autoPairDialogOpen, setAutoPairDialogOpen] = useState(false);
  const [autoPairLoading, setAutoPairLoading] = useState(false);
  const [autoPairResults, setAutoPairResults] = useState<{
    engagementsCreated: number;
    campaignsLinked: number;
    campaignsSkipped: number;
    skippedReasons: { name: string; reason: string }[];
    details: { engagement: string; campaigns: string[] }[];
  } | null>(null);

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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

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
      
      // Fetch all call activities in a single query
      const { data: allCalls } = await supabase
        .from('call_activities')
        .select('engagement_id, disposition, talk_duration, conversation_outcome')
        .in('engagement_id', engagementIds);

      // Fetch all meetings in a single query
      const { data: allMeetings } = await supabase
        .from('meetings')
        .select('id, engagement_id')
        .in('engagement_id', engagementIds);

      const metricsMap: Record<string, EngagementMetrics> = {};
      
      // Initialize all engagements with zero metrics
      for (const eng of engagementList) {
        metricsMap[eng.id] = {
          totalCalls: 0,
          interestedLeads: 0,
          conversations: 0,
          meetingsSet: 0,
        };
      }

      // Aggregate call data
      for (const call of (allCalls || [])) {
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
      for (const meeting of (allMeetings || [])) {
        const m = metricsMap[meeting.engagement_id];
        if (m) {
          m.meetingsSet++;
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

  // Handle auto-pairing campaigns
  const handleAutoPair = async () => {
    if (!currentWorkspace?.id) return;
    
    setAutoPairLoading(true);
    setAutoPairResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('auto-pair-engagements', {
        body: {
          client_id: currentWorkspace.id,
          dry_run: false,
        },
      });

      if (error) throw error;

      setAutoPairResults({
        engagementsCreated: data.engagementsCreated,
        campaignsLinked: data.campaignsLinked,
        campaignsSkipped: data.campaignsSkipped,
        skippedReasons: data.skippedReasons || [],
        details: data.details || [],
      });

      if (data.engagementsCreated > 0 || data.campaignsLinked > 0) {
        toast.success(`Created ${data.engagementsCreated} engagements, linked ${data.campaignsLinked} campaigns`);
        fetchEngagements();
      } else {
        toast.info('No new matches found to auto-pair');
      }
    } catch (err) {
      console.error('Error auto-pairing:', err);
      toast.error('Failed to auto-pair campaigns');
    } finally {
      setAutoPairLoading(false);
    }
  };

  // Filter engagements by active tab
  const filteredEngagements = useMemo(() => {
    return engagements.filter(e => {
      const status = e.status || 'active';
      const isActive = ['active', 'contracted', 'paused'].includes(status);
      return activeTab === 'active' ? isActive : !isActive;
    });
  }, [engagements, activeTab]);

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
      }),
      { calls: 0, interested: 0, meetings: 0 }
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAutoPairDialogOpen(true)}>
              <Wand2 className="mr-2 h-4 w-4" />
              Auto-Pair
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New Engagement
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
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
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.calls.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meetings Set</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
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
          <CardHeader className="pb-3">
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
                      <TableHead>Deal Lead</TableHead>
                      <TableHead>Analysts</TableHead>
                      <TableHead>Research</TableHead>
                      <TableHead className="text-right">Retainer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEngagements.map((engagement) => {
                      const currentStatus = engagement.status || 'active';
                      const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.active;
                      const dealLead = getTeamMemberById(engagement.deal_lead_id);
                      const analyst1 = getTeamMemberById(engagement.analyst_id);
                      const analyst2 = getTeamMemberById(engagement.analyst_2_id);
                      const researchLead = getTeamMemberById(engagement.research_lead_id);
                      const researchMid = getTeamMemberById(engagement.research_mid_id);

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
                            {dealLead ? (
                              <span className="text-sm">{getTeamMemberName(dealLead)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {analyst1 && (
                                <Badge variant="outline" className="text-xs">
                                  {getInitials(engagement.analyst_id)}
                                </Badge>
                              )}
                              {analyst2 && (
                                <Badge variant="outline" className="text-xs">
                                  {getInitials(engagement.analyst_2_id)}
                                </Badge>
                              )}
                              {!analyst1 && !analyst2 && (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {researchLead && (
                                <Badge variant="outline" className="text-xs">
                                  {getInitials(engagement.research_lead_id)}
                                </Badge>
                              )}
                              {researchMid && (
                                <Badge variant="outline" className="text-xs">
                                  {getInitials(engagement.research_mid_id)}
                                </Badge>
                              )}
                              {!researchLead && !researchMid && (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {engagement.monthly_retainer 
                              ? `$${engagement.monthly_retainer.toLocaleString()}`
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={engagement.is_platform ? 'default' : 'secondary'}>
                              {engagement.is_platform ? 'Platform' : 'Add-on'}
                            </Badge>
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

        {/* Auto-Pair Dialog */}
        <Dialog open={autoPairDialogOpen} onOpenChange={setAutoPairDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Auto-Pair Campaigns to Engagements
              </DialogTitle>
              <DialogDescription>
                Automatically create engagements and link campaigns based on client name and industry patterns.
              </DialogDescription>
            </DialogHeader>

            {!autoPairResults && !autoPairLoading && (
              <div className="py-6 space-y-4">
                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="font-medium mb-2">How it works:</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-green-500" />
                      Analyzes campaign names to extract client and industry
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-green-500" />
                      Creates one engagement per client + industry combination
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-green-500" />
                      Links matching campaigns automatically
                    </li>
                    <li className="flex items-start gap-2">
                      <X className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      Skips SourceCo campaigns (internal)
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {autoPairLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Analyzing and pairing campaigns...</p>
              </div>
            )}

            {autoPairResults && (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg border p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{autoPairResults.engagementsCreated}</div>
                      <div className="text-sm text-muted-foreground">Engagements Created</div>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{autoPairResults.campaignsLinked}</div>
                      <div className="text-sm text-muted-foreground">Campaigns Linked</div>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <div className="text-2xl font-bold text-muted-foreground">{autoPairResults.campaignsSkipped}</div>
                      <div className="text-sm text-muted-foreground">Skipped</div>
                    </div>
                  </div>

                  {autoPairResults.details.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Engagements & Campaigns:</h4>
                      <div className="space-y-2">
                        {autoPairResults.details.slice(0, 20).map((detail, i) => (
                          <div key={i} className="rounded-lg border p-3">
                            <div className="font-medium text-sm flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              {detail.engagement}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {detail.campaigns.length} campaign{detail.campaigns.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            <DialogFooter>
              {!autoPairResults ? (
                <>
                  <Button variant="outline" onClick={() => setAutoPairDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAutoPair} disabled={autoPairLoading}>
                    {autoPairLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Run Auto-Pair
                  </Button>
                </>
              ) : (
                <Button onClick={() => {
                  setAutoPairDialogOpen(false);
                  setAutoPairResults(null);
                }}>
                  Done
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
