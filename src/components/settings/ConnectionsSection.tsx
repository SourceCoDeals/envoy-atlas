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

interface DataSource {
  id: string;
  source_type: string;
  status: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  created_at: string | null;
}

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

  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("email");

  const [smartleadApiKey, setSmartleadApiKey] = useState("");
  const [replyioApiKey, setReplyioApiKey] = useState("");

  const [isConnecting, setIsConnecting] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const smartleadSource = useMemo(() => dataSources.find((s) => s.source_type === "smartlead"), [dataSources]);
  const replyioSource = useMemo(() => dataSources.find((s) => s.source_type === "replyio"), [dataSources]);
  const phoneburnerSource = useMemo(() => dataSources.find((s) => s.source_type === "phoneburner"), [dataSources]);

  const fetchDataSources = async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("data_sources")
        .select("id, source_type, status, last_sync_at, last_sync_status, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDataSources((data as DataSource[]) ?? []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load data sources");
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
      if (workspaceId) fetchDataSources();
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
    if (workspaceId) void fetchDataSources();
  }, [workspaceId]);

  const anySyncing = useMemo(() => dataSources.some((s) => s.last_sync_status === "syncing"), [dataSources]);

  useEffect(() => {
    if (!anySyncing || !workspaceId) return;
    const startTime = Date.now();
    const MAX_POLL_DURATION = 30 * 60 * 1000;
    const t = window.setInterval(() => {
      if (Date.now() - startTime > MAX_POLL_DURATION) {
        clearInterval(t);
        return;
      }
      void fetchDataSources();
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
      const { error } = await supabase.from("data_sources").insert({
        name: platform === "smartlead" ? "SmartLead" : "Reply.io",
        source_type: platform,
        api_key_encrypted: apiKey,
        status: "active",
        sync_enabled: true,
      });
      if (error) throw error;

      setSuccess(`${platform === "smartlead" ? "Smartlead" : "Reply.io"} connected successfully!`);
      if (platform === "smartlead") setSmartleadApiKey("");
      if (platform === "replyio") setReplyioApiKey("");
      await fetchDataSources();
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
      // Find the data source for this platform
      const dataSource = dataSources.find((s) => s.source_type === platform);
      if (!dataSource) {
        throw new Error(`No ${platform} connection found. Please connect first.`);
      }

      // Get the first engagement for this client (workspaceId is client_id)
      const { data: engagements, error: engErr } = await supabase
        .from("engagements")
        .select("id")
        .eq("client_id", workspaceId)
        .limit(1);
      
      if (engErr || !engagements?.length) {
        throw new Error("No engagement found. Please create an engagement first.");
      }
      const engagementId = engagements[0].id;

      const token = await getAccessToken();
      const functionName = `${platform}-sync`;
      const res = await supabase.functions.invoke(functionName, {
        body: {
          client_id: workspaceId,
          engagement_id: engagementId,
          data_source_id: dataSource.id,
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
      await fetchDataSources();
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
              isConnected={!!smartleadSource}
              syncStatus={smartleadSource?.last_sync_status}
              lastSyncAt={smartleadSource?.last_sync_at}
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
              isConnected={!!replyioSource}
              syncStatus={replyioSource?.last_sync_status}
              lastSyncAt={replyioSource?.last_sync_at}
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
            {(smartleadSource || replyioSource) && (
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
              isConnected={!!phoneburnerSource}
              syncStatus={phoneburnerSource?.last_sync_status}
              lastSyncAt={phoneburnerSource?.last_sync_at}
              isConnecting={isConnecting.phoneburner_oauth}
              onConnect={handlePhoneBurnerOAuth}
              connectLabel="Connect with PhoneBurner"
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
