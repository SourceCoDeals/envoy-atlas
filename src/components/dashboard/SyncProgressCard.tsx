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
  const { activeSync, recentSyncs, pendingRetries, progressPercent, isLoading } = useSyncProgress();

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Sync Progress
          {activeSync && (
            <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Active
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Real-time data synchronization status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Sync */}
        {activeSync ? (
          <div className="space-y-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="font-medium">Sync in progress</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {progressPercent}%
              </span>
            </div>
            <Progress value={progressPercent || 0} className="h-2" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Campaign {activeSync.processed_campaigns} of {activeSync.total_campaigns}
              </span>
              {activeSync.current_campaign_name && (
                <span className="truncate max-w-[200px]">
                  {activeSync.current_campaign_name}
                </span>
              )}
            </div>
            {activeSync.current_phase && (
              <Badge variant="secondary" className="text-xs">
                Phase: {activeSync.current_phase}
              </Badge>
            )}
            {activeSync.records_synced > 0 && (
              <p className="text-xs text-muted-foreground">
                {activeSync.records_synced.toLocaleString()} records synced
              </p>
            )}
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

        {!activeSync && recentSyncs.length === 0 && pendingRetries.length === 0 && (
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
  const { activeSync, progressPercent } = useSyncProgress();

  if (!activeSync) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      <span className="text-muted-foreground">
        Syncing ({progressPercent}%)
      </span>
      {activeSync.current_phase && (
        <Badge variant="secondary" className="text-xs">
          {activeSync.current_phase}
        </Badge>
      )}
    </div>
  );
}
