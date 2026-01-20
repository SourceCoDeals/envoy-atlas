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

  // Get active/recent sync progress
  const { data: activeSync, isLoading: loadingActive, refetch: refetchActive } = useQuery({
    queryKey: ['sync-progress-active', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_progress')
        .select('*')
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as SyncProgressItem | null;
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

  const progressPercent = activeSync
    ? activeSync.total_campaigns > 0
      ? Math.round((activeSync.processed_campaigns / activeSync.total_campaigns) * 100)
      : 0
    : null;

  return {
    activeSync,
    recentSyncs: recentSyncs || [],
    pendingRetries: pendingRetries || [],
    progressPercent,
    isLoading: loadingActive || loadingRecent || loadingRetries,
    refetch: refetchActive,
  };
}
