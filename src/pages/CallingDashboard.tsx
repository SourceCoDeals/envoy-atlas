import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataHealthIndicator } from '@/components/ui/data-health-indicator';
import { 
  Phone, 
  PhoneCall, 
  Voicemail, 
  Clock, 
  Users,
  Loader2,
  Trophy,
  Sparkles,
  RefreshCw,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { useProcessCalls } from '@/hooks/useCallIntelligence';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useQueryClient } from '@tanstack/react-query';
import { 
  useExternalCalls, 
  filterCalls, 
  isConnection, 
  isVoicemail,
  DATE_RANGE_OPTIONS,
  DateRangeOption 
} from '@/hooks/useExternalCalls';

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

interface RepPerformance {
  memberId: string;
  memberName: string;
  totalCalls: number;
  callsConnected: number;
  connectRate: number;
  voicemailsLeft: number;
  totalTalkTimeSeconds: number;
}

export default function CallingDashboard() {
  const { calls, analysts, loading: callsLoading, refresh, totalCount } = useExternalCalls();
  const processCalls = useProcessCalls();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  
  // Filters
  const [dateRange, setDateRange] = useState<DateRangeOption>('all_time');
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>('all');

  const handleProcessCalls = () => {
    processCalls.mutate({ mode: 'pending', limit: 10 });
  };

  const handleSyncNocoDB = async () => {
    if (!currentWorkspace?.id || syncing) return;
    
    setSyncing(true);
    toast.info('Starting NocoDB sync...', { description: 'This may take a few minutes for large datasets.' });
    
    try {
      const { data, error } = await supabase.functions.invoke('nocodb-sync', {
        body: { 
          workspace_id: currentWorkspace.id,
          action: 'sync'
        }
      });

      if (error) throw error;

      toast.success('NocoDB sync complete', {
        description: `Synced ${data?.synced_count || 0} records successfully`
      });
      
      // Refresh the data
      refresh();
      queryClient.invalidateQueries({ queryKey: ['aggregate-calling-metrics'] });
    } catch (err) {
      console.error('NocoDB sync error:', err);
      toast.error('Sync failed', {
        description: err instanceof Error ? err.message : 'Failed to sync NocoDB data'
      });
    } finally {
      setSyncing(false);
    }
  };

  // Filter and compute metrics
  const { filteredCalls, metrics, repPerformance } = useMemo(() => {
    const filtered = filterCalls(calls, dateRange, selectedAnalyst);
    
    // Aggregate by rep
    const repMap = new Map<string, RepPerformance>();

    for (const call of filtered) {
      const repKey = call.rep_name || call.host_email || 'unknown';
      const displayName = call.rep_name || (call.host_email ? call.host_email.split('@')[0] : 'Unknown');
      
      const existing = repMap.get(repKey);
      const connected = isConnection(call);
      const voicemail = isVoicemail(call);
      const duration = call.duration || 0;
      
      if (existing) {
        existing.totalCalls += 1;
        existing.callsConnected += connected ? 1 : 0;
        existing.voicemailsLeft += voicemail ? 1 : 0;
        existing.totalTalkTimeSeconds += duration;
      } else {
        repMap.set(repKey, {
          memberId: repKey,
          memberName: displayName,
          totalCalls: 1,
          callsConnected: connected ? 1 : 0,
          connectRate: 0,
          voicemailsLeft: voicemail ? 1 : 0,
          totalTalkTimeSeconds: duration,
        });
      }
    }

    // Calculate connect rates and sort
    const reps = Array.from(repMap.values())
      .map(rep => ({
        ...rep,
        connectRate: rep.totalCalls > 0 ? (rep.callsConnected / rep.totalCalls) * 100 : 0,
      }))
      .sort((a, b) => b.connectRate - a.connectRate);

    const totalCalls = reps.reduce((sum, r) => sum + r.totalCalls, 0);
    const totalConnected = reps.reduce((sum, r) => sum + r.callsConnected, 0);
    const totalVoicemails = reps.reduce((sum, r) => sum + r.voicemailsLeft, 0);
    const totalTalkTime = reps.reduce((sum, r) => sum + r.totalTalkTimeSeconds, 0);

    return {
      filteredCalls: filtered,
      metrics: {
        totalCalls,
        totalConnected,
        totalVoicemails,
        totalTalkTimeSeconds: totalTalkTime,
        connectRate: totalCalls > 0 ? (totalConnected / totalCalls) * 100 : 0,
      },
      repPerformance: reps,
    };
  }, [calls, dateRange, selectedAnalyst]);

  const dateRangeLabel = DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label || 'Selected Period';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Call Intelligence</h1>
              <p className="text-muted-foreground">
                {totalCount.toLocaleString()} total calls • Showing {dateRangeLabel.toLowerCase()}
                {selectedAnalyst !== 'all' && ` for ${selectedAnalyst}`}
              </p>
            </div>
            <DataHealthIndicator 
              status={totalCount > 0 ? 'healthy' : 'empty'} 
              tooltip={totalCount > 0 ? `${totalCount} calls synced` : 'No calls synced. Connect PhoneBurner or sync NocoDB.'}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={handleSyncNocoDB}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync NocoDB
            </Button>
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
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeOption)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedAnalyst} onValueChange={setSelectedAnalyst}>
                <SelectTrigger className="w-[200px]">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select analyst" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Analysts ({analysts.length})</SelectItem>
                  {analysts.map(analyst => (
                    <SelectItem key={analyst} value={analyst}>
                      {analyst}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="ml-auto text-sm text-muted-foreground">
                Showing {filteredCalls.length.toLocaleString()} of {totalCount.toLocaleString()} calls
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {callsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.totalCalls.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Across {repPerformance.length} team members
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
              {callsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.connectRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.totalConnected.toLocaleString()} connected / {metrics.totalCalls.toLocaleString()} dials
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
              {callsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.totalVoicemails.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.totalCalls > 0 ? ((metrics.totalVoicemails / metrics.totalCalls) * 100).toFixed(1) : 0}% voicemail rate
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
              {callsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatDuration(metrics.totalTalkTimeSeconds)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Avg {formatDuration(Math.round(metrics.totalTalkTimeSeconds / (metrics.totalConnected || 1)))} per connect
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
              Performance ranking by connect rate ({dateRangeLabel.toLowerCase()})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {callsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : repPerformance.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No calling data for this period</p>
                <p className="text-xs">Try adjusting the date range or sync NocoDB</p>
              </div>
            ) : (
              <div className="space-y-3">
                {repPerformance.slice(0, 15).map((rep, index) => (
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
            {callsLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : repPerformance.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {repPerformance.slice(0, 10).map((rep) => (
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
