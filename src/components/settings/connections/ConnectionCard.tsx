import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Clock, ExternalLink, Loader2 } from "lucide-react";

interface SyncProgress {
  current?: number;
  total?: number;
  label?: string;
  stage?: string;
  batch?: number;
  estimatedTimeRemaining?: string;
}

interface ConnectionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  isConnected: boolean;
  syncStatus?: string | null;
  lastSyncAt?: string | null;
  syncProgress?: SyncProgress;
  // Connect state
  apiKeyValue?: string;
  onApiKeyChange?: (value: string) => void;
  apiKeyPlaceholder?: string;
  isConnecting?: boolean;
  onConnect?: () => void;
  connectLabel?: string;
  helpLink?: { url: string; label: string };
  // Sync actions
  syncActions?: ReactNode;
  // Extra content when syncing
  syncingContent?: ReactNode;
  // Additional status rows
  statusRows?: { label: string; value: ReactNode }[];
}

export function ConnectionCard({
  title,
  description,
  icon,
  isConnected,
  syncStatus,
  lastSyncAt,
  syncProgress,
  apiKeyValue,
  onApiKeyChange,
  apiKeyPlaceholder,
  isConnecting,
  onConnect,
  connectLabel = "Connect",
  helpLink,
  syncActions,
  syncingContent,
  statusRows,
}: ConnectionCardProps) {
  const isSyncing = syncStatus === "syncing";
  const progressPercent = syncProgress?.total 
    ? Math.round((syncProgress.current || 0) / syncProgress.total * 100) 
    : 0;

  const formatStage = (stage?: string) => {
    if (!stage) return null;
    return stage
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card className={isConnected ? "border-success/30" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
              {icon}
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
          {isConnected && (
            <Badge variant="outline" className="border-success text-success text-xs">
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isConnected ? (
          <>
            {onApiKeyChange && (
              <div className="space-y-2">
                <Label htmlFor={`${title}-key`} className="text-xs">API Key</Label>
                <Input
                  id={`${title}-key`}
                  value={apiKeyValue}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  placeholder={apiKeyPlaceholder}
                  className="h-9"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              {onConnect && (
                <Button 
                  onClick={onConnect} 
                  disabled={isConnecting} 
                  className="flex-1 h-9"
                  size="sm"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    connectLabel
                  )}
                </Button>
              )}
              {helpLink && (
                <Button variant="link" size="sm" asChild className="h-9 px-2">
                  <a href={helpLink.url} target="_blank" rel="noopener noreferrer">
                    {helpLink.label}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
          </>
        ) : isSyncing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {syncProgress?.stage ? formatStage(syncProgress.stage) : "Syncing..."}
                </span>
              </div>
              {syncProgress?.batch && (
                <Badge variant="secondary" className="text-xs">
                  Batch {syncProgress.batch}
                </Badge>
              )}
            </div>
            
            {/* Progress bar - always show when syncing */}
            <div className="space-y-1.5">
              <Progress value={progressPercent || 5} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {syncProgress?.total && syncProgress.total > 0 
                    ? `${syncProgress.current || 0} / ${syncProgress.total} ${syncProgress.label || "items"}`
                    : "Processing..."
                  }
                </span>
                {syncProgress?.estimatedTimeRemaining && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    ~{syncProgress.estimatedTimeRemaining}
                  </span>
                )}
              </div>
            </div>
            {syncingContent}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Status</span>
                <Badge 
                  variant={syncStatus === "success" ? "outline" : syncStatus === "error" ? "destructive" : "secondary"}
                  className="text-xs h-5"
                >
                  {syncStatus === "success" ? "Success" : syncStatus === "error" ? "Error" : syncStatus || "Idle"}
                </Badge>
              </div>
              {lastSyncAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">Last Sync</span>
                  <span className="flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {new Date(lastSyncAt).toLocaleString()}
                  </span>
                </div>
              )}
              {statusRows?.map((row, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">{row.label}</span>
                  <span className="text-xs">{row.value}</span>
                </div>
              ))}
            </div>
            {syncActions && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {syncActions}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
