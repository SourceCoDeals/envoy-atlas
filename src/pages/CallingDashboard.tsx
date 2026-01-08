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
  Users,
  Loader2,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { useAggregateCallingMetrics, useProcessCalls } from '@/hooks/useCallIntelligence';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

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

export default function CallingDashboard() {
  const { data: metrics, isLoading: metricsLoading } = useAggregateCallingMetrics();
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
              Team calling performance from PhoneBurner
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
                    Across {metrics?.repPerformance.length || 0} team members
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
                    {metrics?.totalConnected.toLocaleString() || 0} connected / {metrics?.totalCalls.toLocaleString() || 0} dials
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Voicemails</CardTitle>
              <Voicemail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics?.totalVoicemails.toLocaleString() || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.totalCalls ? ((metrics.totalVoicemails / metrics.totalCalls) * 100).toFixed(1) : 0}% voicemail rate
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
                    Avg {formatDuration(Math.round((metrics?.totalTalkTimeSeconds || 0) / (metrics?.totalConnected || 1)))} per connect
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Team Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Leaderboard
            </CardTitle>
            <CardDescription>
              Performance ranking by connect rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !metrics?.repPerformance.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No calling data yet</p>
                <p className="text-xs">Sync PhoneBurner to see team performance</p>
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.repPerformance.map((rep, index) => (
                  <div 
                    key={rep.memberId}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500/10 text-yellow-500' :
                        index === 1 ? 'bg-gray-400/10 text-gray-400' :
                        index === 2 ? 'bg-amber-600/10 text-amber-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index === 0 ? <Trophy className="h-4 w-4" /> : `#${index + 1}`}
                      </div>
                      <div>
                        <p className="font-medium">{rep.memberName}</p>
                        <p className="text-xs text-muted-foreground">
                          {rep.totalCalls.toLocaleString()} calls • {rep.callsConnected.toLocaleString()} connected
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatDuration(rep.totalTalkTimeSeconds)}</p>
                        <p className="text-xs text-muted-foreground">talk time</p>
                      </div>
                      <div className="text-right min-w-[80px]">
                        <Badge variant={rep.connectRate >= 25 ? 'default' : rep.connectRate >= 15 ? 'secondary' : 'outline'}>
                          {rep.connectRate.toFixed(1)}%
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">connect rate</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connect Rate Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Connect Rate by Rep</CardTitle>
            <CardDescription>
              Visual comparison of team connect rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : !metrics?.repPerformance.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {metrics.repPerformance.map((rep) => (
                  <div key={rep.memberId} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{rep.memberName}</span>
                      <span className="text-muted-foreground">
                        {rep.connectRate.toFixed(1)}% ({rep.callsConnected}/{rep.totalCalls})
                      </span>
                    </div>
                    <Progress value={rep.connectRate} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}