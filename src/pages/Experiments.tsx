import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Beaker, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ExperimentData {
  id: string;
  name: string;
  hypothesis: string | null;
  variable_type: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  min_sample_size: number | null;
  actual_sample_size: number | null;
  confidence_level: number | null;
  winner_variant_id: string | null;
  variants: {
    id: string;
    name: string;
    is_control: boolean | null;
    total_sent: number | null;
    reply_rate: number | null;
  }[];
}

export default function Experiments() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState<ExperimentData[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id) fetchExperiments();
  }, [currentWorkspace?.id]);

  const fetchExperiments = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Get engagement IDs for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);

      if (engagementIds.length === 0) {
        setExperiments([]);
        setLoading(false);
        return;
      }

      // Fetch experiments from the experiments table
      const { data: experimentsData, error } = await supabase
        .from('experiments')
        .select(`
          id,
          name,
          hypothesis,
          variable_type,
          status,
          started_at,
          completed_at,
          min_sample_size,
          actual_sample_size,
          confidence_level,
          winner_variant_id,
          experiment_variants (
            id,
            name,
            is_control,
            total_sent,
            reply_rate
          )
        `)
        .in('engagement_id', engagementIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedExperiments: ExperimentData[] = (experimentsData || []).map((exp: any) => ({
        id: exp.id,
        name: exp.name,
        hypothesis: exp.hypothesis,
        variable_type: exp.variable_type,
        status: exp.status,
        started_at: exp.started_at,
        completed_at: exp.completed_at,
        min_sample_size: exp.min_sample_size,
        actual_sample_size: exp.actual_sample_size,
        confidence_level: exp.confidence_level,
        winner_variant_id: exp.winner_variant_id,
        variants: (exp.experiment_variants || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          is_control: v.is_control,
          total_sent: v.total_sent,
          reply_rate: v.reply_rate,
        })),
      }));

      setExperiments(formattedExperiments);
    } catch (err) {
      console.error('Error fetching experiments:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const active = experiments.filter(e => e.status === 'running').length;
    const completed = experiments.filter(e => e.status === 'completed').length;
    const withWinner = experiments.filter(e => e.winner_variant_id).length;
    return { total: experiments.length, active, completed, withWinner };
  }, [experiments]);

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
            <h1 className="text-2xl font-bold tracking-tight">Experiments</h1>
            <p className="text-muted-foreground">Track A/B tests and experiment results</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Experiments</CardTitle>
              <Beaker className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <AlertCircle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Winner</CardTitle>
              <TrendingUp className="h-4 w-4 text-chart-1" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.withWinner}</div>
            </CardContent>
          </Card>
        </div>

        {/* Experiments List */}
        <Card>
          <CardHeader>
            <CardTitle>Experiments</CardTitle>
            <CardDescription>View and manage your A/B test experiments</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : experiments.length === 0 ? (
              <div className="text-center py-12">
                <Beaker className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No experiments yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Experiments are automatically detected from campaigns with multiple variants.
                  Create campaigns with A/B tests to see them here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {experiments.map((experiment) => {
                  const progress = experiment.min_sample_size && experiment.actual_sample_size
                    ? Math.min(100, (experiment.actual_sample_size / experiment.min_sample_size) * 100)
                    : 0;
                  
                  return (
                    <div
                      key={experiment.id}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{experiment.name}</h3>
                            <Badge variant={
                              experiment.status === 'running' ? 'default' :
                              experiment.status === 'completed' ? 'secondary' :
                              'outline'
                            }>
                              {experiment.status || 'draft'}
                            </Badge>
                            {experiment.variable_type && (
                              <Badge variant="outline">{experiment.variable_type}</Badge>
                            )}
                          </div>
                          {experiment.hypothesis && (
                            <p className="text-sm text-muted-foreground mb-3">{experiment.hypothesis}</p>
                          )}
                          
                          {/* Progress bar for sample size */}
                          {experiment.min_sample_size && (
                            <div className="space-y-1 mb-4">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Sample Progress</span>
                                <span>{experiment.actual_sample_size || 0} / {experiment.min_sample_size}</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                            </div>
                          )}

                          {/* Variants */}
                          {experiment.variants.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {experiment.variants.map(variant => (
                                <div
                                  key={variant.id}
                                  className={`p-3 rounded-md border ${
                                    experiment.winner_variant_id === variant.id
                                      ? 'border-success bg-success/10'
                                      : variant.is_control
                                      ? 'border-muted'
                                      : 'border-chart-1/30 bg-chart-1/5'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium truncate">{variant.name}</span>
                                    {variant.is_control && (
                                      <Badge variant="outline" className="text-xs">Control</Badge>
                                    )}
                                    {experiment.winner_variant_id === variant.id && (
                                      <Badge className="text-xs bg-success">Winner</Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Sent: {variant.total_sent?.toLocaleString() || 0}
                                  </div>
                                  <div className="text-lg font-bold">
                                    {variant.reply_rate?.toFixed(2) || 0}%
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {experiment.confidence_level && (
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Confidence</div>
                            <div className="text-xl font-bold">
                              {experiment.confidence_level}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
