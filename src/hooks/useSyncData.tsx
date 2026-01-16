import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

interface SyncProgress {
  smartlead?: { current: number; total: number; status: string };
  replyio?: { current: number; total: number; status: string };
}

const POLL_INTERVAL = 3000; // 3 seconds

export function useSyncData() {
  const { currentWorkspace } = useWorkspace();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgress>({});
  const [elapsedTime, setElapsedTime] = useState(0);
  const syncStartTime = useRef<number | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch sync progress from database
  const fetchProgress = useCallback(async () => {
    if (!currentWorkspace?.id) return null;

    const { data: connections } = await supabase
      .from('api_connections')
      .select('platform, sync_status, sync_progress')
      .eq('workspace_id', currentWorkspace.id)
      .eq('is_active', true);

    if (connections) {
      const newProgress: SyncProgress = {};
      connections.forEach(conn => {
        const syncProgress = conn.sync_progress as any;
        if (conn.platform === 'smartlead' && syncProgress) {
          newProgress.smartlead = {
            current: syncProgress.campaign_index ?? syncProgress.current_index ?? 0,
            total: syncProgress.total_campaigns ?? 0,
            status: conn.sync_status || 'idle'
          };
        } else if (conn.platform === 'replyio' && syncProgress) {
          // Get total from cached_sequences array length
          const cachedSequences = syncProgress.cached_sequences;
          const total = Array.isArray(cachedSequences) 
            ? cachedSequences.length 
            : (syncProgress.total_sequences ?? 0);
          
          newProgress.replyio = {
            current: syncProgress.sequence_index ?? syncProgress.current_index ?? 0,
            total: total,
            status: conn.sync_status || 'idle'
          };
        }
      });
      setProgress(newProgress);
      return newProgress;
    }
    return null;
  }, [currentWorkspace?.id]);

  // Check if sync is still in progress
  const isSyncInProgress = useCallback((prog: SyncProgress) => {
    const slProgress = prog.smartlead;
    const rioProgress = prog.replyio;
    
    const slIncomplete = slProgress && slProgress.total > 0 && 
      slProgress.current < slProgress.total && slProgress.status !== 'error';
    const rioIncomplete = rioProgress && rioProgress.total > 0 && 
      rioProgress.current < rioProgress.total && rioProgress.status !== 'error';
    
    // Also check if status is 'syncing' or 'in_progress'
    const slSyncing = slProgress?.status === 'syncing' || slProgress?.status === 'in_progress';
    const rioSyncing = rioProgress?.status === 'syncing' || rioProgress?.status === 'in_progress';
    
    return slIncomplete || rioIncomplete || slSyncing || rioSyncing;
  }, []);

  // Start polling when sync begins
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    
    pollingRef.current = setInterval(async () => {
      const currentProgress = await fetchProgress();
      if (currentProgress && !isSyncInProgress(currentProgress)) {
        stopPolling();
        setSyncing(false);
        setLastSyncAt(new Date().toISOString());
        toast.success('Sync complete!', {
          description: 'All campaigns synced successfully'
        });
      }
    }, POLL_INTERVAL);
  }, [fetchProgress, isSyncInProgress]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  }, []);

  // Track elapsed time
  useEffect(() => {
    if (syncing && !elapsedRef.current) {
      syncStartTime.current = Date.now();
      setElapsedTime(0);
      elapsedRef.current = setInterval(() => {
        if (syncStartTime.current) {
          setElapsedTime(Math.floor((Date.now() - syncStartTime.current) / 1000));
        }
      }, 1000);
    } else if (!syncing && elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
    
    return () => {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
      }
    };
  }, [syncing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const triggerSync = async (autoContinue = true) => {
    if (!currentWorkspace?.id || syncing) return;

    setSyncing(true);
    setElapsedTime(0);
    syncStartTime.current = Date.now();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Fetch connected platforms for this workspace
      const { data: connections } = await supabase
        .from('api_connections')
        .select('platform, sync_progress')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);

      const connectedPlatforms = (connections || []).map(c => c.platform);
      
      if (connectedPlatforms.length === 0) {
        toast.info('No platforms connected', {
          description: 'Connect SmartLead or Reply.io to sync data'
        });
        setSyncing(false);
        return;
      }

      // Check current progress to decide if this is a continuation
      const currentProgress = await fetchProgress();
      const isResume = currentProgress && isSyncInProgress(currentProgress);

      const syncPromises: Promise<any>[] = [];
      
      // Trigger SmartLead sync if connected
      if (connectedPlatforms.includes('smartlead')) {
        syncPromises.push(
          supabase.functions.invoke('smartlead-sync', {
            body: { 
              workspace_id: currentWorkspace.id,
              sync_type: 'full',
              reset: !isResume,
              auto_continue: true
            }
          })
        );
      }

      // Trigger Reply.io sync if connected (only if SmartLead not connected)
      if (connectedPlatforms.includes('replyio') && !connectedPlatforms.includes('smartlead')) {
        syncPromises.push(
          supabase.functions.invoke('replyio-sync', {
            body: { 
              workspace_id: currentWorkspace.id,
              sync_type: 'full',
              reset: !isResume,
              auto_continue: true
            }
          })
        );
      }

      toast.info(isResume ? 'Resuming sync...' : 'Starting sync...', {
        description: `Syncing ${connectedPlatforms.join(' & ')} - will continue automatically`
      });

      await Promise.allSettled(syncPromises);
      
      // Start polling for progress updates
      startPolling();
      
      // Initial progress fetch
      await fetchProgress();

      return { platforms: connectedPlatforms };
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Sync failed', {
        description: err instanceof Error ? err.message : 'Failed to refresh data'
      });
      setSyncing(false);
      throw err;
    }
  };

  return {
    syncing,
    lastSyncAt,
    progress,
    elapsedTime,
    triggerSync,
    fetchProgress,
  };
}
