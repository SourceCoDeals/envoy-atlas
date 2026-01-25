import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus, Phone, Users, Calendar, Clock, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCallingDuration } from '@/lib/callingConfig';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  format?: 'number' | 'percent' | 'duration' | 'score';
  higherIsBetter?: boolean;
}

function StatCard({ label, value, icon: Icon, trend, format = 'number', higherIsBetter = true }: StatCardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'percent':
        return `${val.toFixed(1)}%`;
      case 'duration':
        return formatCallingDuration(val);
      case 'score':
        return val.toFixed(1);
      default:
        return new Intl.NumberFormat('en-US').format(val);
    }
  };

  const TrendIcon = trend?.direction === 'up' 
    ? ArrowUp 
    : trend?.direction === 'down' 
      ? ArrowDown 
      : Minus;

  const isPositive = trend?.direction === 'up' ? higherIsBetter : !higherIsBetter;
  const trendColor = trend?.direction === 'neutral'
    ? 'text-muted-foreground'
    : isPositive
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <Card className="flex-1">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold">{formatValue(value)}</span>
          {trend && trend.direction !== 'neutral' && (
            <div className={cn('flex items-center gap-0.5 text-sm font-medium', trendColor)}>
              <TrendIcon className="h-3.5 w-3.5" />
              <span>{Math.abs(trend.value).toFixed(1)}%</span>
              {trend.label && (
                <span className="text-xs text-muted-foreground ml-1">{trend.label}</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export interface TopStatsData {
  totalCalls: number;
  totalCallsPrev: number;
  dmConnectRate: number;
  dmConnectRatePrev: number;
  meetingsSet: number;
  meetingsSetPrev: number;
  avgDuration: number;
  avgDurationPrev: number;
  avgScore: number;
  avgScorePrev: number;
}

interface TopStatsRowProps {
  data: TopStatsData;
  isLoading?: boolean;
}

function calculateTrend(current: number, previous: number): { value: number; direction: 'up' | 'down' | 'neutral' } {
  if (previous === 0) return { value: 0, direction: 'neutral' };
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.5) return { value: 0, direction: 'neutral' };
  return { value: change, direction: change > 0 ? 'up' : 'down' };
}

export function TopStatsRow({ data, isLoading }: TopStatsRowProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="flex-1">
            <CardContent className="p-4">
              <div className="h-4 w-20 bg-muted rounded animate-pulse mb-3" />
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <StatCard
        label="Total Calls"
        value={data.totalCalls}
        icon={Phone}
        trend={calculateTrend(data.totalCalls, data.totalCallsPrev)}
        format="number"
      />
      <StatCard
        label="DM Connect Rate"
        value={data.dmConnectRate}
        icon={Users}
        trend={calculateTrend(data.dmConnectRate, data.dmConnectRatePrev)}
        format="percent"
      />
      <StatCard
        label="Meetings Set"
        value={data.meetingsSet}
        icon={Calendar}
        trend={calculateTrend(data.meetingsSet, data.meetingsSetPrev)}
        format="number"
      />
      <StatCard
        label="Avg Duration"
        value={data.avgDuration}
        icon={Clock}
        trend={calculateTrend(data.avgDuration, data.avgDurationPrev)}
        format="duration"
      />
      <StatCard
        label="Avg Score"
        value={data.avgScore}
        icon={Star}
        trend={calculateTrend(data.avgScore, data.avgScorePrev)}
        format="score"
      />
    </div>
  );
}
