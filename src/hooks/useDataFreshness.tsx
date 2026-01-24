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
      // Fetch both data_sources and NocoDB sync timestamps in parallel
      const [sourcesResult, smartleadNocoResult, replyioNocoResult] = await Promise.all([
        supabase
          .from('data_sources')
          .select('source_type, name, last_sync_at, status, last_sync_status, last_sync_error')
          .order('last_sync_at', { ascending: false }),
        supabase
          .from('nocodb_smartlead_campaigns')
          .select('synced_at')
          .order('synced_at', { ascending: false })
          .limit(1),
        supabase
          .from('nocodb_replyio_campaigns')
          .select('synced_at')
          .order('synced_at', { ascending: false })
          .limit(1),
      ]);

      if (sourcesResult.error) throw sourcesResult.error;

      const sources = sourcesResult.data || [];

      // Get the most recent NocoDB sync timestamps
      const nocodbSmartleadSync = smartleadNocoResult.data?.[0]?.synced_at || null;
      const nocodbReplyioSync = replyioNocoResult.data?.[0]?.synced_at || null;

      // Find the most recent sync from data_sources
      const activeSources = sources.filter(s => s.last_sync_at) || [];
      const mostRecentDataSourceSync = activeSources.length > 0 
        ? activeSources[0].last_sync_at 
        : null;

      // The actual most recent sync is the most recent of:
      // 1. data_sources.last_sync_at
      // 2. nocodb_smartlead_campaigns.synced_at
      // 3. nocodb_replyio_campaigns.synced_at
      const allSyncTimes = [
        mostRecentDataSourceSync,
        nocodbSmartleadSync,
        nocodbReplyioSync,
      ].filter(Boolean).map(t => new Date(t!).getTime());

      const mostRecentSync = allSyncTimes.length > 0
        ? new Date(Math.max(...allSyncTimes)).toISOString()
        : null;

      // Check if any source is currently syncing
      const isSyncing = sources.some(s => s.status === 'syncing') || false;

      // Check for errors
      const hasError = sources.some(s => s.last_sync_status === 'error') || false;

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

      // Build sources status including NocoDB sources
      const sourcesStatus = sources.map(s => ({
        type: s.source_type,
        name: s.name,
        lastSyncAt: s.last_sync_at,
        status: s.last_sync_status,
        error: s.last_sync_error,
      }));

      // Add NocoDB sync info as pseudo-sources if they have data
      if (nocodbSmartleadSync) {
        sourcesStatus.push({
          type: 'nocodb_smartlead',
          name: 'NocoDB SmartLead',
          lastSyncAt: nocodbSmartleadSync,
          status: 'success',
          error: null,
        });
      }
      if (nocodbReplyioSync) {
        sourcesStatus.push({
          type: 'nocodb_replyio',
          name: 'NocoDB Reply.io',
          lastSyncAt: nocodbReplyioSync,
          status: 'success',
          error: null,
        });
      }

      return {
        lastSyncAt: mostRecentSync,
        status,
        hoursSinceSync,
        isStale,
        sourcesStatus,
      };
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
