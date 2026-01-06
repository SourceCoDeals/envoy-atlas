import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';
import type { MonthlyMetrics } from '@/hooks/useMonthlyReportData';

interface ExecutiveSummaryProps {
  selectedMonth: Date;
  currentMetrics: MonthlyMetrics;
  previousMetrics: MonthlyMetrics;
}

export function ExecutiveSummary({ selectedMonth, currentMetrics, previousMetrics }: ExecutiveSummaryProps) {
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const replyRate = currentMetrics.sent > 0 ? (currentMetrics.replied / currentMetrics.sent) * 100 : 0;
  const prevReplyRate = previousMetrics.sent > 0 ? (previousMetrics.replied / previousMetrics.sent) * 100 : 0;
  const positiveRate = currentMetrics.sent > 0 ? (currentMetrics.positiveReplies / currentMetrics.sent) * 100 : 0;
  const prevPositiveRate = previousMetrics.sent > 0 ? (previousMetrics.positiveReplies / previousMetrics.sent) * 100 : 0;
  const bounceRate = currentMetrics.sent > 0 ? (currentMetrics.bounced / currentMetrics.sent) * 100 : 0;
  const prevBounceRate = previousMetrics.sent > 0 ? (previousMetrics.bounced / previousMetrics.sent) * 100 : 0;
  const deliveredRate = currentMetrics.sent > 0 ? (currentMetrics.delivered / currentMetrics.sent) * 100 : 0;

  // Calculate health score (simplified)
  const healthScore = Math.round(
    Math.min(100, Math.max(0,
      70 +
      (replyRate >= 3 ? 15 : replyRate >= 1 ? 10 : 0) +
      (bounceRate <= 2 ? 10 : bounceRate <= 5 ? 5 : 0) +
      (deliveredRate >= 95 ? 5 : 0)
    ))
  );

  const sentChange = calculateChange(currentMetrics.sent, previousMetrics.sent);
  const replyRateChange = replyRate - prevReplyRate;
  const positiveRateChange = positiveRate - prevPositiveRate;
  const bounceRateChange = bounceRate - prevBounceRate;

  const TrendIndicator = ({ value, inverse = false }: { value: number; inverse?: boolean }) => {
    const isPositive = inverse ? value < 0 : value > 0;
    const isNegative = inverse ? value > 0 : value < 0;
    
    if (Math.abs(value) < 0.1) {
      return <span className="text-muted-foreground flex items-center gap-1"><Minus className="h-3 w-3" /> flat</span>;
    }
    
    return (
      <span className={`flex items-center gap-1 ${isPositive ? 'text-[hsl(var(--metric-positive))]' : isNegative ? 'text-[hsl(var(--metric-negative))]' : 'text-muted-foreground'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {value > 0 ? '+' : ''}{value.toFixed(1)}%
      </span>
    );
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {format(selectedMonth, 'MMMM yyyy')} Performance
            </h2>
            <p className="text-muted-foreground mt-1">
              {format(selectedMonth, 'MMM d')} - {format(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0), 'MMM d, yyyy')}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Health Score</span>
            <Badge 
              variant="outline" 
              className={`text-lg px-4 py-1 ${
                healthScore >= 70 
                  ? 'border-[hsl(var(--success))] text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)]' 
                  : healthScore >= 50 
                    ? 'border-[hsl(var(--warning))] text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)]'
                    : 'border-destructive text-destructive bg-destructive/10'
              }`}
            >
              {healthScore}/100
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Emails Sent</p>
            <p className="text-2xl font-bold tabular-nums">{currentMetrics.sent.toLocaleString()}</p>
            <TrendIndicator value={sentChange} />
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Reply Rate</p>
            <p className="text-2xl font-bold tabular-nums">{replyRate.toFixed(2)}%</p>
            <TrendIndicator value={replyRateChange} />
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Positive Rate</p>
            <p className="text-2xl font-bold tabular-nums">{positiveRate.toFixed(2)}%</p>
            <TrendIndicator value={positiveRateChange} />
          </div>
          
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Bounce Rate</p>
            <p className="text-2xl font-bold tabular-nums">{bounceRate.toFixed(2)}%</p>
            <TrendIndicator value={bounceRateChange} inverse />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
