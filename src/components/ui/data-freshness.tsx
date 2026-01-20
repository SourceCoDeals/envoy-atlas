import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DataFreshnessProps {
  lastSyncAt: string | null;
  status?: 'idle' | 'syncing' | 'error';
  className?: string;
  showTooltip?: boolean;
}

export function DataFreshness({ lastSyncAt, status = 'idle', className, showTooltip = true }: DataFreshnessProps) {
  if (status === 'syncing') {
    const content = (
      <span className={cn("text-xs text-blue-600 flex items-center gap-1", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Syncing...
      </span>
    );
    return showTooltip ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>Data is being synchronized</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : content;
  }

  if (status === 'error') {
    const content = (
      <span className={cn("text-xs text-destructive flex items-center gap-1", className)}>
        <AlertTriangle className="h-3 w-3" />
        Sync failed
      </span>
    );
    return showTooltip ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>Last sync failed - check connections</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : content;
  }

  if (!lastSyncAt) {
    const content = (
      <span className={cn("text-xs text-amber-600 flex items-center gap-1", className)}>
        <AlertTriangle className="h-3 w-3" />
        Never synced
      </span>
    );
    return showTooltip ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>No data has been synced yet</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : content;
  }

  const syncDate = new Date(lastSyncAt);
  const hoursSince = (Date.now() - syncDate.getTime()) / (1000 * 60 * 60);

  let color = "text-green-600";
  let Icon = CheckCircle;
  let tooltipText = "Data is fresh and up to date";

  if (hoursSince > 24) {
    color = "text-destructive";
    Icon = AlertTriangle;
    tooltipText = "Data is stale - over 24 hours since last sync";
  } else if (hoursSince > 6) {
    color = "text-amber-600";
    Icon = RefreshCw;
    tooltipText = "Data may be outdated - consider syncing";
  }

  const content = (
    <span className={cn(`text-xs ${color} flex items-center gap-1`, className)}>
      <Icon className="h-3 w-3" />
      Updated {formatDistanceToNow(syncDate, { addSuffix: true })}
    </span>
  );

  return showTooltip ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{content}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : content;
}
