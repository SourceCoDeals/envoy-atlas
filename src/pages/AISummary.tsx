import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  Loader2,
  Zap,
  ArrowRight,
  ExternalLink,
  Calendar,
  User,
  Play,
} from 'lucide-react';

interface WeeklySummary {
  id: string;
  week_start: string;
  week_end: string;
  team_health_score: number;
  team_health_trend: 'up' | 'down' | 'flat';
  key_driver: string;
  whats_working: WorkingItem[];
  areas_needing_attention: AttentionItem[];
  weekly_focus_recommendations: Recommendation[];
}

interface WorkingItem {
  pattern: string;
  impact: string;
  recommendation: string;
  example_call_id?: string;
}

interface AttentionItem {
  priority: 'urgent' | 'high' | 'medium';
  issue: string;
  data: string;
  root_cause: string;
  recommendation: string;
}

interface Recommendation {
  action: string;
  owner: string;
  due_date: string;
  predicted_impact: string;
}

export default function AISummary() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchSummary();
    }
  }, [currentWorkspace?.id]);

  const fetchSummary = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Try to fetch existing summary
      const { data: existingSummary } = await supabase
        .from('ai_weekly_summaries')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .single();

      if (existingSummary) {
        setSummary({
          id: existingSummary.id,
          week_start: existingSummary.week_start,
          week_end: existingSummary.week_end,
          team_health_score: existingSummary.team_health_score || 0,
          team_health_trend: (existingSummary.team_health_trend as 'up' | 'down' | 'flat') || 'flat',
          key_driver: existingSummary.key_driver || '',
          whats_working: (existingSummary.whats_working as unknown as WorkingItem[]) || [],
          areas_needing_attention: (existingSummary.areas_needing_attention as unknown as AttentionItem[]) || [],
          weekly_focus_recommendations: (existingSummary.weekly_focus_recommendations as unknown as Recommendation[]) || [],
        });
      } else {
        // Generate sample summary if none exists
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());

        setSummary({
          id: 'sample',
          week_start: weekStart.toISOString(),
          week_end: today.toISOString(),
          team_health_score: 72,
          team_health_trend: 'up',
          key_driver: 'Improved objection handling across the team',
          whats_working: [
            {
              pattern: 'Permission-based openings',
              impact: '74% conversation rate vs 58% baseline',
              recommendation: 'Scale this approach across all reps',
            },
            {
              pattern: 'Timeline questions in first 2 minutes',
              impact: '2.3x higher meeting conversion',
              recommendation: 'Add to mandatory discovery checklist',
            },
            {
              pattern: 'Specific meeting time proposals',
              impact: '45% higher booking rate',
              recommendation: 'Train reps on calendar blocking technique',
            },
          ],
          areas_needing_attention: [
            {
              priority: 'high',
              issue: 'Valuation discussion avoidance',
              data: 'Only 38% of calls discuss valuation expectations',
              root_cause: 'Reps uncomfortable with money conversations',
              recommendation: 'Schedule valuation talk track workshop',
            },
            {
              priority: 'medium',
              issue: 'Follow-up call delays',
              data: 'Average 4.2 days between calls vs. 2.5 day target',
              root_cause: 'No automated reminder system',
              recommendation: 'Implement same-day follow-up triggers',
            },
          ],
          weekly_focus_recommendations: [
            {
              action: 'Review top 3 calls with team',
              owner: 'Team Lead',
              due_date: 'Friday',
              predicted_impact: '+8% AI score improvement',
            },
            {
              action: 'Implement valuation script',
              owner: 'Training Manager',
              due_date: 'Wednesday',
              predicted_impact: '+15% valuation discussions',
            },
            {
              action: 'Set up follow-up automation',
              owner: 'Ops Manager',
              due_date: 'End of Week',
              predicted_impact: '-1.7 day follow-up time',
            },
          ],
        });
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-chart-4';
    return 'text-destructive';
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-warning/10 text-warning border-warning/30">High</Badge>;
      default:
        return <Badge className="bg-chart-4/10 text-chart-4 border-chart-4/30">Medium</Badge>;
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
            <h1 className="text-2xl font-bold tracking-tight">AI Summary & Recommendations</h1>
            <p className="text-muted-foreground">What's working, what's not, and what to do about it</p>
          </div>
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            This Week
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </div>
          </div>
        ) : summary ? (
          <>
            {/* Overall Assessment */}
            <Card className="bg-gradient-to-r from-primary/5 to-transparent">
              <CardContent className="py-6">
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0">
                    <div className={`text-5xl font-bold ${getHealthColor(summary.team_health_score)}`}>
                      {summary.team_health_score}
                    </div>
                    <p className="text-sm text-muted-foreground text-center">Team Health</p>
                  </div>
                  <div className="h-16 w-px bg-border" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {summary.team_health_trend === 'up' ? (
                        <TrendingUp className="h-5 w-5 text-success" />
                      ) : summary.team_health_trend === 'down' ? (
                        <TrendingDown className="h-5 w-5 text-destructive" />
                      ) : (
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="font-medium">
                        {summary.team_health_trend === 'up'
                          ? 'Improving'
                          : summary.team_health_trend === 'down'
                          ? 'Declining'
                          : 'Stable'}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{summary.key_driver}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* What's Working */}
              <Card className="border-success/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    What's Working
                  </CardTitle>
                  <CardDescription>Successful patterns to scale</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {summary.whats_working.map((item, index) => (
                    <div key={index} className="p-4 rounded-lg bg-success/5 border border-success/20 space-y-2">
                      <div className="flex items-start justify-between">
                        <p className="font-medium">{item.pattern}</p>
                        {item.example_call_id && (
                          <Button variant="ghost" size="sm" className="h-7">
                            <Play className="h-3 w-3 mr-1" />
                            Example
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-success font-medium">{item.impact}</p>
                      <p className="text-sm text-muted-foreground">→ {item.recommendation}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Areas Needing Attention */}
              <Card className="border-warning/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Areas Needing Attention
                  </CardTitle>
                  <CardDescription>Issues to address this week</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {summary.areas_needing_attention.map((item, index) => (
                    <div key={index} className="p-4 rounded-lg bg-warning/5 border border-warning/20 space-y-2">
                      <div className="flex items-start justify-between">
                        <p className="font-medium">{item.issue}</p>
                        {getPriorityBadge(item.priority)}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.data}</p>
                      <div className="pt-2 border-t border-warning/20">
                        <p className="text-xs text-muted-foreground">Root Cause</p>
                        <p className="text-sm">{item.root_cause}</p>
                      </div>
                      <p className="text-sm font-medium">→ {item.recommendation}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Weekly Focus Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Weekly Focus Recommendations
                </CardTitle>
                <CardDescription>Prioritized action items for this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.weekly_focus_recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{rec.action}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {rec.owner}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {rec.due_date}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-success/5 text-success border-success/30">
                        {rec.predicted_impact}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No AI Summary Available</p>
              <p className="text-sm">Complete more calls to generate weekly insights</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
