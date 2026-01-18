import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  Phone, Target, TrendingUp, Users, Link as LinkIcon, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LinkedCampaignsList, LinkedCampaign } from '@/components/engagements/LinkedCampaignsList';
import { LinkCampaignsDialog, UnlinkedCampaign } from '@/components/engagements/LinkCampaignsDialog';

interface Engagement {
  id: string;
  sponsor: string | null;
  industry_focus: string | null;
  client_name: string;
  deal_lead: string | null;
  associate_vp: string | null;
  analyst: string | null;
  priority: 'high' | 'medium' | 'low' | null;
  engagement_name: string;
  geography: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  meetings_target: number | null;
  total_calls_target: number | null;
  connect_rate_target: number | null;
  meeting_rate_target: number | null;
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

const priorityColors: Record<string, string> = {
  high: 'bg-green-900/40 hover:bg-green-900/50 border-l-4 border-l-green-500',
  medium: 'bg-amber-900/30 hover:bg-amber-900/40 border-l-4 border-l-amber-500',
  low: 'bg-red-900/30 hover:bg-red-900/40 border-l-4 border-l-red-500',
};

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
  
  // Campaign linking state
  const [linkedCampaigns, setLinkedCampaigns] = useState<Record<string, LinkedCampaign[]>>({});
  const [unlinkedCampaigns, setUnlinkedCampaigns] = useState<UnlinkedCampaign[]>([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingEngagementId, setLinkingEngagementId] = useState<string | null>(null);
  const [unlinkingCampaign, setUnlinkingCampaign] = useState<string | null>(null);

  const emptyForm = {
    sponsor: '',
    industry_focus: '',
    client_name: '',
    deal_lead: '',
    associate_vp: '',
    analyst: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    engagement_name: '',
    geography: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    meetings_target: 20,
    total_calls_target: 500,
    connect_rate_target: 15,
    meeting_rate_target: 3,
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
        .eq('workspace_id', currentWorkspace.id)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEngagements((data || []) as Engagement[]);

      // Fetch metrics for each engagement
      if (data && data.length > 0) {
        await fetchEngagementMetrics(data as Engagement[]);
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
      // For each engagement, get call data matching client name or engagement_name field
      const metricsMap: Record<string, EngagementMetrics> = {};
      
      for (const eng of engagementList) {
        // Match by engagement_name (Primary Opportunity from NocoDB) or client_name
        const { data: callData } = await supabase
          .from('external_calls')
          .select('composite_score, seller_interest_score, call_category, engagement_name, call_title, company_name')
          .eq('workspace_id', currentWorkspace.id)
          .not('composite_score', 'is', null);

        // Filter calls that match this engagement
        const matchingCalls = (callData || []).filter(c => {
          const engName = (c.engagement_name || '').toLowerCase();
          const callTitle = (c.call_title || '').toLowerCase();
          const companyName = (c.company_name || '').toLowerCase();
          const clientNameLower = eng.client_name.toLowerCase();
          const engagementNameLower = eng.engagement_name.toLowerCase();
          
          return (
            engName.includes(clientNameLower) ||
            engName.includes(engagementNameLower) ||
            callTitle.includes(clientNameLower) ||
            companyName.includes(clientNameLower)
          );
        });

        const totalCalls = matchingCalls.length;
        const avgScore = totalCalls > 0 
          ? matchingCalls.reduce((sum, c) => sum + (c.composite_score || 0), 0) / totalCalls 
          : 0;
        const interestedLeads = matchingCalls.filter(c => (c.seller_interest_score || 0) >= 7).length;
        const conversations = matchingCalls.filter(c => 
          c.call_category && ['conversation', 'interested', 'meeting', 'connection'].some(cat => 
            c.call_category?.toLowerCase().includes(cat)
          )
        ).length;

        // Count actual meetings from call categories
        const actualMeetings = matchingCalls.filter(c => 
          c.call_category && (c.call_category.toLowerCase().includes('meeting') || c.call_category.toLowerCase().includes('appointment'))
        ).length;
        
        metricsMap[eng.id] = {
          totalCalls,
          avgScore: Math.round(avgScore * 10) / 10,
          interestedLeads,
          conversations,
          meetingsSet: actualMeetings, // Actual meetings from call data only
        };
      }
      
      setEngagementMetrics(metricsMap);
    } catch (err) {
      console.error('Error fetching engagement metrics:', err);
    }
  };

  // Fetch all campaigns from SmartLead and Reply.io and categorize as linked/unlinked
  const fetchAllCampaigns = useCallback(async () => {
    if (!currentWorkspace?.id) return;

    try {
      // Fetch campaigns from both platforms in parallel
      const [smartleadRes, replyioRes, smartleadMetrics, replyioMetrics] = await Promise.all([
        supabase
          .from('smartlead_campaigns')
          .select('id, name, status, engagement_id')
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('replyio_campaigns')
          .select('id, name, status, engagement_id')
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('smartlead_daily_metrics')
          .select('campaign_id, sent_count, opened_count, replied_count, positive_reply_count')
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('replyio_daily_metrics')
          .select('campaign_id, sent_count, opened_count, replied_count, positive_reply_count')
          .eq('workspace_id', currentWorkspace.id),
      ]);

      // Aggregate SmartLead metrics by campaign
      const smartleadMetricsMap: Record<string, { sent: number; opened: number; replied: number; positive: number }> = {};
      (smartleadMetrics.data || []).forEach((m) => {
        if (!smartleadMetricsMap[m.campaign_id]) {
          smartleadMetricsMap[m.campaign_id] = { sent: 0, opened: 0, replied: 0, positive: 0 };
        }
        smartleadMetricsMap[m.campaign_id].sent += m.sent_count || 0;
        smartleadMetricsMap[m.campaign_id].opened += m.opened_count || 0;
        smartleadMetricsMap[m.campaign_id].replied += m.replied_count || 0;
        smartleadMetricsMap[m.campaign_id].positive += m.positive_reply_count || 0;
      });

      // Aggregate Reply.io metrics by campaign
      const replyioMetricsMap: Record<string, { sent: number; opened: number; replied: number; positive: number }> = {};
      (replyioMetrics.data || []).forEach((m) => {
        if (!replyioMetricsMap[m.campaign_id]) {
          replyioMetricsMap[m.campaign_id] = { sent: 0, opened: 0, replied: 0, positive: 0 };
        }
        replyioMetricsMap[m.campaign_id].sent += m.sent_count || 0;
        replyioMetricsMap[m.campaign_id].opened += m.opened_count || 0;
        replyioMetricsMap[m.campaign_id].replied += m.replied_count || 0;
        replyioMetricsMap[m.campaign_id].positive += m.positive_reply_count || 0;
      });

      // Process campaigns into linked and unlinked
      const linkedMap: Record<string, LinkedCampaign[]> = {};
      const unlinked: UnlinkedCampaign[] = [];

      // Process SmartLead campaigns
      (smartleadRes.data || []).forEach((c) => {
        const metrics = smartleadMetricsMap[c.id] || { sent: 0, opened: 0, replied: 0, positive: 0 };
        const campaign: LinkedCampaign = {
          id: c.id,
          name: c.name,
          platform: 'smartlead',
          status: c.status,
          totalSent: metrics.sent,
          totalOpened: metrics.opened,
          totalReplied: metrics.replied,
          totalPositive: metrics.positive,
        };

        if (c.engagement_id) {
          if (!linkedMap[c.engagement_id]) linkedMap[c.engagement_id] = [];
          linkedMap[c.engagement_id].push(campaign);
        } else {
          unlinked.push({
            id: c.id,
            name: c.name,
            platform: 'smartlead',
            status: c.status,
            totalSent: metrics.sent,
          });
        }
      });

      // Process Reply.io campaigns
      (replyioRes.data || []).forEach((c) => {
        const metrics = replyioMetricsMap[c.id] || { sent: 0, opened: 0, replied: 0, positive: 0 };
        const campaign: LinkedCampaign = {
          id: c.id,
          name: c.name,
          platform: 'replyio',
          status: c.status,
          totalSent: metrics.sent,
          totalOpened: metrics.opened,
          totalReplied: metrics.replied,
          totalPositive: metrics.positive,
        };

        if (c.engagement_id) {
          if (!linkedMap[c.engagement_id]) linkedMap[c.engagement_id] = [];
          linkedMap[c.engagement_id].push(campaign);
        } else {
          unlinked.push({
            id: c.id,
            name: c.name,
            platform: 'replyio',
            status: c.status,
            totalSent: metrics.sent,
          });
        }
      });

      setLinkedCampaigns(linkedMap);
      setUnlinkedCampaigns(unlinked);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    }
  }, [currentWorkspace?.id]);

  const fetchCampaignSummaries = async () => {
    if (!currentWorkspace?.id) return;

    try {
      const { data, error } = await supabase
        .from('external_calls')
        .select('call_title, company_name, composite_score, seller_interest_score, engagement_name, rep_name')
        .eq('workspace_id', currentWorkspace.id)
        .not('composite_score', 'is', null);

      if (error) throw error;

      // Group by engagement_name (Primary Opportunity from NocoDB) or extracted from call_title
      const grouped: Record<string, { calls: number; scores: number[]; interested: number }> = {};
      
      (data || []).forEach(call => {
        // Use engagement_name if available, otherwise extract from call_title
        let project = call.engagement_name;
        
        if (!project) {
          // Extract project from call_title format: "Company <ext> Project"
          const title = call.call_title || '';
          const projectMatch = title.split('<ext>')[1]?.trim() || call.company_name || 'Other';
          project = projectMatch.split('(')[0]?.trim() || projectMatch;
        }
        
        if (!grouped[project]) {
          grouped[project] = { calls: 0, scores: [], interested: 0 };
        }
        grouped[project].calls++;
        grouped[project].scores.push(call.composite_score || 0);
        if ((call.seller_interest_score || 0) >= 7) {
          grouped[project].interested++;
        }
      });

      const summaries: CampaignSummary[] = Object.entries(grouped)
        .map(([clientProject, data]) => ({
          clientProject,
          totalCalls: data.calls,
          avgScore: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10,
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
      // Group by platform
      const smartleadIds = campaigns.filter(c => c.platform === 'smartlead').map(c => c.id);
      const replyioIds = campaigns.filter(c => c.platform === 'replyio').map(c => c.id);

      const updates = [];

      if (smartleadIds.length > 0) {
        updates.push(
          supabase
            .from('smartlead_campaigns')
            .update({ engagement_id: linkingEngagementId })
            .in('id', smartleadIds)
        );
      }

      if (replyioIds.length > 0) {
        updates.push(
          supabase
            .from('replyio_campaigns')
            .update({ engagement_id: linkingEngagementId })
            .in('id', replyioIds)
        );
      }

      await Promise.all(updates);
      toast.success(`Linked ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}`);
      fetchAllCampaigns();
    } catch (err) {
      console.error('Error linking campaigns:', err);
      toast.error('Failed to link campaigns');
      throw err;
    }
  };

  // Handle unlinking a campaign from engagement
  const handleUnlinkCampaign = async (campaignId: string, platform: 'smartlead' | 'replyio') => {
    setUnlinkingCampaign(campaignId);
    try {
      const table = platform === 'smartlead' ? 'smartlead_campaigns' : 'replyio_campaigns';
      const { error } = await supabase
        .from(table)
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
      sponsor: engagement.sponsor || '',
      industry_focus: engagement.industry_focus || '',
      client_name: engagement.client_name,
      deal_lead: engagement.deal_lead || '',
      associate_vp: engagement.associate_vp || '',
      analyst: engagement.analyst || '',
      priority: engagement.priority || 'medium',
      engagement_name: engagement.engagement_name,
      geography: engagement.geography || '',
      start_date: engagement.start_date,
      end_date: engagement.end_date || '',
      meetings_target: engagement.meetings_target || 20,
      total_calls_target: engagement.total_calls_target || 500,
      connect_rate_target: engagement.connect_rate_target || 15,
      meeting_rate_target: engagement.meeting_rate_target || 3,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentWorkspace?.id || !user?.id) return;
    if (!formData.client_name) {
      toast.error('Client name is required');
      return;
    }

    setCreating(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('engagements')
          .update({
            sponsor: formData.sponsor || null,
            industry_focus: formData.industry_focus || null,
            client_name: formData.client_name,
            deal_lead: formData.deal_lead || null,
            associate_vp: formData.associate_vp || null,
            analyst: formData.analyst || null,
            priority: formData.priority,
            engagement_name: formData.engagement_name || formData.client_name,
            geography: formData.geography || null,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
            meetings_target: formData.meetings_target,
            total_calls_target: formData.total_calls_target,
            connect_rate_target: formData.connect_rate_target,
            meeting_rate_target: formData.meeting_rate_target,
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Engagement updated');
      } else {
        const { error } = await supabase.from('engagements').insert({
          workspace_id: currentWorkspace.id,
          created_by: user.id,
          sponsor: formData.sponsor || null,
          industry_focus: formData.industry_focus || null,
          client_name: formData.client_name,
          deal_lead: formData.deal_lead || null,
          associate_vp: formData.associate_vp || null,
          analyst: formData.analyst || null,
          priority: formData.priority,
          engagement_name: formData.engagement_name || formData.client_name,
          geography: formData.geography || null,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          meetings_target: formData.meetings_target,
          total_calls_target: formData.total_calls_target,
          connect_rate_target: formData.connect_rate_target,
          meeting_rate_target: formData.meeting_rate_target,
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

  // Summary totals
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Campaign Summary</h1>
            <p className="text-muted-foreground">Track engagements and performance against targets</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Engagement
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals.calls.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals.interested}</p>
                  <p className="text-xs text-muted-foreground">Interested Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-chart-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{campaignSummaries.length}</p>
                  <p className="text-xs text-muted-foreground">Active Campaigns</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {totals.calls > 0 ? ((totals.interested / totals.calls) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Interest Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Engagement' : 'Create New Engagement'}</DialogTitle>
              <DialogDescription>Fill in the engagement details and targets</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sponsor</Label>
                  <Input
                    placeholder="e.g., Baum Capital"
                    value={formData.sponsor}
                    onChange={(e) => setFormData({ ...formData, sponsor: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input
                    placeholder="e.g., Healthcare"
                    value={formData.industry_focus}
                    onChange={(e) => setFormData({ ...formData, industry_focus: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <Input
                    placeholder="e.g., Level Education"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(val) => setFormData({ ...formData, priority: val as 'high' | 'medium' | 'low' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Deal Lead</Label>
                  <Input
                    placeholder="Name"
                    value={formData.deal_lead}
                    onChange={(e) => setFormData({ ...formData, deal_lead: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Associate / VP</Label>
                  <Input
                    placeholder="Name"
                    value={formData.associate_vp}
                    onChange={(e) => setFormData({ ...formData, associate_vp: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Analyst</Label>
                  <Input
                    placeholder="Name"
                    value={formData.analyst}
                    onChange={(e) => setFormData({ ...formData, analyst: e.target.value })}
                  />
                </div>
              </div>

              {/* Targets Section */}
              <div className="border-t pt-4 mt-4">
                <Label className="text-base font-semibold mb-3 block">Performance Targets</Label>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Total Calls Target</Label>
                    <Input
                      type="number"
                      value={formData.total_calls_target}
                      onChange={(e) => setFormData({ ...formData, total_calls_target: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Meetings Target</Label>
                    <Input
                      type="number"
                      value={formData.meetings_target}
                      onChange={(e) => setFormData({ ...formData, meetings_target: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Connect Rate % Target</Label>
                    <Input
                      type="number"
                      value={formData.connect_rate_target}
                      onChange={(e) => setFormData({ ...formData, connect_rate_target: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Meeting Rate % Target</Label>
                    <Input
                      type="number"
                      value={formData.meeting_rate_target}
                      onChange={(e) => setFormData({ ...formData, meeting_rate_target: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Engagements Table with Expanded Metrics */}
        {engagements.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Managed Engagements</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="w-[140px]">Sponsor</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Deal Lead</TableHead>
                  <TableHead>Associate/VP</TableHead>
                  <TableHead>Analyst</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Interested</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {engagements.map((engagement) => {
                  const metrics = engagementMetrics[engagement.id];
                  const isExpanded = expandedRows.has(engagement.id);
                  const callsProgress = metrics && engagement.total_calls_target 
                    ? (metrics.totalCalls / engagement.total_calls_target) * 100 
                    : 0;

                  return (
                    <>
                      <TableRow
                        key={engagement.id}
                        className="transition-colors cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(engagement.id)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{engagement.sponsor || '-'}</TableCell>
                        <TableCell>{engagement.industry_focus || '-'}</TableCell>
                        <TableCell className="font-medium">{engagement.client_name}</TableCell>
                        <TableCell className="text-primary">{engagement.deal_lead || '-'}</TableCell>
                        <TableCell>{engagement.associate_vp || '-'}</TableCell>
                        <TableCell>{engagement.analyst || '-'}</TableCell>
                        <TableCell className="text-right font-mono">
                          {metrics?.totalCalls || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={metrics?.interestedLeads > 0 ? 'default' : 'secondary'}>
                            {metrics?.interestedLeads || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(engagement);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(engagement.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={10} className="p-4">
                            <div className="space-y-6">
                              {/* Metrics Row */}
                              <div className="grid grid-cols-4 gap-6">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Calls Progress</p>
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                      <span>{metrics?.totalCalls || 0}</span>
                                      <span className="text-muted-foreground">/ {engagement.total_calls_target || 500}</span>
                                    </div>
                                    <Progress value={Math.min(callsProgress, 100)} className="h-2" />
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Avg AI Score</p>
                                  <p className="text-2xl font-bold">{metrics?.avgScore || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Conversations</p>
                                  <p className="text-2xl font-bold">{metrics?.conversations || 0}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Meetings Target</p>
                                  <p className="text-2xl font-bold">
                                    <span className="text-success">{metrics?.meetingsSet || 0}</span>
                                    <span className="text-muted-foreground text-base"> / {engagement.meetings_target || 20}</span>
                                  </p>
                                </div>
                              </div>

                              {/* Linked Campaigns Section */}
                              <div className="border-t pt-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    <h4 className="font-medium text-sm">Linked Email Campaigns</h4>
                                    <p className="text-xs text-muted-foreground">
                                      {(linkedCampaigns[engagement.id] || []).length} campaign{(linkedCampaigns[engagement.id] || []).length !== 1 ? 's' : ''} linked
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/engagements/${engagement.id}/report`);
                                      }}
                                    >
                                      <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                                      View Report
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openLinkDialog(engagement.id);
                                      }}
                                    >
                                      <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                                      Link Campaigns
                                    </Button>
                                  </div>
                                </div>
                                <LinkedCampaignsList
                                  campaigns={linkedCampaigns[engagement.id] || []}
                                  onUnlink={handleUnlinkCampaign}
                                  unlinking={unlinkingCampaign}
                                />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Campaign Summary Table (from call data) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Campaigns Performance</CardTitle>
          </CardHeader>
          {loading ? (
            <CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent>
          ) : campaignSummaries.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Campaign Data Yet</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Import calls to see campaign performance summaries.
              </p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign / Project</TableHead>
                  <TableHead className="text-right">Total Calls</TableHead>
                  <TableHead className="text-right">Avg Score</TableHead>
                  <TableHead className="text-right">Interested Leads</TableHead>
                  <TableHead className="text-right">Interest Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignSummaries.map((campaign, idx) => {
                  const interestRate = campaign.totalCalls > 0 
                    ? ((campaign.interestedLeads / campaign.totalCalls) * 100).toFixed(1)
                    : '0';
                  
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{campaign.clientProject || 'Other'}</TableCell>
                      <TableCell className="text-right font-mono">{campaign.totalCalls}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={campaign.avgScore >= 7 ? 'default' : 'secondary'}>
                          {campaign.avgScore}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{campaign.interestedLeads}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-medium",
                          parseFloat(interestRate) >= 30 ? "text-success" : 
                          parseFloat(interestRate) >= 15 ? "text-chart-4" : "text-muted-foreground"
                        )}>
                          {interestRate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Link Campaigns Dialog */}
        <LinkCampaignsDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          campaigns={unlinkedCampaigns}
          onLink={handleLinkCampaigns}
          engagementName={engagements.find(e => e.id === linkingEngagementId)?.engagement_name || ''}
        />
      </div>
    </DashboardLayout>
  );
}