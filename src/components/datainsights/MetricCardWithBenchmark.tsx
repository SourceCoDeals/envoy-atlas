import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InfoTooltip } from '@/components/ui/metric-tooltip';

interface MetricCardWithBenchmarkProps {
  label: string;
  value: number;
  unit?: string;
  benchmark?: number;
  benchmarkRangeLow?: number | null;
  benchmarkRangeHigh?: number | null;
  trend?: number;
  higherIsBetter?: boolean;
  className?: string;
  metricKey?: string;
}

export function MetricCardWithBenchmark({
  label,
  value,
  unit = '',
  benchmark,
  benchmarkRangeLow,
  benchmarkRangeHigh,
  trend,
  higherIsBetter = true,
  className,
  metricKey,
}: MetricCardWithBenchmarkProps) {
  const getPerformanceStatus = () => {
    if (!benchmark && !benchmarkRangeHigh) return 'neutral';
    
    const target = benchmarkRangeHigh || benchmark || 0;
    const low = benchmarkRangeLow || (benchmark ? benchmark * 0.8 : 0);
    
    if (higherIsBetter) {
      if (value >= target) return 'good';
      if (value >= low) return 'warning';
      return 'bad';
    } else {
      if (value <= low) return 'good';
      if (value <= target) return 'warning';
      return 'bad';
    }
  };

  const status = getPerformanceStatus();
  
  const statusColors = {
    good: 'text-green-500',
    warning: 'text-yellow-500',
    bad: 'text-red-500',
    neutral: 'text-muted-foreground',
  };

  const statusBgColors = {
    good: 'bg-green-500/10',
    warning: 'bg-yellow-500/10',
    bad: 'bg-red-500/10',
    neutral: 'bg-muted/50',
  };

  const formatValue = (val: number) => {
    if (unit === 'percent' || unit === '%') return `${val}%`;
    if (unit === 'minutes' || unit === 'min') return `${val} min`;
    if (unit === 'calls') return val.toLocaleString();
    if (unit === 'attempts') return val.toFixed(1);
    return val.toLocaleString();
  };

  const progressPercentage = benchmark 
    ? Math.min((value / benchmark) * 100, 100) 
    : 50;

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
            {label}
            {metricKey && <InfoTooltip metricKey={metricKey} />}
          </span>
          {trend !== undefined && (
            <div className={cn(
              'flex items-center text-xs font-medium',
              trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-muted-foreground'
            )}>
              {trend > 0 ? <ArrowUp className="h-3 w-3 mr-0.5" /> : 
               trend < 0 ? <ArrowDown className="h-3 w-3 mr-0.5" /> : 
               <Minus className="h-3 w-3 mr-0.5" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        
        <div className="flex items-baseline gap-2 mb-3">
          <span className={cn('text-2xl font-bold', statusColors[status])}>
            {formatValue(value)}
          </span>
        </div>

        {benchmark && (
          <>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
              <div 
                className={cn('h-full rounded-full transition-all', statusBgColors[status])}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Target: {formatValue(benchmark)}
                {benchmarkRangeLow && benchmarkRangeHigh && (
                  <span className="ml-1">({formatValue(benchmarkRangeLow)}-{formatValue(benchmarkRangeHigh)})</span>
                )}
              </span>
              <span className={cn('font-medium', statusColors[status])}>
                {status === 'good' ? 'On Track' : status === 'warning' ? 'Close' : 'Below Target'}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
