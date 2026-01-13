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

      // Fetch connected platforms for this workspace
      const { data: connections } = await supabase
        .from('api_connections')
        .select('platform')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);

      const connectedPlatforms = (connections || []).map(c => c.platform);
      
      const syncPromises: Promise<any>[] = [];
      
      // Trigger SmartLead sync if connected - use reset to force fresh full sync
      if (connectedPlatforms.includes('smartlead')) {
        syncPromises.push(
          supabase.functions.invoke('smartlead-sync', {
            body: { 
              workspace_id: currentWorkspace.id,
              sync_type: 'full',
              reset: true  // Force fresh sync of all campaigns
            }
          })
        );
      }

      // Trigger Reply.io sync if connected - use reset to force fresh full sync
      if (connectedPlatforms.includes('replyio')) {
        syncPromises.push(
          supabase.functions.invoke('replyio-sync', {
            body: { 
              workspace_id: currentWorkspace.id,
              sync_type: 'full',
              reset: true  // Force fresh sync of all sequences
            }
          })
        );
      }

      if (syncPromises.length === 0) {
        toast.info('No platforms connected', {
          description: 'Connect SmartLead or Reply.io to sync data'
        });
        return;
      }

      const results = await Promise.allSettled(syncPromises);
      
      let totalCampaigns = 0;
      let hasErrors = false;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.data) {
          totalCampaigns += result.value.data.processed_campaigns || result.value.data.sequences_synced || 0;
        } else if (result.status === 'rejected' || result.value?.error) {
          hasErrors = true;
          console.error('Sync error:', result);
        }
      });

      setLastSyncAt(new Date().toISOString());
      
      if (hasErrors) {
        toast.warning('Partial sync completed', {
          description: `Synced ${totalCampaigns} campaigns. Some errors occurred.`
        });
      } else {
        toast.success('Data refreshed', {
          description: `Synced ${totalCampaigns} campaigns from ${connectedPlatforms.join(' & ')}`
        });
      }

      return { totalCampaigns, platforms: connectedPlatforms };
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
