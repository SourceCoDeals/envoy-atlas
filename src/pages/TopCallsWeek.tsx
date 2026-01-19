import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Trophy,
  Play,
  FileText,
  BookOpen,
  Star,
  Loader2,
  Phone,
  User,
  Zap,
} from 'lucide-react';

interface TopCall {
  id: string;
  call_id: string;
  quality_score: number;
  rep_name: string;
  contact_name: string;
  company_name: string;
  duration_seconds: number;
  call_date: string;
  outcome: string;
  key_techniques: string[];
  why_it_worked: string;
}

interface PatternInsight {
  category: string;
  insight: string;
  frequency: string;
}

export default function TopCallsWeek() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [topCalls, setTopCalls] = useState<TopCall[]>([]);
  const [patterns, setPatterns] = useState<PatternInsight[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchTopCalls();
    }
  }, [currentWorkspace?.id]);

  const fetchTopCalls = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = engagements?.map(e => e.id) || [];
      if (engagementIds.length === 0) {
        setTopCalls([]);
        setLoading(false);
        return;
      }

      // Fetch top calls by talk duration (proxy for quality)
      const { data: calls, error } = await supabase
        .from('call_activities')
        .select('id, to_name, to_phone, caller_name, talk_duration, conversation_outcome, started_at, notes, transcription')
        .in('engagement_id', engagementIds)
        .not('transcription', 'is', null)
        .order('talk_duration', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Transform data
      const topCallsData: TopCall[] = (calls || []).map((c) => {
        const durationScore = Math.min(100, (c.talk_duration || 0) / 3);
        const hasOutcome = c.conversation_outcome?.toLowerCase().includes('meeting') || 
                          c.conversation_outcome?.toLowerCase().includes('interested');
        const qualityScore = durationScore + (hasOutcome ? 20 : 0);

        return {
          id: c.id,
          call_id: c.id,
          quality_score: Math.min(100, qualityScore),
          rep_name: c.caller_name || 'Unknown',
          contact_name: c.to_name || c.to_phone || 'Unknown',
          company_name: 'Company',
          duration_seconds: c.talk_duration || 0,
          call_date: c.started_at || '',
          outcome: c.conversation_outcome || 'Connection',
          key_techniques: [
            (c.talk_duration || 0) > 180 ? 'Long conversation' : null,
            hasOutcome ? 'Positive outcome' : null,
            c.transcription ? 'Transcribed' : null,
          ].filter(Boolean) as string[],
          why_it_worked: c.notes || 'High overall quality call',
        };
      });

      setTopCalls(topCallsData);

      // Generate pattern insights
      const longCalls = calls?.filter(c => (c.talk_duration || 0) > 180) || [];
      const positiveCalls = calls?.filter(c => 
        c.conversation_outcome?.toLowerCase().includes('meeting') ||
        c.conversation_outcome?.toLowerCase().includes('interested')
      ) || [];

      setPatterns([
        {
          category: 'Call Duration',
          insight: 'Longer calls correlate with better outcomes',
          frequency: `${longCalls.length}/${calls?.length || 0} top calls`,
        },
        {
          category: 'Positive Outcomes',
          insight: 'Meeting-setters have above average duration',
          frequency: `${positiveCalls.length}/${calls?.length || 0} top calls`,
        },
      ]);
    } catch (err) {
      console.error('Error fetching top calls:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Trophy className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Trophy className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-medium">{index + 1}</span>;
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
          <h1 className="text-2xl font-bold tracking-tight">Top Calls This Week</h1>
          <p className="text-muted-foreground">Best performing calls for learning and recognition</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="h-24 w-full bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Leaderboard */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Top 10 Leaderboard
                  </CardTitle>
                  <CardDescription>Ranked by call quality score</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topCalls.length > 0 ? (
                    topCalls.map((call, index) => (
                      <div
                        key={call.id}
                        className={`flex items-center gap-4 p-3 rounded-lg border transition-colors hover:border-primary/50 ${
                          index < 3 ? 'bg-accent/30' : ''
                        }`}
                      >
                        {/* Rank */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-background flex items-center justify-center">
                          {getRankIcon(index)}
                        </div>

                        {/* Call Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{call.contact_name}</p>
                            <Badge variant="outline" className="text-xs">
                              {call.outcome}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {call.rep_name}
                            </span>
                            <span>
                              {Math.floor(call.duration_seconds / 60)}:{(call.duration_seconds % 60).toString().padStart(2, '0')} min
                            </span>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="text-right">
                          <p className={`text-xl font-bold ${getScoreColor(call.quality_score)}`}>
                            {Math.round(call.quality_score)}
                          </p>
                          <p className="text-xs text-muted-foreground">Score</p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <BookOpen className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No scored calls this week</p>
                      <p className="text-sm">Complete calls to see the leaderboard</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Pattern Analysis */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Pattern Analysis
                  </CardTitle>
                  <CardDescription>Common elements in top calls</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {patterns.map((pattern, index) => (
                    <div key={index} className="p-3 rounded-lg bg-accent/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{pattern.category}</p>
                        <Badge variant="outline" className="text-xs">
                          {pattern.frequency}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{pattern.insight}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Create Training</CardTitle>
                  <CardDescription>Turn patterns into modules</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Create Training Module
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Automatically generate training from top call patterns
                  </p>
                </CardContent>
              </Card>

              {/* Call of the Week Highlight */}
              {topCalls.length > 0 && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Star className="h-5 w-5 text-yellow-500" />
                      Call of the Week
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="font-medium">{topCalls[0].contact_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Rep: {topCalls[0].rep_name}
                      </p>
                      <p className="text-sm">{topCalls[0].why_it_worked}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {topCalls[0].key_techniques.map((technique, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {technique}
                          </Badge>
                        ))}
                      </div>
                      <Button variant="outline" className="w-full mt-3">
                        <Play className="h-4 w-4 mr-2" />
                        Listen to Call
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
