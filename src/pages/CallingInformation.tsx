import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Heart,
  Clock,
  DollarSign,
  Users,
  Target,
  Loader2,
  TrendingUp,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';

const COLORS = ['hsl(var(--success))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--muted))'];

interface InterestDistribution {
  level: string;
  count: number;
  percentage: number;
}

interface TimelineDistribution {
  timeline: string;
  count: number;
}

interface MandatoryQuestion {
  question: string;
  asked_percentage: number;
  correlated_with_meeting: boolean;
}

interface CallRecord {
  id: string;
  contact_name: string;
  company_name: string;
  seller_interest_score: number | null;
  timeline_to_sell: string | null;
  motivation_factors: string[] | null;
  valuation_expectations: string | null;
  buyer_preferences: string | null;
  personal_insights: string | null;
  call_date: string;
}

export default function CallingInformation() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [interestDistribution, setInterestDistribution] = useState<InterestDistribution[]>([]);
  const [timelineDistribution, setTimelineDistribution] = useState<TimelineDistribution[]>([]);
  const [mandatoryQuestions, setMandatoryQuestions] = useState<MandatoryQuestion[]>([]);
  const [recentRecords, setRecentRecords] = useState<CallRecord[]>([]);
  const [motivationFactors, setMotivationFactors] = useState<{ factor: string; count: number }[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchCallingInformation();
    }
  }, [currentWorkspace?.id]);

  const fetchCallingInformation = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Fetch AI scores for interest distribution
      const { data: scores } = await supabase
        .from('call_ai_scores')
        .select('seller_interest_score, timeline_to_sell, personal_insights')
        .eq('workspace_id', currentWorkspace.id);

      if (scores) {
        // Calculate interest distribution
        const interestCounts: Record<string, number> = {
          'Very High (9-10)': 0,
          'High (7-8)': 0,
          'Medium (5-6)': 0,
          'Low (3-4)': 0,
          'Very Low (1-2)': 0,
        };

        scores.forEach((s) => {
          const score = s.seller_interest_score || 0;
          if (score >= 9) interestCounts['Very High (9-10)']++;
          else if (score >= 7) interestCounts['High (7-8)']++;
          else if (score >= 5) interestCounts['Medium (5-6)']++;
          else if (score >= 3) interestCounts['Low (3-4)']++;
          else interestCounts['Very Low (1-2)']++;
        });

        const total = scores.length || 1;
        setInterestDistribution(
          Object.entries(interestCounts).map(([level, count]) => ({
            level,
            count,
            percentage: (count / total) * 100,
          }))
        );

        // Calculate timeline distribution
        const timelineCounts: Record<string, number> = {};
        scores.forEach((s) => {
          const timeline = s.timeline_to_sell || 'Not Discussed';
          timelineCounts[timeline] = (timelineCounts[timeline] || 0) + 1;
        });

        setTimelineDistribution(
          Object.entries(timelineCounts)
            .map(([timeline, count]) => ({ timeline, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6)
        );
      }

      // Fetch deals for more detailed info
      const { data: deals } = await supabase
        .from('calling_deals')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (deals) {
        // Extract motivation factors
        const factorCounts: Record<string, number> = {};
        deals.forEach((d) => {
          (d.motivation_factors || []).forEach((f: string) => {
            factorCounts[f] = (factorCounts[f] || 0) + 1;
          });
        });

        setMotivationFactors(
          Object.entries(factorCounts)
            .map(([factor, count]) => ({ factor, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
        );

        // Map to call records
        setRecentRecords(
          deals.map((d) => ({
            id: d.id,
            contact_name: d.contact_name || 'Unknown',
            company_name: d.company_name,
            seller_interest_score: d.seller_interest_score,
            timeline_to_sell: d.timeline_to_sell,
            motivation_factors: d.motivation_factors,
            valuation_expectations: d.valuation_expectations,
            buyer_preferences: d.buyer_preferences,
            personal_insights: null,
            call_date: d.created_at,
          }))
        );
      }

      // Sample mandatory questions data
      setMandatoryQuestions([
        { question: 'Have you thought about selling?', asked_percentage: 95, correlated_with_meeting: true },
        { question: 'What\'s your timeline?', asked_percentage: 82, correlated_with_meeting: true },
        { question: 'What\'s the business worth to you?', asked_percentage: 45, correlated_with_meeting: true },
        { question: 'Who would be the ideal buyer?', asked_percentage: 38, correlated_with_meeting: false },
        { question: 'What happens if you don\'t sell?', asked_percentage: 28, correlated_with_meeting: true },
      ]);
    } catch (err) {
      console.error('Error fetching calling information:', err);
    } finally {
      setLoading(false);
    }
  };

  const getInterestColor = (score: number | null) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 8) return 'text-success';
    if (score >= 5) return 'text-chart-4';
    return 'text-destructive';
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calling Information</h1>
          <p className="text-muted-foreground">AI-extracted insights from conversations</p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-40 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Tabs defaultValue="aggregated" className="space-y-6">
            <TabsList>
              <TabsTrigger value="aggregated">Aggregated Insights</TabsTrigger>
              <TabsTrigger value="records">Individual Records</TabsTrigger>
            </TabsList>

            <TabsContent value="aggregated" className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Seller Interest Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-chart-2" />
                      Seller Interest Distribution
                    </CardTitle>
                    <CardDescription>Interest levels across all conversations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={interestDistribution}
                            dataKey="count"
                            nameKey="level"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ level, percentage }) => `${level.split(' ')[0]} ${percentage.toFixed(0)}%`}
                          >
                            {interestDistribution.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-chart-3" />
                      Timeline Distribution
                    </CardTitle>
                    <CardDescription>When sellers are planning to sell</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={timelineDistribution} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis dataKey="timeline" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={100} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar dataKey="count" fill="hsl(var(--chart-3))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Motivation Factors */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-chart-4" />
                      Motivation Factors
                    </CardTitle>
                    <CardDescription>Why sellers are considering a sale</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {motivationFactors.length > 0 ? (
                        motivationFactors.map((item, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-sm">{item.factor}</span>
                            <div className="flex items-center gap-2">
                              <Progress value={(item.count / (motivationFactors[0]?.count || 1)) * 100} className="w-20 h-2" />
                              <Badge variant="outline">{item.count}</Badge>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No data yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Mandatory Questions Adherence */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Mandatory Questions
                    </CardTitle>
                    <CardDescription>Discovery question adherence</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {mandatoryQuestions.map((q, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              {q.correlated_with_meeting && (
                                <CheckCircle2 className="h-3 w-3 text-success" />
                              )}
                              {q.question}
                            </span>
                            <span className={q.asked_percentage >= 70 ? 'text-success' : 'text-muted-foreground'}>
                              {q.asked_percentage}%
                            </span>
                          </div>
                          <Progress value={q.asked_percentage} className="h-1.5" />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      <CheckCircle2 className="h-3 w-3 inline mr-1" />
                      Correlated with meeting conversion
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="records" className="space-y-4">
              {recentRecords.length > 0 ? (
                recentRecords.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{record.contact_name}</h3>
                          <p className="text-sm text-muted-foreground">{record.company_name}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${getInterestColor(record.seller_interest_score)}`}>
                            {record.seller_interest_score || '-'}/10
                          </p>
                          <p className="text-xs text-muted-foreground">Interest</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                        <div className="p-2 rounded-lg bg-accent/50">
                          <p className="text-muted-foreground text-xs">Timeline</p>
                          <p className="font-medium">{record.timeline_to_sell || 'Not discussed'}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-accent/50">
                          <p className="text-muted-foreground text-xs">Valuation</p>
                          <p className="font-medium">{record.valuation_expectations || 'Not discussed'}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-accent/50">
                          <p className="text-muted-foreground text-xs">Buyer Pref</p>
                          <p className="font-medium">{record.buyer_preferences || 'Not discussed'}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-accent/50">
                          <p className="text-muted-foreground text-xs">Motivation</p>
                          <p className="font-medium">
                            {record.motivation_factors?.join(', ') || 'Not identified'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No call records yet</p>
                    <p className="text-sm">Information will appear here after calls are scored by AI</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
