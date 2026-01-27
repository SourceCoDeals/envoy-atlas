import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Database, Activity, AlertTriangle, Zap, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type DataSourceType = 
  | 'snapshots'      // Real nocodb_campaign_daily_snapshots data
  | 'nocodb'         // Aggregate campaign totals from NocoDB
  | 'activity'       // Real email_activities data
  | 'estimated'      // Synthetic/backfilled data
  | 'daily_metrics'  // From daily_metrics table
  | 'mixed';         // Combination of sources

interface DataSourceBadgeProps {
  source: DataSourceType;
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

const sourceConfig: Record<DataSourceType, {
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  colorClass: string;
}> = {
  snapshots: {
    label: 'Live Snapshots',
    shortLabel: 'Snapshots',
    description: 'Real-time daily snapshots from NocoDB sync',
    icon: Zap,
    variant: 'default',
    colorClass: 'bg-success/10 text-success border-success/20 hover:bg-success/20',
  },
  nocodb: {
    label: 'NocoDB Sync',
    shortLabel: 'NocoDB',
    description: 'Aggregate campaign totals from NocoDB',
    icon: Database,
    variant: 'secondary',
    colorClass: 'bg-chart-1/10 text-chart-1 border-chart-1/20 hover:bg-chart-1/20',
  },
  activity: {
    label: 'Activity Log',
    shortLabel: 'Activity',
    description: 'Real email activity data from tracking',
    icon: Activity,
    variant: 'default',
    colorClass: 'bg-success/10 text-success border-success/20 hover:bg-success/20',
  },
  estimated: {
    label: 'Estimated',
    shortLabel: 'Est.',
    description: 'Synthetic data distributed from aggregate totals',
    icon: AlertTriangle,
    variant: 'outline',
    colorClass: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/20',
  },
  daily_metrics: {
    label: 'Daily Metrics',
    shortLabel: 'Daily',
    description: 'Aggregated daily metrics from sync',
    icon: BarChart3,
    variant: 'secondary',
    colorClass: 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
  },
  mixed: {
    label: 'Mixed Sources',
    shortLabel: 'Mixed',
    description: 'Combination of multiple data sources',
    icon: Database,
    variant: 'outline',
    colorClass: 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
  },
};

export function DataSourceBadge({ 
  source, 
  className, 
  showLabel = true,
  compact = false 
}: DataSourceBadgeProps) {
  const config = sourceConfig[source];
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline"
          className={cn(
            "gap-1 font-medium cursor-help transition-colors",
            config.colorClass,
            compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
            className
          )}
        >
          <Icon className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          {showLabel && (
            <span>{compact ? config.shortLabel : config.label}</span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="font-medium">{config.label}</p>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Helper to determine data source from various indicators
export function determineDataSource(options: {
  hasSnapshots?: boolean;
  hasActivityData?: boolean;
  hasEstimatedData?: boolean;
  hasDailyMetrics?: boolean;
  isNocoDBAggregate?: boolean;
}): DataSourceType {
  const { hasSnapshots, hasActivityData, hasEstimatedData, hasDailyMetrics, isNocoDBAggregate } = options;
  
  if (hasSnapshots) return 'snapshots';
  if (hasActivityData) return 'activity';
  if (hasEstimatedData) return 'estimated';
  if (isNocoDBAggregate) return 'nocodb';
  if (hasDailyMetrics) return 'daily_metrics';
  return 'mixed';
}
