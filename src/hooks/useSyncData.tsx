import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

interface SyncProgress {
  smartlead?: { current: number; total: number; status: string };
  replyio?: { current: number; total: number; status: string };
}

export function useSyncData() {
  const { currentWorkspace } = useWorkspace();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgress>({});

  // Poll sync progress while syncing
  const fetchProgress = useCallback(async () => {
    if (!currentWorkspace?.id) return;

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
            current: syncProgress.current_index || 0,
            total: syncProgress.total_campaigns || 0,
            status: conn.sync_status || 'idle'
          };
        } else if (conn.platform === 'replyio' && syncProgress) {
          newProgress.replyio = {
            current: syncProgress.current_index || 0,
            total: syncProgress.cached_sequences?.length || 0,
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
  const isSyncInProgress = (progress: SyncProgress) => {
    const slProgress = progress.smartlead;
    const rioProgress = progress.replyio;
    
    const slIncomplete = slProgress && slProgress.current < slProgress.total && slProgress.status !== 'error';
    const rioIncomplete = rioProgress && rioProgress.current < rioProgress.total && rioProgress.status !== 'error';
    
    return slIncomplete || rioIncomplete;
  };

  const triggerSync = async (autoContinue = true) => {
    if (!currentWorkspace?.id || syncing) return;

    setSyncing(true);
    
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
              reset: !isResume  // Only reset if not resuming
            }
          })
        );
      }

      // Trigger Reply.io sync if connected
      if (connectedPlatforms.includes('replyio')) {
        syncPromises.push(
          supabase.functions.invoke('replyio-sync', {
            body: { 
              workspace_id: currentWorkspace.id,
              sync_type: 'full',
              reset: !isResume  // Only reset if not resuming
            }
          })
        );
      }

      toast.info(isResume ? 'Resuming sync...' : 'Starting sync...', {
        description: `Syncing ${connectedPlatforms.join(' & ')}`
      });

      const results = await Promise.allSettled(syncPromises);
      
      let hasErrors = false;
      
      results.forEach((result) => {
        if (result.status === 'rejected' || result.value?.error) {
          hasErrors = true;
          console.error('Sync error:', result);
        }
      });

      // Check progress after sync batch completes
      const newProgress = await fetchProgress();
      setLastSyncAt(new Date().toISOString());

      if (hasErrors) {
        toast.warning('Sync encountered errors', {
          description: 'Check logs for details'
        });
      } else if (newProgress && isSyncInProgress(newProgress)) {
        const slProg = newProgress.smartlead;
        const rioProg = newProgress.replyio;
        
        const progressText = [
          slProg && slProg.total > 0 ? `SmartLead: ${slProg.current}/${slProg.total}` : null,
          rioProg && rioProg.total > 0 ? `Reply.io: ${rioProg.current}/${rioProg.total}` : null
        ].filter(Boolean).join(', ');

        toast.info('Sync in progress', {
          description: `${progressText}. Auto-continuing...`,
          duration: 3000
        });

        // Auto-continue after a short delay
        if (autoContinue) {
          setTimeout(() => {
            triggerSync(true);
          }, 2000);
        }
      } else {
        toast.success('Sync complete!', {
          description: `All campaigns synced from ${connectedPlatforms.join(' & ')}`
        });
      }

      return { progress: newProgress, platforms: connectedPlatforms };
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Sync failed', {
        description: err instanceof Error ? err.message : 'Failed to refresh data'
      });
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  return {
    syncing,
    lastSyncAt,
    progress,
    triggerSync,
    fetchProgress,
  };
}
