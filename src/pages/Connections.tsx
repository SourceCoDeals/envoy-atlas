import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Download,
  ExternalLink,
  Loader2,
  Phone,
  Plug,
  RefreshCw,
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
                        <div className="space-y-2">
                          <Label htmlFor="pb-token">Personal Access Token</Label>
                          <Input
                            id="pb-token"
                            value={phoneburnerToken}
                            onChange={(e) => setPhoneburnerToken(e.target.value)}
                            placeholder="Paste PhoneBurner PAT"
                          />
                        </div>
                        <Button onClick={() => handleConnect("phoneburner")} disabled={!!isConnecting.phoneburner} className="w-full">
                          {isConnecting.phoneburner ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            "Connect PhoneBurner"
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
