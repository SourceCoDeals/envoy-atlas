import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { StatusDot } from '@/components/dashboard/StatusDot';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  Plug, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ExternalLink,
  Key,
  Clock,
  Download,
  AlertCircle,
  FastForward,
  AlertTriangle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';

type SyncProgress = {
  step?: string;
  progress?: number;
  total?: number;
  current?: number;
  // Smartlead fields
  campaign_index?: number;
  batch_index?: number;
  total_campaigns?: number;
  current_campaign?: number;
  campaign_name?: string;
  campaigns_synced?: number;
  email_accounts_synced?: number;
  variants_synced?: number;
  metrics_created?: number;
  leads_synced?: number;
  events_created?: number;
  error?: string;
  // Reply.io v3 fields
  sequence_index?: number;
  contact_cursor?: number | null;
  total_sequences?: number;
  processed_sequences?: number;
  total_contacts?: number;
  processed_contacts?: number;
  current_sequence_name?: string;
  last_heartbeat?: string;
  errors?: string[];
};

type ApiConnection = {
  id: string;
  platform: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_full_sync_at: string | null;
  sync_status: string | null;
  sync_progress: SyncProgress | null;
  created_at: string;
};

export default function Connections() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [replyioApiKey, setReplyioApiKey] = useState('');
  const [phoneburnerApiKey, setPhoneburnerApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingReplyio, setIsConnectingReplyio] = useState(false);
  const [isConnectingPhoneburner, setIsConnectingPhoneburner] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingPhoneburner, setIsSyncingPhoneburner] = useState(false);
  const [isResumingSync, setIsResumingSync] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isSyncingReplyio, setIsSyncingReplyio] = useState(false);
  const [isResumingReplyio, setIsResumingReplyio] = useState(false);
  const [isStoppingReplyio, setIsStoppingReplyio] = useState(false);
  const [isDiagnosingReplyio, setIsDiagnosingReplyio] = useState(false);
  const [replyioDiagnostics, setReplyioDiagnostics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (currentWorkspace) {
      fetchConnections();
    }
  }, [currentWorkspace]);

  // Auto-continue Reply.io sync when in progress
  useEffect(() => {
    const replyioConnection = connections.find(c => c.platform === 'replyio');
    if (!replyioConnection || replyioConnection.sync_status !== 'syncing') return;
    if (!currentWorkspace?.id) return;

    console.log('Reply.io sync in progress, setting up polling...');
    
    const pollInterval = window.setInterval(() => {
      fetchConnections();
    }, 2000);

    const resumeInterval = window.setInterval(() => {
      void continueReplyioSync();
    }, 60000);

    // Initial resume call
    void continueReplyioSync();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (resumeInterval) clearInterval(resumeInterval);
    };
  }, [connections.find(c => c.platform === 'replyio')?.sync_status, currentWorkspace?.id]);

  // Auto-continue Smartlead sync when in progress
  useEffect(() => {
    const smartleadConnection = connections.find(c => c.platform === 'smartlead');
    if (!smartleadConnection || smartleadConnection.sync_status !== 'syncing') return;
    if (!currentWorkspace?.id) return;

    let pollInterval: number | undefined;
    let resumeInterval: number | undefined;

    const start = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Your session expired while a sync is in progress. Please sign in again to resume the Smartlead sync.');
        return;
      }

      pollInterval = window.setInterval(fetchConnections, 2000);
      resumeInterval = window.setInterval(() => {
        void continueSmartleadSync();
      }, 60000);

      void continueSmartleadSync();
    };

    void start();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (resumeInterval) clearInterval(resumeInterval);
    };
  }, [connections.find(c => c.platform === 'smartlead')?.sync_status, currentWorkspace?.id]);

  const fetchConnections = async () => {
    if (!currentWorkspace) return;

    try {
      const { data, error } = await supabase
        .from('api_connections')
        .select('id, platform, is_active, last_sync_at, last_full_sync_at, sync_status, sync_progress, created_at')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;
      
      const parsedData = (data || []).map(conn => ({
        ...conn,
        sync_progress: conn.sync_progress as SyncProgress | null,
      }));
      
      setConnections(parsedData);
      
      // Check if Smartlead sync just completed
      const prevSmartlead = connections.find(c => c.platform === 'smartlead');
      const currSmartlead = parsedData.find(c => c.platform === 'smartlead');
      if (prevSmartlead?.sync_status === 'syncing' && currSmartlead?.sync_status === 'success') {
        setIsSyncing(false);
        const progress = currSmartlead.sync_progress;
        setSuccess(
          `Sync complete! Synced ${progress?.campaigns_synced || 0} campaigns, ` +
          `${progress?.variants_synced || 0} email variants, ` +
          `${progress?.email_accounts_synced || 0} email accounts.`
        );
      }

      // Check if Reply.io sync just completed
      const prevReplyio = connections.find(c => c.platform === 'replyio');
      const currReplyio = parsedData.find(c => c.platform === 'replyio');
      if (prevReplyio?.sync_status === 'syncing' && currReplyio?.sync_status === 'completed') {
        setIsSyncingReplyio(false);
        const progress = currReplyio.sync_progress;
        setSuccess(
          `Reply.io sync complete! Synced ${progress?.processed_sequences || 0} sequences, ` +
          `${progress?.processed_contacts || 0} contacts.`
        );
      }
    } catch (err) {
      console.error('Error fetching connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform: 'smartlead' | 'replyio') => {
    if (!currentWorkspace || !user || !apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsConnecting(true);

    try {
      const { error } = await supabase
        .from('api_connections')
        .upsert({
          workspace_id: currentWorkspace.id,
          platform,
          api_key_encrypted: apiKey,
          is_active: true,
          sync_status: 'pending',
          created_by: user.id,
        }, {
          onConflict: 'workspace_id,platform',
        });

      if (error) throw error;

      setSuccess(`${platform === 'smartlead' ? 'Smartlead' : 'Reply.io'} connected successfully!`);
      setApiKey('');
      fetchConnections();
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('api_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;
      fetchConnections();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect');
    }
  };

  const handleConnectReplyio = async () => {
    if (!currentWorkspace || !user || !replyioApiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsConnectingReplyio(true);

    try {
      const { error } = await supabase
        .from('api_connections')
        .upsert({
          workspace_id: currentWorkspace.id,
          platform: 'replyio',
          api_key_encrypted: replyioApiKey,
          is_active: true,
          sync_status: 'pending',
          created_by: user.id,
        }, {
          onConflict: 'workspace_id,platform',
        });

      if (error) throw error;

      setSuccess('Reply.io connected successfully!');
      setReplyioApiKey('');
      fetchConnections();
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setIsConnectingReplyio(false);
    }
  };

  const continueSmartleadSync = async () => {
    if (!currentWorkspace || isResumingSync) return;

    try {
      setIsResumingSync(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await supabase.functions.invoke('smartlead-sync', {
        body: {
          workspace_id: currentWorkspace.id,
          sync_type: 'full',
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    } catch (e) {
      console.log('Continue sync call completed (may have timed out, will retry)');
    } finally {
      setIsResumingSync(false);
    }
  };

  const continueReplyioSync = async () => {
    if (!currentWorkspace || isResumingReplyio) return;
    
    const replyioConnection = connections.find(c => c.platform === 'replyio');
    if (!replyioConnection || replyioConnection.sync_status !== 'syncing') return;

    try {
      setIsResumingReplyio(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await supabase.functions.invoke('replyio-sync', {
        body: { workspace_id: currentWorkspace.id, sync_type: 'full' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      await fetchConnections();
    } catch (error) {
      console.log('Continue Reply.io sync call completed (may have timed out, will retry)');
    } finally {
      setIsResumingReplyio(false);
    }
  };

  const runReplyioDiagnostics = async () => {
    if (!currentWorkspace || isDiagnosingReplyio) return;

    try {
      setError(null);
      setSuccess(null);
      setReplyioDiagnostics(null);
      setIsDiagnosingReplyio(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated. Please sign in again.');

      const res = await supabase.functions.invoke('replyio-sync', {
        body: { workspace_id: currentWorkspace.id, diagnostic: true },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw new Error(res.error.message || 'Diagnostics failed');
      setReplyioDiagnostics(res.data?.results || res.data);
      setSuccess('Reply.io diagnostics captured below.');
    } catch (e: any) {
      setError(e.message || 'Failed to run diagnostics');
    } finally {
      setIsDiagnosingReplyio(false);
    }
  };

  const handlePullFullHistory = async (reset = false, forceAdvance = false) => {
    if (!currentWorkspace) return;

    setError(null);
    setSuccess(null);
    setIsSyncing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      const response = await supabase.functions.invoke('smartlead-sync', {
        body: {
          workspace_id: currentWorkspace.id,
          sync_type: 'full',
          reset,
          force_advance: forceAdvance,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Sync failed');
      }

      void continueSmartleadSync();
    } catch (err: any) {
      console.error('Sync error:', err);
      setError(err.message || 'Failed to start sync');
      setIsSyncing(false);
    }
  };

  const handleStopSync = async () => {
    if (!currentWorkspace) return;
    
    setIsStopping(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('api_connections')
        .update({ sync_status: 'stopped' })
        .eq('workspace_id', currentWorkspace.id)
        .eq('platform', 'smartlead');
      
      if (error) throw error;
      
      setSuccess('Sync stopped. You can reset and restart when ready.');
      setIsSyncing(false);
      fetchConnections();
    } catch (err: any) {
      setError(err.message || 'Failed to stop sync');
    } finally {
      setIsStopping(false);
    }
  };

  const handleStopReplyioSync = async () => {
    if (!currentWorkspace) return;
    
    setIsStoppingReplyio(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('api_connections')
        .update({ sync_status: 'stopped' })
        .eq('workspace_id', currentWorkspace.id)
        .eq('platform', 'replyio');
      
      if (error) throw error;
      
      setSuccess('Reply.io sync stopped.');
      setIsSyncingReplyio(false);
      fetchConnections();
    } catch (err: any) {
      setError(err.message || 'Failed to stop sync');
    } finally {
      setIsStoppingReplyio(false);
    }
  };

  const handleForceAdvanceReplyio = async () => {
    if (!currentWorkspace) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await supabase.functions.invoke('replyio-sync', {
        body: { workspace_id: currentWorkspace.id, force_advance: true },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      await fetchConnections();
      setSuccess('Forced advance to next sequence');
    } catch (error) {
      console.error('Error force advancing Reply.io sync:', error);
    }
  };

  const handleReplyioSync = async (reset = false) => {
    if (!currentWorkspace) return;

    setError(null);
    setSuccess(null);
    setIsSyncingReplyio(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      const response = await supabase.functions.invoke('replyio-sync', {
        body: {
          workspace_id: currentWorkspace.id,
          sync_type: 'full',
          reset,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Sync failed');
      }

      const data = response.data;
      if (data?.complete) {
        setSuccess(
          `Reply.io sync complete! Synced ${data.progress?.processed_sequences || 0} sequences, ` +
          `${data.progress?.processed_contacts || 0} contacts.`
        );
        setIsSyncingReplyio(false);
      } else if (data?.skipped) {
        setSuccess('Sync already in progress...');
      } else {
        setSuccess('Reply.io sync started, processing in background...');
      }
      
      fetchConnections();
    } catch (err: any) {
      console.error('Reply.io sync error:', err);
      setError(err.message || 'Failed to sync Reply.io');
      setIsSyncingReplyio(false);
    }
  };

  // PhoneBurner handlers
  const handleConnectPhoneburner = async () => {
    if (!currentWorkspace || !user || !phoneburnerApiKey.trim()) {
      setError('Please enter a PhoneBurner access token');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsConnectingPhoneburner(true);

    try {
      const { error } = await supabase
        .from('api_connections')
        .upsert({
          workspace_id: currentWorkspace.id,
          platform: 'phoneburner',
          api_key_encrypted: phoneburnerApiKey,
          is_active: true,
          sync_status: 'pending',
          created_by: user.id,
        }, {
          onConflict: 'workspace_id,platform',
        });

      if (error) throw error;

      setSuccess('PhoneBurner connected successfully!');
      setPhoneburnerApiKey('');
      fetchConnections();
    } catch (err: any) {
      setError(err.message || 'Failed to connect PhoneBurner');
    } finally {
      setIsConnectingPhoneburner(false);
    }
  };

  const handlePhoneburnerSync = async (reset = false) => {
    if (!currentWorkspace) return;

    setError(null);
    setSuccess(null);
    setIsSyncingPhoneburner(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      const response = await supabase.functions.invoke('phoneburner-sync', {
        body: {
          workspace_id: currentWorkspace.id,
          sync_type: 'full',
          reset,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'PhoneBurner sync failed');
      }

      const data = response.data;
      if (data?.done) {
        setSuccess(
          `PhoneBurner sync complete! Synced ${data.contacts_synced || 0} contacts, ` +
          `${data.calls_synced || 0} calls.`
        );
        setIsSyncingPhoneburner(false);
      } else {
        setSuccess('PhoneBurner sync started, processing in background...');
      }

      fetchConnections();
    } catch (err: any) {
      console.error('PhoneBurner sync error:', err);
      setError(err.message || 'Failed to sync PhoneBurner');
      setIsSyncingPhoneburner(false);
    }
  };

  const smartleadConnection = connections.find(c => c.platform === 'smartlead');
  const replyioConnection = connections.find(c => c.platform === 'replyio');
  const phoneburnerConnection = connections.find(c => c.platform === 'phoneburner');
  const isSyncingSmartlead = smartleadConnection?.sync_status === 'syncing' || isSyncing;
  const isSyncingReplyioActive = replyioConnection?.sync_status === 'syncing' || isSyncingReplyio;
  const isSyncingPhoneburnerActive = phoneburnerConnection?.sync_status === 'syncing' || isSyncingPhoneburner;
  const syncProgress = smartleadConnection?.sync_progress;
  const replyioSyncProgress = replyioConnection?.sync_progress;
  const phoneburnerSyncProgress = phoneburnerConnection?.sync_progress;

  // Calculate Reply.io progress percentage
  const getReplyioProgress = () => {
    if (!replyioSyncProgress) return 0;
    const step = replyioSyncProgress.step;
    if (step === 'email_accounts') return 5;
    if (step === 'sequences') {
      const total = replyioSyncProgress.total_sequences || 1;
      const processed = replyioSyncProgress.processed_sequences || 0;
      return 5 + (processed / total) * 70;
    }
    if (step === 'contacts') {
      const processed = replyioSyncProgress.processed_contacts || 0;
      return 75 + Math.min(processed / 100, 1) * 20;
    }
    if (step === 'complete') return 100;
    return 0;
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connections</h1>
          <p className="text-muted-foreground">
            Connect your email outreach platforms to import campaign data
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="text-success">{success}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Smartlead Connection */}
          <Card className={smartleadConnection ? 'border-success/30' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                    <Plug className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Smartlead</CardTitle>
                    <CardDescription>Primary outreach platform</CardDescription>
                  </div>
                </div>
                {smartleadConnection && (
                  <Badge variant="outline" className="border-success text-success">
                    <StatusDot status="healthy" size="sm" className="mr-1" />
                    Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {smartleadConnection ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="capitalize">
                      {isSyncingSmartlead ? 'Syncing...' : (smartleadConnection.sync_status || 'Active')}
                    </span>
                  </div>
                  
                  {isSyncingSmartlead && syncProgress && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {syncProgress.campaign_name 
                            ? `Syncing: ${syncProgress.campaign_name}` 
                            : 'Starting sync...'}
                        </span>
                        <span>
                          {syncProgress.campaign_index ?? syncProgress.current_campaign ?? (syncProgress.batch_index ? syncProgress.batch_index * 2 : 0)} / {syncProgress.total_campaigns ?? syncProgress.total ?? '?'}
                        </span>
                      </div>
                      <Progress value={syncProgress.progress || 0} className="h-2" />
                    </div>
                  )}

                  {smartleadConnection.last_sync_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last Sync</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(smartleadConnection.last_sync_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                  
                  {smartleadConnection.last_full_sync_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last Full Sync</span>
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {new Date(smartleadConnection.last_full_sync_at).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {syncProgress?.step === 'complete' && (
                    <div className="text-xs text-muted-foreground bg-accent/50 rounded-lg p-3">
                      <p className="font-medium mb-1">Last sync results:</p>
                      <p>{syncProgress.campaigns_synced} campaigns, {syncProgress.variants_synced} variants, {syncProgress.leads_synced || 0} leads, {syncProgress.events_created || 0} events</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {isSyncingSmartlead ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handlePullFullHistory(false, true)}
                          title="Skip to next batch if sync is stuck"
                        >
                          <FastForward className="mr-2 h-4 w-4" />
                          Skip Batch
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          onClick={handleStopSync}
                          disabled={isStopping}
                        >
                          {isStopping ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Stopping...
                            </>
                          ) : (
                            <>
                              <XCircle className="mr-2 h-4 w-4" />
                              Stop Sync
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handlePullFullHistory(false)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Continue Sync
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              title="Reset and re-sync from scratch"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                Reset Sync Data?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will delete all synced data and start a full re-sync from scratch.
                                This may take a long time for accounts with many campaigns.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handlePullFullHistory(true)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Reset & Full Sync
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              Disconnect
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                Disconnect Smartlead?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove your Smartlead API key and stop all syncing. 
                                You'll need to re-enter your API key to reconnect.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDisconnect(smartleadConnection.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Disconnect
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="smartlead-key">API Key</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="smartlead-key"
                        type="password"
                        placeholder="Enter your Smartlead API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Button
                      onClick={() => handleConnect('smartlead')}
                      disabled={isConnecting || !apiKey.trim()}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        'Connect Smartlead'
                      )}
                    </Button>
                    <Button variant="link" size="sm" asChild>
                      <a 
                        href="https://app.smartlead.ai/settings/api" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        Get API Key
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reply.io Connection */}
          <Card className={replyioConnection ? 'border-success/30' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                    <Plug className={`h-5 w-5 ${replyioConnection ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Reply.io</CardTitle>
                    <CardDescription>Secondary outreach platform</CardDescription>
                  </div>
                </div>
                {replyioConnection && (
                  <Badge variant="outline" className="border-success text-success">
                    <StatusDot status="healthy" size="sm" className="mr-1" />
                    Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {replyioConnection ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="capitalize">
                      {isSyncingReplyioActive ? 'Syncing...' : (replyioConnection.sync_status || 'Active')}
                    </span>
                  </div>
                  
                  {/* Sync Progress */}
                  {isSyncingReplyioActive && replyioSyncProgress && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {replyioSyncProgress.step === 'email_accounts' && 'Syncing email accounts...'}
                          {replyioSyncProgress.step === 'sequences' && (replyioSyncProgress.current_sequence_name 
                            ? `Syncing: ${replyioSyncProgress.current_sequence_name}` 
                            : 'Syncing sequences...')}
                          {replyioSyncProgress.step === 'contacts' && `Syncing contacts (${replyioSyncProgress.processed_contacts || 0} processed)`}
                        </span>
                        <span>
                          {replyioSyncProgress.step === 'sequences' && (
                            `${replyioSyncProgress.processed_sequences || 0} / ${replyioSyncProgress.total_sequences || '?'}`
                          )}
                        </span>
                      </div>
                      <Progress value={getReplyioProgress()} className="h-2" />
                    </div>
                  )}
                  
                  {replyioConnection.last_sync_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last Sync</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(replyioConnection.last_sync_at).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Sync Results */}
                  {replyioSyncProgress?.step === 'complete' && (
                    <div className="text-xs text-muted-foreground bg-accent/50 rounded-lg p-3">
                      <p className="font-medium mb-1">Last sync results:</p>
                      <p>{replyioSyncProgress.processed_sequences || 0} sequences, {replyioSyncProgress.processed_contacts || 0} contacts</p>
                    </div>
                  )}

                  {/* Errors Display (only show for active or failed syncs) */}
                  {(isSyncingReplyioActive || replyioConnection.sync_status === 'error') &&
                    replyioSyncProgress?.errors && replyioSyncProgress.errors.length > 0 && (
                      <div className="text-xs text-destructive bg-destructive/10 rounded-lg p-3">
                        <p className="font-medium mb-1">Errors:</p>
                        {replyioSyncProgress.errors.slice(-3).map((err, i) => (
                          <p key={i} className="truncate">{err}</p>
                        ))}
                      </div>
                    )}

                  {replyioDiagnostics && (
                    <Alert>
                      <AlertDescription>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Reply.io diagnostics</p>
                          <pre className="max-h-56 overflow-auto rounded-md bg-accent/40 p-3 text-xs text-foreground">
                            {JSON.stringify(replyioDiagnostics, null, 2)}
                          </pre>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2 pt-2">
                    {isSyncingReplyioActive ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleForceAdvanceReplyio}
                          title="Skip to next sequence if sync is stuck"
                        >
                          <FastForward className="mr-2 h-4 w-4" />
                          Skip
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          onClick={handleStopReplyioSync}
                          disabled={isStoppingReplyio}
                        >
                          {isStoppingReplyio ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Stopping...
                            </>
                          ) : (
                            <>
                              <XCircle className="mr-2 h-4 w-4" />
                              Stop Sync
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleReplyioSync(false)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Sync Data
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={runReplyioDiagnostics}
                          disabled={isDiagnosingReplyio}
                          title="Run a quick API sanity-check (no data changes)"
                        >
                          {isDiagnosingReplyio ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              title="Reset and re-sync from scratch"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                Reset Reply.io Sync Data?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will delete all synced Reply.io data and start a full re-sync from scratch.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleReplyioSync(true)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Reset & Full Sync
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              Disconnect
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                Disconnect Reply.io?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove your Reply.io API key and stop all syncing. 
                                You'll need to re-enter your API key to reconnect.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDisconnect(replyioConnection.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Disconnect
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="replyio-key">API Key</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="replyio-key"
                        type="password"
                        placeholder="Enter your Reply.io API key"
                        value={replyioApiKey}
                        onChange={(e) => setReplyioApiKey(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Button
                      onClick={() => handleConnectReplyio()}
                      disabled={isConnectingReplyio || !replyioApiKey.trim()}
                    >
                      {isConnectingReplyio ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        'Connect Reply.io'
                      )}
                    </Button>
                    <Button variant="link" size="sm" asChild>
                      <a 
                        href="https://app.reply.io/settings/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        Get API Key
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PhoneBurner Connection */}
          <Card className={phoneburnerConnection ? 'border-success/30' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                    <Plug className={`h-5 w-5 ${phoneburnerConnection ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">PhoneBurner</CardTitle>
                    <CardDescription>Power dialer & call tracking</CardDescription>
                  </div>
                </div>
                {phoneburnerConnection && (
                  <Badge variant="outline" className="border-success text-success">
                    <StatusDot status="healthy" size="sm" className="mr-1" />
                    Connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {phoneburnerConnection ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="capitalize">
                      {isSyncingPhoneburnerActive ? 'Syncing...' : (phoneburnerConnection.sync_status || 'Active')}
                    </span>
                  </div>

                  {/* Sync Progress */}
                  {isSyncingPhoneburnerActive && phoneburnerSyncProgress && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {phoneburnerSyncProgress.step === 'contacts' && 'Syncing contacts...'}
                          {phoneburnerSyncProgress.step === 'dial_sessions' && 'Syncing dial sessions & calls...'}
                          {phoneburnerSyncProgress.step === 'complete' && 'Complete'}
                        </span>
                      </div>
                      <Progress value={phoneburnerSyncProgress.progress || 0} className="h-2" />
                    </div>
                  )}

                  {phoneburnerConnection.last_sync_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last Sync</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(phoneburnerConnection.last_sync_at).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Sync Results */}
                  {phoneburnerSyncProgress?.step === 'complete' && (
                    <div className="text-xs text-muted-foreground bg-accent/50 rounded-lg p-3">
                      <p className="font-medium mb-1">Last sync results:</p>
                      <p>{phoneburnerSyncProgress.contacts_synced || 0} contacts, {phoneburnerSyncProgress.calls_synced || 0} calls</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handlePhoneburnerSync(false)}
                      disabled={isSyncingPhoneburnerActive}
                    >
                      {isSyncingPhoneburnerActive ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Sync Data
                        </>
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Reset and re-sync from scratch"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Reset PhoneBurner Sync Data?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete all synced PhoneBurner data and start a full re-sync from scratch.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handlePhoneburnerSync(true)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Reset & Full Sync
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          Disconnect
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Disconnect PhoneBurner?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove your PhoneBurner access token and stop all syncing.
                            You'll need to re-enter your token to reconnect.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDisconnect(phoneburnerConnection.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phoneburner-key">Access Token</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phoneburner-key"
                        type="password"
                        placeholder="Enter your PhoneBurner access token"
                        value={phoneburnerApiKey}
                        onChange={(e) => setPhoneburnerApiKey(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Generate a Personal Access Token in PhoneBurner under My Account → Integration Settings
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Button
                      onClick={handleConnectPhoneburner}
                      disabled={isConnectingPhoneburner || !phoneburnerApiKey.trim()}
                    >
                      {isConnectingPhoneburner ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        'Connect PhoneBurner'
                      )}
                    </Button>
                    <Button variant="link" size="sm" asChild>
                      <a
                        href="https://www.phoneburner.com/developer/getting_started"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        API Docs
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Sync Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Sync</CardTitle>
            <CardDescription>
              How your data is imported and synced
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg bg-accent/30">
                <h4 className="font-medium mb-1">Historical Backfill</h4>
                <p className="text-sm text-muted-foreground">
                  Click "Pull Full History" to import all campaigns, email variants, and metrics
                </p>
              </div>
              <div className="p-4 rounded-lg bg-accent/30">
                <h4 className="font-medium mb-1">Email Copy Analytics</h4>
                <p className="text-sm text-muted-foreground">
                  Subject lines and body copy are synced with performance metrics
                </p>
              </div>
              <div className="p-4 rounded-lg bg-accent/30">
                <h4 className="font-medium mb-1">Copy Insights</h4>
                <p className="text-sm text-muted-foreground">
                  View your synced copy analytics on the Copy Insights page
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
