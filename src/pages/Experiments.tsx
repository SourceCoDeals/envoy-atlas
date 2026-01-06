import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Lightbulb, BookOpen, Calculator } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ExperimentStatusOverview } from '@/components/experiments/ExperimentStatusOverview';
import { ActiveExperimentCard, ActiveExperiment, ExperimentVariant } from '@/components/experiments/ActiveExperimentCard';
import { ExperimentResultsCard } from '@/components/experiments/ExperimentResultsCard';
import { ExperimentSuggestions, ExperimentSuggestion } from '@/components/experiments/ExperimentSuggestions';
import { ExperimentProgramHealth } from '@/components/experiments/ExperimentProgramHealth';
import { SampleSizeCalculator } from '@/components/experiments/SampleSizeCalculator';
import { ExperimentBestPractices } from '@/components/experiments/ExperimentBestPractices';
import { NoExperimentsState } from '@/components/experiments/NoExperimentsState';

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
  if (absZ >= 3.29) return 0.001;
  if (absZ >= 2.58) return 0.01;
  if (absZ >= 1.96) return 0.05;
  if (absZ >= 1.645) return 0.1;
  return Math.min(1, 2 * (1 - (0.5 * (1 + Math.tanh(absZ * 0.7)))));
}

// Corrected sample size requirements - much higher than 100!
const MIN_SAMPLE_SIZE = 500; // Realistic minimum for detecting 50% relative lift
const CONFIDENCE_THRESHOLD = 95;

export default function Experiments() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState<ActiveExperiment[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Mock suggestions for now
  const suggestions: ExperimentSuggestion[] = useMemo(() => [
    {
      id: '1',
      type: 'Subject Line',
      priority: 'high',
      hypothesis: 'Question-based subjects will increase reply rate by at least 25% because our data shows questions get 23% higher engagement but are underused',
      rationale: 'Question patterns show 23% lift in similar accounts but are only used in 9% of your emails',
      expectedLift: 0.25,
      requiredSample: 2000,
      estimatedDurationDays: 14,
      controlSuggestion: 'Current best performing subject line',
      treatmentSuggestion: 'New subject using question pattern'
    },
    {
      id: '2',
      type: 'CTA',
      priority: 'high',
      hypothesis: 'Choice-based CTAs ("Tuesday or Thursday?") will increase meeting conversion by 40% by reducing friction',
      rationale: 'Choice CTAs show 34% higher meeting conversion in industry benchmarks but are only used in 12% of your emails',
      expectedLift: 0.40,
      requiredSample: 1200,
      estimatedDurationDays: 10,
      controlSuggestion: 'Soft CTA ("Would you be open to...")',
      treatmentSuggestion: 'Choice CTA ("Tuesday or Thursday?")'
    },
    {
      id: '3',
      type: 'Send Time',
      priority: 'medium',
      hypothesis: 'Sending Tuesday 9-10 AM will increase reply rates by 15%',
      rationale: 'Analysis suggests Tuesday morning may be optimal but currently receives only 8% of volume',
      expectedLift: 0.15,
      requiredSample: 3500,
      estimatedDurationDays: 21,
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

          const status: 'running' | 'completed' | 'needs_data' | 'draft' = 
            !hasEnoughData ? 'needs_data' : hasSignificance ? 'completed' : 'running';

          const daysSinceCreation = Math.floor(
            (Date.now() - new Date(campaign.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          const currentSampleControl = control?.sentCount || 0;
          const currentSampleTreatment = treatments.reduce((sum, t) => sum + t.sentCount, 0);
          const requiredSample = MIN_SAMPLE_SIZE;
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

  // Calculate program health metrics
  const programHealth = useMemo(() => {
    const completed = completedExperiments.length + needsDataExperiments.length;
    const allExperiments = [...completedExperiments, ...needsDataExperiments, ...runningExperiments];
    
    const avgSampleSize = allExperiments.length > 0
      ? allExperiments.reduce((sum, e) => sum + (e.currentSampleControl + e.currentSampleTreatment) / 2, 0) / allExperiments.length
      : 0;
    
    const avgDurationDays = allExperiments.length > 0
      ? allExperiments.reduce((sum, e) => sum + e.dayNumber, 0) / allExperiments.length
      : 0;

    return {
      totalTests: completed,
      winnersFound: completedExperiments.length,
      noDiffFound: needsDataExperiments.length,
      avgSampleSize: Math.round(avgSampleSize),
      avgDurationDays
    };
  }, [completedExperiments, needsDataExperiments, runningExperiments]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasExperiments = experiments.length > 0;
  const hasRunningExperiments = runningExperiments.length > 0;

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
            <Button variant="outline" size="sm" onClick={() => setActiveTab('calculator')}>
              <Calculator className="h-4 w-4 mr-2" />
              Power Calculator
            </Button>
            <Button variant="outline" size="sm" onClick={() => setActiveTab('suggestions')}>
              <Lightbulb className="h-4 w-4 mr-2" />
              Suggestions ({suggestions.length})
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
        ) : !hasExperiments ? (
          <NoExperimentsState suggestions={suggestions} />
        ) : (
          <div className="space-y-6">
            {/* Status Overview */}
            <ExperimentStatusOverview 
              running={runningExperiments.length}
              winners={completedExperiments.length}
              noDiff={needsDataExperiments.length}
              draft={0}
            />

            {/* Program Health Alert - Show prominently if there are issues */}
            {programHealth.totalTests > 0 && (
              <ExperimentProgramHealth {...programHealth} />
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="running">Running ({runningExperiments.length})</TabsTrigger>
                <TabsTrigger value="completed">Completed ({completedExperiments.length})</TabsTrigger>
                <TabsTrigger value="suggestions">
                  Suggestions ({suggestions.length})
                </TabsTrigger>
                <TabsTrigger value="calculator">Power Calculator</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Show suggestions prominently if no running experiments */}
                {!hasRunningExperiments && suggestions.length > 0 && (
                  <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-5 w-5 text-warning" />
                      <h3 className="font-semibold">No Running Experiments</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      We found {suggestions.length} high-potential experiments based on your data. 
                      Start testing to discover what works best.
                    </p>
                    <Button onClick={() => setActiveTab('suggestions')}>
                      View Suggestions
                    </Button>
                  </div>
                )}

                {/* Running Experiments Summary */}
                {runningExperiments.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Currently Running</h3>
                    {runningExperiments.slice(0, 2).map(experiment => (
                      <ActiveExperimentCard key={experiment.id} experiment={experiment} />
                    ))}
                    {runningExperiments.length > 2 && (
                      <Button variant="outline" onClick={() => setActiveTab('running')}>
                        View all {runningExperiments.length} running experiments
                      </Button>
                    )}
                  </div>
                )}

                {/* Best Practices - Collapsed by default */}
                <ExperimentBestPractices />
              </TabsContent>

              <TabsContent value="running" className="space-y-4">
                {runningExperiments.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground border rounded-lg border-dashed">
                    <p>No running experiments</p>
                    <Button 
                      variant="link" 
                      className="mt-2"
                      onClick={() => setActiveTab('suggestions')}
                    >
                      View suggested experiments
                    </Button>
                  </div>
                ) : (
                  runningExperiments.map(experiment => (
                    <ActiveExperimentCard key={experiment.id} experiment={experiment} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-4">
                {completedExperiments.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground border rounded-lg border-dashed">
                    <p>No completed experiments with clear winners yet</p>
                    <p className="text-sm mt-2">
                      Experiments need {MIN_SAMPLE_SIZE.toLocaleString()}+ sends per variant and 95%+ confidence
                    </p>
                  </div>
                ) : (
                  completedExperiments.map(experiment => (
                    <ExperimentResultsCard key={experiment.id} experiment={experiment} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="suggestions" className="space-y-4">
                <ExperimentSuggestions suggestions={suggestions} />
              </TabsContent>

              <TabsContent value="calculator" className="space-y-4">
                <SampleSizeCalculator 
                  dailySendCapacity={500}
                  baselineReplyRate={0.03}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
