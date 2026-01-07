import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Phone, 
  PhoneCall, 
  Voicemail, 
  Clock, 
  TrendingUp, 
  Brain, 
  FileText,
  Loader2,
  Trophy,
  AlertTriangle,
  Sparkles,
  Play
} from 'lucide-react';
import { useCallingMetrics, useTopAndBottomCalls, useProcessCalls } from '@/hooks/useCallIntelligence';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { formatDistanceToNow } from 'date-fns';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 70) return 'default';
  if (score >= 50) return 'secondary';
  return 'destructive';
}

export default function CallingDashboard() {
  const { data: metrics, isLoading: metricsLoading } = useCallingMetrics();
  const { data: topBottom, isLoading: topBottomLoading } = useTopAndBottomCalls(5);
  const processCalls = useProcessCalls();

  const handleProcessCalls = () => {
    processCalls.mutate({ mode: 'pending', limit: 10 });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Call Intelligence</h1>
            <p className="text-muted-foreground">
              AI-powered analysis of your cold calling performance
            </p>
          </div>
          <Button 
            onClick={handleProcessCalls}
            disabled={processCalls.isPending}
          >
            {processCalls.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Process Calls
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics?.totalCalls.toLocaleString() || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.callsWithRecording || 0} with recordings
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connect Rate</CardTitle>
              <PhoneCall className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics?.connectRate.toFixed(1) || 0}%</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.totalConnected || 0} connected / {metrics?.totalCalls || 0} dials
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg AI Score</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${metrics?.avgAIScore ? getScoreColor(metrics.avgAIScore) : ''}`}>
                    {metrics?.avgAIScore !== null ? `${metrics.avgAIScore}/100` : '--'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.scoredCalls || 0} calls scored
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Talk Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatDuration(metrics?.totalTalkTimeSeconds || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Avg {formatDuration(Math.round(metrics?.avgDuration || 0))} per connect
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Processing Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              AI Processing Pipeline
            </CardTitle>
            <CardDescription>
              Transcription and scoring progress for your calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Calls with Recording</span>
                    <span className="font-medium">{metrics?.callsWithRecording || 0} / {metrics?.totalCalls || 0}</span>
                  </div>
                  <Progress 
                    value={metrics?.totalCalls ? (metrics.callsWithRecording / metrics.totalCalls) * 100 : 0} 
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Transcribed</span>
                    <span className="font-medium">{metrics?.transcribedCalls || 0} / {metrics?.callsWithRecording || 0}</span>
                  </div>
                  <Progress 
                    value={metrics?.callsWithRecording ? (metrics.transcribedCalls / metrics.callsWithRecording) * 100 : 0} 
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">AI Scored</span>
                    <span className="font-medium">{metrics?.scoredCalls || 0} / {metrics?.transcribedCalls || 0}</span>
                  </div>
                  <Progress 
                    value={metrics?.transcribedCalls ? (metrics.scoredCalls / metrics.transcribedCalls) * 100 : 0} 
                    className="h-2"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top and Bottom Calls */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Calls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top Performing Calls
              </CardTitle>
              <CardDescription>
                Highest AI-scored calls to learn from
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topBottomLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : topBottom?.topCalls.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No scored calls yet</p>
                  <p className="text-xs">Process calls to see AI scores</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topBottom?.topCalls.map((item, index) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/10 text-yellow-500 font-bold text-sm">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {item.call?.phone_number || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.call?.start_at 
                              ? formatDistanceToNow(new Date(item.call.start_at), { addSuffix: true })
                              : 'Unknown date'
                            }
                            {item.call?.duration_seconds && ` • ${formatDuration(item.call.duration_seconds)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getScoreBadgeVariant(item.composite_score || 0)}>
                          {item.composite_score}/100
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom Calls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Calls Needing Review
              </CardTitle>
              <CardDescription>
                Lower-scored calls for coaching opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topBottomLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : topBottom?.bottomCalls.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No scored calls yet</p>
                  <p className="text-xs">Process calls to see AI scores</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topBottom?.bottomCalls.map((item, index) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 font-bold text-sm">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {item.call?.phone_number || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.call?.start_at 
                              ? formatDistanceToNow(new Date(item.call.start_at), { addSuffix: true })
                              : 'Unknown date'
                            }
                            {item.call?.duration_seconds && ` • ${formatDuration(item.call.duration_seconds)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getScoreBadgeVariant(item.composite_score || 0)}>
                          {item.composite_score}/100
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Voicemails Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Voicemail className="h-5 w-5" />
              Voicemail Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-3xl font-bold">{metrics?.totalVoicemails || 0}</p>
                  <p className="text-sm text-muted-foreground">Voicemails left</p>
                </div>
                <div className="h-12 w-px bg-border" />
                <div>
                  <p className="text-3xl font-bold">
                    {metrics?.totalCalls ? ((metrics.totalVoicemails / metrics.totalCalls) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Voicemail rate</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
