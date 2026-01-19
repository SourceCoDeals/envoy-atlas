import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Mail, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Clock,
  AlertTriangle,
  RefreshCw,
  Play
} from 'lucide-react';

interface PlatformProgress {
  current: number;
  total: number;
  status: string;
  lastSyncAt?: string;
  isStale?: boolean;
}

interface SyncProgress {
  smartlead?: PlatformProgress;
  replyio?: PlatformProgress;
}

interface SyncProgressBarProps {
  progress: SyncProgress;
  isActive: boolean;
  elapsedTime: number;
  staleSyncs?: string[];
  onResume?: () => void;
  onPlatformSync?: (platform: 'smartlead' | 'replyio') => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function PlatformProgressRow({ 
  label, 
  icon: Icon, 
  progress, 
  color,
  onSync,
}: { 
  label: string; 
  icon: React.ElementType;
  progress?: PlatformProgress;
  color: string;
  onSync?: () => void;
}) {
  if (!progress || progress.total === 0) {
    return null;
  }

  const percentage = Math.round((progress.current / progress.total) * 100);
  const isComplete = progress.current >= progress.total;
  const isError = progress.status === 'error';
  const isStale = progress.isStale;
  const isSyncing = progress.status === 'syncing' || progress.status === 'in_progress';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="font-medium">{label}</span>
          {isComplete && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {isError && <AlertCircle className="h-4 w-4 text-destructive" />}
          {isStale && !isError && (
            <Badge variant="outline" className="text-xs text-warning border-warning/50">
              Stale
            </Badge>
          )}
          {isSyncing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {progress.current}/{progress.total} ({percentage}%)
          </span>
          {isStale && onSync && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs"
              onClick={onSync}
            >
              <Play className="h-3 w-3 mr-1" />
              Resume
            </Button>
          )}
        </div>
      </div>
      <Progress 
        value={percentage} 
        className={`h-2 ${isStale ? 'opacity-60' : ''}`}
      />
      {progress.lastSyncAt && (
        <p className="text-xs text-muted-foreground">
          Last activity: {formatRelativeTime(progress.lastSyncAt)}
        </p>
      )}
    </div>
  );
}

export function SyncProgressBar({ 
  progress, 
  isActive, 
  elapsedTime,
  staleSyncs = [],
  onResume,
  onPlatformSync,
}: SyncProgressBarProps) {
  const hasProgress = progress.smartlead || progress.replyio;
  const hasStale = staleSyncs.length > 0;
  
  // Show stale sync alert even when not actively syncing
  if (!isActive && hasStale && hasProgress) {
    return (
      <Alert className="border-warning/50 bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle className="text-warning">Sync Interrupted</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm">
            {staleSyncs.includes('smartlead') && progress.smartlead && (
              <span>SmartLead sync stopped at {progress.smartlead.current}/{progress.smartlead.total} campaigns. </span>
            )}
            {staleSyncs.includes('replyio') && progress.replyio && (
              <span>Reply.io sync stopped at {progress.replyio.current}/{progress.replyio.total} sequences. </span>
            )}
          </p>
          <div className="flex gap-2">
            {onResume && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onResume}
                className="border-warning/50 text-warning hover:bg-warning/10"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Resume All Syncs
              </Button>
            )}
            {staleSyncs.includes('smartlead') && onPlatformSync && (
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => onPlatformSync('smartlead')}
              >
                <Mail className="h-4 w-4 mr-2" />
                SmartLead Only
              </Button>
            )}
            {staleSyncs.includes('replyio') && onPlatformSync && (
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => onPlatformSync('replyio')}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Reply.io Only
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Don't show if no activity and no progress
  if (!isActive && !hasProgress) {
    return null;
  }

  const slComplete = progress.smartlead && progress.smartlead.current >= progress.smartlead.total;
  const rioComplete = progress.replyio && progress.replyio.current >= progress.replyio.total;
  const allComplete = (!progress.smartlead || slComplete) && (!progress.replyio || rioComplete);

  const currentPhase = !slComplete && progress.smartlead
    ? 'SmartLead' 
    : !rioComplete && progress.replyio
      ? 'Reply.io' 
      : 'Analysis';

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isActive && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            <span className="font-semibold">
              {allComplete ? 'Sync Complete' : `Syncing ${currentPhase}...`}
            </span>
            {isActive && (
              <Badge variant="secondary" className="text-xs">
                Auto-continuing
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <Clock className="h-4 w-4" />
            <span>{formatTime(elapsedTime)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <PlatformProgressRow
            label="SmartLead"
            icon={Mail}
            progress={progress.smartlead}
            color="text-blue-500"
            onSync={onPlatformSync ? () => onPlatformSync('smartlead') : undefined}
          />
          <PlatformProgressRow
            label="Reply.io"
            icon={MessageSquare}
            progress={progress.replyio}
            color="text-purple-500"
            onSync={onPlatformSync ? () => onPlatformSync('replyio') : undefined}
          />
        </div>

        {isActive && (
          <p className="text-xs text-muted-foreground">
            ✓ Sync will continue automatically in background batches
          </p>
        )}
      </CardContent>
    </Card>
  );
}
