import { cn } from '@/lib/utils';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  format?: 'number' | 'percent' | 'currency';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function MetricCard({
  label,
  value,
  trend,
  format = 'number',
  className,
  size = 'md',
  loading = false,
}: MetricCardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'percent':
        return `${val.toFixed(2)}%`;
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
        }).format(val);
      default:
        return new Intl.NumberFormat('en-US').format(val);
    }
  };

  const TrendIcon = trend?.direction === 'up' 
    ? ArrowUpIcon 
    : trend?.direction === 'down' 
      ? ArrowDownIcon 
      : MinusIcon;

  const trendColorClass = trend?.direction === 'up'
    ? 'metric-trend-positive'
    : trend?.direction === 'down'
      ? 'metric-trend-negative'
      : 'text-muted-foreground';

  const sizeClasses = {
    sm: {
      card: 'p-3',
      value: 'text-lg',
      label: 'text-xs',
    },
    md: {
      card: 'p-4',
      value: 'text-2xl',
      label: 'text-xs',
    },
    lg: {
      card: 'p-6',
      value: 'text-4xl',
      label: 'text-sm',
    },
  };

  if (loading) {
    return (
      <div className={cn('metric-card animate-pulse', sizeClasses[size].card, className)}>
        <div className="h-4 w-20 bg-muted rounded mb-2" />
        <div className="h-8 w-24 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className={cn('metric-card', sizeClasses[size].card, className)}>
      <p className={cn('metric-label mb-1', sizeClasses[size].label)}>{label}</p>
      <div className="flex items-end gap-2">
        <span className={cn('metric-value', sizeClasses[size].value)}>
          {formatValue(value)}
        </span>
        {trend && (
          <span className={cn('metric-trend flex items-center gap-0.5 mb-1', trendColorClass)}>
            <TrendIcon className="h-3 w-3" />
            {Math.abs(trend.value).toFixed(1)}%
            {trend.label && <span className="text-muted-foreground ml-1">{trend.label}</span>}
          </span>
        )}
      </div>
    </div>
  );
}