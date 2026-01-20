import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataFreshness } from '@/components/ui/data-freshness';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

interface DataSource {
  id: string;
  source_type: string;
  name: string;
  status: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  sync_enabled: boolean | null;
}

export function SyncStatusPanel() {
  const { currentWorkspace } = useWorkspace();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: dataSources, isLoading, refetch } = useQuery({
    queryKey: ['data-sources', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_sources')
        .select('id, source_type, name, status, last_sync_at, last_sync_status, last_sync_error, sync_enabled')
        .order('source_type');
      
      if (error) throw error;
      return data as DataSource[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const handleSync = async (source: DataSource) => {
    if (!currentWorkspace?.id) return;

    setSyncingId(source.id);
    try {
      const syncEndpoint = source.source_type === 'smartlead'
        ? 'smartlead-sync'
        : source.source_type === 'replyio'
        ? 'replyio-sync'
        : null;

      if (!syncEndpoint) {
        toast.error(`No sync available for ${source.source_type}`);
        return;
      }

      const { data: engagement } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!engagement?.id) {
        toast.error('No engagement found for this workspace');
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke(syncEndpoint, {
        body: {
          client_id: currentWorkspace.id,
          engagement_id: engagement.id,
          data_source_id: source.id,
          reset: false,
          full_backfill: false,
          auto_continue: true,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) throw error;

      toast.success(`Sync started for ${source.name}`);
      setTimeout(() => refetch(), 1500);
    } catch (err: any) {
      console.error('Sync error:', err);
      toast.error(`Sync failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSyncingId(null);
    }
  };

  const getStatusColor = (source: DataSource) => {
    if (syncingId === source.id) return 'bg-blue-500 animate-pulse';
    if (source.status === 'active' && source.last_sync_status === 'success') return 'bg-green-500';
    if (source.last_sync_status === 'error') return 'bg-red-500';
    if (source.status === 'inactive') return 'bg-gray-400';
    return 'bg-amber-500';
  };

  const getSyncStatus = (source: DataSource): 'idle' | 'syncing' | 'error' => {
    if (syncingId === source.id) return 'syncing';
    if (source.last_sync_status === 'error') return 'error';
    return 'idle';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
          <CardDescription>Connected platforms and sync status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!dataSources?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
          <CardDescription>Connected platforms and sync status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p>No data sources connected</p>
            <p className="text-sm">Connect SmartLead or Reply.io to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Sources</CardTitle>
        <CardDescription>Connected platforms and sync status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {dataSources.map(source => (
            <div key={source.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  getStatusColor(source)
                )} />
                <div>
                  <span className="font-medium capitalize">{source.name || source.source_type}</span>
                  {source.last_sync_error && (
                    <p className="text-xs text-destructive truncate max-w-[200px]">{source.last_sync_error}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <DataFreshness 
                  lastSyncAt={source.last_sync_at} 
                  status={getSyncStatus(source)}
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  type="button"
                  onClick={() => handleSync(source)}
                  disabled={syncingId === source.id}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-1", syncingId === source.id && "animate-spin")} />
                  {syncingId === source.id ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
