import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface DataFreshnessInfo {
  lastSyncAt: string | null;
  status: 'idle' | 'syncing' | 'error';
  hoursSinceSync: number | null;
  isStale: boolean;
  sourcesStatus: Array<{
    type: string;
    name: string;
    lastSyncAt: string | null;
    status: string | null;
    error: string | null;
  }>;
}

export function useDataFreshness() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['data-freshness', currentWorkspace?.id],
    queryFn: async (): Promise<DataFreshnessInfo> => {
      const { data: sources, error } = await supabase
        .from('data_sources')
        .select('source_type, name, last_sync_at, status, last_sync_status, last_sync_error')
        .order('last_sync_at', { ascending: false });

      if (error) throw error;

      // Find the most recent sync
      const activeSources = sources?.filter(s => s.last_sync_at) || [];
      const mostRecentSync = activeSources.length > 0 
        ? activeSources[0].last_sync_at 
        : null;

      // Check if any source is currently syncing
      const isSyncing = sources?.some(s => s.status === 'syncing') || false;

      // Check for errors
      const hasError = sources?.some(s => s.last_sync_status === 'error') || false;

      // Calculate hours since last sync
      let hoursSinceSync: number | null = null;
      if (mostRecentSync) {
        hoursSinceSync = (Date.now() - new Date(mostRecentSync).getTime()) / (1000 * 60 * 60);
      }

      // Data is stale if > 24 hours since last sync
      const isStale = hoursSinceSync !== null && hoursSinceSync > 24;

      // Determine overall status
      let status: 'idle' | 'syncing' | 'error' = 'idle';
      if (isSyncing) status = 'syncing';
      else if (hasError) status = 'error';

      return {
        lastSyncAt: mostRecentSync,
        status,
        hoursSinceSync,
        isStale,
        sourcesStatus: (sources || []).map(s => ({
          type: s.source_type,
          name: s.name,
          lastSyncAt: s.last_sync_at,
          status: s.last_sync_status,
          error: s.last_sync_error,
        })),
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
