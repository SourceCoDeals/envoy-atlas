import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Mail, Reply, ThumbsUp, AlertTriangle, Ban, ShieldAlert } from 'lucide-react';
import type { MonthlyMetrics } from '@/hooks/useMonthlyReportData';

interface MonthlyKPICardsProps {
  currentMetrics: MonthlyMetrics;
  previousMetrics: MonthlyMetrics;
}

interface KPICardProps {
  label: string;
  value: string;
  subValue?: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  status?: 'good' | 'warning' | 'bad' | 'neutral';
  benchmark?: string;
  inverse?: boolean;
}

function KPICard({ label, value, subValue, change, changeLabel, icon, status = 'neutral', benchmark, inverse = false }: KPICardProps) {
  const statusColors = {
    good: 'border-[hsl(var(--success))] bg-[hsl(var(--success)/0.05)]',
    warning: 'border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.05)]',
    bad: 'border-destructive bg-destructive/5',
    neutral: 'border-border',
  };

  const getTrendColor = (change?: number) => {
    if (change === undefined || Math.abs(change) < 0.1) return 'text-muted-foreground';
    const isPositive = inverse ? change < 0 : change > 0;
    return isPositive ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--metric-negative))]';
  };

  return (
    <Card className={`${statusColors[status]} border`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground">{subValue}</p>
            )}
          </div>
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            {icon}
          </div>
        </div>
        
        <div className="mt-3 flex items-center justify-between">
          {change !== undefined && (
            <span className={`flex items-center gap-1 text-xs font-medium ${getTrendColor(change)}`}>
              {Math.abs(change) < 0.1 ? (
                <><Minus className="h-3 w-3" /> {changeLabel || 'No change'}</>
              ) : change > 0 ? (
                <><TrendingUp className="h-3 w-3" /> +{change.toFixed(1)}% {changeLabel || 'MoM'}</>
              ) : (
                <><TrendingDown className="h-3 w-3" /> {change.toFixed(1)}% {changeLabel || 'MoM'}</>
              )}
            </span>
          )}
          {benchmark && (
            <span className="text-xs text-muted-foreground">{benchmark}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MonthlyKPICards({ currentMetrics, previousMetrics }: MonthlyKPICardsProps) {
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
  const prevDeliveredRate = previousMetrics.sent > 0 ? (previousMetrics.delivered / previousMetrics.sent) * 100 : 0;
  
  const spamRate = currentMetrics.sent > 0 ? (currentMetrics.spamComplaints / currentMetrics.sent) * 100 : 0;
  const prevSpamRate = previousMetrics.sent > 0 ? (previousMetrics.spamComplaints / previousMetrics.sent) * 100 : 0;

  const getReplyStatus = (rate: number) => {
    if (rate >= 3) return 'good';
    if (rate >= 1) return 'neutral';
    return 'warning';
  };

  const getBounceStatus = (rate: number) => {
    if (rate <= 2) return 'good';
    if (rate <= 5) return 'neutral';
    return 'bad';
  };

  const getSpamStatus = (rate: number) => {
    if (rate <= 0.05) return 'good';
    if (rate <= 0.1) return 'warning';
    return 'bad';
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KPICard
        label="Emails Sent"
        value={currentMetrics.sent.toLocaleString()}
        subValue={`${currentMetrics.delivered.toLocaleString()} delivered`}
        change={calculateChange(currentMetrics.sent, previousMetrics.sent)}
        icon={<Mail className="h-4 w-4 text-primary" />}
        status="neutral"
      />
      
      <KPICard
        label="Delivered Rate"
        value={`${deliveredRate.toFixed(1)}%`}
        subValue={`${currentMetrics.delivered.toLocaleString()} emails`}
        change={deliveredRate - prevDeliveredRate}
        changeLabel="pts"
        icon={<Mail className="h-4 w-4 text-[hsl(var(--success))]" />}
        status={deliveredRate >= 95 ? 'good' : deliveredRate >= 90 ? 'neutral' : 'bad'}
        benchmark=">95% target"
      />
      
      <KPICard
        label="Reply Rate"
        value={`${replyRate.toFixed(2)}%`}
        subValue={`${currentMetrics.replied.toLocaleString()} replies`}
        change={replyRate - prevReplyRate}
        changeLabel="pts"
        icon={<Reply className="h-4 w-4 text-primary" />}
        status={getReplyStatus(replyRate)}
        benchmark="3% avg"
      />
      
      <KPICard
        label="Positive Rate"
        value={`${positiveRate.toFixed(2)}%`}
        subValue={`${currentMetrics.positiveReplies.toLocaleString()} positive`}
        change={positiveRate - prevPositiveRate}
        changeLabel="pts"
        icon={<ThumbsUp className="h-4 w-4 text-[hsl(var(--success))]" />}
        status={positiveRate >= 1.5 ? 'good' : positiveRate >= 0.5 ? 'neutral' : 'warning'}
        benchmark="1.5% avg"
      />
      
      <KPICard
        label="Bounce Rate"
        value={`${bounceRate.toFixed(2)}%`}
        subValue={`${currentMetrics.bounced.toLocaleString()} bounced`}
        change={bounceRate - prevBounceRate}
        changeLabel="pts"
        icon={<AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />}
        status={getBounceStatus(bounceRate)}
        benchmark="<5% target"
        inverse
      />
      
      <KPICard
        label="Spam Rate"
        value={`${spamRate.toFixed(3)}%`}
        subValue={`${currentMetrics.spamComplaints.toLocaleString()} complaints`}
        change={spamRate - prevSpamRate}
        changeLabel="pts"
        icon={<ShieldAlert className="h-4 w-4 text-destructive" />}
        status={getSpamStatus(spamRate)}
        benchmark="<0.1% target"
        inverse
      />
    </div>
  );
}
