import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useChannel } from "@/hooks/useChannel";
import { useToast } from "@/hooks/use-toast";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  Mail,
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

interface ConnectionsSectionProps {
  workspaceId: string;
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated. Please sign in again.");
  return token;
}

export function ConnectionsSection({ workspaceId }: ConnectionsSectionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { channel } = useChannel();
  const { toast } = useToast();

  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("email");

  const [smartleadApiKey, setSmartleadApiKey] = useState("");
  const [replyioApiKey, setReplyioApiKey] = useState("");
  const [phoneburnerToken, setPhoneburnerToken] = useState("");
  const [nocodbApiToken, setNocodbApiToken] = useState("");

  const [isConnecting, setIsConnecting] = useState<{ [k: string]: boolean }>({});
  const [isSyncing, setIsSyncing] = useState<{ [k: string]: boolean }>({});

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPATInput, setShowPATInput] = useState(false);

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
    if (!workspaceId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("api_connections")
        .select("id, platform, is_active, last_sync_at, last_full_sync_at, sync_status, sync_progress, created_at")
        .eq("workspace_id", workspaceId)
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

  // Handle OAuth callback results from query params
  useEffect(() => {
    const successParam = searchParams.get("success");
    const errorParam = searchParams.get("error");

    if (successParam === "phoneburner_connected") {
      setSuccess("PhoneBurner connected successfully! You can now sync your data.");
      setSearchParams({}, { replace: true });
      if (workspaceId) fetchConnections();
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
    if (workspaceId) void fetchConnections();
  }, [workspaceId]);

  // Light polling when any sync is running
  const anySyncing = useMemo(
    () => connections.some((c) => c.sync_status === "syncing"),
    [connections]
  );

  useEffect(() => {
    if (!anySyncing || !workspaceId) return;

    const startTime = Date.now();
    const MAX_POLL_DURATION = 30 * 60 * 1000;

    const t = window.setInterval(() => {
      if (Date.now() - startTime > MAX_POLL_DURATION) {
        clearInterval(t);
        return;
      }
      void fetchConnections();
    }, 5000);

    return () => window.clearInterval(t);
  }, [anySyncing, workspaceId]);

  const handleConnect = async (platform: "smartlead" | "replyio" | "phoneburner") => {
    if (!workspaceId || !user) return;

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
          workspace_id: workspaceId,
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
      };
      setSuccess(`${platformNames[platform]} connected successfully!`);
      
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
    if (!workspaceId || !user) return;

    setError(null);
    setSuccess(null);
    setIsConnecting((s) => ({ ...s, phoneburner_oauth: true }));

    try {
      const token = await getAccessToken();
      const res = await supabase.functions.invoke("phoneburner-oauth", {
        body: {
          action: "authorize",
          workspace_id: workspaceId,
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
    if (!workspaceId) return;
    const { reset = false, fullBackfill = false } = options;

    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, smartlead: true }));

    try {
      const token = await getAccessToken();
      const res = await supabase.functions.invoke("smartlead-sync", {
        body: {
          workspace_id: workspaceId,
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
    if (!workspaceId) return;
    const { reset = false, fullBackfill = false } = options;

    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, replyio: true }));

    try {
      const token = await getAccessToken();
      const res = await supabase.functions.invoke("replyio-sync", {
        body: {
          workspace_id: workspaceId,
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
    if (!workspaceId) return;

    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, smartlead_replies: true }));

    try {
      const token = await getAccessToken();
      const res = await supabase.functions.invoke("smartlead-sync", {
        body: {
          workspace_id: workspaceId,
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
    if (!workspaceId) return;
    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, phoneburner: true }));

    try {
      const data = await invokeSync("phoneburner-sync", {
        workspace_id: workspaceId,
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
    if (!workspaceId) return;

    setError(null);
    setSuccess(null);
    setIsSyncing((s) => ({ ...s, phoneburner_stop: true }));

    try {
      const { error } = await supabase
        .from("api_connections")
        .update({ sync_status: "stopped" })
        .eq("workspace_id", workspaceId)
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading connections...
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="calling" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Calling
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Smartlead Card */}
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
                    <Button onClick={() => handleConnect("smartlead")} disabled={!!isConnecting.smartlead} className="w-full">
                      {isConnecting.smartlead ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        "Connect Smartlead"
                      )}
                    </Button>
                  </>
                ) : smartleadConnection.sync_status === "syncing" ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-medium">Syncing...</span>
                    </div>
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
                      >
                        <Database className="mr-2 h-3 w-3" />
                        Full Backfill
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncSmartleadReplies()}
                        disabled={!!isSyncing.smartlead_replies}
                      >
                        <Inbox className="mr-2 h-3 w-3" />
                        Sync Inbox
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reply.io Card */}
            <Card className={replyioConnection ? "border-success/30" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                      <Plug className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Reply.io</CardTitle>
                      <CardDescription>Email automation platform</CardDescription>
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
                      >
                        <Database className="mr-2 h-3 w-3" />
                        Full Backfill
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Data Coverage */}
            {(smartleadConnection || replyioConnection) && (
              <div className="md:col-span-2">
                <DataCoverageIndicator workspaceId={workspaceId} />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="calling" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* PhoneBurner Card */}
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
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
