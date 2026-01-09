import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Building2, Loader2, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

const priorityColors: Record<string, string> = {
  high: 'bg-green-900/40 hover:bg-green-900/50',
  medium: 'bg-amber-900/30 hover:bg-amber-900/40',
  low: 'bg-red-900/30 hover:bg-red-900/40',
};

export default function EngagementDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    } catch (err) {
      console.error('Error fetching engagements:', err);
      toast.error('Failed to load engagements');
    } finally {
      setLoading(false);
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
          total_calls_target: 1000,
          meetings_target: 20,
          connect_rate_target: 20,
          meeting_rate_target: 5,
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
            <h1 className="text-2xl font-bold tracking-tight">Engagements</h1>
            <p className="text-muted-foreground">Track PE firm engagements and team assignments</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Engagement
          </Button>
        </div>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Engagement' : 'Create New Engagement'}</DialogTitle>
              <DialogDescription>Fill in the engagement details</DialogDescription>
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

        {/* Table */}
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent>
          </Card>
        ) : engagements.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Engagements Yet</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Create your first PE firm engagement to track clients and team assignments.
              </p>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Engagement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Sponsor</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Deal Lead</TableHead>
                  <TableHead>Associate / VP</TableHead>
                  <TableHead>Analyst</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {engagements.map((engagement) => (
                  <TableRow
                    key={engagement.id}
                    className={cn(
                      'transition-colors cursor-pointer',
                      priorityColors[engagement.priority || 'medium']
                    )}
                    onClick={() => openEdit(engagement)}
                  >
                    <TableCell className="font-medium">{engagement.sponsor || '-'}</TableCell>
                    <TableCell>{engagement.industry_focus || '-'}</TableCell>
                    <TableCell>{engagement.client_name}</TableCell>
                    <TableCell className="text-primary">{engagement.deal_lead || '-'}</TableCell>
                    <TableCell>{engagement.associate_vp || '-'}</TableCell>
                    <TableCell>{engagement.analyst || '-'}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
