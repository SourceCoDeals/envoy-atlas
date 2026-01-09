import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

export function useSyncData() {
  const { currentWorkspace } = useWorkspace();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const triggerSync = async () => {
    if (!currentWorkspace?.id || syncing) return;

    setSyncing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('smartlead-sync', {
        body: { 
          workspace_id: currentWorkspace.id,
          sync_type: 'incremental'
        }
      });

      if (error) throw error;

      setLastSyncAt(new Date().toISOString());
      
      if (data?.partial) {
        toast.info('Sync in progress', {
          description: `Synced ${data.processed_campaigns || 0} campaigns. More data loading...`
        });
      } else {
        toast.success('Data refreshed', {
          description: `Synced ${data?.processed_campaigns || 0} campaigns successfully`
        });
      }

      return data;
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
    triggerSync,
  };
}
