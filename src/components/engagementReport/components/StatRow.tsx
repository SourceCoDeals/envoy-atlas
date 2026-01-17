import { cn } from '@/lib/utils';

interface StatRowProps {
  label: string;
  value: string | number;
  percentage?: number;
  suffix?: string;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}

export function StatRow({
  label,
  value,
  percentage,
  suffix,
  className,
  labelClassName,
  valueClassName,
}: StatRowProps) {
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <div className={cn('flex justify-between text-sm', className)}>
      <span className={cn('text-muted-foreground', labelClassName)}>{label}</span>
      <span className={cn('font-medium', valueClassName)}>
        {formattedValue}
        {percentage !== undefined && (
          <span className="text-muted-foreground ml-1">
            ({percentage.toFixed(1)}%)
          </span>
        )}
        {suffix && <span className="text-muted-foreground ml-1">{suffix}</span>}
      </span>
    </div>
  );
}
