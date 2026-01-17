import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TrendIndicator {
  direction: 'up' | 'down' | 'neutral';
  value: string;
  isPositive?: boolean;
}

interface ReportMetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: TrendIndicator;
  highlight?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  valueClassName?: string;
}

export function ReportMetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  highlight = false,
  size = 'md',
  className,
  valueClassName,
}: ReportMetricCardProps) {
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const valueSizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const trendColors = {
    up: trend?.isPositive !== false ? 'text-green-500' : 'text-red-500',
    down: trend?.isPositive === true ? 'text-green-500' : 'text-red-500',
    neutral: 'text-muted-foreground',
  };

  return (
    <Card
      className={cn(
        sizeClasses[size],
        highlight && 'bg-primary/5 border-primary/20',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p
            className={cn(
              'font-bold mt-1',
              valueSizeClasses[size],
              highlight && 'text-primary',
              valueClassName
            )}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={cn('text-xs mt-1', trendColors[trend.direction])}>
              {trend.direction === 'up' && '↑ '}
              {trend.direction === 'down' && '↓ '}
              {trend.value}
            </p>
          )}
        </div>
        {Icon && (
          <Icon
            className={cn(
              'h-5 w-5 flex-shrink-0',
              highlight ? 'text-primary' : 'text-muted-foreground'
            )}
          />
        )}
      </div>
    </Card>
  );
}
