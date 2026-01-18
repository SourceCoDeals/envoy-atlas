import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertTriangle, Circle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type DataHealthStatus = 'healthy' | 'degraded' | 'broken' | 'empty';

interface DataHealthIndicatorProps {
  status: DataHealthStatus;
  label?: string;
  tooltip?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<DataHealthStatus, {
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  label: string;
}> = {
  healthy: {
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success',
    label: 'Working',
  },
  degraded: {
    icon: AlertTriangle,
    color: 'text-warning',
    bgColor: 'bg-warning',
    label: 'Partial',
  },
  broken: {
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive',
    label: 'Broken',
  },
  empty: {
    icon: Circle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted-foreground',
    label: 'No Data',
  },
};

const sizeConfig = {
  sm: { icon: 'h-3 w-3', dot: 'h-2 w-2', text: 'text-xs' },
  md: { icon: 'h-4 w-4', dot: 'h-2.5 w-2.5', text: 'text-sm' },
  lg: { icon: 'h-5 w-5', dot: 'h-3 w-3', text: 'text-base' },
};

export function DataHealthIndicator({
  status,
  label,
  tooltip,
  size = 'md',
  showLabel = true,
  className,
}: DataHealthIndicatorProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  const content = (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Icon className={cn(sizes.icon, config.color)} />
      {showLabel && (
        <span className={cn(sizes.text, config.color, 'font-medium')}>
          {label || config.label}
        </span>
      )}
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{content}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

// Simple dot indicator for compact displays
export function DataHealthDot({
  status,
  tooltip,
  size = 'md',
  className,
}: Omit<DataHealthIndicatorProps, 'label' | 'showLabel'>) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];

  const dot = (
    <span 
      className={cn(
        'inline-block rounded-full animate-pulse',
        sizes.dot,
        config.bgColor,
        className
      )} 
    />
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">{dot}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return dot;
}
