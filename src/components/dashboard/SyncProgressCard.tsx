import { useSyncProgress } from '@/hooks/useSyncProgress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw } from 'lucide-react';

const statusConfig = {
  running: {
    icon: Loader2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-950',
    label: 'Syncing',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-950',
    label: 'Completed',
    animate: false,
  },
  partial: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-950',
    label: 'Partial',
    animate: false,
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-950',
    label: 'Failed',
    animate: false,
  },
};

export function SyncProgressCard() {
  const { activeSyncs, recentSyncs, pendingRetries, isLoading } = useSyncProgress();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sync Progress</CardTitle>
          <CardDescription>Real-time data synchronization status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasActiveSyncs = activeSyncs && activeSyncs.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Sync Progress
          {hasActiveSyncs && (
            <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {activeSyncs.length} Active
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Real-time data synchronization status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Syncs */}
        {hasActiveSyncs ? (
          <div className="space-y-3">
            {activeSyncs.map((sync) => {
              const progressPercent = sync.total_campaigns > 0
                ? Math.round((sync.processed_campaigns / sync.total_campaigns) * 100)
                : 0;
              const platformName = sync.data_sources?.name || sync.data_sources?.source_type || 'Unknown';
              
              return (
                <div 
                  key={sync.id}
                  className="space-y-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="font-medium">{platformName}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {progressPercent}%
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Campaign {sync.processed_campaigns} of {sync.total_campaigns}
                    </span>
                    {sync.current_campaign_name && (
                      <span className="truncate max-w-[200px]">
                        {sync.current_campaign_name}
                      </span>
                    )}
                  </div>
                  {sync.current_phase && (
                    <Badge variant="secondary" className="text-xs">
                      Phase: {sync.current_phase}
                    </Badge>
                  )}
                  {sync.records_synced > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {sync.records_synced.toLocaleString()} records synced
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">
            No active sync
          </div>
        )}

        {/* Pending Retries */}
        {pendingRetries.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Pending Retries ({pendingRetries.length})
            </h4>
            {pendingRetries.slice(0, 3).map(retry => (
              <div 
                key={retry.id} 
                className="flex items-center justify-between p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-sm">Retry {retry.retry_count + 1}/{retry.max_retries}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(retry.next_retry_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Recent Sync History */}
        {recentSyncs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Syncs</h4>
            <div className="space-y-1">
              {recentSyncs.slice(0, 5).map(sync => {
                const config = statusConfig[sync.status];
                const Icon = config.icon;
                return (
                  <div 
                    key={sync.id} 
                    className={cn(
                      "flex items-center justify-between p-2 rounded",
                      config.bgColor
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", config.color, config.animate && "animate-spin")} />
                      <span className="text-sm">{config.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {sync.processed_campaigns}/{sync.total_campaigns} campaigns
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(sync.started_at), { addSuffix: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!hasActiveSyncs && recentSyncs.length === 0 && pendingRetries.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            No sync history yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact inline progress indicator for headers
export function SyncProgressIndicator() {
  const { activeSyncs, combinedProgress } = useSyncProgress();

  if (!activeSyncs || activeSyncs.length === 0) return null;
  
  const progressPercent = combinedProgress && combinedProgress.totalCampaigns > 0
    ? Math.round((combinedProgress.processedCampaigns / combinedProgress.totalCampaigns) * 100)
    : 0;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      <span className="text-muted-foreground">
        Syncing {activeSyncs.length > 1 ? `(${activeSyncs.length} sources)` : ''} ({progressPercent}%)
      </span>
      {activeSyncs.length === 1 && activeSyncs[0].current_phase && (
        <Badge variant="secondary" className="text-xs">
          {activeSyncs[0].current_phase}
        </Badge>
      )}
    </div>
  );
}
