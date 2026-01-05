import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface HealthBadgeProps {
  score: number; // 0-1 scale
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function HealthBadge({ score, showLabel = true, size = 'md', className }: HealthBadgeProps) {
  const getHealthLevel = (score: number): 'good' | 'warning' | 'critical' => {
    if (score >= 0.8) return 'good';
    if (score >= 0.5) return 'warning';
    return 'critical';
  };

  const healthLevel = getHealthLevel(score);
  
  const config = {
    good: {
      icon: CheckCircle2,
      label: 'Healthy',
      className: 'health-score-good',
    },
    warning: {
      icon: AlertTriangle,
      label: 'Warning',
      className: 'health-score-warning',
    },
    critical: {
      icon: XCircle,
      label: 'Critical',
      className: 'health-score-critical',
    },
  };

  const { icon: Icon, label, className: healthClassName } = config[healthLevel];

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-3 py-1',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <span className={cn('health-score', healthClassName, sizeClasses[size], className)}>
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{label}</span>}
      <span className="font-mono">{(score * 100).toFixed(0)}%</span>
    </span>
  );
}