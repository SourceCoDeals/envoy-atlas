import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, AlertCircle, CheckCircle2 } from "lucide-react";

interface DataAvailabilityBadgeProps {
  type: 'actual' | 'estimated' | 'unavailable' | 'partial';
  tooltip?: string;
  size?: 'sm' | 'md';
}

/**
 * Badge that indicates data availability/quality status
 * - actual: Real data from API/sync
 * - estimated: Calculated or derived data
 * - unavailable: No data available
 * - partial: Some data missing
 */
export function DataAvailabilityBadge({ type, tooltip, size = 'sm' }: DataAvailabilityBadgeProps) {
  const config = {
    actual: {
      label: 'Actual',
      variant: 'default' as const,
      icon: CheckCircle2,
      defaultTooltip: 'This data is from actual measurements',
    },
    estimated: {
      label: 'Est.',
      variant: 'outline' as const,
      icon: Info,
      defaultTooltip: 'This value is estimated based on available data',
    },
    unavailable: {
      label: 'N/A',
      variant: 'secondary' as const,
      icon: AlertCircle,
      defaultTooltip: 'Data not available from source',
    },
    partial: {
      label: 'Partial',
      variant: 'outline' as const,
      icon: AlertCircle,
      defaultTooltip: 'Some data may be missing',
    },
  };

  const { label, variant, icon: Icon, defaultTooltip } = config[type];
  
  const sizeClasses = size === 'sm' 
    ? 'text-[10px] px-1.5 py-0 h-4' 
    : 'text-xs px-2 py-0.5';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={variant} 
            className={`${sizeClasses} gap-1 font-normal cursor-help`}
          >
            <Icon className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltip || defaultTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface MetricWithAvailabilityProps {
  value: string | number;
  label: string;
  availability: 'actual' | 'estimated' | 'unavailable' | 'partial';
  availabilityTooltip?: string;
  className?: string;
}

/**
 * Display a metric value with its data availability indicator
 */
export function MetricWithAvailability({ 
  value, 
  label, 
  availability, 
  availabilityTooltip,
  className = '' 
}: MetricWithAvailabilityProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="font-medium">{value}</span>
      <span className="text-muted-foreground text-sm">{label}</span>
      {availability !== 'actual' && (
        <DataAvailabilityBadge 
          type={availability} 
          tooltip={availabilityTooltip}
          size="sm"
        />
      )}
    </div>
  );
}

/**
 * Hook to determine data availability for various metric types
 */
export function useDataAvailability(data: {
  hasSmartLeadOpens?: boolean;
  hasReplyIoSent?: boolean;
  hasCallScores?: boolean;
  hasDomainAuth?: boolean;
  hasLeadEnrichment?: boolean;
}) {
  return {
    smartLeadOpens: data.hasSmartLeadOpens ? 'actual' : 'estimated',
    replyIoSent: data.hasReplyIoSent ? 'actual' : 'estimated',
    callScores: data.hasCallScores ? 'actual' : 'unavailable',
    domainAuth: data.hasDomainAuth ? 'actual' : 'estimated',
    leadEnrichment: data.hasLeadEnrichment ? 'actual' : 'partial',
    meetingBreakdown: 'estimated' as const, // Always estimated until calendar integration
    listQuality: 'estimated' as const, // Always estimated based on heuristics
  };
}
