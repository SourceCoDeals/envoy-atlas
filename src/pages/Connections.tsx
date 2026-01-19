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

type ApiConnection = {
  id: string;
  platform: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_full_sync_at: string | null;
  sync_status: string | null;
  sync_progress: SyncProgress;
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

  const [connections, setConnections] = useState<ApiConnection[]>([]);
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
    () => connections.find((c) => c.platform === "smartlead"),
    [connections]
  );
  const replyioConnection = useMemo(
    () => connections.find((c) => c.platform === "replyio"),
    [connections]
  );
  const phoneburnerConnection = useMemo(
    () => connections.find((c) => c.platform === "phoneburner"),
    [connections]
  );
  const nocodbConnection = useMemo(
    () => connections.find((c) => c.platform === "nocodb"),
    [connections]
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
      setConnections((data || []).map((d: any) => ({
        id: d.id,
        platform: d.source_type,
        is_active: d.status === 'active',
        last_sync_at: d.last_sync_at,
        last_full_sync_at: d.last_sync_at,
        sync_status: d.last_sync_status,
        sync_progress: 100,
        created_at: d.created_at,
      })));
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
    () => connections.some((c) => c.sync_status === "syncing"),
    [connections]
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
    }, 5000); // Increased from 2s to 5s to reduce load

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
      const { error } = await supabase.from("api_connections").upsert(
        {
          workspace_id: currentWorkspace.id,
          platform,
          api_key_encrypted: apiKey,
          is_active: true,
          sync_status: "pending",
          created_by: user.id,
        },
        { onConflict: "workspace_id,platform" }
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
        .from("api_connections")
        .update({ sync_status: "stopped" })
        .eq("workspace_id", currentWorkspace.id)
        .eq("platform", "phoneburner");

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
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to run diagnostics");
    } finally {
      setIsSyncing((s) => ({ ...s, phoneburner_diagnose: false }));
    }
  };

  const fetchNocodbStats = async () => {
    if (!currentWorkspace) return;
    
    try {
      const { data, error } = await supabase
        .from("external_calls")
        .select("import_status")
        .eq("workspace_id", currentWorkspace.id);
      
      if (error) throw error;
      
      const stats = {
        totalCalls: data?.length || 0,
        pending: data?.filter(c => c.import_status === "pending").length || 0,
        transcriptFetched: data?.filter(c => c.import_status === "transcript_fetched").length || 0,
        scored: data?.filter(c => c.import_status === "scored").length || 0,
        errors: data?.filter(c => c.import_status === "error").length || 0,
      };
      
      setNocodbStats(stats);
    } catch (e) {
      console.error("Error fetching NocoDB stats:", e);
    }
  };

  const handleRefreshStats = async () => {
    setIsSyncing((s) => ({ ...s, nocodb_stats: true }));
    await fetchNocodbStats();
    setIsSyncing((s) => ({ ...s, nocodb_stats: false }));
  };

  const handleNocoDBSync = async (action: "sync" | "full_sync") => {
    if (!currentWorkspace) return;

    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, nocodb: true }));
    setSyncProgress({ phase: "starting", current: 0, total: 0, percent: 0, message: "Starting sync..." });

    // Poll for progress updates while sync is running
    const pollInterval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("api_connections")
          .select("sync_progress, sync_status")
          .eq("workspace_id", currentWorkspace.id)
          .eq("platform", "nocodb")
          .single();
        
        if (data?.sync_progress && data.sync_status === "syncing") {
          const progress = data.sync_progress as any;
          setSyncProgress({
            phase: progress.phase || "syncing",
            current: progress.current || 0,
            total: progress.total || 0,
            percent: progress.percent || 0,
            message: progress.message || "Syncing...",
          });
        }
      } catch (e) {
        // Ignore polling errors
      }
    }, 1000);

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
        const stats = data.stats;
        setSyncProgress({ phase: "complete", current: stats.inserted, total: stats.fetched, percent: 100, message: "Complete!" });
        
        const syncMessage = action === "full_sync"
          ? `Full sync complete! Synced ${stats.inserted} calls, created ${stats.leads_created} contacts.`
          : `Sync complete! Synced ${stats.inserted} calls, created ${stats.leads_created} contacts.`;
        
        setSuccess(syncMessage);
        
        // Show toast notification
        toast({
          title: "✅ NocoDB Sync Complete",
          description: `Imported ${stats.inserted} of ${stats.fetched} records${stats.errors > 0 ? ` (${stats.errors} errors)` : ""}. Created ${stats.leads_created} contacts.`,
          duration: 6000,
        });
      } else {
        throw new Error(data.error || "Sync failed");
      }

      await fetchConnections();
      await fetchNocodbStats();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to sync NocoDB");
      setSyncProgress(null);
      
      toast({
        title: "❌ Sync Failed",
        description: e?.message || "Failed to sync NocoDB",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      clearInterval(pollInterval);
      setIsSyncing((s) => ({ ...s, nocodb: false }));
      // Clear progress after a short delay
      setTimeout(() => setSyncProgress(null), 3000);
    }
  };

  const handleFetchTranscripts = async () => {
    if (!currentWorkspace) return;

    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, transcripts: true }));

    try {
      const token = await getAccessToken();
      const res = await supabase.functions.invoke("fetch-transcripts", {
        body: {
          workspace_id: currentWorkspace.id,
          limit: 20,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw new Error(res.error.message || "Fetch failed");

      const data = res.data;
      setSuccess(`Processed ${data.processed} transcripts (${data.errors} errors).`);
      await fetchNocodbStats();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to fetch transcripts");
    } finally {
      setIsSyncing((s) => ({ ...s, transcripts: false }));
    }
  };

  const handleScoreExternalCalls = async () => {
    if (!currentWorkspace) return;

    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, scoring: true }));

    try {
      const token = await getAccessToken();
      const res = await supabase.functions.invoke("score-external-calls", {
        body: {
          workspace_id: currentWorkspace.id,
          limit: 10,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw new Error(res.error.message || "Scoring failed");

      const data = res.data;
      setSuccess(`Scored ${data.scored} calls (${data.errors} errors).`);
      await fetchNocodbStats();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to score calls");
    } finally {
      setIsSyncing((s) => ({ ...s, scoring: false }));
    }
  };

  // Background processing for transcripts and scoring
  const startBackgroundProcessing = async () => {
    if (!currentWorkspace || isProcessingBackground) return;
    
    setIsProcessingBackground(true);
    console.log("[Background] Starting background processing...");
    
    const processLoop = async () => {
      try {
        const token = await getAccessToken();
        let hasMoreWork = true;
        
        while (hasMoreWork) {
          await fetchNocodbStats();
          
          const { data: pendingCalls } = await supabase
            .from("external_calls")
            .select("id")
            .eq("workspace_id", currentWorkspace.id)
            .eq("import_status", "pending")
            .not("fireflies_url", "is", null)
            .limit(1);
          
          if (pendingCalls && pendingCalls.length > 0) {
            console.log("[Background] Fetching transcripts...");
            await supabase.functions.invoke("fetch-transcripts", {
              body: { workspace_id: currentWorkspace.id, limit: 10 },
              headers: { Authorization: `Bearer ${token}` },
            });
            continue;
          }
          
          const { data: unscoredCalls } = await supabase
            .from("external_calls")
            .select("id")
            .eq("workspace_id", currentWorkspace.id)
            .eq("import_status", "transcript_fetched")
            .limit(1);
          
          if (unscoredCalls && unscoredCalls.length > 0) {
            console.log("[Background] Scoring calls...");
            await supabase.functions.invoke("score-external-calls", {
              body: { workspace_id: currentWorkspace.id, limit: 5 },
              headers: { Authorization: `Bearer ${token}` },
            });
            continue;
          }
          
          hasMoreWork = false;
        }
        
        console.log("[Background] Processing complete");
        await fetchNocodbStats();
      } catch (e) {
        console.error("[Background] Error:", e);
      } finally {
        setIsProcessingBackground(false);
      }
    };
    
    processLoop();
  };

  // Fetch NocoDB stats on mount and auto-refresh during background processing
  useEffect(() => {
    if (currentWorkspace?.id && channel === "calling") {
      fetchNocodbStats();
    }
  }, [currentWorkspace?.id, channel]);

  // Auto-refresh stats while background processing is active
  useEffect(() => {
    if (!isProcessingBackground || !currentWorkspace?.id) return;
    
    const interval = setInterval(() => {
      fetchNocodbStats();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isProcessingBackground, currentWorkspace?.id]);

  const phoneburnerProgress = (phoneburnerConnection?.sync_progress as any) || null;
  const pbPhase = phoneburnerProgress?.phase;
  const pbCalls = phoneburnerProgress?.calls_synced || 0;
  const pbContacts = phoneburnerProgress?.contacts_synced || 0;
  const pbSessions = phoneburnerProgress?.sessions_synced || 0;

  const pbProgressPercent = useMemo(() => {
    if (!phoneburnerConnection || phoneburnerConnection.sync_status !== "syncing") return 0;
    if (!pbPhase) return 5;
    if (pbPhase === "dialsessions") return 35;
    if (pbPhase === "contacts") return 65;
    if (pbPhase === "metrics") return 85;
    if (pbPhase === "linking") return 95;
    return 10;
  }, [phoneburnerConnection, pbPhase]);

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
          <h1 className="text-2xl font-bold tracking-tight">{channel === "email" ? "Email Connections" : "Calling Connections"}</h1>
          <p className="text-muted-foreground">
            {channel === "email"
              ? "Connect your email outreach platforms to import campaign data"
              : "Connect your cold calling platforms to import dial session data"}
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
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading connections...
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {channel === "email" && (
              <>
                {/* Smartlead */}
                <Card className={smartleadConnection ? "border-success/30" : ""}>
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
                          Connected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!smartleadConnection ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="smartlead-key">API Key</Label>
                          <Input
                            id="smartlead-key"
                            value={smartleadApiKey}
                            onChange={(e) => setSmartleadApiKey(e.target.value)}
                            placeholder="Paste Smartlead API key"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button onClick={() => handleConnect("smartlead")} disabled={!!isConnecting.smartlead} className="flex-1">
                            {isConnecting.smartlead ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              "Connect Smartlead"
                            )}
                          </Button>
                        </div>
                      </>
                    ) : smartleadConnection.sync_status === "syncing" ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm font-medium">Syncing...</span>
                        </div>
                        {(smartleadConnection.sync_progress as any)?.historical_days && (
                          <div className="text-xs text-muted-foreground">
                            Historical days: {(smartleadConnection.sync_progress as any).historical_days}
                          </div>
                        )}
                        {(smartleadConnection.sync_progress as any)?.campaign_index !== undefined && (
                          <div className="space-y-1">
                            <Progress
                              value={
                                ((smartleadConnection.sync_progress as any).campaign_index /
                                  ((smartleadConnection.sync_progress as any).total_campaigns || 1)) *
                                100
                              }
                            />
                            <div className="text-xs text-muted-foreground">
                              {(smartleadConnection.sync_progress as any).campaign_index} /{" "}
                              {(smartleadConnection.sync_progress as any).total_campaigns} campaigns
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className="capitalize">{smartleadConnection.sync_status || "active"}</span>
                          </div>
                          {smartleadConnection.last_sync_at && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Last Sync</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(smartleadConnection.last_sync_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {smartleadConnection.last_full_sync_at && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Last Full Sync</span>
                              <span className="flex items-center gap-1">
                                <Download className="h-3 w-3" />
                                {new Date(smartleadConnection.last_full_sync_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSyncSmartlead()}
                            disabled={!!isSyncing.smartlead}
                          >
                            {isSyncing.smartlead ? (
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-3 w-3" />
                            )}
                            Sync
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSyncSmartlead({ fullBackfill: true })}
                            disabled={!!isSyncing.smartlead}
                            title="Fetch ALL historical data (up to 2 years)"
                          >
                            {isSyncing.smartlead ? (
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            ) : (
                              <Database className="mr-2 h-3 w-3" />
                            )}
                            Full Backfill
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSyncSmartleadReplies()}
                            disabled={!!isSyncing.smartlead_replies}
                            title="Fetch inbox replies and message events"
                          >
                            {isSyncing.smartlead_replies ? (
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            ) : (
                              <Inbox className="mr-2 h-3 w-3" />
                            )}
                            Sync Inbox
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSyncSmartlead({ reset: true })}
                            disabled={!!isSyncing.smartlead}
                          >
                            Reset & Sync
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Reply.io */}
                <Card className={replyioConnection ? "border-success/30" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                          <Plug className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Reply.io</CardTitle>
                          <CardDescription>Email sequences & engagement</CardDescription>
                        </div>
                      </div>
                      {replyioConnection && (
                        <Badge variant="outline" className="border-success text-success">
                          Connected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!replyioConnection ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="replyio-key">API Key</Label>
                          <Input
                            id="replyio-key"
                            value={replyioApiKey}
                            onChange={(e) => setReplyioApiKey(e.target.value)}
                            placeholder="Paste Reply.io API key"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button onClick={() => handleConnect("replyio")} disabled={!!isConnecting.replyio} className="flex-1">
                            {isConnecting.replyio ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              "Connect Reply.io"
                            )}
                          </Button>
                          <Button variant="link" size="sm" asChild>
                            <a href="https://app.reply.io/settings/apikey" target="_blank" rel="noopener noreferrer">
                              Get API Key
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      </>
                    ) : replyioConnection.sync_status === "syncing" ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm font-medium">Syncing...</span>
                        </div>
                        {(replyioConnection.sync_progress as any)?.sequences_synced !== undefined && (
                          <div className="space-y-1">
                            <Progress
                              value={
                                ((replyioConnection.sync_progress as any).sequences_synced /
                                  ((replyioConnection.sync_progress as any).total_sequences || 100)) *
                                100
                              }
                            />
                            <div className="text-xs text-muted-foreground">
                              {(replyioConnection.sync_progress as any).sequences_synced} /{" "}
                              {(replyioConnection.sync_progress as any).total_sequences || "?"} sequences
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className="capitalize">{replyioConnection.sync_status || "active"}</span>
                          </div>
                          {replyioConnection.last_sync_at && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Last Sync</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(replyioConnection.last_sync_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {replyioConnection.last_full_sync_at && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Last Full Sync</span>
                              <span className="flex items-center gap-1">
                                <Download className="h-3 w-3" />
                                {new Date(replyioConnection.last_full_sync_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSyncReplyio()}
                            disabled={!!isSyncing.replyio}
                          >
                            {isSyncing.replyio ? (
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-3 w-3" />
                            )}
                            Sync
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSyncReplyio({ fullBackfill: true })}
                            disabled={!!isSyncing.replyio}
                            title="Fetch ALL sequences and historical data"
                          >
                            {isSyncing.replyio ? (
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            ) : (
                              <Database className="mr-2 h-3 w-3" />
                            )}
                            Full Backfill
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSyncReplyio({ reset: true })}
                            disabled={!!isSyncing.replyio}
                          >
                            Reset & Sync
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Data Coverage Indicator */}
                {currentWorkspace && (smartleadConnection || replyioConnection) && (
                  <DataCoverageIndicator workspaceId={currentWorkspace.id} />
                )}
              </>
            )}

            {channel === "calling" && (
              <>
                {/* PhoneBurner */}
                <Card className={phoneburnerConnection ? "border-success/30" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                          <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">PhoneBurner</CardTitle>
                          <CardDescription>Power dialer & call tracking</CardDescription>
                        </div>
                      </div>
                      {phoneburnerConnection && (
                        <Badge variant="outline" className="border-success text-success">
                          Connected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!phoneburnerConnection ? (
                      <>
                        <Button
                          onClick={handlePhoneBurnerOAuth}
                          disabled={!!isConnecting.phoneburner_oauth}
                          className="w-full"
                        >
                          {isConnecting.phoneburner_oauth ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Connect with PhoneBurner
                            </>
                          )}
                        </Button>

                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">or</span>
                          </div>
                        </div>

                        {showPATInput ? (
                          <div className="space-y-2">
                            <Label htmlFor="pb-token">Personal Access Token</Label>
                            <Input
                              id="pb-token"
                              value={phoneburnerToken}
                              onChange={(e) => setPhoneburnerToken(e.target.value)}
                              placeholder="Paste PhoneBurner PAT"
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleConnect("phoneburner")}
                                disabled={!!isConnecting.phoneburner}
                                variant="outline"
                                className="flex-1"
                              >
                                {isConnecting.phoneburner ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Connecting...
                                  </>
                                ) : (
                                  "Connect with PAT"
                                )}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setShowPATInput(false)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground"
                            onClick={() => setShowPATInput(true)}
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            Use Personal Access Token instead
                          </Button>
                        )}
                      </>
                    ) : phoneburnerConnection.sync_status === "auth_expired" ? (
                      <>
                        <Alert variant="destructive" className="mb-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            PhoneBurner authorization has expired. Please reconnect.
                          </AlertDescription>
                        </Alert>
                        <Button
                          onClick={handlePhoneBurnerOAuth}
                          disabled={!!isConnecting.phoneburner_oauth}
                          className="w-full"
                        >
                          {isConnecting.phoneburner_oauth ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Reconnecting...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Reconnect PhoneBurner
                            </>
                          )}
                        </Button>
                      </>
                    ) : phoneburnerConnection.sync_status === "syncing" ? (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize font-medium">
                              {pbPhase === "dialsessions"
                                ? "Syncing dial sessions..."
                                : pbPhase === "contacts"
                                  ? "Syncing contacts..."
                                  : pbPhase === "metrics"
                                    ? "Calculating metrics..."
                                    : pbPhase === "linking"
                                      ? "Linking contacts..."
                                      : "Starting sync..."}
                            </span>
                            <span className="text-muted-foreground">{pbProgressPercent}%</span>
                          </div>
                          <Progress value={pbProgressPercent} />
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>{pbSessions} sessions</span>
                            <span>{pbContacts} contacts</span>
                            <span>{pbCalls} calls</span>
                          </div>
                        </div>

                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={handleStopPhoneburnerSync}
                          disabled={!!isSyncing.phoneburner_stop}
                        >
                          {isSyncing.phoneburner_stop ? (
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
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className="capitalize">{phoneburnerConnection.sync_status || "active"}</span>
                          </div>
                          {phoneburnerConnection.last_sync_at && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Last Sync</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(phoneburnerConnection.last_sync_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {phoneburnerProgress && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Records</span>
                              <span className="text-xs">
                                {pbSessions} sessions, {pbContacts} contacts, {pbCalls} calls
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleSyncPhoneburner(false)}
                            disabled={!!isSyncing.phoneburner}
                          >
                            {isSyncing.phoneburner ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Sync
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSyncPhoneburner(true)}
                            disabled={!!isSyncing.phoneburner}
                          >
                            Full Reset
                          </Button>
                        </div>

                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handlePhoneBurnerOAuth}
                          disabled={!!isConnecting.phoneburner_oauth}
                        >
                          {isConnecting.phoneburner_oauth ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Authorizing...
                            </>
                          ) : (
                            <>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Authorize for Individual Calls
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          OAuth authorization enables individual call records & recordings
                        </p>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground"
                          onClick={handleDiagnosePhoneburner}
                          disabled={!!isSyncing.phoneburner_diagnose}
                        >
                          {isSyncing.phoneburner_diagnose ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Running Diagnostics...
                            </>
                          ) : (
                            <>
                              <AlertCircle className="mr-2 h-4 w-4" />
                              Run Diagnostics
                            </>
                          )}
                        </Button>

                        {diagnosticResult && (
                          <div className="mt-2 space-y-2 rounded-lg bg-accent/30 p-3 text-xs">
                            <p className="font-semibold">Diagnostic Results:</p>
                            {diagnosticResult.tests?.members && (
                              <div className="flex justify-between">
                                <span>Members:</span>
                                <span className={diagnosticResult.tests.members.success ? "text-green-500" : "text-red-500"}>
                                  {diagnosticResult.tests.members.success ? `${diagnosticResult.tests.members.count} found` : "Failed"}
                                </span>
                              </div>
                            )}
                            {diagnosticResult.tests?.contacts && (
                              <div className="flex justify-between">
                                <span>Contacts:</span>
                                <span className={diagnosticResult.tests.contacts.success ? "text-green-500" : "text-red-500"}>
                                  {diagnosticResult.tests.contacts.success ? `${diagnosticResult.tests.contacts.total_contacts} total` : "Failed"}
                                </span>
                              </div>
                            )}
                            {diagnosticResult.tests?.dial_sessions && (
                              <div className="flex justify-between">
                                <span>Dial Sessions:</span>
                                <span className={diagnosticResult.tests.dial_sessions.success ? "text-green-500" : "text-red-500"}>
                                  {diagnosticResult.tests.dial_sessions.success
                                    ? `${diagnosticResult.tests.dial_sessions.total_results} found`
                                    : "Failed"}
                                </span>
                              </div>
                            )}
                            {diagnosticResult.recommendation && (
                              <p className="mt-2 text-muted-foreground italic">{diagnosticResult.recommendation}</p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* NocoDB Connection */}
                <Card className={nocodbConnection ? "border-success/30" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                          <Database className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">NocoDB</CardTitle>
                          <CardDescription>Call data from Fireflies.ai</CardDescription>
                        </div>
                      </div>
                      {nocodbConnection && (
                        <Badge variant="outline" className="border-success text-success">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Connected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!nocodbConnection ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="nocodb-token">API Token</Label>
                          <Input
                            id="nocodb-token"
                            type="password"
                            value={nocodbApiToken}
                            onChange={(e) => setNocodbApiToken(e.target.value)}
                            placeholder="Paste NocoDB API Token"
                          />
                          <p className="text-xs text-muted-foreground">
                            Get your API token from NocoDB Settings → API Tokens
                          </p>
                        </div>
                        <Button
                          onClick={() => handleConnect("nocodb")}
                          disabled={!!isConnecting.nocodb}
                          className="w-full"
                        >
                          {isConnecting.nocodb ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <Database className="mr-2 h-4 w-4" />
                              Connect NocoDB
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        {/* Status and Last Sync */}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className="capitalize">{nocodbConnection.sync_status || "active"}</span>
                          </div>
                          {nocodbConnection.last_sync_at && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Last Sync</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(nocodbConnection.last_sync_at).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Stats Display */}
                        {nocodbStats && (
                          <div className="space-y-2 rounded-lg bg-accent/20 p-3 text-sm">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium">Processing Status</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleRefreshStats}
                                disabled={!!isSyncing.nocodb_stats}
                              >
                                {isSyncing.nocodb_stats ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-amber-500" />
                                <span className="text-muted-foreground">Pending:</span>
                                <span className="font-medium">{nocodbStats.pending}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                <span className="text-muted-foreground">Transcripts:</span>
                                <span className="font-medium">{nocodbStats.transcriptFetched}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                <span className="text-muted-foreground">Scored:</span>
                                <span className="font-medium">{nocodbStats.scored}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-red-500" />
                                <span className="text-muted-foreground">Errors:</span>
                                <span className="font-medium">{nocodbStats.errors}</span>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Total Calls:</span>
                                <span className="font-medium text-foreground">{nocodbStats.totalCalls}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Progress Bar during Sync */}
                        {syncProgress && isSyncing.nocodb && (
                          <div className="space-y-2 rounded-lg bg-primary/5 border border-primary/20 p-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-primary">{syncProgress.message}</span>
                              <span className="text-muted-foreground">{syncProgress.percent}%</span>
                            </div>
                            <Progress value={syncProgress.percent} className="h-2" />
                            {syncProgress.total > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {syncProgress.current} / {syncProgress.total} records
                              </p>
                            )}
                          </div>
                        )}

                        {/* Sync Buttons */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleNocoDBSync("sync")}
                            disabled={!!isSyncing.nocodb}
                          >
                            {isSyncing.nocodb ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Sync Now
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleNocoDBSync("full_sync")}
                            disabled={!!isSyncing.nocodb}
                          >
                            Full Re-sync
                          </Button>
                        </div>

                        {/* Process Pending Button */}
                        {hasPendingWork && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={startBackgroundProcessing}
                            disabled={isProcessingBackground}
                          >
                            {isProcessingBackground ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing... ({nocodbStats?.pending || 0} pending, {nocodbStats?.transcriptFetched || 0} to score)
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Process {(nocodbStats?.pending || 0) + (nocodbStats?.transcriptFetched || 0)} Pending
                              </>
                            )}
                          </Button>
                        )}

                        <p className="text-xs text-muted-foreground text-center">
                          {isProcessingBackground 
                            ? "Background processing in progress. Stats refresh every 5s." 
                            : "Sync to fetch latest data from NocoDB."}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
