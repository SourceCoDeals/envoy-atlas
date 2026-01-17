import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, CheckCircle, XCircle, AlertTriangle, 
  Clock, Play, Pause, RotateCcw, Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

interface PlatformStatus {
  platform: string;
  displayName: string;
  status: 'idle' | 'syncing' | 'success' | 'error' | 'partial' | 'paused';
  current: number;
  total: number;
  lastSyncAt: string | null;
  lastFullSyncAt: string | null;
  errorMessage?: string;
  batchLimitReached?: boolean;
  heartbeat?: string;
  elapsedTime?: number;
  estimatedTimeRemaining?: number;
  isActive: boolean;
}

const PLATFORM_CONFIG: Record<string, { displayName: string; rateDelaySeconds: number }> = {
  smartlead: { displayName: 'SmartLead', rateDelaySeconds: 0.25 },
  replyio: { displayName: 'Reply.io', rateDelaySeconds: 10.5 },
  nocodb: { displayName: 'NocoDB', rateDelaySeconds: 0.5 },
  phoneburner: { displayName: 'PhoneBurner', rateDelaySeconds: 1 },
};

export function SyncStatusDashboard() {
  const { currentWorkspace } = useWorkspace();
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!currentWorkspace?.id) return;

    try {
      const { data: connections, error } = await supabase
        .from('api_connections')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      const statuses: PlatformStatus[] = (connections || []).map((conn: any) => {
        const progress = conn.sync_progress || {};
        const config = PLATFORM_CONFIG[conn.platform] || { displayName: conn.platform, rateDelaySeconds: 1 };
        
        // Calculate progress
        let current = 0;
        let total = 0;
        
        if (conn.platform === 'replyio') {
          current = progress.sequence_index || 0;
          total = progress.total_sequences || 0;
        } else if (conn.platform === 'smartlead') {
          current = progress.campaign_offset || progress.current_campaign || 0;
          total = progress.total_campaigns || 0;
        }

        // Calculate elapsed time
        let elapsedTime: number | undefined;
        if (conn.sync_status === 'syncing' && progress.started_at) {
          elapsedTime = Math.round((Date.now() - new Date(progress.started_at).getTime()) / 1000);
        }

        // Estimate remaining time
        let estimatedTimeRemaining: number | undefined;
        if (conn.sync_status === 'syncing' && total > 0 && current > 0) {
          const remaining = total - current;
          estimatedTimeRemaining = Math.round(remaining * config.rateDelaySeconds);
        }

        return {
          platform: conn.platform,
          displayName: config.displayName,
          status: conn.sync_status || 'idle',
          current,
          total,
          lastSyncAt: conn.last_sync_at,
          lastFullSyncAt: conn.last_full_sync_at,
          errorMessage: progress.error_message || progress.failure_reason,
          batchLimitReached: progress.batch_limit_reached,
          heartbeat: progress.heartbeat,
          elapsedTime,
          estimatedTimeRemaining,
          isActive: conn.is_active,
        };
      });

      setPlatforms(statuses);
      
      // Check if any sync is in progress
      setSyncing(statuses.some(s => s.status === 'syncing' || s.status === 'partial'));
    } catch (err) {
      console.error('Error fetching sync status:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchStatus();
    
    // Poll every 3 seconds if syncing, otherwise every 30 seconds
    const interval = setInterval(fetchStatus, syncing ? 3000 : 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, syncing]);

  const triggerSync = async (platform: string) => {
    if (!currentWorkspace?.id) return;

    try {
      const functionName = `${platform}-sync`;
      const { error } = await supabase.functions.invoke(functionName, {
        body: { workspace_id: currentWorkspace.id, reset: false },
      });

      if (error) throw error;
      toast.success(`${PLATFORM_CONFIG[platform]?.displayName || platform} sync started`);
      fetchStatus();
    } catch (err: any) {
      toast.error(`Failed to start sync: ${err.message}`);
    }
  };

  const triggerRecovery = async () => {
    if (!currentWorkspace?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke('sync-recovery', {
        body: { action: 'auto', workspace_id: currentWorkspace.id },
      });

      if (error) throw error;
      
      const results = data?.results || [];
      if (results.length > 0) {
        toast.success(`Recovered ${results.length} stuck sync(s)`);
      } else {
        toast.info('No stuck syncs found');
      }
      fetchStatus();
    } catch (err: any) {
      toast.error(`Recovery failed: ${err.message}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'syncing':
      case 'partial':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
      case 'idle':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string, batchLimitReached?: boolean) => {
    if (batchLimitReached) {
      return <Badge variant="destructive">Batch Limit</Badge>;
    }
    
    switch (status) {
      case 'syncing':
        return <Badge className="bg-blue-500/20 text-blue-500">Syncing</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500/20 text-yellow-500">Partial</Badge>;
      case 'success':
      case 'idle':
        return <Badge className="bg-green-500/20 text-green-500">Complete</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatRelativeTime = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (platforms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Data Sync Status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-8">
          No data connections configured. Add connections in the Connections tab.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Data Sync Status
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={triggerRecovery}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Recover
            </Button>
            <Button variant="outline" size="sm" onClick={fetchStatus}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {platforms.map((p) => (
            <div
              key={p.platform}
              className={`p-4 rounded-lg border ${
                p.status === 'syncing' || p.status === 'partial'
                  ? 'border-blue-500/50 bg-blue-500/5'
                  : p.status === 'error'
                  ? 'border-red-500/50 bg-red-500/5'
                  : 'bg-card'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(p.status)}
                  <span className="font-medium">{p.displayName}</span>
                </div>
                {getStatusBadge(p.status, p.batchLimitReached)}
              </div>

              {(p.status === 'syncing' || p.status === 'partial') && p.total > 0 && (
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span>{p.current}/{p.total} ({Math.round((p.current / p.total) * 100)}%)</span>
                  </div>
                  <Progress value={(p.current / p.total) * 100} className="h-2" />
                  {p.estimatedTimeRemaining && (
                    <p className="text-xs text-muted-foreground">
                      Est. {formatDuration(p.estimatedTimeRemaining)} remaining
                    </p>
                  )}
                </div>
              )}

              {p.errorMessage && (
                <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-500 line-clamp-2">{p.errorMessage}</p>
                </div>
              )}

              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Last sync</span>
                  <span>{formatRelativeTime(p.lastSyncAt)}</span>
                </div>
                {p.heartbeat && (p.status === 'syncing' || p.status === 'partial') && (
                  <div className="flex justify-between">
                    <span>Heartbeat</span>
                    <span>{formatRelativeTime(p.heartbeat)}</span>
                  </div>
                )}
              </div>

              {p.isActive && p.status !== 'syncing' && p.status !== 'partial' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => triggerSync(p.platform)}
                >
                  <Play className="mr-2 h-3 w-3" />
                  Sync Now
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
