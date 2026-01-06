import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MonthlyMetrics } from '@/hooks/useMonthlyReportData';

interface BenchmarkComparisonProps {
  currentMetrics: MonthlyMetrics;
}

interface Benchmark {
  label: string;
  value: number;
  benchmark: number;
  format: 'percent' | 'number';
  inverse?: boolean; // true if lower is better
  benchmarkLabel: string;
}

export function BenchmarkComparison({ currentMetrics }: BenchmarkComparisonProps) {
  const replyRate = currentMetrics.sent > 0 ? (currentMetrics.replied / currentMetrics.sent) * 100 : 0;
  const positiveRate = currentMetrics.sent > 0 ? (currentMetrics.positiveReplies / currentMetrics.sent) * 100 : 0;
  const bounceRate = currentMetrics.sent > 0 ? (currentMetrics.bounced / currentMetrics.sent) * 100 : 0;
  const spamRate = currentMetrics.sent > 0 ? (currentMetrics.spamComplaints / currentMetrics.sent) * 100 : 0;
  const deliveredRate = currentMetrics.sent > 0 ? (currentMetrics.delivered / currentMetrics.sent) * 100 : 0;

  // Industry benchmarks for cold email (2025-2026 data)
  const benchmarks: Benchmark[] = [
    { label: 'Reply Rate', value: replyRate, benchmark: 3.0, format: 'percent', benchmarkLabel: '3% avg' },
    { label: 'Positive Rate', value: positiveRate, benchmark: 1.5, format: 'percent', benchmarkLabel: '1.5% avg' },
    { label: 'Bounce Rate', value: bounceRate, benchmark: 5.0, format: 'percent', inverse: true, benchmarkLabel: '<5% target' },
    { label: 'Spam Rate', value: spamRate, benchmark: 0.1, format: 'percent', inverse: true, benchmarkLabel: '<0.1% target' },
    { label: 'Delivered Rate', value: deliveredRate, benchmark: 95, format: 'percent', benchmarkLabel: '>95% target' },
  ];

  const getProgressValue = (value: number, benchmark: number, inverse?: boolean) => {
    if (inverse) {
      // For inverse metrics, being under benchmark is good
      if (value <= 0) return 100;
      const ratio = Math.min(benchmark / value, 2);
      return Math.min(ratio * 50, 100);
    }
    // For normal metrics, higher is better
    const ratio = benchmark > 0 ? value / benchmark : 0;
    return Math.min(ratio * 50 + 25, 100);
  };

  const getStatus = (value: number, benchmark: number, inverse?: boolean) => {
    if (inverse) {
      if (value <= benchmark * 0.5) return 'excellent';
      if (value <= benchmark) return 'good';
      if (value <= benchmark * 2) return 'warning';
      return 'poor';
    }
    if (value >= benchmark * 1.5) return 'excellent';
    if (value >= benchmark) return 'good';
    if (value >= benchmark * 0.5) return 'warning';
    return 'poor';
  };

  const getDifference = (value: number, benchmark: number, inverse?: boolean) => {
    const diff = ((value - benchmark) / benchmark) * 100;
    if (inverse) return -diff;
    return diff;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Industry Benchmark Comparison</CardTitle>
        <p className="text-sm text-muted-foreground">How you compare to industry averages</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {benchmarks.map((item) => {
          const status = getStatus(item.value, item.benchmark, item.inverse);
          const diff = getDifference(item.value, item.benchmark, item.inverse);
          const progressValue = getProgressValue(item.value, item.benchmark, item.inverse);

          return (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{item.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums font-medium">
                    {item.value.toFixed(2)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    vs {item.benchmarkLabel}
                  </span>
                  <span className={`flex items-center gap-1 text-xs font-medium ${
                    status === 'excellent' || status === 'good' 
                      ? 'text-[hsl(var(--success))]' 
                      : status === 'warning' 
                        ? 'text-[hsl(var(--warning))]' 
                        : 'text-destructive'
                  }`}>
                    {Math.abs(diff) < 1 ? (
                      <><Minus className="h-3 w-3" /> on target</>
                    ) : diff > 0 ? (
                      <><TrendingUp className="h-3 w-3" /> +{diff.toFixed(0)}%</>
                    ) : (
                      <><TrendingDown className="h-3 w-3" /> {diff.toFixed(0)}%</>
                    )}
                  </span>
                </div>
              </div>
              <div className="relative">
                <Progress 
                  value={progressValue} 
                  className={`h-2 ${
                    status === 'excellent' || status === 'good' 
                      ? '[&>div]:bg-[hsl(var(--success))]' 
                      : status === 'warning' 
                        ? '[&>div]:bg-[hsl(var(--warning))]' 
                        : '[&>div]:bg-destructive'
                  }`}
                />
                {/* Benchmark marker */}
                <div 
                  className="absolute top-0 w-0.5 h-2 bg-foreground/50"
                  style={{ left: '50%' }}
                />
              </div>
            </div>
          );
        })}

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Benchmarks based on 2025-2026 cold email industry data. The vertical line indicates the industry average.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
