import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useChannel } from "@/hooks/useChannel";

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
  FileText,
  KeyRound,
  Loader2,
  Phone,
  Plug,
  RefreshCw,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react";

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

  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const [smartleadApiKey, setSmartleadApiKey] = useState("");
  const [replyioApiKey, setReplyioApiKey] = useState("");
  const [phoneburnerToken, setPhoneburnerToken] = useState("");

  const [isConnecting, setIsConnecting] = useState<{ [k: string]: boolean }>({});
  const [isSyncing, setIsSyncing] = useState<{ [k: string]: boolean }>({});

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [showPATInput, setShowPATInput] = useState(false);
  
  // NocoDB sync stats
  const [nocodbStats, setNocodbStats] = useState<{
    totalCalls: number;
    pending: number;
    transcriptFetched: number;
    scored: number;
    errors: number;
  } | null>(null);

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

  const fetchConnections = async () => {
    if (!currentWorkspace) return;

    try {
      setLoading(true);
      // Only select non-sensitive columns - api_key_encrypted is intentionally excluded
      // for security. Edge functions access keys directly using service role.
      const { data, error } = await supabase
        .from("api_connections")
        .select("id, platform, is_active, last_sync_at, last_full_sync_at, sync_status, sync_progress, created_at")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setConnections((data as any) ?? []);
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
      // Clear the query params
      setSearchParams({}, { replace: true });
      // Refresh connections
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (currentWorkspace?.id) void fetchConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.id]);

  // light polling when any sync is running
  useEffect(() => {
    const anySyncing = connections.some((c) => c.sync_status === "syncing");
    if (!anySyncing) return;

    const t = window.setInterval(() => {
      void fetchConnections();
    }, 2000);

    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections.map((c) => c.sync_status).join("|")]);

  const handleConnect = async (platform: "smartlead" | "replyio" | "phoneburner") => {
    if (!currentWorkspace || !user) return;

    const apiKey =
      platform === "smartlead"
        ? smartleadApiKey.trim()
        : platform === "replyio"
          ? replyioApiKey.trim()
          : phoneburnerToken.trim();

    if (!apiKey) {
      setError(platform === "phoneburner" ? "Please enter a PhoneBurner access token" : "Please enter an API key");
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

      setSuccess(`${platform === "phoneburner" ? "PhoneBurner" : platform === "replyio" ? "Reply.io" : "Smartlead"} connected successfully!`);
      if (platform === "smartlead") setSmartleadApiKey("");
      if (platform === "replyio") setReplyioApiKey("");
      if (platform === "phoneburner") setPhoneburnerToken("");

      await fetchConnections();
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

      // Store state in sessionStorage for verification on callback
      sessionStorage.setItem("phoneburner_oauth_state", state);

      // PhoneBurner blocks being embedded in iframes (X-Frame-Options/CSP).
      // Open OAuth in a new tab/window.
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
    setIsSyncing((s) => ({ ...s, nocodb: true }));
    await fetchNocodbStats();
    setIsSyncing((s) => ({ ...s, nocodb: false }));
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

  // Handle JSON file upload for external calls - auto-processes everything
  const handleJsonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentWorkspace) return;

    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, upload: true }));

    try {
      const token = await getAccessToken();
      
      // Step 1: Import JSON
      setSuccess("Step 1/3: Importing calls...");
      console.log("[JSON Upload] Reading file:", file.name);
      const text = await file.text();
      const calls = JSON.parse(text);

      if (!Array.isArray(calls)) {
        throw new Error("Invalid JSON: expected an array of calls");
      }

      console.log("[JSON Upload] Parsed", calls.length, "calls, uploading...");
      const importRes = await supabase.functions.invoke("import-json-calls", {
        body: {
          calls,
          workspaceId: currentWorkspace.id,
          clearExisting: false,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (importRes.error) throw new Error(importRes.error.message || "Import failed");
      if (!importRes.data.success) throw new Error(importRes.data.error || "Import returned unsuccessful");
      
      const imported = importRes.data;
      console.log("[JSON Upload] Imported:", imported);

      // Step 2: Fetch transcripts for any pending calls
      setSuccess(`Step 2/3: Fetching transcripts... (imported ${imported.inserted} calls)`);
      let transcriptsFetched = 0;
      let transcriptLoops = 0;
      const maxTranscriptLoops = 10; // Process up to 200 calls (20 per batch)
      
      while (transcriptLoops < maxTranscriptLoops) {
        const transcriptRes = await supabase.functions.invoke("fetch-transcripts", {
          body: { workspace_id: currentWorkspace.id, limit: 20 },
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (transcriptRes.error) {
          console.error("[JSON Upload] Transcript fetch error:", transcriptRes.error);
          break;
        }
        
        const processed = transcriptRes.data?.processed || 0;
        transcriptsFetched += processed;
        console.log(`[JSON Upload] Transcript batch: ${processed} processed, total: ${transcriptsFetched}`);
        
        if (processed === 0) break; // No more to process
        transcriptLoops++;
        
        setSuccess(`Step 2/3: Fetching transcripts... (${transcriptsFetched} fetched)`);
      }

      // Step 3: Score all calls with transcripts
      setSuccess(`Step 3/3: AI scoring calls... (${transcriptsFetched} transcripts)`);
      let callsScored = 0;
      let scoreLoops = 0;
      const maxScoreLoops = 20; // Process up to 100 calls (5 per batch)
      
      while (scoreLoops < maxScoreLoops) {
        const scoreRes = await supabase.functions.invoke("score-external-calls", {
          body: { workspace_id: currentWorkspace.id, limit: 5 },
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (scoreRes.error) {
          console.error("[JSON Upload] Scoring error:", scoreRes.error);
          break;
        }
        
        const scored = scoreRes.data?.scored || 0;
        callsScored += scored;
        console.log(`[JSON Upload] Score batch: ${scored} scored, total: ${callsScored}`);
        
        if (scored === 0) break; // No more to score
        scoreLoops++;
        
        setSuccess(`Step 3/3: AI scoring calls... (${callsScored} scored)`);
      }

      setSuccess(`✓ Complete! Imported ${imported.inserted} calls, fetched ${transcriptsFetched} transcripts, scored ${callsScored} calls`);
      await fetchNocodbStats();
    } catch (e: any) {
      console.error("[JSON Upload] Error:", e);
      setError(e?.message || "Failed to process JSON file");
    } finally {
      setIsSyncing((s) => ({ ...s, upload: false }));
      event.target.value = "";
    }
  };

  // Fetch NocoDB stats on mount
  useEffect(() => {
    if (currentWorkspace?.id && channel === "calling") {
      fetchNocodbStats();
    }
  }, [currentWorkspace?.id, channel]);

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
                    ) : (
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
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Status</span>
                          <span className="capitalize">{replyioConnection.sync_status || "active"}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
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
                        {/* Primary: OAuth Connection */}
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

                        {/* Secondary: PAT for developers */}
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
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Reconnect PhoneBurner
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
                        </div>

                        {(phoneburnerConnection.sync_status === "syncing" || isSyncing.phoneburner) && (
                          <div className="space-y-2 rounded-lg bg-accent/20 p-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Dial Sessions</span>
                              <span className="font-medium">{Number(pbSessions).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Contacts</span>
                              <span className="font-medium">{Number(pbContacts).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Calls</span>
                              <span className="font-medium">{Number(pbCalls).toLocaleString()}</span>
                            </div>
                            <Progress value={pbProgressPercent} className="h-2" />
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {pbPhase ? `Phase: ${pbPhase}` : "Starting..."}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          {phoneburnerConnection.sync_status === "syncing" ? (
                            <Button
                              variant="outline"
                              className="flex-1 text-destructive hover:text-destructive"
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
                                  Stop
                                </>
                              )}
                            </Button>
                          ) : (
                            <>
                              <Button variant="outline" className="flex-1" onClick={() => handleSyncPhoneburner(false)} disabled={!!isSyncing.phoneburner}>
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
                              <Button variant="outline" className="flex-1" onClick={() => handleSyncPhoneburner(true)} disabled={!!isSyncing.phoneburner}>
                                Reset & Sync
                              </Button>
                            </>
                          )}
                        </div>

                        {/* Upgrade to OAuth for individual call records */}
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
                            {diagnosticResult.tests?.contact_activities && (
                              <div className="flex flex-col gap-1">
                                <div className="flex justify-between">
                                  <span>Contact Activities:</span>
                                  <span className={diagnosticResult.tests.contact_activities.success ? "text-green-500" : "text-red-500"}>
                                    {diagnosticResult.tests.contact_activities.success
                                      ? `${diagnosticResult.tests.contact_activities.total_results} total`
                                      : diagnosticResult.tests.contact_activities.error || "Failed"}
                                  </span>
                                </div>
                                {diagnosticResult.tests.contact_activities.call_activities_found !== undefined && (
                                  <div className="flex justify-between pl-2 text-muted-foreground">
                                    <span>└ Call activities:</span>
                                    <span>{diagnosticResult.tests.contact_activities.call_activities_found}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            {diagnosticResult.tests?.contact_auditlog && (
                              <div className="flex flex-col gap-1">
                                <div className="flex justify-between">
                                  <span>Contact Audit Log:</span>
                                  <span className={diagnosticResult.tests.contact_auditlog.success ? "text-green-500" : "text-red-500"}>
                                    {diagnosticResult.tests.contact_auditlog.success
                                      ? `${diagnosticResult.tests.contact_auditlog.entries_on_page} entries`
                                      : diagnosticResult.tests.contact_auditlog.error || "Failed"}
                                  </span>
                                </div>
                              </div>
                            )}
                            {diagnosticResult.tests?.dial_sessions_no_date_filter && (
                              <div className="flex justify-between">
                                <span>Dial Sessions (no filter):</span>
                                <span className={diagnosticResult.tests.dial_sessions_no_date_filter.success ? "text-green-500" : "text-red-500"}>
                                  {diagnosticResult.tests.dial_sessions_no_date_filter.success
                                    ? `${diagnosticResult.tests.dial_sessions_no_date_filter.total_results} found`
                                    : diagnosticResult.tests.dial_sessions_no_date_filter.error || "Failed"}
                                </span>
                              </div>
                            )}
                            {diagnosticResult.tests?.members_entire_team && (
                              <div className="flex justify-between">
                                <span>Entire Team Members:</span>
                                <span className={diagnosticResult.tests.members_entire_team.success ? "text-green-500" : "text-red-500"}>
                                  {diagnosticResult.tests.members_entire_team.success
                                    ? `${diagnosticResult.tests.members_entire_team.count} found`
                                    : diagnosticResult.tests.members_entire_team.error || "Failed"}
                                </span>
                              </div>
                            )}
                            {diagnosticResult.tests?.voicemails && (
                              <div className="flex justify-between">
                                <span>Voicemails:</span>
                                <span className={diagnosticResult.tests.voicemails.success ? "text-green-500" : "text-red-500"}>
                                  {diagnosticResult.tests.voicemails.success
                                    ? `${diagnosticResult.tests.voicemails.total_results} found`
                                    : diagnosticResult.tests.voicemails.error || "Failed"}
                                </span>
                              </div>
                            )}
                            {diagnosticResult.tests?.dialsession_settings && (
                              <div className="flex justify-between">
                                <span>Dialsession Settings:</span>
                                <span className={diagnosticResult.tests.dialsession_settings.success ? "text-green-500" : "text-red-500"}>
                                  {diagnosticResult.tests.dialsession_settings.success ? "Retrieved" : diagnosticResult.tests.dialsession_settings.error || "Failed"}
                                </span>
                              </div>
                            )}
                            {diagnosticResult.tests?.usage && (
                              <div className="flex flex-col gap-1">
                                <div className="flex justify-between">
                                  <span>Usage (90 days):</span>
                                  <span className={diagnosticResult.tests.usage.success ? "text-green-500" : "text-red-500"}>
                                    {diagnosticResult.tests.usage.success
                                      ? `${diagnosticResult.tests.usage.total_calls} calls`
                                      : "Failed"}
                                  </span>
                                </div>
                                {diagnosticResult.tests.usage.member_breakdown && (
                                  <div className="pl-2 text-muted-foreground space-y-0.5">
                                    {diagnosticResult.tests.usage.member_breakdown.map((m: any, i: number) => (
                                      <div key={i} className="flex justify-between">
                                        <span>└ {m.name}:</span>
                                        <span>{m.total_calls} calls</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
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

                {/* External Calls / Fireflies Integration */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                          <Database className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">External Calls (Test Data)</CardTitle>
                          <CardDescription>Fireflies call recordings for AI Summary</CardDescription>
                        </div>
                      </div>
                      {nocodbStats && nocodbStats.totalCalls > 0 && (
                        <Badge variant="outline" className="border-green-500 text-green-500">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {nocodbStats.totalCalls} calls loaded
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stats Display */}
                    {nocodbStats && nocodbStats.totalCalls > 0 ? (
                      <>
                        <div className="space-y-2 rounded-lg bg-accent/20 p-3 text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium">Processing Status</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleRefreshStats}
                              disabled={!!isSyncing.nocodb}
                            >
                              {isSyncing.nocodb ? (
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
                        </div>

                        {/* Processing Actions */}
                        {nocodbStats.pending > 0 && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleFetchTranscripts}
                            disabled={!!isSyncing.transcripts}
                          >
                            {isSyncing.transcripts ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Fetching Transcripts...
                              </>
                            ) : (
                              <>
                                <FileText className="mr-2 h-4 w-4" />
                                Fetch Transcripts ({nocodbStats.pending} pending)
                              </>
                            )}
                          </Button>
                        )}

                        {nocodbStats.transcriptFetched > 0 && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleScoreExternalCalls}
                            disabled={!!isSyncing.scoring}
                          >
                            {isSyncing.scoring ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Scoring...
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                AI Score Calls ({nocodbStats.transcriptFetched} ready)
                              </>
                            )}
                          </Button>
                        )}

                        <p className="text-xs text-muted-foreground text-center">
                          Process transcripts → AI Score → View in AI Summary
                        </p>
                        
                        {/* JSON Upload */}
                        <div className="pt-2 border-t">
                          <Label htmlFor="json-upload" className="text-xs text-muted-foreground">
                            Upload JSON file to add more calls:
                          </Label>
                          <div className="mt-1">
                            <input
                              type="file"
                              id="json-upload"
                              accept=".json"
                              onChange={handleJsonUpload}
                              disabled={!!isSyncing.upload}
                              className="hidden"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => document.getElementById('json-upload')?.click()}
                              disabled={!!isSyncing.upload}
                            >
                              {isSyncing.upload ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Importing...
                                </>
                              ) : (
                                <>
                                  <Upload className="mr-2 h-4 w-4" />
                                  Upload JSON
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No data loaded</p>
                        <p className="text-xs mt-1">Upload a JSON file to import calls</p>
                        <div className="mt-3">
                          <input
                            type="file"
                            id="json-upload-empty"
                            accept=".json"
                            onChange={handleJsonUpload}
                            disabled={!!isSyncing.upload}
                            className="hidden"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById('json-upload-empty')?.click()}
                            disabled={!!isSyncing.upload}
                          >
                            {isSyncing.upload ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Importing...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload JSON
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
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
