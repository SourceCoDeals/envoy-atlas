import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ReportProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  valueLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  className?: string;
  colorClass?: string;
}

export function ReportProgressBar({
  value,
  max = 100,
  label,
  valueLabel,
  size = 'md',
  showPercentage = false,
  className,
  colorClass,
}: ReportProgressBarProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn('space-y-1', className)}>
      {(label || valueLabel || showPercentage) && (
        <div className="flex justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          <span className="font-medium">
            {valueLabel || (showPercentage && `${percentage.toFixed(1)}%`)}
          </span>
        </div>
      )}
      <div
        className={cn(
          'rounded-full overflow-hidden bg-muted',
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            colorClass || 'bg-primary'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
