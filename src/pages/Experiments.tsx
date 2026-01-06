import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, 
  FlaskConical,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  BarChart3,
  Trophy,
  AlertTriangle,
  Play,
  Pause,
  Target,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

interface ExperimentVariant {
  id: string;
  name: string;
  subject_line: string | null;
  is_control: boolean;
  sent_count: number;
  reply_count: number;
  positive_count: number;
  reply_rate: number;
  positive_rate: number;
}

interface Experiment {
  campaign_id: string;
  campaign_name: string;
  variants: ExperimentVariant[];
  total_sent: number;
  status: 'running' | 'completed' | 'needs_data';
  winner: ExperimentVariant | null;
  confidence: number;
  has_significance: boolean;
}

// Statistical functions
function calculateZScore(p1: number, p2: number, n1: number, n2: number): number {
  const p = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1/n1 + 1/n2));
  if (se === 0) return 0;
  return (p1 - p2) / se;
}

function zScoreToConfidence(z: number): number {
  // Approximate p-value to confidence conversion
  const absZ = Math.abs(z);
  if (absZ >= 2.576) return 99;
  if (absZ >= 1.96) return 95;
  if (absZ >= 1.645) return 90;
  if (absZ >= 1.28) return 80;
  return Math.min(80, absZ * 35);
}

const MIN_SAMPLE_SIZE = 100; // Minimum sends per variant for significance
const CONFIDENCE_THRESHOLD = 95;

export default function Experiments() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState<Experiment[]>([]);

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
      // Fetch campaigns with their variants
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          status,
          campaign_variants (
            id,
            name,
            subject_line,
            is_control
          )
        `)
        .eq('workspace_id', currentWorkspace.id);

      if (campaignsError) throw campaignsError;

      // Fetch metrics for variants
      const { data: metrics, error: metricsError } = await supabase
        .from('daily_metrics')
        .select('variant_id, sent_count, replied_count, positive_reply_count')
        .eq('workspace_id', currentWorkspace.id)
        .not('variant_id', 'is', null);

      if (metricsError) throw metricsError;

      // Aggregate metrics per variant
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

      // Build experiments from campaigns with multiple variants
      const experimentsData: Experiment[] = (campaigns || [])
        .filter(c => c.campaign_variants && c.campaign_variants.length >= 2)
        .map(campaign => {
          const variants: ExperimentVariant[] = (campaign.campaign_variants || []).map((v: any) => {
            const stats = variantMetrics.get(v.id) || { sent: 0, replied: 0, positive: 0 };
            return {
              id: v.id,
              name: v.name,
              subject_line: v.subject_line,
              is_control: v.is_control || false,
              sent_count: stats.sent,
              reply_count: stats.replied,
              positive_count: stats.positive,
              reply_rate: stats.sent > 0 ? (stats.replied / stats.sent) * 100 : 0,
              positive_rate: stats.sent > 0 ? (stats.positive / stats.sent) * 100 : 0,
            };
          });

          const totalSent = variants.reduce((sum, v) => sum + v.sent_count, 0);
          const hasEnoughData = variants.every(v => v.sent_count >= MIN_SAMPLE_SIZE);

          // Find winner using reply rate
          let winner: ExperimentVariant | null = null;
          let confidence = 0;
          let hasSignificance = false;

          if (variants.length >= 2 && hasEnoughData) {
            // Sort by reply rate
            const sorted = [...variants].sort((a, b) => b.reply_rate - a.reply_rate);
            const best = sorted[0];
            const second = sorted[1];

            // Calculate z-score and confidence
            const zScore = calculateZScore(
              best.reply_rate / 100,
              second.reply_rate / 100,
              best.sent_count,
              second.sent_count
            );
            confidence = zScoreToConfidence(zScore);
            hasSignificance = confidence >= CONFIDENCE_THRESHOLD;

            if (hasSignificance) {
              winner = best;
            }
          }

          const status: 'running' | 'completed' | 'needs_data' = !hasEnoughData ? 'needs_data' : hasSignificance ? 'completed' : 'running';

          return {
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            variants,
            total_sent: totalSent,
            status,
            winner,
            confidence,
            has_significance: hasSignificance,
          };
        })
        .filter(e => e.variants.length >= 2)
        .sort((a, b) => {
          // Sort: completed first, then running, then needs_data
          const statusOrder = { completed: 0, running: 1, needs_data: 2 };
          return statusOrder[a.status] - statusOrder[b.status];
        });

      setExperiments(experimentsData);
    } catch (err) {
      console.error('Error fetching experiments:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'completed') {
      return <Badge className="bg-success/20 text-success border-success/30"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
    }
    if (status === 'running') {
      return <Badge className="bg-primary/20 text-primary border-primary/30"><Play className="w-3 h-3 mr-1" />Running</Badge>;
    }
    return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Needs Data</Badge>;
  };

  const getConfidenceBadge = (confidence: number, hasSignificance: boolean) => {
    if (hasSignificance) {
      return <Badge className="bg-success/20 text-success border-success/30">{confidence.toFixed(0)}% confident</Badge>;
    }
    if (confidence >= 80) {
      return <Badge className="bg-warning/20 text-warning border-warning/30">{confidence.toFixed(0)}% (not significant)</Badge>;
    }
    return <Badge variant="outline">{confidence.toFixed(0)}%</Badge>;
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Experiments</h1>
          <p className="text-muted-foreground">
            A/B tests with statistical rigor and clear winner selection
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : experiments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-warning/10 flex items-center justify-center mb-4">
                <FlaskConical className="h-8 w-8 text-warning" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Experiments Yet</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Campaigns with multiple email variants (A/B tests) will appear here automatically.
                Create A/B tests in Smartlead to see statistical analysis.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{experiments.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Total Experiments</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-success" />
                    <span className="text-2xl font-bold text-success">{completedExperiments.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">With Winner ({CONFIDENCE_THRESHOLD}%+ confidence)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-primary" />
                    <span className="text-2xl font-bold">{runningExperiments.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Still Running</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{needsDataExperiments.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Need More Data (&lt;{MIN_SAMPLE_SIZE} per variant)</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="all" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all">All ({experiments.length})</TabsTrigger>
                <TabsTrigger value="completed">Winners ({completedExperiments.length})</TabsTrigger>
                <TabsTrigger value="running">Running ({runningExperiments.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                <ExperimentList experiments={experiments} />
              </TabsContent>

              <TabsContent value="completed" className="space-y-4">
                <ExperimentList experiments={completedExperiments} />
              </TabsContent>

              <TabsContent value="running" className="space-y-4">
                <ExperimentList experiments={runningExperiments} />
              </TabsContent>
            </Tabs>

            {/* Best Practices */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  A/B Testing Best Practices
                </CardTitle>
                <CardDescription>From the Cold Email Platform Guide</CardDescription>
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
                    <p className="font-medium mb-2">Minimum Sample Size</p>
                    <p className="text-sm text-muted-foreground">
                      Need <strong>{MIN_SAMPLE_SIZE}+ recipients per variant</strong> for statistical significance.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="font-medium mb-2">Focus on Reply Rate</p>
                    <p className="text-sm text-muted-foreground">
                      Reply rate is the primary metric. Open rates are unreliable due to pixel tracking limitations.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function ExperimentList({ experiments }: { experiments: Experiment[] }) {
  if (experiments.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          No experiments in this category
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {experiments.map(experiment => (
        <ExperimentCard key={experiment.campaign_id} experiment={experiment} />
      ))}
    </div>
  );
}

function ExperimentCard({ experiment }: { experiment: Experiment }) {
  const getStatusBadge = (status: string) => {
    if (status === 'completed') {
      return <Badge className="bg-success/20 text-success border-success/30"><CheckCircle2 className="w-3 h-3 mr-1" />Winner Found</Badge>;
    }
    if (status === 'running') {
      return <Badge className="bg-primary/20 text-primary border-primary/30"><Play className="w-3 h-3 mr-1" />Running</Badge>;
    }
    return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Needs Data</Badge>;
  };

  // Prepare chart data
  const chartData = experiment.variants.map(v => ({
    name: v.name.length > 20 ? v.name.substring(0, 20) + '...' : v.name,
    fullName: v.name,
    replyRate: v.reply_rate,
    sent: v.sent_count,
    isWinner: experiment.winner?.id === v.id,
    isControl: v.is_control,
  }));

  return (
    <Card className={experiment.winner ? 'border-success/30' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{experiment.campaign_name}</CardTitle>
            <CardDescription>
              {experiment.variants.length} variants · {experiment.total_sent.toLocaleString()} total sent
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(experiment.status)}
            {experiment.confidence > 0 && (
              <Badge variant="outline">
                {experiment.confidence.toFixed(0)}% confidence
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Chart */}
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" unit="%" fontSize={12} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  fontSize={11} 
                  width={120}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value.toFixed(2)}%`,
                    `Reply Rate (${props.payload.sent.toLocaleString()} sent)`
                  ]}
                  labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName || label}
                />
                <Bar dataKey="replyRate" name="Reply Rate">
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={
                        entry.isWinner 
                          ? 'hsl(var(--success))' 
                          : entry.isControl 
                            ? 'hsl(var(--primary))'
                            : 'hsl(var(--muted-foreground))'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Variant Details */}
          <div className="space-y-2">
            {experiment.variants.map(variant => (
              <div
                key={variant.id}
                className={`p-3 rounded-lg ${
                  experiment.winner?.id === variant.id 
                    ? 'bg-success/10 border border-success/30' 
                    : 'bg-muted/30'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {experiment.winner?.id === variant.id && (
                      <Trophy className="h-4 w-4 text-success" />
                    )}
                    <span className="font-medium text-sm">{variant.name}</span>
                    {variant.is_control && (
                      <Badge variant="secondary" className="text-xs">Control</Badge>
                    )}
                  </div>
                  <span className={`font-mono text-sm ${
                    experiment.winner?.id === variant.id ? 'text-success' : ''
                  }`}>
                    {variant.reply_rate.toFixed(2)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {variant.subject_line || 'No subject line'}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{variant.sent_count.toLocaleString()} sent</span>
                  <span>{variant.reply_count} replies</span>
                  <span>{variant.positive_count} positive</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {experiment.status === 'needs_data' && (
          <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm text-warning">
              Need at least {MIN_SAMPLE_SIZE} sends per variant for statistical significance
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
