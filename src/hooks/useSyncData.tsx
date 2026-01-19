import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

interface PlatformProgress {
  current: number;
  total: number;
  status: string;
  lastSyncAt?: string;
  isStale?: boolean;
}

interface SyncProgress {
  smartlead?: PlatformProgress;
  replyio?: PlatformProgress;
}

interface DataSourceInfo {
  id: string;
  source_type: string;
  last_sync_status: string | null;
  last_sync_at: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  additional_config: any;
}

const POLL_INTERVAL = 3000; // 3 seconds
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes - consider partial sync "stale" after this

export function useSyncData() {
  const { currentWorkspace } = useWorkspace();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgress>({});
  const [elapsedTime, setElapsedTime] = useState(0);
  const [staleSyncs, setStaleSyncs] = useState<string[]>([]);
  const syncStartTime = useRef<number | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);

  // Detect if a sync is "stale" (partial status but hasn't progressed in 5+ minutes)
  const isStalePartialSync = useCallback((ds: DataSourceInfo): boolean => {
    if (!ds.last_sync_status || ds.last_sync_status !== 'partial') return false;
    if (!ds.last_sync_at) return false;
    
    const lastSync = new Date(ds.last_sync_at).getTime();
    const now = Date.now();
    return (now - lastSync) > STALE_THRESHOLD_MS;
  }, []);

  // Fetch sync progress from database
  const fetchProgress = useCallback(async () => {
    if (!currentWorkspace?.id) return null;

    const { data: dataSources } = await supabase
      .from('data_sources')
      .select('id, source_type, last_sync_status, last_sync_at, additional_config')
      .in('source_type', ['smartlead', 'replyio'])
      .eq('status', 'active');

    if (dataSources) {
      const newProgress: SyncProgress = {};
      const stale: string[] = [];
      
      dataSources.forEach((ds: DataSourceInfo) => {
        const config = ds.additional_config as Record<string, unknown> | null;
        const status = ds.last_sync_status || 'idle';
        const isStale = isStalePartialSync(ds);
        
        if (isStale) {
          stale.push(ds.source_type);
        }
        
        if (ds.source_type === 'smartlead' && config) {
          const total = (config.total_campaigns as number) ?? 0;
          const isComplete = status === 'success' || config.completed === true;
          const current = isComplete ? total : ((config.campaign_index as number) ?? 0);
          newProgress.smartlead = { 
            current, 
            total, 
            status,
            lastSyncAt: ds.last_sync_at || undefined,
            isStale,
          };
        } else if (ds.source_type === 'replyio' && config) {
          const total = (config.total_sequences as number) ?? 0;
          const isComplete = status === 'success' || config.completed === true;
          const current = isComplete ? total : ((config.sequence_index as number) ?? 0);
          newProgress.replyio = { 
            current, 
            total, 
            status,
            lastSyncAt: ds.last_sync_at || undefined,
            isStale,
          };
        }
      });
      
      setProgress(newProgress);
      setStaleSyncs(stale);
      return newProgress;
    }
    return null;
  }, [currentWorkspace?.id, isStalePartialSync]);

  // Check if sync is still in progress
  const isSyncInProgress = useCallback((prog: SyncProgress) => {
    const slProgress = prog.smartlead;
    const rioProgress = prog.replyio;
    
    // Check if actively syncing (status = syncing/in_progress)
    const slSyncing = slProgress?.status === 'syncing' || slProgress?.status === 'in_progress';
    const rioSyncing = rioProgress?.status === 'syncing' || rioProgress?.status === 'in_progress';
    
    // Check if incomplete but NOT stale (still actively progressing)
    const slIncomplete = slProgress && slProgress.total > 0 && 
      slProgress.current < slProgress.total && 
      slProgress.status !== 'error' &&
      !slProgress.isStale;
    const rioIncomplete = rioProgress && rioProgress.total > 0 && 
      rioProgress.current < rioProgress.total && 
      rioProgress.status !== 'error' &&
      !rioProgress.isStale;
    
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
        
        // Check if completed or stale
        const hasStale = staleSyncs.length > 0;
        if (hasStale) {
          toast.warning('Sync interrupted', {
            description: `${staleSyncs.join(', ')} sync appears stuck. Use "Resume Sync" to continue.`
          });
        } else {
          toast.success('Sync complete!', {
            description: 'All campaigns synced successfully'
          });
        }
      }
    }, POLL_INTERVAL);
  }, [fetchProgress, isSyncInProgress, staleSyncs]);

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

  // Auto-detect an in-progress sync on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const current = await fetchProgress();
      if (cancelled || !current) return;

      if (isSyncInProgress(current)) {
        setSyncing(true);
        startPolling();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchProgress, isSyncInProgress, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Get data sources with their IDs for triggering syncs
  const getDataSources = async (): Promise<DataSourceInfo[]> => {
    const { data } = await supabase
      .from('data_sources')
      .select('id, source_type, last_sync_status, last_sync_at, additional_config')
      .in('source_type', ['smartlead', 'replyio'])
      .eq('status', 'active');
    
    return (data as DataSourceInfo[]) || [];
  };

  // Get engagement ID for the workspace
  const getEngagementId = async (clientId: string): Promise<string | null> => {
    const { data } = await supabase
      .from('engagements')
      .select('id')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    return data?.id || null;
  };

  // Trigger sync for a specific platform
  const triggerPlatformSync = async (
    platform: 'smartlead' | 'replyio',
    options: { reset?: boolean; resume?: boolean } = {}
  ) => {
    if (!currentWorkspace?.id) return;

    const dataSources = await getDataSources();
    const ds = dataSources.find(d => d.source_type === platform);
    
    if (!ds) {
      toast.error(`${platform} not connected`);
      return;
    }

    const engagementId = await getEngagementId(currentWorkspace.id);
    if (!engagementId) {
      toast.error('No engagement found');
      return;
    }

    setSyncing(true);
    setElapsedTime(0);
    syncStartTime.current = Date.now();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const shouldReset = options.reset ?? false;
      
      await supabase.functions.invoke(`${platform}-sync`, {
        body: { 
          client_id: currentWorkspace.id,
          engagement_id: engagementId,
          data_source_id: ds.id,
          reset: shouldReset,
          auto_continue: true,
          // Enable comprehensive sync options
          sync_leads: true,
          sync_people: true,
          sync_email_accounts: true,
          sync_lead_categories: true,
          sync_statistics: true,
          sync_email_activities: true,
          sync_message_history: false, // Keep disabled - very expensive
          classify_replies: true,
        }
      });

      toast.info(`Starting ${platform} sync...`, {
        description: shouldReset ? 'Full resync initiated' : 'Resuming sync...'
      });

      startPolling();
      await fetchProgress();
    } catch (err) {
      console.error(`${platform} sync error:`, err);
      toast.error(`${platform} sync failed`, {
        description: err instanceof Error ? err.message : 'Unknown error'
      });
      setSyncing(false);
    }
  };

  // Resume stale/partial syncs
  const resumeStaleSyncs = async () => {
    if (staleSyncs.length === 0) return;

    for (const platform of staleSyncs) {
      if (platform === 'smartlead' || platform === 'replyio') {
        await triggerPlatformSync(platform, { resume: true });
      }
    }
  };

  // Main sync trigger - syncs ALL connected platforms in parallel
  const triggerSync = async (options: { reset?: boolean } = {}) => {
    if (!currentWorkspace?.id || syncing) return;

    // Check if sync is already in progress
    const currentProgress = await fetchProgress();
    if (currentProgress && isSyncInProgress(currentProgress)) {
      toast.info('Sync already in progress', {
        description: 'Watching for updates...'
      });
      setSyncing(true);
      startPolling();
      return { platforms: ['smartlead', 'replyio'] };
    }

    setSyncing(true);
    setElapsedTime(0);
    syncStartTime.current = Date.now();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Fetch connected data sources WITH their IDs
      const dataSources = await getDataSources();
      
      if (dataSources.length === 0) {
        toast.info('No platforms connected', {
          description: 'Connect SmartLead or Reply.io to sync data'
        });
        setSyncing(false);
        return;
      }

      // Get engagement ID
      const engagementId = await getEngagementId(currentWorkspace.id);
      if (!engagementId) {
        toast.error('No engagement found', {
          description: 'Create an engagement first'
        });
        setSyncing(false);
        return;
      }

      const syncPromises: Promise<unknown>[] = [];
      const platforms: string[] = [];
      
      // FIX: Trigger ALL connected platforms in parallel (not else-if)
      for (const ds of dataSources) {
        if (ds.source_type === 'smartlead' || ds.source_type === 'replyio') {
          platforms.push(ds.source_type);
          syncPromises.push(
            supabase.functions.invoke(`${ds.source_type}-sync`, {
              body: { 
                client_id: currentWorkspace.id,
                engagement_id: engagementId,
                data_source_id: ds.id,
                sync_type: 'full',
                reset: options.reset ?? true,
                auto_continue: true,
                // Enable comprehensive sync options
                sync_leads: true,
                sync_people: true,
                sync_email_accounts: true,
                sync_lead_categories: true,
                sync_statistics: true,
                sync_email_activities: true,
                sync_message_history: false, // Keep disabled - very expensive
                classify_replies: true,
              }
            })
          );
        }
      }

      toast.info('Starting sync...', {
        description: `Syncing ${platforms.join(' & ')} - will continue automatically`
      });

      await Promise.allSettled(syncPromises);
      
      startPolling();
      await fetchProgress();

      return { platforms };
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
    staleSyncs,
    triggerSync,
    triggerPlatformSync,
    resumeStaleSyncs,
    fetchProgress,
  };
}
