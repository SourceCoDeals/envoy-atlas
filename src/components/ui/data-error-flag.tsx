import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, XCircle, CircleSlash, Clock, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DataErrorType = 'estimated' | 'not-tracked' | 'hardcoded' | 'stale' | 'partial';

interface DataErrorFlagProps {
  type: DataErrorType;
  tooltip?: string;
  className?: string;
  size?: 'sm' | 'md';
}

const errorConfig: Record<DataErrorType, {
  label: string;
  icon: typeof AlertTriangle;
  className: string;
  defaultTooltip: string;
}> = {
  estimated: {
    label: 'ESTIMATED',
    icon: AlertTriangle,
    className: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
    defaultTooltip: 'This value is estimated using a formula, not actual tracked data',
  },
  'not-tracked': {
    label: 'NOT TRACKED',
    icon: XCircle,
    className: 'bg-red-500/20 text-red-600 border-red-500/30',
    defaultTooltip: 'This metric is not being tracked. Integration or configuration required.',
  },
  hardcoded: {
    label: 'FAKE DATA',
    icon: CircleSlash,
    className: 'bg-red-600/30 text-red-700 border-red-600/50',
    defaultTooltip: 'This is hardcoded placeholder data, not real values',
  },
  stale: {
    label: 'STALE',
    icon: Clock,
    className: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
    defaultTooltip: 'This data may be outdated. Last sync was over 24 hours ago.',
  },
  partial: {
    label: 'PARTIAL',
    icon: HelpCircle,
    className: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
    defaultTooltip: 'Only partial data is available for this metric',
  },
};

export function DataErrorFlag({ type, tooltip, className, size = 'sm' }: DataErrorFlagProps) {
  const config = errorConfig[type];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'cursor-help font-mono uppercase tracking-wider',
              size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
              config.className,
              className
            )}
          >
            <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{tooltip || config.defaultTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface MetricWithFlagProps {
  value: React.ReactNode;
  label?: string;
  errorType?: DataErrorType;
  errorTooltip?: string;
  className?: string;
}

export function MetricWithFlag({ 
  value, 
  label, 
  errorType, 
  errorTooltip,
  className 
}: MetricWithFlagProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {errorType && <DataErrorFlag type={errorType} tooltip={errorTooltip} />}
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}
