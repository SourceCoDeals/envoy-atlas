import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface BenchmarkIndicatorProps {
  value: number;
  benchmark: number;
  higherIsBetter?: boolean;
  showIcon?: boolean;
  className?: string;
}

type BenchmarkStatus = 'good' | 'warning' | 'bad';

function getBenchmarkStatus(
  value: number,
  benchmark: number,
  higherIsBetter: boolean
): BenchmarkStatus {
  const diff = higherIsBetter ? value - benchmark : benchmark - value;
  if (diff >= 0) return 'good';
  if (diff > -benchmark * 0.2) return 'warning';
  return 'bad';
}

const statusConfig: Record<BenchmarkStatus, { 
  color: string; 
  icon: typeof CheckCircle; 
  symbol: string 
}> = {
  good: { color: 'text-green-500', icon: CheckCircle, symbol: '✓' },
  warning: { color: 'text-yellow-500', icon: AlertTriangle, symbol: '!' },
  bad: { color: 'text-red-500', icon: XCircle, symbol: '✗' },
};

export function BenchmarkIndicator({
  value,
  benchmark,
  higherIsBetter = true,
  showIcon = false,
  className,
}: BenchmarkIndicatorProps) {
  const status = getBenchmarkStatus(value, benchmark, higherIsBetter);
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={cn('text-xs flex items-center gap-1', config.color, className)}>
      {showIcon ? (
        <Icon className="h-3 w-3" />
      ) : (
        <span>{config.symbol}</span>
      )}
      <span>Benchmark: {benchmark}%</span>
    </span>
  );
}
