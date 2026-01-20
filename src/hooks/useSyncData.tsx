import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

interface SyncProgressRow {
  id: string;
  data_source_id: string | null;
  status: 'running' | 'completed' | 'failed' | 'partial';
  total_campaigns: number;
  processed_campaigns: number;
  current_phase: string | null;
  records_synced: number;
  updated_at: string;
  started_at: string;
}

interface DataSourceInfo {
  id: string;
  source_type: string;
  last_sync_status: string | null;
  last_sync_at: string | null;
}

interface PlatformProgress {
  current: number;
  total: number;
  status: string;
  lastSyncAt?: string;
  isStale?: boolean;
  recordsSynced?: number;
  currentPhase?: string;
}

interface SyncProgress {
  smartlead?: PlatformProgress;
  replyio?: PlatformProgress;
}

const POLL_INTERVAL = 3000; // 3 seconds
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes - consider sync "stale" after this

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

  // Detect if a sync_progress row is "stale" (running but not updated in 5+ minutes)
  const isStaleSync = useCallback((updatedAt: string): boolean => {
    const lastUpdate = new Date(updatedAt).getTime();
    const now = Date.now();
    return (now - lastUpdate) > STALE_THRESHOLD_MS;
  }, []);

  // Fetch sync progress from sync_progress table (single source of truth)
  const fetchProgress = useCallback(async () => {
    if (!currentWorkspace?.id) return null;

    // Get data sources to map source_type
    const { data: dataSources } = await supabase
      .from('data_sources')
      .select('id, source_type, last_sync_status, last_sync_at')
      .in('source_type', ['smartlead', 'replyio'])
      .eq('status', 'active');

    if (!dataSources || dataSources.length === 0) {
      setProgress({});
      setStaleSyncs([]);
      return null;
    }

    // Build a map of data_source_id -> source_type
    const dsMap = new Map<string, string>();
    const dsLastSync = new Map<string, string | null>();
    dataSources.forEach((ds: DataSourceInfo) => {
      dsMap.set(ds.id, ds.source_type);
      dsLastSync.set(ds.source_type, ds.last_sync_at);
    });

    // Fetch running sync_progress rows
    const { data: runningProgress } = await supabase
      .from('sync_progress')
      .select('*')
      .eq('status', 'running')
      .order('started_at', { ascending: false });

    // Fetch most recent completed/partial/failed sync_progress for each data source
    const { data: recentProgress } = await supabase
      .from('sync_progress')
      .select('*')
      .in('status', ['completed', 'partial', 'failed'])
      .order('started_at', { ascending: false })
      .limit(20);

    const newProgress: SyncProgress = {};
    const stale: string[] = [];

    // Process running syncs first
    if (runningProgress && runningProgress.length > 0) {
      for (const sp of runningProgress as SyncProgressRow[]) {
        const sourceType = sp.data_source_id ? dsMap.get(sp.data_source_id) : null;
        if (!sourceType) continue;

        const isStale = isStaleSync(sp.updated_at);
        if (isStale) {
          stale.push(sourceType);
        }

        const platformProgress: PlatformProgress = {
          current: sp.processed_campaigns || 0,
          total: sp.total_campaigns || 0,
          status: isStale ? 'stale' : 'running',
          lastSyncAt: sp.updated_at,
          isStale,
          recordsSynced: sp.records_synced || 0,
          currentPhase: sp.current_phase || undefined,
        };

        if (sourceType === 'smartlead') {
          newProgress.smartlead = platformProgress;
        } else if (sourceType === 'replyio') {
          newProgress.replyio = platformProgress;
        }
      }
    }

    // Fill in from recent completed syncs for platforms without running syncs
    if (recentProgress && recentProgress.length > 0) {
      for (const sp of recentProgress as SyncProgressRow[]) {
        const sourceType = sp.data_source_id ? dsMap.get(sp.data_source_id) : null;
        if (!sourceType) continue;

        // Skip if we already have a running sync for this platform
        if (sourceType === 'smartlead' && newProgress.smartlead) continue;
        if (sourceType === 'replyio' && newProgress.replyio) continue;

        const platformProgress: PlatformProgress = {
          current: sp.processed_campaigns || 0,
          total: sp.total_campaigns || 0,
          status: sp.status,
          lastSyncAt: dsLastSync.get(sourceType) || sp.updated_at,
          isStale: false,
          recordsSynced: sp.records_synced || 0,
        };

        if (sourceType === 'smartlead' && !newProgress.smartlead) {
          newProgress.smartlead = platformProgress;
        } else if (sourceType === 'replyio' && !newProgress.replyio) {
          newProgress.replyio = platformProgress;
        }
      }
    }

    // If we still don't have progress for a platform, create empty progress
    for (const ds of dataSources) {
      if (ds.source_type === 'smartlead' && !newProgress.smartlead) {
        newProgress.smartlead = {
          current: 0,
          total: 0,
          status: 'idle',
          lastSyncAt: ds.last_sync_at || undefined,
          isStale: false,
        };
      } else if (ds.source_type === 'replyio' && !newProgress.replyio) {
        newProgress.replyio = {
          current: 0,
          total: 0,
          status: 'idle',
          lastSyncAt: ds.last_sync_at || undefined,
          isStale: false,
        };
      }
    }

    setProgress(newProgress);
    setStaleSyncs(stale);
    return newProgress;
  }, [currentWorkspace?.id, isStaleSync]);

  // Check if sync is still in progress (and not stale)
  const isSyncInProgress = useCallback((prog: SyncProgress) => {
    const slProgress = prog.smartlead;
    const rioProgress = prog.replyio;
    
    // Check if actively syncing (status = running and NOT stale)
    const slSyncing = slProgress?.status === 'running' && !slProgress.isStale;
    const rioSyncing = rioProgress?.status === 'running' && !rioProgress.isStale;
    
    return slSyncing || rioSyncing;
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
            description: `${staleSyncs.join(', ')} sync appears stuck. Use "Resume" to continue.`
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
      .select('id, source_type, last_sync_status, last_sync_at')
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

  // Force reset stuck syncs
  const forceResetStuckSyncs = async () => {
    if (!currentWorkspace?.id) return;

    try {
      const { error } = await supabase.functions.invoke('sync-reset', {
        body: { stale_threshold_minutes: 5 }
      });

      if (error) throw error;

      toast.success('Stuck syncs reset', {
        description: 'You can now Resume or start a new sync'
      });

      await fetchProgress();
    } catch (err) {
      console.error('Force reset error:', err);
      toast.error('Failed to reset stuck syncs');
    }
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
          sync_leads: false, // Disabled for quick sync - leads pagination is slow
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
                sync_leads: false, // Disabled for quick sync - leads pagination is slow
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
    forceResetStuckSyncs,
    fetchProgress,
  };
}
