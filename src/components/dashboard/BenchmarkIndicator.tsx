import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Industry benchmarks for cold email outreach
export const INDUSTRY_BENCHMARKS = {
  replyRate: { value: 3.0, label: 'Reply Rate', unit: '%', source: 'Industry average for B2B cold email' },
  positiveRate: { value: 1.5, label: 'Positive Rate', unit: '%', source: 'Industry average for B2B cold email' },
  openRate: { value: 50, label: 'Open Rate', unit: '%', source: 'Industry average (pixel tracking limitations)' },
  bounceRate: { value: 3.0, label: 'Bounce Rate', unit: '%', source: 'Max recommended for sender reputation' },
  spamRate: { value: 0.1, label: 'Spam Rate', unit: '%', source: 'Google/Yahoo bulk sender requirement' },
  deliveredRate: { value: 95, label: 'Delivered Rate', unit: '%', source: 'Healthy infrastructure threshold' },
  meetingRate: { value: 0.5, label: 'Meeting Rate', unit: '%', source: 'Industry average for cold email' },
};

export type BenchmarkMetric = keyof typeof INDUSTRY_BENCHMARKS;

interface BenchmarkIndicatorProps {
  metric: BenchmarkMetric;
  value: number;
  /** If true, lower is better (e.g., bounce rate) */
  invertDirection?: boolean;
  showValue?: boolean;
  showDelta?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: { icon: 'h-3 w-3', text: 'text-xs', gap: 'gap-0.5' },
  md: { icon: 'h-4 w-4', text: 'text-sm', gap: 'gap-1' },
  lg: { icon: 'h-5 w-5', text: 'text-base', gap: 'gap-1.5' },
};

export function BenchmarkIndicator({
  metric,
  value,
  invertDirection = false,
  showValue = true,
  showDelta = true,
  showTooltip = true,
  size = 'md',
  className,
}: BenchmarkIndicatorProps) {
  const benchmark = INDUSTRY_BENCHMARKS[metric];
  const sizes = sizeConfig[size];
  
  // Calculate performance vs benchmark
  const delta = value - benchmark.value;
  const deltaPercent = benchmark.value > 0 ? (delta / benchmark.value) * 100 : 0;
  
  // Determine if performance is good/bad
  const isAboveBenchmark = value >= benchmark.value;
  const isGood = invertDirection ? !isAboveBenchmark : isAboveBenchmark;
  const isNeutral = Math.abs(deltaPercent) < 10; // Within 10% is neutral
  
  // Choose icon and color
  const Icon = isNeutral ? Minus : (isGood ? TrendingUp : TrendingDown);
  const colorClass = isNeutral 
    ? 'text-muted-foreground' 
    : (isGood ? 'text-success' : 'text-destructive');

  const content = (
    <div className={cn('flex items-center', sizes.gap, className)}>
      <Icon className={cn(sizes.icon, colorClass)} />
      {showValue && (
        <span className={cn(sizes.text, colorClass, 'font-medium')}>
          {value.toFixed(metric === 'spamRate' ? 2 : 1)}{benchmark.unit}
        </span>
      )}
      {showDelta && !isNeutral && (
        <span className={cn(sizes.text, colorClass, 'opacity-75')}>
          ({delta > 0 ? '+' : ''}{delta.toFixed(1)}{benchmark.unit} vs benchmark)
        </span>
      )}
      {showDelta && isNeutral && (
        <span className={cn(sizes.text, 'text-muted-foreground opacity-75')}>
          (at benchmark)
        </span>
      )}
    </div>
  );

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{content}</div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-xs space-y-1">
              <p className="font-medium">{benchmark.label}: {benchmark.value}{benchmark.unit}</p>
              <p className="text-xs text-muted-foreground">{benchmark.source}</p>
              <p className="text-xs">
                Your value: <span className={colorClass}>{value.toFixed(metric === 'spamRate' ? 2 : 1)}{benchmark.unit}</span>
                {' '}({isGood ? 'Above' : 'Below'} benchmark)
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

// Simple badge showing benchmark comparison
export function BenchmarkBadge({
  metric,
  value,
  invertDirection = false,
  className,
}: Pick<BenchmarkIndicatorProps, 'metric' | 'value' | 'invertDirection' | 'className'>) {
  const benchmark = INDUSTRY_BENCHMARKS[metric];
  const isAboveBenchmark = value >= benchmark.value;
  const isGood = invertDirection ? !isAboveBenchmark : isAboveBenchmark;
  const deltaPercent = benchmark.value > 0 ? ((value - benchmark.value) / benchmark.value) * 100 : 0;
  const isNeutral = Math.abs(deltaPercent) < 10;

  if (isNeutral) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        ≈ benchmark
      </span>
    );
  }

  return (
    <span className={cn(
      'text-xs font-medium',
      isGood ? 'text-success' : 'text-destructive',
      className
    )}>
      {isGood ? '↑' : '↓'} {Math.abs(deltaPercent).toFixed(0)}% vs benchmark
    </span>
  );
}

// Context component for showing benchmark in a card
export function BenchmarkContext({
  metric,
  className,
}: Pick<BenchmarkIndicatorProps, 'metric' | 'className'>) {
  const benchmark = INDUSTRY_BENCHMARKS[metric];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1 text-xs text-muted-foreground cursor-help', className)}>
            <Info className="h-3 w-3" />
            <span>Benchmark: {benchmark.value}{benchmark.unit}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-xs">{benchmark.source}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
