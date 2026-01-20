import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface SyncProgressItem {
  id: string;
  data_source_id: string | null;
  engagement_id: string | null;
  status: 'running' | 'completed' | 'failed' | 'partial';
  total_campaigns: number;
  processed_campaigns: number;
  current_campaign_name: string | null;
  current_phase: string | null;
  records_synced: number;
  errors: string[];
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface RetryQueueItem {
  id: string;
  data_source_id: string | null;
  engagement_id: string | null;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  next_retry_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
}

export function useSyncProgress() {
  const { currentWorkspace } = useWorkspace();

  // Get active/recent sync progress for all data sources
  const { data: activeSyncs, isLoading: loadingActive, refetch: refetchActive } = useQuery({
    queryKey: ['sync-progress-active', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_progress')
        .select(`
          *,
          data_sources!sync_progress_data_source_id_fkey(source_type, name)
        `)
        .eq('status', 'running')
        .order('started_at', { ascending: false });

      if (error) throw error;
      return (data || []) as (SyncProgressItem & { data_sources: { source_type: string; name: string } | null })[];
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 2000, // Poll every 2 seconds when there's an active sync
  });

  // Get recent sync history
  const { data: recentSyncs, isLoading: loadingRecent } = useQuery({
    queryKey: ['sync-progress-history', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_progress')
        .select('*')
        .neq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as SyncProgressItem[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Get pending retries
  const { data: pendingRetries, isLoading: loadingRetries } = useQuery({
    queryKey: ['sync-retry-queue', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_retry_queue')
        .select('*')
        .eq('status', 'pending')
        .order('next_retry_at', { ascending: true });

      if (error) throw error;
      return data as RetryQueueItem[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // For backward compatibility, expose first active sync as activeSync
  const activeSync = activeSyncs && activeSyncs.length > 0 ? activeSyncs[0] : null;
  
  const progressPercent = activeSync
    ? activeSync.total_campaigns > 0
      ? Math.round((activeSync.processed_campaigns / activeSync.total_campaigns) * 100)
      : 0
    : null;
  
  // Calculate combined progress across all active syncs
  const combinedProgress = activeSyncs && activeSyncs.length > 0
    ? activeSyncs.reduce((acc, sync) => ({
        totalCampaigns: acc.totalCampaigns + (sync.total_campaigns || 0),
        processedCampaigns: acc.processedCampaigns + (sync.processed_campaigns || 0),
        recordsSynced: acc.recordsSynced + (sync.records_synced || 0),
      }), { totalCampaigns: 0, processedCampaigns: 0, recordsSynced: 0 })
    : null;

  return {
    activeSync,
    activeSyncs: activeSyncs || [],
    recentSyncs: recentSyncs || [],
    pendingRetries: pendingRetries || [],
    progressPercent,
    combinedProgress,
    isLoading: loadingActive || loadingRecent || loadingRetries,
    refetch: refetchActive,
  };
}
