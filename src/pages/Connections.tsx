import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useChannel } from "@/hooks/useChannel";
import { useToast } from "@/hooks/use-toast";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Download,
  ExternalLink,
  Inbox,
  KeyRound,
  Loader2,
  Phone,
  Plug,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";

import { DataCoverageIndicator } from "@/components/connections/DataCoverageIndicator";

type SyncProgress = Record<string, any> | null;

type DataSource = {
  id: string;
  source_type: string;
  status: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  created_at: string;
};

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated. Please sign in again.");
  return token;
}

export default function Connections() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { channel } = useChannel();
  const { toast } = useToast();

  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);

  const [smartleadApiKey, setSmartleadApiKey] = useState("");
  const [replyioApiKey, setReplyioApiKey] = useState("");
  const [phoneburnerToken, setPhoneburnerToken] = useState("");
  const [nocodbApiToken, setNocodbApiToken] = useState("");

  const [isConnecting, setIsConnecting] = useState<{ [k: string]: boolean }>({});
  const [isSyncing, setIsSyncing] = useState<{ [k: string]: boolean }>({});

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [showPATInput, setShowPATInput] = useState(false);
  const [isProcessingBackground, setIsProcessingBackground] = useState(false);
  
  // NocoDB sync stats
  const [nocodbStats, setNocodbStats] = useState<{
    totalCalls: number;
    pending: number;
    transcriptFetched: number;
    scored: number;
    errors: number;
  } | null>(null);
  
  // NocoDB sync progress (real-time)
  const [syncProgress, setSyncProgress] = useState<{
    phase: string;
    current: number;
    total: number;
    percent: number;
    message: string;
  } | null>(null);

  // Check if there's pending work
  const hasPendingWork = nocodbStats && (nocodbStats.pending > 0 || nocodbStats.transcriptFetched > 0);

  const smartleadConnection = useMemo(
    () => dataSources.find((c) => c.source_type === "smartlead"),
    [dataSources]
  );
  const replyioConnection = useMemo(
    () => dataSources.find((c) => c.source_type === "replyio"),
    [dataSources]
  );
  const phoneburnerConnection = useMemo(
    () => dataSources.find((c) => c.source_type === "phoneburner"),
    [dataSources]
  );
  const nocodbConnection = useMemo(
    () => dataSources.find((c) => c.source_type === "nocodb"),
    [dataSources]
  );

  const fetchConnections = async () => {
    if (!currentWorkspace) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("data_sources")
        .select("id, source_type, status, last_sync_at, last_sync_status, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDataSources((data || []) as DataSource[]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load connections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  // Handle OAuth callback results from query params
  useEffect(() => {
    const successParam = searchParams.get("success");
    const errorParam = searchParams.get("error");

    if (successParam === "phoneburner_connected") {
      setSuccess("PhoneBurner connected successfully! You can now sync your data.");
      setSearchParams({}, { replace: true });
      if (currentWorkspace?.id) fetchConnections();
    } else if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "PhoneBurner authorization was denied.",
        missing_params: "Missing authorization parameters. Please try again.",
        invalid_state: "Invalid authorization state. Please try again.",
        callback_failed: "Failed to complete PhoneBurner connection. Please try again.",
      };
      setError(errorMessages[errorParam] || "An error occurred during PhoneBurner connection.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    if (currentWorkspace?.id) void fetchConnections();
  }, [currentWorkspace?.id]);

  // Memoize syncing status for stable dependency
  const anySyncing = useMemo(
    () => dataSources.some((c) => c.last_sync_status === "syncing"),
    [dataSources]
  );

  // Light polling when any sync is running - with timeout safety
  useEffect(() => {
    if (!anySyncing || !currentWorkspace?.id) return;

    const startTime = Date.now();
    const MAX_POLL_DURATION = 30 * 60 * 1000; // 30 minutes max

    const t = window.setInterval(() => {
      // Auto-stop polling after 30 minutes to prevent infinite loops
      if (Date.now() - startTime > MAX_POLL_DURATION) {
        console.warn('[Connections] Polling timeout reached, stopping automatic refresh');
        clearInterval(t);
        return;
      }
      void fetchConnections();
    }, 5000);

    return () => window.clearInterval(t);
  }, [anySyncing, currentWorkspace?.id]);

  const handleConnect = async (platform: "smartlead" | "replyio" | "phoneburner" | "nocodb") => {
    if (!currentWorkspace || !user) return;

    const apiKey =
      platform === "smartlead"
        ? smartleadApiKey.trim()
        : platform === "replyio"
          ? replyioApiKey.trim()
          : platform === "nocodb"
            ? nocodbApiToken.trim()
            : phoneburnerToken.trim();

    if (!apiKey) {
      setError(platform === "nocodb" ? "Please enter your NocoDB API Token" : platform === "phoneburner" ? "Please enter a PhoneBurner access token" : "Please enter an API key");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsConnecting((s) => ({ ...s, [platform]: true }));

    try {
      // Insert into data_sources table
      const { error } = await supabase.from("data_sources").upsert(
        {
          name: platform,
          source_type: platform,
          api_key_encrypted: apiKey,
          status: 'active',
          last_sync_status: "pending",
        },
        { onConflict: "source_type" }
      );

      if (error) throw error;

      const platformNames: Record<string, string> = {
        smartlead: "Smartlead",
        replyio: "Reply.io",
        phoneburner: "PhoneBurner",
        nocodb: "NocoDB",
      };
      setSuccess(`${platformNames[platform]} connected successfully!`);
      
      if (platform === "smartlead") setSmartleadApiKey("");
      if (platform === "replyio") setReplyioApiKey("");
      if (platform === "phoneburner") setPhoneburnerToken("");
      if (platform === "nocodb") setNocodbApiToken("");

      await fetchConnections();
      
      // Auto-trigger sync for NocoDB after connecting
      if (platform === "nocodb") {
        handleNocoDBSync("sync");
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || `Failed to connect ${platform}`);
    } finally {
      setIsConnecting((s) => ({ ...s, [platform]: false }));
    }
  };

  const handlePhoneBurnerOAuth = async () => {
    if (!currentWorkspace || !user) return;

    setError(null);
    setSuccess(null);
    setIsConnecting((s) => ({ ...s, phoneburner_oauth: true }));

    try {
      const token = await getAccessToken();
      const res = await supabase.functions.invoke("phoneburner-oauth", {
        body: {
          action: "authorize",
          workspace_id: currentWorkspace.id,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw new Error(res.error.message || "Failed to initiate OAuth");

      const { authorization_url, state } = res.data;

      if (!authorization_url) {
        throw new Error("OAuth not configured. Please contact support or use a Personal Access Token.");
      }

      sessionStorage.setItem("phoneburner_oauth_state", state);
      window.open(authorization_url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to start PhoneBurner OAuth flow");
    } finally {
      setIsConnecting((s) => ({ ...s, phoneburner_oauth: false }));
    }
  };

  const invokeSync = async (fn: string, body: Record<string, any>) => {
    const token = await getAccessToken();
    const res = await supabase.functions.invoke(fn, {
      body,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.error) throw new Error(res.error.message || "Sync failed");
    return res.data as any;
  };

  const handleSyncSmartlead = async (options: { reset?: boolean; fullBackfill?: boolean } = {}) => {
    if (!currentWorkspace) return;
    const { reset = false, fullBackfill = false } = options;

    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, smartlead: true }));

    try {
      const token = await getAccessToken();
      const res = await supabase.functions.invoke("smartlead-sync", {
        body: {
          workspace_id: currentWorkspace.id,
          reset,
          full_backfill: fullBackfill,
          auto_continue: true,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw new Error(res.error.message || "Sync failed");

      const data = res.data;
      if (data.success) {
        if (data.complete) {
          setSuccess(
            fullBackfill
              ? `Full historical backfill complete! Fetched ${data.progress?.historical_days || 0} days of data.`
              : `SmartLead sync complete! Synced ${data.progress?.campaigns_synced || 0} campaigns.`
          );
        } else {
          setSuccess(
            fullBackfill
              ? `Historical backfill in progress... (${data.progress?.historical_days || 0} days so far)`
              : "SmartLead sync started, processing in background..."
          );
        }
      }

      await fetchConnections();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to sync SmartLead");
    } finally {
      setIsSyncing((s) => ({ ...s, smartlead: false }));
    }
  };

  const handleSyncReplyio = async (options: { reset?: boolean; fullBackfill?: boolean } = {}) => {
    if (!currentWorkspace) return;
    const { reset = false, fullBackfill = false } = options;

    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, replyio: true }));

    try {
      const token = await getAccessToken();
      const res = await supabase.functions.invoke("replyio-sync", {
        body: {
          workspace_id: currentWorkspace.id,
          reset,
          full_backfill: fullBackfill,
          auto_continue: true,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw new Error(res.error.message || "Sync failed");

      const data = res.data;
      if (data.success) {
        if (data.complete) {
          setSuccess(`Reply.io sync complete! Synced ${data.progress?.sequences_synced || 0} sequences.`);
        } else {
          setSuccess("Reply.io sync started, processing in background...");
        }
      }

      await fetchConnections();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to sync Reply.io");
    } finally {
      setIsSyncing((s) => ({ ...s, replyio: false }));
    }
  };

  const handleSyncSmartleadReplies = async () => {
    if (!currentWorkspace) return;

    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, smartlead_replies: true }));

    try {
      const token = await getAccessToken();
      const res = await supabase.functions.invoke("smartlead-sync", {
        body: {
          workspace_id: currentWorkspace.id,
          fetch_replies_only: true,
          auto_continue: true,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw new Error(res.error.message || "Sync failed");

      const data = res.data;
      if (data.success) {
        setSuccess(`Inbox replies sync complete! Fetched ${data.progress?.replies_fetched || 0} replies.`);
      }

      await fetchConnections();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to sync inbox replies");
    } finally {
      setIsSyncing((s) => ({ ...s, smartlead_replies: false }));
    }
  };

  const handleSyncPhoneburner = async (reset = false) => {
    if (!currentWorkspace) return;
    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, phoneburner: true }));

    try {
      const data = await invokeSync("phoneburner-sync", {
        workspace_id: currentWorkspace.id,
        reset,
      });

      if (data?.status === "complete") {
        setSuccess(
          `PhoneBurner sync complete! Synced ${data.contacts_synced || 0} contacts, ${data.sessions_synced || 0} sessions, ${data.calls_synced || 0} calls.`
        );
      } else {
        setSuccess("PhoneBurner sync started, processing in background...");
      }

      await fetchConnections();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to sync PhoneBurner");
    } finally {
      setIsSyncing((s) => ({ ...s, phoneburner: false }));
    }
  };

  const handleStopPhoneburnerSync = async () => {
    if (!currentWorkspace) return;

    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, phoneburner_stop: true }));

    try {
      const { error } = await supabase
        .from("data_sources")
        .update({ last_sync_status: "stopped" })
        .eq("source_type", "phoneburner");

      if (error) throw error;
      setSuccess("PhoneBurner sync stopped.");
      await fetchConnections();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to stop sync");
    } finally {
      setIsSyncing((s) => ({ ...s, phoneburner_stop: false }));
    }
  };

  const handleDiagnosePhoneburner = async () => {
    if (!currentWorkspace) return;
    setError(null);
    setSuccess(null);
    setDiagnosticResult(null);
    setIsSyncing((s) => ({ ...s, phoneburner_diagnose: true }));

    try {
      const data = await invokeSync("phoneburner-sync", {
        workspace_id: currentWorkspace.id,
        diagnostic: true,
      });

      setDiagnosticResult(data);
      if (data?.status === "ok") {
        setSuccess("PhoneBurner connection is healthy!");
      } else {
        setError(data?.message || "Diagnostic found issues");
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to run diagnostics");
    } finally {
      setIsSyncing((s) => ({ ...s, phoneburner_diagnose: false }));
    }
  };

  const handleNocoDBSync = async (action: "sync" | "fetch_transcripts" | "score" | "process_pending") => {
    if (!currentWorkspace) return;
    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, nocodb: true }));
    setSyncProgress(null);

    try {
      const token = await getAccessToken();
      const res = await supabase.functions.invoke("nocodb-sync", {
        body: {
          workspace_id: currentWorkspace.id,
          action,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw new Error(res.error.message || "Sync failed");

      const data = res.data;
      if (data.success) {
        const actionMessages: Record<string, string> = {
          sync: `NocoDB sync complete! Imported ${data.imported || 0} new calls.`,
          fetch_transcripts: `Transcripts fetched for ${data.processed || 0} calls.`,
          score: `Scored ${data.processed || 0} calls.`,
          process_pending: `Processed ${data.processed || 0} pending calls.`,
        };
        setSuccess(actionMessages[action] || "Operation complete!");
        
        // Refresh stats
        fetchNocoDBStats();
      }

      await fetchConnections();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to sync NocoDB");
    } finally {
      setIsSyncing((s) => ({ ...s, nocodb: false }));
    }
  };

  const fetchNocoDBStats = async () => {
    if (!currentWorkspace?.id) return;

    try {
      // Get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);
      if (engagementIds.length === 0) {
        setNocodbStats({ totalCalls: 0, pending: 0, transcriptFetched: 0, scored: 0, errors: 0 });
        return;
      }

      // Get call statistics from call_activities
      const { data: calls, count } = await supabase
        .from('call_activities')
        .select('id, disposition, transcription', { count: 'exact' })
        .in('engagement_id', engagementIds)
        .limit(1000);

      const totalCalls = count || 0;
      const callsList = calls || [];
      
      // Simple categorization
      const withTranscript = callsList.filter(c => c.transcription).length;
      const pending = callsList.filter(c => !c.transcription).length;

      setNocodbStats({
        totalCalls,
        pending,
        transcriptFetched: withTranscript,
        scored: withTranscript, // Approximate
        errors: 0,
      });
    } catch (e) {
      console.error('Error fetching NocoDB stats:', e);
    }
  };

  useEffect(() => {
    if (nocodbConnection && currentWorkspace?.id) {
      fetchNocoDBStats();
    }
  }, [nocodbConnection, currentWorkspace?.id]);

  const handleProcessBackground = async () => {
    if (!currentWorkspace || !hasPendingWork) return;
    
    setIsProcessingBackground(true);
    setError(null);
    
    try {
      const token = await getAccessToken();
      
      // Process in stages
      if (nocodbStats && nocodbStats.pending > 0) {
        toast({ title: "Fetching transcripts...", description: `Processing ${nocodbStats.pending} calls` });
        await supabase.functions.invoke("fetch-transcripts", {
          body: { workspace_id: currentWorkspace.id, batch_size: 50 },
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      
      if (nocodbStats && nocodbStats.transcriptFetched > 0) {
        toast({ title: "Scoring calls...", description: `Processing ${nocodbStats.transcriptFetched} calls` });
        await supabase.functions.invoke("score-external-calls", {
          body: { workspace_id: currentWorkspace.id, batch_size: 20 },
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      
      setSuccess("Background processing complete!");
      fetchNocoDBStats();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Background processing failed");
    } finally {
      setIsProcessingBackground(false);
    }
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return null;

  const renderSyncStatus = (source: DataSource | undefined) => {
    if (!source) return null;

    const status = source.last_sync_status;
    const isActive = source.status === 'active';

    return (
      <div className="flex items-center gap-2">
        {status === "syncing" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm text-muted-foreground">Syncing...</span>
          </>
        ) : status === "complete" || status === "success" ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">
              Last sync: {source.last_sync_at ? new Date(source.last_sync_at).toLocaleString() : 'Never'}
            </span>
          </>
        ) : status === "error" || status === "failed" ? (
          <>
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">Sync failed</span>
          </>
        ) : status === "stopped" ? (
          <>
            <Clock className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-yellow-600">Stopped</span>
          </>
        ) : (
          <>
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {isActive ? 'Ready to sync' : 'Not connected'}
            </span>
          </>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Plug className="h-6 w-6" />
            Connections
          </h1>
          <p className="text-muted-foreground">
            Connect your sales tools to import campaigns and calling data
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700 dark:text-green-300">{success}</AlertDescription>
          </Alert>
        )}

        {/* Data Coverage */}
        {currentWorkspace?.id && <DataCoverageIndicator workspaceId={currentWorkspace.id} />}

        {/* Connection Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* SmartLead */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Inbox className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">SmartLead</CardTitle>
                    <CardDescription>Email outreach campaigns</CardDescription>
                  </div>
                </div>
                {smartleadConnection && (
                  <Badge variant={smartleadConnection.status === 'active' ? "default" : "secondary"}>
                    {smartleadConnection.status === 'active' ? "Connected" : "Inactive"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderSyncStatus(smartleadConnection)}
              
              {!smartleadConnection ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="smartlead-key">API Key</Label>
                    <Input
                      id="smartlead-key"
                      type="password"
                      placeholder="Enter your SmartLead API key"
                      value={smartleadApiKey}
                      onChange={(e) => setSmartleadApiKey(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => handleConnect("smartlead")}
                    disabled={isConnecting.smartlead || !smartleadApiKey.trim()}
                  >
                    {isConnecting.smartlead ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...</>
                    ) : (
                      <><KeyRound className="h-4 w-4 mr-2" /> Connect</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleSyncSmartlead()}
                    disabled={isSyncing.smartlead}
                  >
                    {isSyncing.smartlead ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing...</>
                    ) : (
                      <><RefreshCw className="h-4 w-4 mr-2" /> Sync</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSyncSmartlead({ fullBackfill: true })}
                    disabled={isSyncing.smartlead}
                  >
                    <Download className="h-4 w-4 mr-2" /> Full Backfill
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reply.io */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <Inbox className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Reply.io</CardTitle>
                    <CardDescription>Email sequences & automation</CardDescription>
                  </div>
                </div>
                {replyioConnection && (
                  <Badge variant={replyioConnection.status === 'active' ? "default" : "secondary"}>
                    {replyioConnection.status === 'active' ? "Connected" : "Inactive"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderSyncStatus(replyioConnection)}
              
              {!replyioConnection ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="replyio-key">API Key</Label>
                    <Input
                      id="replyio-key"
                      type="password"
                      placeholder="Enter your Reply.io API key"
                      value={replyioApiKey}
                      onChange={(e) => setReplyioApiKey(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => handleConnect("replyio")}
                    disabled={isConnecting.replyio || !replyioApiKey.trim()}
                  >
                    {isConnecting.replyio ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...</>
                    ) : (
                      <><KeyRound className="h-4 w-4 mr-2" /> Connect</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleSyncReplyio()}
                    disabled={isSyncing.replyio}
                  >
                    {isSyncing.replyio ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing...</>
                    ) : (
                      <><RefreshCw className="h-4 w-4 mr-2" /> Sync</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PhoneBurner */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">PhoneBurner</CardTitle>
                    <CardDescription>Power dialer & call tracking</CardDescription>
                  </div>
                </div>
                {phoneburnerConnection && (
                  <Badge variant={phoneburnerConnection.status === 'active' ? "default" : "secondary"}>
                    {phoneburnerConnection.status === 'active' ? "Connected" : "Inactive"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderSyncStatus(phoneburnerConnection)}
              
              {!phoneburnerConnection ? (
                <div className="space-y-3">
                  <Button
                    className="w-full"
                    onClick={handlePhoneBurnerOAuth}
                    disabled={isConnecting.phoneburner_oauth}
                  >
                    {isConnecting.phoneburner_oauth ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...</>
                    ) : (
                      <><ExternalLink className="h-4 w-4 mr-2" /> Connect with OAuth</>
                    )}
                  </Button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowPATInput(!showPATInput)}
                  >
                    <KeyRound className="h-4 w-4 mr-2" /> Use Personal Access Token
                  </Button>
                  
                  {showPATInput && (
                    <div className="space-y-2">
                      <Input
                        type="password"
                        placeholder="Enter your PhoneBurner PAT"
                        value={phoneburnerToken}
                        onChange={(e) => setPhoneburnerToken(e.target.value)}
                      />
                      <Button
                        className="w-full"
                        onClick={() => handleConnect("phoneburner")}
                        disabled={isConnecting.phoneburner || !phoneburnerToken.trim()}
                      >
                        Connect
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleSyncPhoneburner()}
                      disabled={isSyncing.phoneburner}
                    >
                      {isSyncing.phoneburner ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-2" /> Sync</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDiagnosePhoneburner}
                      disabled={isSyncing.phoneburner_diagnose}
                    >
                      {isSyncing.phoneburner_diagnose ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {phoneburnerConnection.last_sync_status === "syncing" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={handleStopPhoneburnerSync}
                      disabled={isSyncing.phoneburner_stop}
                    >
                      Stop Sync
                    </Button>
                  )}
                </div>
              )}
              
              {diagnosticResult && (
                <div className="mt-4 p-3 rounded-lg bg-muted text-sm">
                  <pre className="whitespace-pre-wrap text-xs">
                    {JSON.stringify(diagnosticResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* NocoDB */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <Database className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">NocoDB</CardTitle>
                    <CardDescription>External call recordings</CardDescription>
                  </div>
                </div>
                {nocodbConnection && (
                  <Badge variant={nocodbConnection.status === 'active' ? "default" : "secondary"}>
                    {nocodbConnection.status === 'active' ? "Connected" : "Inactive"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderSyncStatus(nocodbConnection)}
              
              {!nocodbConnection ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="nocodb-token">API Token</Label>
                    <Input
                      id="nocodb-token"
                      type="password"
                      placeholder="Enter your NocoDB API token"
                      value={nocodbApiToken}
                      onChange={(e) => setNocodbApiToken(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => handleConnect("nocodb")}
                    disabled={isConnecting.nocodb || !nocodbApiToken.trim()}
                  >
                    {isConnecting.nocodb ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...</>
                    ) : (
                      <><KeyRound className="h-4 w-4 mr-2" /> Connect</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {nocodbStats && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 rounded bg-muted">
                        <div className="font-medium">{nocodbStats.totalCalls}</div>
                        <div className="text-xs text-muted-foreground">Total Calls</div>
                      </div>
                      <div className="p-2 rounded bg-muted">
                        <div className="font-medium">{nocodbStats.transcriptFetched}</div>
                        <div className="text-xs text-muted-foreground">Transcribed</div>
                      </div>
                    </div>
                  )}
                  
                  {syncProgress && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{syncProgress.phase}</span>
                        <span>{syncProgress.percent}%</span>
                      </div>
                      <Progress value={syncProgress.percent} />
                      <p className="text-xs text-muted-foreground">{syncProgress.message}</p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleNocoDBSync("sync")}
                      disabled={isSyncing.nocodb}
                    >
                      {isSyncing.nocodb ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-2" /> Sync</>
                      )}
                    </Button>
                  </div>
                  
                  {hasPendingWork && (
                    <Button
                      className="w-full"
                      onClick={handleProcessBackground}
                      disabled={isProcessingBackground}
                    >
                      {isProcessingBackground ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" /> Process Pending ({nocodbStats?.pending || 0})</>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}