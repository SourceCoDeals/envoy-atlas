import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Database, Inbox, Mail, Phone, Plug, RefreshCw } from "lucide-react";

import { DataCoverageIndicator } from "@/components/connections/DataCoverageIndicator";
import { ConnectionCard, SyncButton } from "./connections";

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
  const { toast } = useToast();

  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("email");

  const [smartleadApiKey, setSmartleadApiKey] = useState("");
  const [replyioApiKey, setReplyioApiKey] = useState("");

  const [isConnecting, setIsConnecting] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const smartleadConnection = useMemo(() => connections.find((c) => c.platform === "smartlead"), [connections]);
  const replyioConnection = useMemo(() => connections.find((c) => c.platform === "replyio"), [connections]);
  const phoneburnerConnection = useMemo(() => connections.find((c) => c.platform === "phoneburner"), [connections]);

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
      setConnections((data as ApiConnection[]) ?? []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load connections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const successParam = searchParams.get("success");
    const errorParam = searchParams.get("error");

    if (successParam === "phoneburner_connected") {
      setSuccess("PhoneBurner connected successfully!");
      setSearchParams({}, { replace: true });
      if (workspaceId) fetchConnections();
    } else if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "PhoneBurner authorization was denied.",
        missing_params: "Missing authorization parameters.",
        invalid_state: "Invalid authorization state.",
        callback_failed: "Failed to complete PhoneBurner connection.",
      };
      setError(errorMessages[errorParam] || "An error occurred.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    if (workspaceId) void fetchConnections();
  }, [workspaceId]);

  const anySyncing = useMemo(() => connections.some((c) => c.sync_status === "syncing"), [connections]);

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

  const handleConnect = async (platform: "smartlead" | "replyio") => {
    if (!workspaceId || !user) return;
    const apiKey = platform === "smartlead" ? smartleadApiKey.trim() : replyioApiKey.trim();
    if (!apiKey) {
      setError("Please enter an API key");
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

      setSuccess(`${platform === "smartlead" ? "Smartlead" : "Reply.io"} connected successfully!`);
      if (platform === "smartlead") setSmartleadApiKey("");
      if (platform === "replyio") setReplyioApiKey("");
      await fetchConnections();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || `Failed to connect ${platform}`);
    } finally {
      setIsConnecting((s) => ({ ...s, [platform]: false }));
    }
  };

  const handleSync = async (
    platform: "smartlead" | "replyio" | "phoneburner",
    options: { reset?: boolean; fullBackfill?: boolean; fetchRepliesOnly?: boolean } = {}
  ) => {
    if (!workspaceId) return;
    setError(null);
    setSuccess(null);
    const syncKey = options.fetchRepliesOnly ? `${platform}_replies` : platform;
    setIsSyncing((s) => ({ ...s, [syncKey]: true }));

    try {
      const token = await getAccessToken();
      const functionName = `${platform}-sync`;
      const res = await supabase.functions.invoke(functionName, {
        body: {
          workspace_id: workspaceId,
          reset: options.reset,
          full_backfill: options.fullBackfill,
          fetch_replies_only: options.fetchRepliesOnly,
          auto_continue: true,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw new Error(res.error.message || "Sync failed");

      const data = res.data;
      if (data.success) {
        const msg = data.complete
          ? `Sync complete! Synced ${data.progress?.campaigns_synced || data.progress?.sequences_synced || 0} items.`
          : "Sync started, processing in background...";
        setSuccess(msg);
      }
      await fetchConnections();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || `Failed to sync ${platform}`);
    } finally {
      setIsSyncing((s) => ({ ...s, [syncKey]: false }));
    }
  };

  const handlePhoneBurnerOAuth = async () => {
    if (!workspaceId || !user) return;
    setError(null);
    setIsConnecting((s) => ({ ...s, phoneburner_oauth: true }));

    try {
      const token = await getAccessToken();
      const res = await supabase.functions.invoke("phoneburner-oauth", {
        body: { action: "authorize", workspace_id: workspaceId },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw new Error(res.error.message || "Failed to initiate OAuth");
      const { authorization_url, state } = res.data;
      if (!authorization_url) throw new Error("OAuth not configured.");

      sessionStorage.setItem("phoneburner_oauth_state", state);
      window.open(authorization_url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to start PhoneBurner OAuth flow");
    } finally {
      setIsConnecting((s) => ({ ...s, phoneburner_oauth: false }));
    }
  };

  const getProgress = (conn: ApiConnection | undefined, keys: { current: string; total: string; label: string }) => {
    if (!conn?.sync_progress) return undefined;
    const progress = conn.sync_progress as any;
    
    // Calculate estimated time remaining based on platform rate limits
    let estimatedTimeRemaining: string | undefined;
    const remaining = (progress[keys.total] || 0) - (progress[keys.current] || 0);
    if (remaining > 0 && conn.sync_status === "syncing") {
      // Smartlead: ~250ms per item, Reply.io: ~10.5s per sequence for stats
      const platform = conn.platform;
      const msPerItem = platform === "replyio" ? 10500 : platform === "smartlead" ? 250 : 1000;
      const totalMs = remaining * msPerItem;
      const mins = Math.ceil(totalMs / 60000);
      estimatedTimeRemaining = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    }
    
    return {
      current: progress[keys.current] || 0,
      total: progress[keys.total] || 0,
      label: keys.label,
      stage: progress.stage || progress.current_stage,
      batch: progress.batch_number || progress.batch,
      estimatedTimeRemaining,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <RefreshCw className="h-4 w-4 animate-spin" />
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
        <TabsList className="h-9">
          <TabsTrigger value="email" className="flex items-center gap-2 text-xs h-7 px-3">
            <Mail className="h-3.5 w-3.5" />
            Email
          </TabsTrigger>
          <TabsTrigger value="calling" className="flex items-center gap-2 text-xs h-7 px-3">
            <Phone className="h-3.5 w-3.5" />
            Calling
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Smartlead */}
            <ConnectionCard
              title="Smartlead"
              description="Primary outreach platform"
              icon={<Plug className="h-5 w-5 text-primary" />}
              isConnected={!!smartleadConnection}
              syncStatus={smartleadConnection?.sync_status}
              lastSyncAt={smartleadConnection?.last_sync_at}
              syncProgress={getProgress(smartleadConnection, {
                current: "campaign_index",
                total: "total_campaigns",
                label: "campaigns",
              })}
              apiKeyValue={smartleadApiKey}
              onApiKeyChange={setSmartleadApiKey}
              apiKeyPlaceholder="Paste Smartlead API key"
              isConnecting={isConnecting.smartlead}
              onConnect={() => handleConnect("smartlead")}
              connectLabel="Connect Smartlead"
              syncActions={
                <>
                  <SyncButton
                    onClick={() => handleSync("smartlead")}
                    isLoading={isSyncing.smartlead}
                    icon={<RefreshCw className="h-3 w-3" />}
                    tooltip="Fetch latest data since last sync"
                  >
                    Quick Sync
                  </SyncButton>
                  <SyncButton
                    onClick={() => handleSync("smartlead", { fullBackfill: true })}
                    isLoading={isSyncing.smartlead}
                    icon={<Database className="h-3 w-3" />}
                    variant="ghost"
                    tooltip="Re-sync all historical data (may take several minutes)"
                  >
                    Full History
                  </SyncButton>
                  <SyncButton
                    onClick={() => handleSync("smartlead", { fetchRepliesOnly: true })}
                    isLoading={isSyncing.smartlead_replies}
                    icon={<Inbox className="h-3 w-3" />}
                    variant="ghost"
                    tooltip="Download reply content from master inbox"
                  >
                    Fetch Replies
                  </SyncButton>
                </>
              }
            />

            {/* Reply.io */}
            <ConnectionCard
              title="Reply.io"
              description="Email automation platform"
              icon={<Plug className="h-5 w-5 text-primary" />}
              isConnected={!!replyioConnection}
              syncStatus={replyioConnection?.sync_status}
              lastSyncAt={replyioConnection?.last_sync_at}
              syncProgress={getProgress(replyioConnection, {
                current: "sequences_synced",
                total: "total_sequences",
                label: "sequences",
              })}
              apiKeyValue={replyioApiKey}
              onApiKeyChange={setReplyioApiKey}
              apiKeyPlaceholder="Paste Reply.io API key"
              isConnecting={isConnecting.replyio}
              onConnect={() => handleConnect("replyio")}
              connectLabel="Connect Reply.io"
              helpLink={{ url: "https://app.reply.io/settings/apikey", label: "Get API Key" }}
              syncActions={
                <>
                  <SyncButton
                    onClick={() => handleSync("replyio")}
                    isLoading={isSyncing.replyio}
                    icon={<RefreshCw className="h-3 w-3" />}
                    tooltip="Fetch latest data since last sync"
                  >
                    Quick Sync
                  </SyncButton>
                  <SyncButton
                    onClick={() => handleSync("replyio", { fullBackfill: true })}
                    isLoading={isSyncing.replyio}
                    icon={<Database className="h-3 w-3" />}
                    variant="ghost"
                    tooltip="Re-sync all historical data (may take several minutes)"
                  >
                    Full History
                  </SyncButton>
                </>
              }
            />

            {/* Data Coverage */}
            {(smartleadConnection || replyioConnection) && (
              <div className="md:col-span-2">
                <DataCoverageIndicator workspaceId={workspaceId} />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="calling" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* PhoneBurner - OAuth flow */}
            <ConnectionCard
              title="PhoneBurner"
              description="Power dialer & call tracking"
              icon={<Phone className="h-5 w-5 text-primary" />}
              isConnected={!!phoneburnerConnection}
              syncStatus={phoneburnerConnection?.sync_status}
              lastSyncAt={phoneburnerConnection?.last_sync_at}
              syncProgress={getProgress(phoneburnerConnection, {
                current: "sessions_synced",
                total: "total_sessions",
                label: "sessions",
              })}
              isConnecting={isConnecting.phoneburner_oauth}
              onConnect={handlePhoneBurnerOAuth}
              connectLabel="Connect with PhoneBurner"
              statusRows={
                phoneburnerConnection?.sync_progress && phoneburnerConnection.sync_status !== "syncing"
                  ? [
                      {
                        label: "Records",
                        value: `${(phoneburnerConnection.sync_progress as any)?.sessions_synced || 0} sessions, ${(phoneburnerConnection.sync_progress as any)?.contacts_synced || 0} contacts`,
                      },
                    ]
                  : undefined
              }
              syncActions={
                <>
                  <SyncButton
                    onClick={() => handleSync("phoneburner")}
                    isLoading={isSyncing.phoneburner}
                    icon={<RefreshCw className="h-3 w-3" />}
                    tooltip="Fetch latest call sessions and contacts"
                  >
                    Quick Sync
                  </SyncButton>
                  <SyncButton
                    onClick={() => handleSync("phoneburner", { reset: true })}
                    isLoading={isSyncing.phoneburner}
                    variant="ghost"
                    tooltip="Clear cached data and re-sync from scratch"
                  >
                    Full Reset
                  </SyncButton>
                </>
              }
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
