import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FlaskConical, Plus, Lightbulb, BookOpen, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ExperimentStatusOverview } from '@/components/experiments/ExperimentStatusOverview';
import { ActiveExperimentCard, ActiveExperiment, ExperimentVariant } from '@/components/experiments/ActiveExperimentCard';
import { ExperimentResultsCard } from '@/components/experiments/ExperimentResultsCard';
import { ExperimentSuggestions, ExperimentSuggestion } from '@/components/experiments/ExperimentSuggestions';

// Statistical functions
function calculateZScore(p1: number, p2: number, n1: number, n2: number): number {
  const p = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1/n1 + 1/n2));
  if (se === 0) return 0;
  return (p1 - p2) / se;
}

function zScoreToConfidence(z: number): number {
  const absZ = Math.abs(z);
  if (absZ >= 2.576) return 99;
  if (absZ >= 1.96) return 95;
  if (absZ >= 1.645) return 90;
  if (absZ >= 1.28) return 80;
  return Math.min(80, absZ * 35);
}

function zScoreToPValue(z: number): number {
  const absZ = Math.abs(z);
  // Approximate two-tailed p-value
  if (absZ >= 3.29) return 0.001;
  if (absZ >= 2.58) return 0.01;
  if (absZ >= 1.96) return 0.05;
  if (absZ >= 1.645) return 0.1;
  return Math.min(1, 2 * (1 - (0.5 * (1 + Math.tanh(absZ * 0.7)))));
}

const MIN_SAMPLE_SIZE = 100;
const CONFIDENCE_THRESHOLD = 95;

export default function Experiments() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState<ActiveExperiment[]>([]);

  // Mock suggestions for now
  const suggestions: ExperimentSuggestion[] = useMemo(() => [
    {
      id: '1',
      type: 'Subject Line',
      priority: 'high',
      hypothesis: 'Question-based subjects will increase reply rate by at least 15%',
      rationale: 'Question patterns show 23% lift in similar accounts but are underused in your campaigns',
      expectedLift: 0.15,
      requiredSample: 2100,
      estimatedDurationDays: 14,
      controlSuggestion: 'Current best performing subject',
      treatmentSuggestion: 'New subject using question pattern'
    },
    {
      id: '2',
      type: 'CTA',
      priority: 'high',
      hypothesis: 'Choice-based CTAs will increase meeting conversion rate',
      rationale: 'Choice CTAs ("Tuesday or Thursday?") show 34% higher meeting conversion but only used in 12% of emails',
      expectedLift: 0.25,
      requiredSample: 1800,
      estimatedDurationDays: 21,
      controlSuggestion: 'Soft CTA ("Would you be open to...")',
      treatmentSuggestion: 'Choice CTA ("Tuesday or Thursday?")'
    },
    {
      id: '3',
      type: 'Send Time',
      priority: 'medium',
      hypothesis: 'Sending Tuesday 9-10 AM will increase reply rates',
      rationale: 'Analysis suggests Tuesday morning may be optimal but currently receives only 8% of volume',
      expectedLift: 0.12,
      requiredSample: 2500,
      estimatedDurationDays: 14,
      controlSuggestion: 'Current send time distribution',
      treatmentSuggestion: 'Shift volume to Tuesday 9-10 AM'
    }
  ], []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchExperiments();
    }
  }, [currentWorkspace?.id]);

  const fetchExperiments = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          status,
          created_at,
          campaign_variants (
            id,
            name,
            subject_line,
            is_control
          )
        `)
        .eq('workspace_id', currentWorkspace.id);

      if (campaignsError) throw campaignsError;

      const { data: metrics, error: metricsError } = await supabase
        .from('daily_metrics')
        .select('variant_id, sent_count, replied_count, positive_reply_count')
        .eq('workspace_id', currentWorkspace.id)
        .not('variant_id', 'is', null);

      if (metricsError) throw metricsError;

      const variantMetrics = new Map<string, { sent: number; replied: number; positive: number }>();
      metrics?.forEach(m => {
        if (!m.variant_id) return;
        if (!variantMetrics.has(m.variant_id)) {
          variantMetrics.set(m.variant_id, { sent: 0, replied: 0, positive: 0 });
        }
        const stats = variantMetrics.get(m.variant_id)!;
        stats.sent += m.sent_count || 0;
        stats.replied += m.replied_count || 0;
        stats.positive += m.positive_reply_count || 0;
      });

      const experimentsData: ActiveExperiment[] = (campaigns || [])
        .filter(c => c.campaign_variants && c.campaign_variants.length >= 2)
        .map(campaign => {
          const variants: ExperimentVariant[] = (campaign.campaign_variants || []).map((v: any) => {
            const stats = variantMetrics.get(v.id) || { sent: 0, replied: 0, positive: 0 };
            return {
              id: v.id,
              name: v.name,
              subjectLine: v.subject_line,
              isControl: v.is_control || false,
              sentCount: stats.sent,
              replyCount: stats.replied,
              replyRate: stats.sent > 0 ? (stats.replied / stats.sent) * 100 : 0,
              positiveRate: stats.replied > 0 ? (stats.positive / stats.replied) * 100 : 0,
            };
          });

          const totalSent = variants.reduce((sum, v) => sum + v.sentCount, 0);
          const hasEnoughData = variants.every(v => v.sentCount >= MIN_SAMPLE_SIZE);
          const control = variants.find(v => v.isControl) || variants[0];
          const treatments = variants.filter(v => v.id !== control?.id);

          let winner: ExperimentVariant | null = null;
          let confidence = 0;
          let pValue: number | null = null;
          let hasSignificance = false;

          if (variants.length >= 2 && hasEnoughData && control) {
            const sorted = [...variants].sort((a, b) => b.replyRate - a.replyRate);
            const best = sorted[0];
            const second = sorted[1];

            const zScore = calculateZScore(
              best.replyRate / 100,
              second.replyRate / 100,
              best.sentCount,
              second.sentCount
            );
            confidence = zScoreToConfidence(zScore);
            pValue = zScoreToPValue(zScore);
            hasSignificance = confidence >= CONFIDENCE_THRESHOLD;

            if (hasSignificance) {
              winner = best;
            }
          }

          const status: 'running' | 'completed' | 'needs_data' = 
            !hasEnoughData ? 'needs_data' : hasSignificance ? 'completed' : 'running';

          const daysSinceCreation = Math.floor(
            (Date.now() - new Date(campaign.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          const currentSampleControl = control?.sentCount || 0;
          const currentSampleTreatment = treatments.reduce((sum, t) => sum + t.sentCount, 0);
          const requiredSample = 2000;
          const progress = (currentSampleControl + currentSampleTreatment) / (requiredSample * 2);
          const estimatedDaysRemaining = progress > 0 ? Math.ceil((1 - progress) / progress * daysSinceCreation) : null;

          return {
            id: campaign.id,
            name: campaign.name,
            hypothesis: `Testing ${variants.length} variants to optimize reply rate`,
            primaryMetric: 'Reply Rate',
            status,
            dayNumber: daysSinceCreation,
            totalDays: 14,
            variants,
            requiredSamplePerVariant: requiredSample,
            currentSampleControl,
            currentSampleTreatment,
            winner,
            confidence,
            pValue,
            lift: winner && control ? ((winner.replyRate - control.replyRate) / control.replyRate) * 100 : null,
            estimatedDaysRemaining
          };
        })
        .filter(e => e.variants.length >= 2)
        .sort((a, b) => {
          const statusOrder = { completed: 0, running: 1, needs_data: 2, draft: 3 };
          return statusOrder[a.status] - statusOrder[b.status];
        });

      setExperiments(experimentsData);
    } catch (err) {
      console.error('Error fetching experiments:', err);
    } finally {
      setLoading(false);
    }
  };

  const completedExperiments = experiments.filter(e => e.status === 'completed');
  const runningExperiments = experiments.filter(e => e.status === 'running');
  const needsDataExperiments = experiments.filter(e => e.status === 'needs_data');

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Experiments</h1>
            <p className="text-muted-foreground">
              Scientific A/B testing with statistical rigor
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              <Lightbulb className="h-4 w-4 mr-2" />
              View Suggestions
            </Button>
            <Button variant="outline" size="sm" disabled>
              <BookOpen className="h-4 w-4 mr-2" />
              View Archive
            </Button>
            <Button size="sm" disabled>
              <Plus className="h-4 w-4 mr-2" />
              New Experiment
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : experiments.length === 0 ? (
          <div className="space-y-6">
            <ExperimentStatusOverview running={0} winners={0} noDiff={0} draft={0} />
            
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="h-16 w-16 rounded-2xl bg-warning/10 flex items-center justify-center mb-4">
                  <FlaskConical className="h-8 w-8 text-warning" />
                </div>
                <h2 className="text-xl font-semibold mb-2">No Experiments Yet</h2>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  Campaigns with multiple email variants (A/B tests) will appear here automatically.
                  Create A/B tests in Smartlead to see statistical analysis.
                </p>
              </CardContent>
            </Card>

            {/* Show suggestions even without experiments */}
            <ExperimentSuggestions suggestions={suggestions} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Overview */}
            <ExperimentStatusOverview 
              running={runningExperiments.length}
              winners={completedExperiments.length}
              noDiff={needsDataExperiments.length}
              draft={0}
            />

            <Tabs defaultValue="running" className="space-y-4">
              <TabsList>
                <TabsTrigger value="running">Running ({runningExperiments.length})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({completedExperiments.length})</TabsTrigger>
                <TabsTrigger value="suggestions">Suggestions ({suggestions.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="running" className="space-y-4">
                {runningExperiments.length === 0 ? (
                  <Card>
                    <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                      No running experiments
                    </CardContent>
                  </Card>
                ) : (
                  runningExperiments.map(experiment => (
                    <ActiveExperimentCard key={experiment.id} experiment={experiment} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-4">
                {completedExperiments.length === 0 ? (
                  <Card>
                    <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                      No completed experiments yet
                    </CardContent>
                  </Card>
                ) : (
                  completedExperiments.map(experiment => (
                    <ExperimentResultsCard key={experiment.id} experiment={experiment} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="suggestions" className="space-y-4">
                <ExperimentSuggestions suggestions={suggestions} />
              </TabsContent>
            </Tabs>

            {/* Best Practices */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  A/B Testing Best Practices
                </CardTitle>
                <CardDescription>Guidelines for rigorous experimentation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="font-medium mb-2">Test ONE Variable</p>
                    <p className="text-sm text-muted-foreground">
                      Change only one element per test (subject line, CTA, send time) for clear attribution.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="font-medium mb-2">Wait for Significance</p>
                    <p className="text-sm text-muted-foreground">
                      Need <strong>{MIN_SAMPLE_SIZE}+ sends per variant</strong> and {CONFIDENCE_THRESHOLD}%+ confidence before declaring a winner.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="font-medium mb-2">Document Learnings</p>
                    <p className="text-sm text-muted-foreground">
                      Add results to your Playbook to build institutional knowledge over time.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
