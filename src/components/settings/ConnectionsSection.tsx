import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Database, 
  ExternalLink,
  Loader2, 
  Mail, 
  Phone, 
  RefreshCw 
} from "lucide-react";

interface DataSource {
  id: string;
  source_type: string;
  status: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
}

interface ConnectionsSectionProps {
  workspaceId: string;
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

export function ConnectionsSection({ workspaceId }: ConnectionsSectionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);

  const [smartleadApiKey, setSmartleadApiKey] = useState("");
  const [replyioApiKey, setReplyioApiKey] = useState("");

  const [isConnecting, setIsConnecting] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const smartleadSource = useMemo(() => dataSources.find((s) => s.source_type === "smartlead"), [dataSources]);
  const replyioSource = useMemo(() => dataSources.find((s) => s.source_type === "replyio"), [dataSources]);
  const phoneburnerSource = useMemo(() => dataSources.find((s) => s.source_type === "phoneburner"), [dataSources]);

  const fetchDataSources = async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("data_sources")
        .select("id, source_type, status, last_sync_at, last_sync_status")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDataSources((data as DataSource[]) ?? []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  // Handle OAuth callbacks
  useEffect(() => {
    const successParam = searchParams.get("success");
    const errorParam = searchParams.get("error");

    if (successParam === "phoneburner_connected") {
      setSearchParams({}, { replace: true });
      fetchDataSources();
    } else if (errorParam) {
      setError("Connection failed");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    if (workspaceId) fetchDataSources();
  }, [workspaceId]);

  // Poll during sync
  const anySyncing = useMemo(() => dataSources.some((s) => s.last_sync_status === "syncing"), [dataSources]);

  useEffect(() => {
    if (!anySyncing || !workspaceId) return;
    const t = setInterval(() => fetchDataSources(), 5000);
    return () => clearInterval(t);
  }, [anySyncing, workspaceId]);

  const handleConnect = async (platform: "smartlead" | "replyio") => {
    const apiKey = platform === "smartlead" ? smartleadApiKey.trim() : replyioApiKey.trim();
    if (!apiKey || !workspaceId || !user) return;

    setError(null);
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

      if (platform === "smartlead") setSmartleadApiKey("");
      if (platform === "replyio") setReplyioApiKey("");
      await fetchDataSources();
    } catch (e: any) {
      setError(e?.message || "Connection failed");
    } finally {
      setIsConnecting((s) => ({ ...s, [platform]: false }));
    }
  };

  const handleSync = async (platform: string, options: { reset?: boolean; fullBackfill?: boolean } = {}) => {
    if (!workspaceId) return;
    setError(null);
    setIsSyncing((s) => ({ ...s, [platform]: true }));

    try {
      const dataSource = dataSources.find((s) => s.source_type === platform);
      if (!dataSource) throw new Error("Not connected");

      const { data: engagements } = await supabase
        .from("engagements")
        .select("id")
        .eq("client_id", workspaceId)
        .limit(1);
      
      if (!engagements?.length) throw new Error("No engagement found");

      const token = await getAccessToken();
      await supabase.functions.invoke(`${platform}-sync`, {
        body: {
          client_id: workspaceId,
          engagement_id: engagements[0].id,
          data_source_id: dataSource.id,
          reset: options.reset,
          full_backfill: options.fullBackfill,
          auto_continue: true,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      await fetchDataSources();
    } catch (e: any) {
      setError(e?.message || "Sync failed");
    } finally {
      setIsSyncing((s) => ({ ...s, [platform]: false }));
    }
  };

  const handlePhoneBurnerOAuth = async () => {
    if (!workspaceId || !user) return;
    setError(null);
    setIsConnecting((s) => ({ ...s, phoneburner: true }));

    try {
      const token = await getAccessToken();
      const res = await supabase.functions.invoke("phoneburner-oauth", {
        body: { action: "authorize", workspace_id: workspaceId },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw new Error(res.error.message);
      const { authorization_url, state } = res.data;
      if (!authorization_url) throw new Error("OAuth not configured");

      sessionStorage.setItem("phoneburner_oauth_state", state);
      window.open(authorization_url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setError(e?.message || "OAuth failed");
    } finally {
      setIsConnecting((s) => ({ ...s, phoneburner: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  const renderConnectionCard = (
    platform: string,
    title: string,
    description: string,
    Icon: React.ElementType,
    source: DataSource | undefined,
    apiKeyState?: { value: string; setter: (v: string) => void; placeholder: string },
    helpUrl?: string,
    isOAuth?: boolean
  ) => {
    const isConnected = !!source;
    const isSyncingNow = source?.last_sync_status === "syncing" || isSyncing[platform];
    const lastSync = source?.last_sync_at;

    return (
      <Card className={isConnected ? "border-success/30" : ""}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">{title}</CardTitle>
                <CardDescription className="text-xs">{description}</CardDescription>
              </div>
            </div>
            {isConnected && (
              <Badge variant="outline" className="border-success text-success text-xs h-5">
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isConnected ? (
            <>
              {apiKeyState && (
                <div className="space-y-1.5">
                  <Label className="text-xs">API Key</Label>
                  <Input
                    value={apiKeyState.value}
                    onChange={(e) => apiKeyState.setter(e.target.value)}
                    placeholder={apiKeyState.placeholder}
                    className="h-8 text-sm"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 flex-1"
                  disabled={isConnecting[platform]}
                  onClick={() => isOAuth ? handlePhoneBurnerOAuth() : handleConnect(platform as any)}
                >
                  {isConnecting[platform] && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                  {isOAuth ? "Connect via OAuth" : "Connect"}
                </Button>
                {helpUrl && (
                  <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                    <a href={helpUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Status Row */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                {isSyncingNow ? (
                  <span className="flex items-center gap-1 text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Syncing...
                  </span>
                ) : source?.last_sync_status === "error" ? (
                  <span className="text-destructive">Error</span>
                ) : (
                  <span className="text-success">Ready</span>
                )}
              </div>

              {/* Last Sync Row */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Last sync</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(lastSync)}
                </span>
              </div>

              {/* Sync Progress (when syncing) */}
              {isSyncingNow && (
                <Progress value={15} className="h-1.5" />
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  disabled={isSyncingNow}
                  onClick={() => handleSync(platform)}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Quick Sync
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={isSyncingNow}
                  onClick={() => handleSync(platform, { fullBackfill: true })}
                >
                  <Database className="h-3 w-3 mr-1" />
                  Full
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Email Platforms */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Email Platforms
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {renderConnectionCard(
            "smartlead",
            "SmartLead",
            "Email outreach",
            Mail,
            smartleadSource,
            { value: smartleadApiKey, setter: setSmartleadApiKey, placeholder: "API key" }
          )}
          {renderConnectionCard(
            "replyio",
            "Reply.io",
            "Email automation",
            Mail,
            replyioSource,
            { value: replyioApiKey, setter: setReplyioApiKey, placeholder: "API key" },
            "https://app.reply.io/settings/apikey"
          )}
        </div>
      </div>

      {/* Calling Platforms */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Calling Platforms
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {renderConnectionCard(
            "phoneburner",
            "PhoneBurner",
            "Power dialer",
            Phone,
            phoneburnerSource,
            undefined,
            undefined,
            true
          )}
        </div>
      </div>
    </div>
  );
}