import * as React from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getMetricDefinition, MetricDefinition } from '@/lib/metricDefinitions';
import { cn } from '@/lib/utils';

interface MetricTooltipProps {
  metricKey: string;
  children: React.ReactNode;
  showIcon?: boolean;
  iconClassName?: string;
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

export function MetricTooltip({
  metricKey,
  children,
  showIcon = false,
  iconClassName,
  className,
  side = 'top',
  align = 'center',
}: MetricTooltipProps) {
  const definition = getMetricDefinition(metricKey);

  if (!definition) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex items-center gap-1 cursor-help', className)}>
            {children}
            {showIcon && (
              <Info className={cn('h-3 w-3 text-muted-foreground opacity-60 hover:opacity-100 transition-opacity', iconClassName)} />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} align={align} className="max-w-xs p-3">
          <MetricTooltipContent definition={definition} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface MetricTooltipContentProps {
  definition: MetricDefinition;
}

function MetricTooltipContent({ definition }: MetricTooltipContentProps) {
  return (
    <div className="space-y-2">
      <p className="font-medium text-sm">{definition.name}</p>
      <p className="text-xs text-muted-foreground">{definition.description}</p>
      
      <div className="pt-1 border-t border-border">
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
          {definition.formula}
        </code>
      </div>
      
      {definition.benchmark && (
        <p className="text-xs text-success">
          <span className="font-medium">Benchmark:</span> {definition.benchmark}
        </p>
      )}
      
      {definition.dataSource && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Source:</span> {definition.dataSource}
        </p>
      )}
      
      {definition.dispositions && definition.dispositions.length > 0 && (
        <div className="text-xs">
          <span className="font-medium text-muted-foreground">Includes:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {definition.dispositions.slice(0, 5).map((d) => (
              <span key={d} className="bg-muted px-1.5 py-0.5 rounded text-[10px] capitalize">
                {d}
              </span>
            ))}
            {definition.dispositions.length > 5 && (
              <span className="text-muted-foreground text-[10px]">
                +{definition.dispositions.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Simple inline info icon with tooltip
 */
interface InfoTooltipProps {
  metricKey: string;
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function InfoTooltip({ metricKey, className, side = 'top' }: InfoTooltipProps) {
  const definition = getMetricDefinition(metricKey);

  if (!definition) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className={cn('h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors', className)} />
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs p-3">
          <MetricTooltipContent definition={definition} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
