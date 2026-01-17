import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Phone, PhoneCall, Users, MessageCircle, CalendarCheck, 
  Voicemail, Clock, Star
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const metrics = [
    { 
      label: 'Total Calls', 
      value: callingMetrics.totalCalls.toLocaleString(), 
      icon: Phone,
    },
    { 
      label: 'Connections', 
      value: callingMetrics.connections.toLocaleString(), 
      rate: callingMetrics.connectRate,
      icon: PhoneCall,
      subtitle: 'connect rate',
    },
    { 
      label: 'Conversations', 
      value: callingMetrics.conversations.toLocaleString(), 
      rate: callingMetrics.conversationRate,
      icon: MessageCircle,
      subtitle: 'of calls',
    },
    { 
      label: 'DM Conversations', 
      value: callingMetrics.dmConversations.toLocaleString(), 
      icon: Users,
      highlight: true,
    },
    { 
      label: 'Meetings', 
      value: callingMetrics.meetings.toLocaleString(), 
      rate: callingMetrics.meetingRate,
      icon: CalendarCheck,
      subtitle: 'meeting rate',
      highlight: true,
    },
    { 
      label: 'Voicemails', 
      value: callingMetrics.voicemails.toLocaleString(), 
      rate: callingMetrics.voicemailRate,
      icon: Voicemail,
      subtitle: 'of calls',
    },
    { 
      label: 'Avg Duration', 
      value: formatDuration(callingMetrics.avgDuration), 
      icon: Clock,
    },
    { 
      label: 'Avg Score', 
      value: callingMetrics.avgScore.toFixed(1), 
      icon: Star,
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
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div 
                  key={metric.label} 
                  className={`p-4 rounded-lg border ${metric.highlight ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${metric.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {metric.label}
                    </span>
                  </div>
                  <p className={`text-2xl font-bold ${metric.highlight ? 'text-primary' : ''}`}>
                    {metric.value}
                  </p>
                  {metric.rate !== undefined && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {metric.rate.toFixed(1)}% {metric.subtitle}
                    </p>
                  )}
                </div>
              );
            })}
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
            <CardTitle className="text-lg">Conversation Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            {callOutcomes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No outcome data available</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={callOutcomes} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis 
                      type="category" 
                      dataKey="outcome" 
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
              <div className="flex justify-between">
                <span className="text-sm font-medium">Overall Connect Rate</span>
                <span className="text-sm font-bold">{callingMetrics.connectRate.toFixed(1)}%</span>
              </div>
              <Progress value={callingMetrics.connectRate} className="h-3" />
              <p className="text-xs text-muted-foreground">
                Industry benchmark: 15-20%
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Conversation Rate</span>
                <span className="text-sm font-bold">{callingMetrics.conversationRate.toFixed(1)}%</span>
              </div>
              <Progress value={callingMetrics.conversationRate} className="h-3" />
              <p className="text-xs text-muted-foreground">
                Of connections that became conversations
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Meeting Conversion</span>
                <span className="text-sm font-bold">{callingMetrics.meetingRate.toFixed(1)}%</span>
              </div>
              <Progress value={Math.min(100, callingMetrics.meetingRate * 10)} className="h-3" />
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
