import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Phone, PhoneCall, Users, MessageCircle, CalendarCheck, 
  Voicemail, Clock, Star, AlertTriangle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { ReportMetricCard } from './components/ReportMetricCard';
import { ReportProgressBar } from './components/ReportProgressBar';
import { formatDuration } from './utils/formatters';
import { CALLING_BENCHMARKS } from './constants/thresholds';
import { DataErrorFlag } from '@/components/ui/data-error-flag';

interface CallingReportTabProps {
  data: {
    callingMetrics: {
      totalCalls: number;
      connections: number;
      connectRate: number;
      conversations: number;
      conversationRate: number;
      dmConversations: number;
      meetings: number;
      meetingRate: number;
      voicemails: number;
      voicemailRate: number;
      avgDuration: number;
      avgScore: number;
    };
    callDispositions: Array<{ category: string; count: number; percentage: number }>;
    callOutcomes: Array<{ outcome: string; count: number; percentage: number }>;
  };
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
];

export function CallingReportTab({ data }: CallingReportTabProps) {
  const { callingMetrics, callDispositions, callOutcomes } = data;

  // Check if we have scored calls
  const hasAIScores = callingMetrics.avgScore > 0;
  
  // Filter out tracked vs untracked outcomes
  const actualOutcomes = callOutcomes.filter(o => 
    o.outcome === 'Meeting Booked' || o.outcome === 'Interested'
  );
  // Other outcomes are NOT tracked (show 0) - no longer estimated
  const untrackedOutcomes = callOutcomes.filter(o => 
    o.outcome !== 'Meeting Booked' && o.outcome !== 'Interested'
  );

  const metrics = [
    { 
      label: 'Total Calls', 
      value: callingMetrics.totalCalls, 
      icon: Phone,
      isActual: true,
    },
    { 
      label: 'Connections', 
      value: callingMetrics.connections, 
      rate: callingMetrics.connectRate,
      icon: PhoneCall,
      subtitle: 'connect rate',
      isActual: true,
    },
    { 
      label: 'Conversations', 
      value: callingMetrics.conversations, 
      rate: callingMetrics.conversationRate,
      icon: MessageCircle,
      subtitle: 'of calls',
      isActual: true,
    },
    { 
      label: 'DM Conversations', 
      value: callingMetrics.dmConversations, 
      icon: Users,
      highlight: true,
      isActual: true,
    },
    { 
      label: 'Meetings', 
      value: callingMetrics.meetings, 
      rate: callingMetrics.meetingRate,
      icon: CalendarCheck,
      subtitle: 'meeting rate',
      highlight: true,
      isActual: true,
    },
    { 
      label: 'Voicemails', 
      value: callingMetrics.voicemails, 
      rate: callingMetrics.voicemailRate,
      icon: Voicemail,
      subtitle: 'of calls',
      isActual: true,
    },
    { 
      label: 'Avg Duration', 
      value: formatDuration(callingMetrics.avgDuration), 
      icon: Clock,
      isFormatted: true,
      isActual: true,
    },
    { 
      label: 'Avg Score', 
      value: callingMetrics.avgScore.toFixed(1), 
      icon: Star,
      isFormatted: true,
      isActual: hasAIScores,
      tooltip: hasAIScores ? undefined : 'No calls have been AI scored yet',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Calling Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Calling Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {metrics.map((metric) => (
              <div 
                key={metric.label}
                className={`p-4 rounded-lg border ${metric.highlight ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <metric.icon className={`h-4 w-4 ${metric.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {metric.label}
                  </span>
                  {!metric.isActual && (
                    <DataErrorFlag type="partial" size="sm" tooltip={metric.tooltip} />
                  )}
                </div>
                <p className={`text-2xl font-bold ${metric.highlight ? 'text-primary' : ''}`}>
                  {metric.isFormatted ? metric.value : metric.value.toLocaleString()}
                </p>
                {metric.rate !== undefined && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {metric.rate.toFixed(1)}% {metric.subtitle}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Disposition Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Call Disposition Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {callDispositions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No call data available</p>
            ) : (
              <div className="flex items-center gap-6">
                <div className="w-48 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={callDispositions}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="count"
                      >
                        {callDispositions.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {callDispositions.slice(0, 6).map((item, index) => (
                    <div key={item.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm">{item.category}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{item.count}</span>
                        <span className="text-muted-foreground text-sm ml-1">
                          ({item.percentage.toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation Outcomes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Conversation Outcomes
              {untrackedOutcomes.length > 0 && (
                <DataErrorFlag 
                  type="partial" 
                  size="sm" 
                  tooltip="Some outcome categories require proper call disposition tracking"
                />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {callOutcomes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No outcome data available</p>
            ) : (
              <div className="space-y-4">
                {/* Actual outcomes */}
                <div className="space-y-2">
                  {actualOutcomes.map((outcome) => (
                    <div key={outcome.outcome} className="flex items-center justify-between p-2 rounded bg-green-500/10">
                      <span className="text-sm font-medium">{outcome.outcome}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{outcome.count}</span>
                        <span className="text-xs text-green-600">✓ Tracked</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Untracked outcomes - show as not available */}
                {untrackedOutcomes.length > 0 && (
                  <div className="pt-2 border-t border-dashed">
                    <p className="text-xs text-muted-foreground mb-2">Not tracked (requires call disposition data):</p>
                    {untrackedOutcomes.map((outcome) => (
                      <div key={outcome.outcome} className="flex items-center justify-between p-2 rounded bg-muted/30 opacity-60">
                        <span className="text-sm">{outcome.outcome}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-muted-foreground">—</span>
                          <DataErrorFlag type="not-tracked" size="sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Connect Rate Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connect Rate Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <ReportProgressBar
                value={callingMetrics.connectRate}
                label="Overall Connect Rate"
                valueLabel={`${callingMetrics.connectRate.toFixed(1)}%`}
                size="lg"
              />
              <p className="text-xs text-muted-foreground">
                Industry benchmark: {CALLING_BENCHMARKS.connectRate.min}-{CALLING_BENCHMARKS.connectRate.max}%
              </p>
            </div>
            <div className="space-y-2">
              <ReportProgressBar
                value={callingMetrics.conversationRate}
                label="Conversation Rate"
                valueLabel={`${callingMetrics.conversationRate.toFixed(1)}%`}
                size="lg"
              />
              <p className="text-xs text-muted-foreground">
                Of connections that became conversations
              </p>
            </div>
            <div className="space-y-2">
              <ReportProgressBar
                value={Math.min(100, callingMetrics.meetingRate * 10)}
                label="Meeting Conversion"
                valueLabel={`${callingMetrics.meetingRate.toFixed(1)}%`}
                size="lg"
              />
              <p className="text-xs text-muted-foreground">
                Calls that resulted in meetings
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
