import { Mail, MessageSquare, ThumbsUp, Calendar, BarChart3 } from 'lucide-react';
import { MetricTooltip } from '@/components/ui/metric-tooltip';
import type { TodaysPulse } from '@/hooks/useOverviewDashboard';

interface TodaysPulseBarProps {
  pulse: TodaysPulse;
}

export function TodaysPulseBar({ pulse }: TodaysPulseBarProps) {
  const items = [
    { icon: Mail, label: 'emails sending', metricKey: 'today_emails_sending', value: pulse.emailsSending, color: 'text-chart-1' },
    { icon: MessageSquare, label: 'replies', metricKey: 'today_replies', value: pulse.replies, color: 'text-chart-2' },
    { icon: ThumbsUp, label: 'positive', metricKey: 'today_positive', value: pulse.positive, color: 'text-success' },
    { icon: Calendar, label: 'meetings booked', metricKey: 'today_meetings_booked', value: pulse.meetingsBooked, color: 'text-chart-4' },
  ];

  // Add active campaigns if available (from snapshots)
  if (pulse.activeCampaigns && pulse.activeCampaigns > 0) {
    items.push({ 
      icon: BarChart3, 
      label: 'active campaigns', 
      metricKey: 'active_campaigns',
      value: pulse.activeCampaigns, 
      color: 'text-muted-foreground' 
    });
  }

  return (
    <div className="w-full bg-card border border-border rounded-lg px-4 py-2.5 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max">
        <span className="text-sm font-medium text-muted-foreground shrink-0">Today:</span>
        <div className="flex items-center gap-4 sm:gap-6">
          {items.map((item, i) => (
            <MetricTooltip key={item.label} metricKey={item.metricKey}>
              <div className="flex items-center gap-1.5">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span className="font-mono font-semibold text-sm">{item.value.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">{item.label}</span>
                {i < items.length - 1 && <span className="text-border ml-2 hidden sm:inline">|</span>}
              </div>
            </MetricTooltip>
          ))}
        </div>
      </div>
    </div>
  );
}
