import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { formatDistanceToNow } from 'date-fns';

export type SyncStatus = 'syncing' | 'success' | 'error' | 'partial' | 'never';

interface DataSource {
  id: string;
  name: string;
  sourceType: string;
  lastSyncAt: string | null;
  lastSyncStatus: SyncStatus;
  lastSyncError: string | null;
  recordsProcessed: number | null;
}

interface SyncStatusIndicatorProps {
  compact?: boolean;
  showButton?: boolean;
  onSync?: () => void;
  className?: string;
}

const statusConfig: Record<SyncStatus, {
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  label: string;
}> = {
  syncing: {
    icon: Loader2,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: 'Syncing',
  },
  success: {
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success/10',
    label: 'Synced',
  },
  error: {
    icon: AlertCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    label: 'Error',
  },
  partial: {
    icon: Clock,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    label: 'Partial',
  },
  never: {
    icon: RefreshCw,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    label: 'Never Synced',
  },
};

export function SyncStatusIndicator({ 
  compact = false, 
  showButton = true,
  onSync,
  className 
}: SyncStatusIndicatorProps) {
  const { currentWorkspace } = useWorkspace();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchDataSources();
    }
  }, [currentWorkspace?.id]);

  const fetchDataSources = async () => {
    if (!currentWorkspace?.id) return;

    const { data: engagements } = await supabase
      .from('engagements')
      .select('id')
      .eq('client_id', currentWorkspace.id);

    const engagementIds = (engagements || []).map(e => e.id);

    const { data: sources } = await supabase
      .from('data_sources')
      .select('id, name, source_type, last_sync_at, last_sync_status, last_sync_error, last_sync_records_processed')
      .eq('status', 'active');

    if (sources) {
      setDataSources(sources.map(s => ({
        id: s.id,
        name: s.name,
        sourceType: s.source_type,
        lastSyncAt: s.last_sync_at,
        lastSyncStatus: (s.last_sync_status as SyncStatus) || 'never',
        lastSyncError: s.last_sync_error,
        recordsProcessed: s.last_sync_records_processed,
      })));
    }
    setLoading(false);
  };

  if (loading || dataSources.length === 0) {
    return null;
  }

  // Get overall status
  const overallStatus = dataSources.reduce((worst, ds) => {
    if (ds.lastSyncStatus === 'error') return 'error';
    if (ds.lastSyncStatus === 'partial' && worst !== 'error') return 'partial';
    if (ds.lastSyncStatus === 'syncing' && worst !== 'error' && worst !== 'partial') return 'syncing';
    if (ds.lastSyncStatus === 'success' && worst === 'never') return 'success';
    return worst;
  }, 'never' as SyncStatus);

  const lastSync = dataSources
    .filter(ds => ds.lastSyncAt)
    .sort((a, b) => new Date(b.lastSyncAt!).getTime() - new Date(a.lastSyncAt!).getTime())[0];

  const config = statusConfig[overallStatus];
  const Icon = config.icon;
  const isSyncing = overallStatus === 'syncing';

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center gap-1.5', className)}>
              <Icon className={cn('h-4 w-4', config.color, isSyncing && 'animate-spin')} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-medium">{config.label}</p>
              {lastSync && (
                <p className="text-muted-foreground">
                  Last sync: {formatDistanceToNow(new Date(lastSync.lastSyncAt!), { addSuffix: true })}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge variant="outline" className={cn('flex items-center gap-1.5', config.bgColor)}>
        <Icon className={cn('h-3.5 w-3.5', config.color, isSyncing && 'animate-spin')} />
        <span className={config.color}>{config.label}</span>
        {lastSync && (
          <span className="text-muted-foreground text-xs ml-1">
            {formatDistanceToNow(new Date(lastSync.lastSyncAt!), { addSuffix: true })}
          </span>
        )}
      </Badge>
      {showButton && onSync && (
        <Button variant="ghost" size="sm" onClick={onSync} disabled={isSyncing}>
          <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
        </Button>
      )}
    </div>
  );
}

// Individual source status for detailed views
export function SourceSyncStatus({ source }: { source: DataSource }) {
  const config = statusConfig[source.lastSyncStatus];
  const Icon = config.icon;
  const isSyncing = source.lastSyncStatus === 'syncing';

  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={cn('h-4 w-4', config.color, isSyncing && 'animate-spin')} />
      <span className="font-medium">{source.name}</span>
      <span className={cn('text-xs', config.color)}>{config.label}</span>
      {source.lastSyncAt && (
        <span className="text-muted-foreground text-xs">
          {formatDistanceToNow(new Date(source.lastSyncAt), { addSuffix: true })}
        </span>
      )}
      {source.recordsProcessed && (
        <span className="text-muted-foreground text-xs">
          ({source.recordsProcessed.toLocaleString()} records)
        </span>
      )}
      {source.lastSyncError && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">{source.lastSyncError}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
