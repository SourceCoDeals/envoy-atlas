import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Plus, Building2, Loader2, Pencil, Trash2, ChevronDown, ChevronRight,
  Phone, Target, TrendingUp, Users, Link as LinkIcon, BarChart3, Wand2, Check, X, Archive
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { LinkedCampaignsList, LinkedCampaign } from '@/components/engagements/LinkedCampaignsList';
import { LinkCampaignsDialog, UnlinkedCampaign } from '@/components/engagements/LinkCampaignsDialog';

// Updated interface to match the new unified schema
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
}

interface EngagementMetrics {
  totalCalls: number;
  avgScore: number;
  interestedLeads: number;
  conversations: number;
  meetingsSet: number;
}

interface CampaignSummary {
  clientProject: string;
  totalCalls: number;
  avgScore: number;
  interestedLeads: number;
}

export default function EngagementDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [campaignSummaries, setCampaignSummaries] = useState<CampaignSummary[]>([]);
  const [engagementMetrics, setEngagementMetrics] = useState<Record<string, EngagementMetrics>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
  // Campaign linking state
  const [linkedCampaigns, setLinkedCampaigns] = useState<Record<string, LinkedCampaign[]>>({});
  const [unlinkedCampaigns, setUnlinkedCampaigns] = useState<UnlinkedCampaign[]>([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingEngagementId, setLinkingEngagementId] = useState<string | null>(null);
  const [unlinkingCampaign, setUnlinkingCampaign] = useState<string | null>(null);

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

  const emptyForm = {
    name: '',
    description: '',
    status: 'active',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    meeting_goal: 20,
    target_list_size: 500,
  };

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchEngagements();
      fetchCampaignSummaries();
      fetchAllCampaigns();
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
    if (!currentWorkspace?.id) return;

    try {
      const metricsMap: Record<string, EngagementMetrics> = {};
      
      for (const eng of engagementList) {
        // Get call activities for this engagement
        const { data: callData } = await supabase
          .from('call_activities')
          .select('disposition, talk_duration, conversation_outcome, to_name')
          .eq('engagement_id', eng.id);

        // Get meetings for this engagement
        const { data: meetingsData } = await supabase
          .from('meetings')
          .select('id')
          .eq('engagement_id', eng.id);

        const calls = callData || [];
        const totalCalls = calls.length;
        
        // Count conversations (calls with talk time)
        const conversations = calls.filter(c => (c.talk_duration || 0) > 30).length;
        
        // Interested leads based on disposition
        const interestedLeads = calls.filter(c => 
          c.disposition?.toLowerCase().includes('interested') ||
          c.conversation_outcome?.toLowerCase().includes('interested')
        ).length;

        metricsMap[eng.id] = {
          totalCalls,
          avgScore: 0, // Scores not tracked in call_activities
          interestedLeads,
          conversations,
          meetingsSet: meetingsData?.length || 0,
        };
      }
      
      setEngagementMetrics(metricsMap);
    } catch (err) {
      console.error('Error fetching engagement metrics:', err);
    }
  };

  // Fetch all campaigns from unified campaigns table
  const fetchAllCampaigns = useCallback(async () => {
    if (!currentWorkspace?.id) return;

    try {
      // Get engagement IDs for this workspace
      const { data: engagementsData } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagementsData || []).map(e => e.id);

      if (engagementIds.length === 0) {
        setLinkedCampaigns({});
        setUnlinkedCampaigns([]);
        return;
      }

      // Fetch campaigns from unified campaigns table
      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('id, name, status, engagement_id, total_sent, total_opened, total_replied, campaign_type')
        .in('engagement_id', engagementIds);

      // Fetch unlinked campaigns (campaigns where engagement_id is null but data_source belongs to workspace)
      const { data: dataSources } = await supabase
        .from('data_sources')
        .select('id')
        .limit(100);

      const dataSourceIds = (dataSources || []).map(d => d.id);

      const { data: unlinkedCampaignsData } = await supabase
        .from('campaigns')
        .select('id, name, status, total_sent, campaign_type')
        .is('engagement_id', null)
        .in('data_source_id', dataSourceIds);

      // Process campaigns into linked map
      const linkedMap: Record<string, LinkedCampaign[]> = {};

      (campaignsData || []).forEach((c) => {
        const campaign: LinkedCampaign = {
          id: c.id,
          name: c.name,
          platform: c.campaign_type === 'email' ? 'smartlead' : 'replyio',
          status: c.status || 'active',
          totalSent: c.total_sent || 0,
          totalOpened: c.total_opened || 0,
          totalReplied: c.total_replied || 0,
          totalPositive: 0,
        };

        if (c.engagement_id) {
          if (!linkedMap[c.engagement_id]) linkedMap[c.engagement_id] = [];
          linkedMap[c.engagement_id].push(campaign);
        }
      });

      // Process unlinked campaigns
      const unlinked: UnlinkedCampaign[] = (unlinkedCampaignsData || []).map(c => ({
        id: c.id,
        name: c.name,
        platform: c.campaign_type === 'email' ? 'smartlead' : 'replyio',
        status: c.status || 'active',
        totalSent: c.total_sent || 0,
      }));

      setLinkedCampaigns(linkedMap);
      setUnlinkedCampaigns(unlinked);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    }
  }, [currentWorkspace?.id]);

  const fetchCampaignSummaries = async () => {
    if (!currentWorkspace?.id) return;

    try {
      // Get engagement IDs for this workspace
      const { data: engagementsData } = await supabase
        .from('engagements')
        .select('id, name')
        .eq('client_id', currentWorkspace.id);

      if (!engagementsData || engagementsData.length === 0) {
        setCampaignSummaries([]);
        return;
      }

      const engagementIds = engagementsData.map(e => e.id);

      // Get call activities for these engagements
      const { data: callData } = await supabase
        .from('call_activities')
        .select('engagement_id, disposition, talk_duration, conversation_outcome')
        .in('engagement_id', engagementIds);

      // Group by engagement
      const grouped: Record<string, { calls: number; interested: number }> = {};
      
      engagementsData.forEach(eng => {
        grouped[eng.name] = { calls: 0, interested: 0 };
      });

      (callData || []).forEach(call => {
        const engagement = engagementsData.find(e => e.id === call.engagement_id);
        if (engagement) {
          grouped[engagement.name].calls++;
          if (call.disposition?.toLowerCase().includes('interested') ||
              call.conversation_outcome?.toLowerCase().includes('interested')) {
            grouped[engagement.name].interested++;
          }
        }
      });

      const summaries: CampaignSummary[] = Object.entries(grouped)
        .map(([clientProject, data]) => ({
          clientProject,
          totalCalls: data.calls,
          avgScore: 0,
          interestedLeads: data.interested,
        }))
        .sort((a, b) => b.totalCalls - a.totalCalls)
        .slice(0, 25);

      setCampaignSummaries(summaries);
    } catch (err) {
      console.error('Error fetching campaign summaries:', err);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Open link campaigns dialog
  const openLinkDialog = (engagementId: string) => {
    setLinkingEngagementId(engagementId);
    setLinkDialogOpen(true);
  };

  // Handle linking campaigns to engagement
  const handleLinkCampaigns = async (campaigns: { id: string; platform: 'smartlead' | 'replyio' }[]) => {
    if (!linkingEngagementId) return;

    try {
      const campaignIds = campaigns.map(c => c.id);

      if (campaignIds.length > 0) {
        const { error } = await supabase
          .from('campaigns')
          .update({ engagement_id: linkingEngagementId })
          .in('id', campaignIds);

        if (error) throw error;
      }

      toast.success(`Linked ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}`);
      fetchAllCampaigns();
    } catch (err) {
      console.error('Error linking campaigns:', err);
      toast.error('Failed to link campaigns');
      throw err;
    }
  };

  // Handle unlinking a campaign from engagement
  const handleUnlinkCampaign = async (campaignId: string, _platform: 'smartlead' | 'replyio') => {
    setUnlinkingCampaign(campaignId);
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ engagement_id: null })
        .eq('id', campaignId);

      if (error) throw error;
      toast.success('Campaign unlinked');
      fetchAllCampaigns();
    } catch (err) {
      console.error('Error unlinking campaign:', err);
      toast.error('Failed to unlink campaign');
    } finally {
      setUnlinkingCampaign(null);
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
      if (editingId) {
        const { error } = await supabase
          .from('engagements')
          .update({
            name: formData.name,
            description: formData.description || null,
            status: formData.status,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            meeting_goal: formData.meeting_goal,
            target_list_size: formData.target_list_size,
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Engagement updated');
      } else {
        const { error } = await supabase.from('engagements').insert({
          client_id: currentWorkspace.id,
          name: formData.name,
          description: formData.description || null,
          status: formData.status,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          meeting_goal: formData.meeting_goal,
          target_list_size: formData.target_list_size,
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
        // Refresh data
        fetchEngagements();
        fetchAllCampaigns();
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

  // Toggle engagement status
  const handleToggleStatus = async (engagementId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'closed' : 'active';
    try {
      const { error } = await supabase
        .from('engagements')
        .update({ status: newStatus })
        .eq('id', engagementId);

      if (error) throw error;
      
      setEngagements(prev => 
        prev.map(e => e.id === engagementId ? { ...e, status: newStatus } : e)
      );
      toast.success(`Engagement marked as ${newStatus}`);
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Failed to update status');
    }
  };

  // Filter engagements by active tab
  const filteredEngagements = useMemo(() => {
    return engagements.filter(e => {
      const status = e.status || 'active';
      return activeTab === 'active' ? status === 'active' : status === 'closed';
    });
  }, [engagements, activeTab]);

  // Count by status
  const statusCounts = useMemo(() => {
    const active = engagements.filter(e => (e.status || 'active') === 'active').length;
    const closed = engagements.filter(e => e.status === 'closed').length;
    return { active, closed };
  }, [engagements]);

  const totals = useMemo(() => {
    return campaignSummaries.reduce(
      (acc, c) => ({
        calls: acc.calls + c.totalCalls,
        interested: acc.interested + c.interestedLeads,
      }),
      { calls: 0, interested: 0 }
    );
  }, [campaignSummaries]);

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
              Auto-Pair Campaigns
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
              <CardTitle className="text-sm font-medium">Total Engagements</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{engagements.length}</div>
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
              <CardTitle className="text-sm font-medium">Interested Leads</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.interested.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Linked Campaigns</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(linkedCampaigns).reduce((sum, campaigns) => sum + campaigns.length, 0)}
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Conversations</TableHead>
                    <TableHead className="text-right">Interested</TableHead>
                    <TableHead className="text-right">Meetings</TableHead>
                    <TableHead className="text-right">Campaigns</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEngagements.map((engagement) => {
                    const metrics = engagementMetrics[engagement.id] || {
                      totalCalls: 0,
                      avgScore: 0,
                      interestedLeads: 0,
                      conversations: 0,
                      meetingsSet: 0,
                    };
                    const campaigns = linkedCampaigns[engagement.id] || [];
                    const isExpanded = expandedRows.has(engagement.id);
                    const currentStatus = engagement.status || 'active';

                    return (
                      <>
                        <TableRow key={engagement.id} className="hover:bg-muted/50">
                          <TableCell 
                            className="cursor-pointer"
                            onClick={() => toggleRow(engagement.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell 
                            className="cursor-pointer"
                            onClick={() => toggleRow(engagement.id)}
                          >
                            <div>
                              <div className="font-medium">{engagement.name}</div>
                              {engagement.description && (
                                <div className="text-sm text-muted-foreground line-clamp-1">
                                  {engagement.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={currentStatus === 'active' ? 'default' : 'secondary'}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => handleToggleStatus(engagement.id, currentStatus)}
                            >
                              {currentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{metrics.totalCalls}</TableCell>
                          <TableCell className="text-right">{metrics.conversations}</TableCell>
                          <TableCell className="text-right">{metrics.interestedLeads}</TableCell>
                          <TableCell className="text-right">{metrics.meetingsSet}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openLinkDialog(engagement.id)}
                            >
                              <LinkIcon className="h-4 w-4 mr-1" />
                              {campaigns.length}
                            </Button>
                          </TableCell>
                          <TableCell>
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
                        {isExpanded && campaigns.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={9} className="bg-muted/30 p-4">
                              <LinkedCampaignsList
                                campaigns={campaigns}
                                onUnlink={handleUnlinkCampaign}
                                unlinking={unlinkingCampaign}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Engagement' : 'Create Engagement'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update engagement details' : 'Create a new client engagement'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Engagement Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Q1 Outreach Campaign"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meeting_goal">Meeting Goal</Label>
                  <Input
                    id="meeting_goal"
                    type="number"
                    value={formData.meeting_goal}
                    onChange={(e) => setFormData({ ...formData, meeting_goal: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target_list_size">Target List Size</Label>
                  <Input
                    id="target_list_size"
                    type="number"
                    value={formData.target_list_size}
                    onChange={(e) => setFormData({ ...formData, target_list_size: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Link Campaigns Dialog */}
        <LinkCampaignsDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          campaigns={unlinkedCampaigns}
          onLink={handleLinkCampaigns}
          engagementName={engagements.find(e => e.id === linkingEngagementId)?.name || ''}
        />

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
                    <li className="flex items-start gap-2">
                      <X className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      Skips campaigns with unidentifiable clients
                    </li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  This will create new engagements and link all matching campaigns immediately.
                </p>
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
                  {/* Summary */}
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

                  {/* Details */}
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
                        {autoPairResults.details.length > 20 && (
                          <p className="text-sm text-muted-foreground">
                            ...and {autoPairResults.details.length - 20} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Skipped */}
                  {autoPairResults.skippedReasons.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-muted-foreground">Skipped ({autoPairResults.skippedReasons.length}):</h4>
                      <div className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                        {autoPairResults.skippedReasons.slice(0, 10).map((s, i) => (
                          <div key={i} className="truncate">
                            {s.name}: {s.reason}
                          </div>
                        ))}
                        {autoPairResults.skippedReasons.length > 10 && (
                          <div>...and {autoPairResults.skippedReasons.length - 10} more</div>
                        )}
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
