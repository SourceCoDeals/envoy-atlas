import { cn } from '@/lib/utils';

interface StatusDotProps {
  status: 'healthy' | 'warning' | 'critical' | 'inactive';
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusDot({ status, pulse = false, size = 'md', className }: StatusDotProps) {
  const statusClasses = {
    healthy: 'status-healthy',
    warning: 'status-warning',
    critical: 'status-critical',
    inactive: 'bg-muted-foreground',
  };

  const sizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
  };

  return (
    <span
      className={cn(
        'status-dot',
        statusClasses[status],
        sizeClasses[size],
        pulse && 'animate-pulse-glow',
        className
      )}
    />
  );
}