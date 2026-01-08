import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Plus,
  Building2,
  Target,
  Calendar,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Phone,
  CalendarDays,
} from 'lucide-react';

interface Engagement {
  id: string;
  client_name: string;
  engagement_name: string;
  industry_focus: string | null;
  geography: string | null;
  start_date: string;
  end_date: string | null;
  total_calls_target: number;
  meetings_target: number;
  connect_rate_target: number;
  meeting_rate_target: number;
  status: string;
  // Computed
  current_calls: number;
  current_meetings: number;
  current_connect_rate: number;
  days_elapsed: number;
  days_total: number;
  pace_status: 'ahead' | 'on_track' | 'behind';
}

export default function EngagementDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // New engagement form
  const [newEngagement, setNewEngagement] = useState({
    client_name: '',
    engagement_name: '',
    industry_focus: '',
    geography: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    total_calls_target: 1000,
    meetings_target: 20,
    connect_rate_target: 20,
    meeting_rate_target: 5,
  });

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
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate progress for each engagement
      const enrichedEngagements = (data || []).map((e) => {
        const start = new Date(e.start_date);
        const end = e.end_date ? new Date(e.end_date) : new Date();
        const today = new Date();
        const daysTotal = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        // These would come from actual metrics
        const currentCalls = Math.floor(Math.random() * e.total_calls_target * 0.6);
        const currentMeetings = Math.floor(Math.random() * e.meetings_target * 0.7);
        const currentConnectRate = 15 + Math.random() * 15;

        const expectedProgress = daysElapsed / daysTotal;
        const actualProgress = currentCalls / e.total_calls_target;
        const paceStatus = actualProgress >= expectedProgress * 1.1 
          ? 'ahead' 
          : actualProgress >= expectedProgress * 0.9 
            ? 'on_track' 
            : 'behind';

        return {
          ...e,
          current_calls: currentCalls,
          current_meetings: currentMeetings,
          current_connect_rate: currentConnectRate,
          days_elapsed: daysElapsed,
          days_total: daysTotal,
          pace_status: paceStatus,
        } as Engagement;
      });

      setEngagements(enrichedEngagements);
    } catch (err) {
      console.error('Error fetching engagements:', err);
      toast.error('Failed to load engagements');
    } finally {
      setLoading(false);
    }
  };

  const createEngagement = async () => {
    if (!currentWorkspace?.id || !user?.id) return;
    if (!newEngagement.client_name || !newEngagement.engagement_name) {
      toast.error('Please fill in required fields');
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from('engagements').insert({
        workspace_id: currentWorkspace.id,
        created_by: user.id,
        ...newEngagement,
        end_date: newEngagement.end_date || null,
      });

      if (error) throw error;

      toast.success('Engagement created successfully');
      setDialogOpen(false);
      setNewEngagement({
        client_name: '',
        engagement_name: '',
        industry_focus: '',
        geography: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        total_calls_target: 1000,
        meetings_target: 20,
        connect_rate_target: 20,
        meeting_rate_target: 5,
      });
      fetchEngagements();
    } catch (err) {
      console.error('Error creating engagement:', err);
      toast.error('Failed to create engagement');
    } finally {
      setCreating(false);
    }
  };

  const getPaceColor = (status: string) => {
    switch (status) {
      case 'ahead':
        return 'text-success';
      case 'on_track':
        return 'text-chart-4';
      case 'behind':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getPaceBadge = (status: string) => {
    switch (status) {
      case 'ahead':
        return <Badge className="bg-success/10 text-success border-success/30">Ahead</Badge>;
      case 'on_track':
        return <Badge className="bg-chart-4/10 text-chart-4 border-chart-4/30">On Track</Badge>;
      case 'behind':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30">Behind</Badge>;
      default:
        return null;
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
            <h1 className="text-2xl font-bold tracking-tight">Engagement Dashboard</h1>
            <p className="text-muted-foreground">Track PE firm engagements and targets</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Engagement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Engagement</DialogTitle>
                <DialogDescription>Set up a new PE firm project with targets</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_name">Client Name *</Label>
                    <Input
                      id="client_name"
                      placeholder="e.g., Blackstone"
                      value={newEngagement.client_name}
                      onChange={(e) => setNewEngagement({ ...newEngagement, client_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="engagement_name">Engagement Name *</Label>
                    <Input
                      id="engagement_name"
                      placeholder="e.g., Manufacturing Roll-Up"
                      value={newEngagement.engagement_name}
                      onChange={(e) => setNewEngagement({ ...newEngagement, engagement_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="industry_focus">Industry Focus</Label>
                    <Input
                      id="industry_focus"
                      placeholder="e.g., Manufacturing"
                      value={newEngagement.industry_focus}
                      onChange={(e) => setNewEngagement({ ...newEngagement, industry_focus: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="geography">Geography</Label>
                    <Input
                      id="geography"
                      placeholder="e.g., Midwest US"
                      value={newEngagement.geography}
                      onChange={(e) => setNewEngagement({ ...newEngagement, geography: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={newEngagement.start_date}
                      onChange={(e) => setNewEngagement({ ...newEngagement, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={newEngagement.end_date}
                      onChange={(e) => setNewEngagement({ ...newEngagement, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="total_calls_target">Total Calls Target</Label>
                    <Input
                      id="total_calls_target"
                      type="number"
                      value={newEngagement.total_calls_target}
                      onChange={(e) =>
                        setNewEngagement({ ...newEngagement, total_calls_target: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meetings_target">Meetings Target</Label>
                    <Input
                      id="meetings_target"
                      type="number"
                      value={newEngagement.meetings_target}
                      onChange={(e) =>
                        setNewEngagement({ ...newEngagement, meetings_target: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="connect_rate_target">Connect Rate Target (%)</Label>
                    <Input
                      id="connect_rate_target"
                      type="number"
                      value={newEngagement.connect_rate_target}
                      onChange={(e) =>
                        setNewEngagement({ ...newEngagement, connect_rate_target: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meeting_rate_target">Meeting Rate Target (%)</Label>
                    <Input
                      id="meeting_rate_target"
                      type="number"
                      value={newEngagement.meeting_rate_target}
                      onChange={(e) =>
                        setNewEngagement({ ...newEngagement, meeting_rate_target: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createEngagement} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Engagement
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-40 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : engagements.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Engagements Yet</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Create your first PE firm engagement to track calls, meetings, and targets.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Engagement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {engagements.map((engagement) => (
              <Card key={engagement.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{engagement.engagement_name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Building2 className="h-3 w-3" />
                        {engagement.client_name}
                        {engagement.industry_focus && (
                          <>
                            <span>•</span>
                            {engagement.industry_focus}
                          </>
                        )}
                      </CardDescription>
                    </div>
                    {getPaceBadge(engagement.pace_status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress bars */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          Calls
                        </span>
                        <span className="text-muted-foreground">
                          {engagement.current_calls.toLocaleString()} / {engagement.total_calls_target.toLocaleString()}
                        </span>
                      </div>
                      <Progress
                        value={(engagement.current_calls / engagement.total_calls_target) * 100}
                        className="h-2"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          Meetings
                        </span>
                        <span className="text-muted-foreground">
                          {engagement.current_meetings} / {engagement.meetings_target}
                        </span>
                      </div>
                      <Progress
                        value={(engagement.current_meetings / engagement.meetings_target) * 100}
                        className="h-2"
                      />
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="p-2 rounded-lg bg-accent/50">
                      <p className="font-medium">{engagement.current_connect_rate.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Connect Rate</p>
                    </div>
                    <div className="p-2 rounded-lg bg-accent/50">
                      <p className="font-medium">
                        {engagement.days_elapsed} / {engagement.days_total}
                      </p>
                      <p className="text-xs text-muted-foreground">Days</p>
                    </div>
                    <div className="p-2 rounded-lg bg-accent/50">
                      <p className={`font-medium ${getPaceColor(engagement.pace_status)}`}>
                        {engagement.pace_status === 'ahead' && <TrendingUp className="h-4 w-4 inline" />}
                        {engagement.pace_status === 'behind' && <TrendingDown className="h-4 w-4 inline" />}
                        {engagement.pace_status === 'on_track' && '→'}
                      </p>
                      <p className="text-xs text-muted-foreground">Pace</p>
                    </div>
                  </div>

                  {/* Alerts */}
                  {engagement.pace_status === 'behind' && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Behind pace - need {Math.ceil((engagement.total_calls_target - engagement.current_calls) / (engagement.days_total - engagement.days_elapsed))} calls/day</span>
                    </div>
                  )}

                  <Button variant="ghost" size="sm" className="w-full">
                    View Details
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
