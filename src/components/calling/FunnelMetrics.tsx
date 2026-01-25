import { Card, CardContent } from '@/components/ui/card';
import { Phone, PhoneCall, CheckCircle, Calendar, Clock, Star, Flame } from 'lucide-react';
import { CallingMetricsConfig, getScoreStatus, getScoreStatusColor, formatScore, formatCallingDuration } from '@/lib/callingConfig';

interface FunnelMetricsProps {
  totalCalls: number;
  connections: number;
  completed: number;
  meetings: number;
  talkTimeSeconds: number;
  avgScore: number | null;
  activated: number;
  config: CallingMetricsConfig;
}

export function FunnelMetrics({
  totalCalls,
  connections,
  completed,
  meetings,
  talkTimeSeconds,
  avgScore,
  activated,
  config,
}: FunnelMetricsProps) {
  const connectRate = totalCalls > 0 ? (connections / totalCalls) * 100 : 0;
  const completionRate = connections > 0 ? (completed / connections) * 100 : 0;
  const meetingRate = completed > 0 ? (meetings / completed) * 100 : 0;
  const activationRate = completed > 0 ? (activated / completed) * 100 : 0;
  const avgTalkTime = connections > 0 ? talkTimeSeconds / connections : 0;

  const overallStatus = getScoreStatus(avgScore, config.overallQualityThresholds);

  // Row 1: Main funnel metrics (5 cards)
  const topRowCards = [
    {
      icon: Phone,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
      label: 'DIALS',
      value: totalCalls.toLocaleString(),
      subValue: null,
      subLabel: null,
    },
    {
      icon: PhoneCall,
      iconColor: 'text-chart-2',
      iconBg: 'bg-chart-2/10',
      label: 'CONNECTS',
      value: connections.toLocaleString(),
      subValue: `${connectRate.toFixed(1)}%`,
      subLabel: 'of dials',
    },
    {
      icon: CheckCircle,
      iconColor: 'text-chart-3',
      iconBg: 'bg-chart-3/10',
      label: 'COMPLETED',
      value: completed.toLocaleString(),
      subValue: `${completionRate.toFixed(1)}%`,
      subLabel: 'of connects',
    },
    {
      icon: Calendar,
      iconColor: 'text-chart-4',
      iconBg: 'bg-chart-4/10',
      label: 'MEETINGS',
      value: meetings.toLocaleString(),
      subValue: `${meetingRate.toFixed(1)}%`,
      subLabel: 'of completed',
    },
    {
      icon: Flame,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-500/10',
      label: 'ACTIVATED',
      value: activated.toLocaleString(),
      subValue: `${activationRate.toFixed(1)}%`,
      subLabel: 'willing to sell',
    },
  ];

  // Row 2: Quality metrics (3 cards)
  const bottomRowCards = [
    {
      icon: Clock,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
      label: 'TALK TIME',
      value: formatCallingDuration(talkTimeSeconds),
      subValue: `${Math.round(avgTalkTime / 60)}m/call`,
      subLabel: null,
    },
    {
      icon: Star,
      iconColor: getScoreStatusColor(overallStatus).replace('bg-', 'text-').replace('/10', ''),
      iconBg: getScoreStatusColor(overallStatus),
      label: 'AVG SCORE',
      value: formatScore(avgScore, config),
      subValue: '/10',
      subLabel: null,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Row - Main Funnel (5 cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {topRowCards.map((card, idx) => (
          <Card key={idx}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                  {card.subValue && (
                    <p className="text-xs text-muted-foreground truncate">
                      <span className="font-medium text-foreground">{card.subValue}</span>
                      {card.subLabel && <span> {card.subLabel}</span>}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Row - Quality Metrics (2 cards) */}
      <div className="grid grid-cols-2 gap-4">
        {bottomRowCards.map((card, idx) => (
          <Card key={idx}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                  <p className="text-2xl font-bold">
                    {card.value}
                    {card.subValue && <span className="text-sm text-muted-foreground">{card.subValue}</span>}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
