import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, CheckCircle, XCircle, AlertTriangle, 
  Clock, Play, RotateCcw, Zap, Pause
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
  errorMessage?: string;
  batchLimitReached?: boolean;
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
        
        let current = 0;
        let total = 0;
        
        if (conn.platform === 'replyio') {
          current = progress.sequence_index || 0;
          total = progress.total_sequences || 0;
        } else if (conn.platform === 'smartlead') {
          current = progress.campaign_offset || progress.current_campaign || 0;
          total = progress.total_campaigns || 0;
        }

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
          errorMessage: progress.error_message || progress.failure_reason,
          batchLimitReached: progress.batch_limit_reached,
          estimatedTimeRemaining,
          isActive: conn.is_active,
        };
      });

      setPlatforms(statuses);
      setSyncing(statuses.some(s => s.status === 'syncing' || s.status === 'partial'));
    } catch (err) {
      console.error('Error fetching sync status:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, syncing ? 3000 : 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, syncing]);

  const triggerSync = async (platform: string) => {
    if (!currentWorkspace?.id) return;
    try {
      const { error } = await supabase.functions.invoke(`${platform}-sync`, {
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
        return <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />;
      case 'success':
      case 'idle':
        return <CheckCircle className="h-3.5 w-3.5 text-success" />;
      case 'error':
        return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      case 'paused':
        return <Pause className="h-3.5 w-3.5 text-warning" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string, batchLimitReached?: boolean) => {
    if (batchLimitReached) {
      return <Badge variant="destructive" className="text-[10px] h-5">Batch Limit</Badge>;
    }
    switch (status) {
      case 'syncing':
        return <Badge className="bg-primary/10 text-primary text-[10px] h-5">Syncing</Badge>;
      case 'partial':
        return <Badge className="bg-warning/10 text-warning text-[10px] h-5">Partial</Badge>;
      case 'success':
      case 'idle':
        return <Badge className="bg-success/10 text-success text-[10px] h-5">Complete</Badge>;
      case 'error':
        return <Badge variant="destructive" className="text-[10px] h-5">Error</Badge>;
      case 'paused':
        return <Badge variant="secondary" className="text-[10px] h-5">Paused</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] h-5">Unknown</Badge>;
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatRelativeTime = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <RefreshCw className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (platforms.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Data Sync Status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-6 text-sm">
          No connections configured yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Data Sync Status
          </CardTitle>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={triggerRecovery} className="h-7 text-xs px-2">
              <RotateCcw className="mr-1.5 h-3 w-3" />
              Recover
            </Button>
            <Button variant="outline" size="sm" onClick={fetchStatus} className="h-7 text-xs px-2">
              <RefreshCw className={`mr-1.5 h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {platforms.map((p) => (
            <div
              key={p.platform}
              className={`p-3 rounded-lg border transition-colors ${
                p.status === 'syncing' || p.status === 'partial'
                  ? 'border-primary/40 bg-primary/5'
                  : p.status === 'error'
                  ? 'border-destructive/40 bg-destructive/5'
                  : 'bg-muted/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  {getStatusIcon(p.status)}
                  <span className="font-medium text-sm">{p.displayName}</span>
                </div>
                {getStatusBadge(p.status, p.batchLimitReached)}
              </div>

              {(p.status === 'syncing' || p.status === 'partial') && p.total > 0 && (
                <div className="space-y-1.5 mb-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span>{p.current}/{p.total} ({Math.round((p.current / p.total) * 100)}%)</span>
                  </div>
                  <Progress value={(p.current / p.total) * 100} className="h-1.5" />
                  {p.estimatedTimeRemaining && (
                    <p className="text-[10px] text-muted-foreground">
                      ~{formatDuration(p.estimatedTimeRemaining)} remaining
                    </p>
                  )}
                </div>
              )}

              {p.errorMessage && (
                <div className="mb-2 p-1.5 rounded bg-destructive/10 border border-destructive/20">
                  <p className="text-[10px] text-destructive line-clamp-2">{p.errorMessage}</p>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Last sync</span>
                <span>{formatRelativeTime(p.lastSyncAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
