import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_CONFIG, type StatusType } from '../constants/statusConfig';

interface StatusBadgeProps {
  status: StatusType;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({
  status,
  showIcon = true,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  
  if (!config) {
    return (
      <Badge variant="secondary" className={className}>
        {status}
      </Badge>
    );
  }

  return (
    <Badge
      className={cn(
        config.colors.bg,
        config.colors.text,
        config.colors.border,
        'border',
        size === 'sm' && 'text-xs px-1.5 py-0.5',
        className
      )}
    >
      {showIcon && config.icon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  );
}
