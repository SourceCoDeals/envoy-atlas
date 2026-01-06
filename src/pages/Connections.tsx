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
  // backend function fields
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingReplyio, setIsConnectingReplyio] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResumingSync, setIsResumingSync] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isSyncingReplyio, setIsSyncingReplyio] = useState(false);
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

  // Poll for sync progress AND keep nudging batch sync forward
  useEffect(() => {
    const smartleadConnection = connections.find(c => c.platform === 'smartlead');
    if (smartleadConnection?.sync_status !== 'syncing') return;

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
      }, 60000); // 60s interval - each sync batch takes time, avoid overlapping calls

      // kick once immediately
      void continueSmartleadSync();
    };

    void start();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (resumeInterval) clearInterval(resumeInterval);
    };
  }, [connections, currentWorkspace?.id]);

  const fetchConnections = async () => {
    if (!currentWorkspace) return;

    try {
      const { data, error } = await supabase
        .from('api_connections')
        .select('id, platform, is_active, last_sync_at, last_full_sync_at, sync_status, sync_progress, created_at')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;
      
      // Parse sync_progress from JSON
      const parsedData = (data || []).map(conn => ({
        ...conn,
        sync_progress: conn.sync_progress as SyncProgress | null,
      }));
      
      setConnections(parsedData);
      
      // Check if sync just completed
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
      // Silent: don't show banner for automatic continue calls
      console.log('Continue sync call completed (may have timed out, will retry)');
    } finally {
      setIsResumingSync(false);
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

      // Kick off the next batch soon (polling effect will take over)
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
      if (data?.done) {
        setSuccess(
          `Reply.io sync complete! Synced ${data.campaigns_synced || 0} campaigns, ` +
          `${data.leads_synced || 0} leads, ` +
          `${data.email_accounts_synced || 0} email accounts.`
        );
        setIsSyncingReplyio(false);
      } else if (data?.success) {
        setSuccess('Reply.io sync in progress. This page will update automatically.');
      }
      
      fetchConnections();
    } catch (err: any) {
      console.error('Reply.io sync error:', err);
      setError(err.message || 'Failed to sync Reply.io');
      setIsSyncingReplyio(false);
    }
  };

  const smartleadConnection = connections.find(c => c.platform === 'smartlead');
  const replyioConnection = connections.find(c => c.platform === 'replyio');
  const isSyncingSmartlead = smartleadConnection?.sync_status === 'syncing' || isSyncing;
  const isSyncingReplyioActive = replyioConnection?.sync_status === 'syncing' || isSyncingReplyio;
  const syncProgress = smartleadConnection?.sync_progress;
  const replyioSyncProgress = replyioConnection?.sync_progress;

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

        <div className="grid gap-6 md:grid-cols-2">
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
                  
                  {/* Sync Progress */}
                  {isSyncingSmartlead && syncProgress && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {syncProgress.campaign_name 
                            ? `Syncing: ${syncProgress.campaign_name}` 
                            : 'Starting sync...'}
                        </span>
                        <span>
                          {/* Prefer campaign_index, fallback to current_campaign, then batch_index * 2 */}
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

                  {/* Sync Results */}
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
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDisconnect(smartleadConnection.id)}
                        >
                          Disconnect
                        </Button>
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
                          {replyioSyncProgress.campaign_name 
                            ? `Syncing: ${replyioSyncProgress.campaign_name}` 
                            : 'Starting sync...'}
                        </span>
                        <span>
                          {replyioSyncProgress.campaign_index ?? 0} / {replyioSyncProgress.total_campaigns ?? '?'}
                        </span>
                      </div>
                      <Progress value={replyioSyncProgress.progress || 0} className="h-2" />
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
                      <p>{replyioSyncProgress.campaigns_synced || 0} campaigns, {replyioSyncProgress.leads_synced || 0} leads, {replyioSyncProgress.email_accounts_synced || 0} email accounts</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {isSyncingReplyioActive ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled
                      >
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </Button>
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
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDisconnect(replyioConnection.id)}
                        >
                          Disconnect
                        </Button>
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
