import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageSquare, CheckCircle2, AlertCircle, Loader2, Clock } from 'lucide-react';

interface PlatformProgress {
  current: number;
  total: number;
  status: string;
}

interface SyncProgress {
  smartlead?: PlatformProgress;
  replyio?: PlatformProgress;
}

interface SyncProgressBarProps {
  progress: SyncProgress;
  isActive: boolean;
  elapsedTime: number;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function PlatformProgressRow({ 
  label, 
  icon: Icon, 
  progress, 
  color 
}: { 
  label: string; 
  icon: React.ElementType;
  progress?: PlatformProgress;
  color: string;
}) {
  if (!progress || progress.total === 0) {
    return null;
  }

  const percentage = Math.round((progress.current / progress.total) * 100);
  const isComplete = progress.current >= progress.total;
  const isError = progress.status === 'error';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="font-medium">{label}</span>
          {isComplete && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {isError && <AlertCircle className="h-4 w-4 text-destructive" />}
        </div>
        <span className="text-muted-foreground">
          {progress.current}/{progress.total} ({percentage}%)
        </span>
      </div>
      <Progress 
        value={percentage} 
        className="h-2"
      />
    </div>
  );
}

export function SyncProgressBar({ progress, isActive, elapsedTime }: SyncProgressBarProps) {
  if (!isActive && !progress.smartlead && !progress.replyio) {
    return null;
  }

  const slComplete = progress.smartlead && progress.smartlead.current >= progress.smartlead.total;
  const rioComplete = progress.replyio && progress.replyio.current >= progress.replyio.total;
  const allComplete = slComplete && rioComplete;

  const currentPhase = !slComplete 
    ? 'SmartLead' 
    : !rioComplete 
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
          />
          <PlatformProgressRow
            label="Reply.io"
            icon={MessageSquare}
            progress={progress.replyio}
            color="text-purple-500"
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
