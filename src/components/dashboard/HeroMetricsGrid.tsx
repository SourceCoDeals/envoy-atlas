import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus, Mail, MessageSquare, ThumbsUp, Calendar } from 'lucide-react';
import { MetricTooltip } from '@/components/ui/metric-tooltip';
import type { HeroMetric } from '@/hooks/useOverviewDashboard';

interface HeroMetricsGridProps {
  metrics: HeroMetric[];
}

const iconMap: Record<string, typeof Mail> = {
  'Emails Sent': Mail,
  'Reply Rate': MessageSquare,
  'Positive Reply Rate': ThumbsUp,
  'Meeting Booked Rate': Calendar,
};

const colorMap: Record<string, string> = {
  'Emails Sent': 'text-chart-1',
  'Reply Rate': 'text-chart-2',
  'Positive Reply Rate': 'text-success',
  'Meeting Booked Rate': 'text-chart-4',
};

const metricKeyMap: Record<string, string> = {
  'Emails Sent': 'emails_sent',
  'Reply Rate': 'reply_rate',
  'Positive Reply Rate': 'positive_reply_rate',
  'Meeting Booked Rate': 'meeting_booked_rate',
};

export function HeroMetricsGrid({ metrics }: HeroMetricsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {metrics.map((metric) => {
        const Icon = iconMap[metric.label] || Mail;
        const iconColor = colorMap[metric.label] || 'text-primary';
        const metricKey = metricKeyMap[metric.label] || 'emails_sent';
        
        const TrendIcon = metric.trend === 'up' ? ArrowUp : metric.trend === 'down' ? ArrowDown : Minus;
        const trendColor = metric.trend === 'up' 
          ? 'text-success' 
          : metric.trend === 'down' 
            ? 'text-destructive' 
            : 'text-muted-foreground';

        const formattedValue = metric.format === 'percent' 
          ? `${metric.value.toFixed(2)}%`
          : metric.value.toLocaleString();

        return (
          <Card key={metric.label} className="relative overflow-hidden">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between mb-2">
                <Icon className={`h-5 w-5 ${iconColor}`} />
                <div className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
                  <TrendIcon className="h-3.5 w-3.5" />
                  <span>{metric.change.toFixed(1)}%</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight font-mono">
                  {formattedValue}
                </p>
                <MetricTooltip metricKey={metricKey} showIcon>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {metric.label}
                  </p>
                </MetricTooltip>
              </div>
              
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">
                vs last week
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
