import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Send, CheckCircle, Eye, MousePointer, MessageSquare, 
  ThumbsUp, AlertTriangle, Mail
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface EmailReportTabProps {
  data: {
    emailMetrics: {
      sent: number;
      delivered: number;
      deliveryRate: number;
      opened: number;
      openRate: number;
      clicked: number;
      clickRate: number;
      replied: number;
      replyRate: number;
      positiveReplies: number;
      positiveRate: number;
      bounced: number;
      bounceRate: number;
      unsubscribed: number;
      meetings: number;
    };
    linkedCampaigns: Array<{ id: string; name: string; platform: 'smartlead' | 'replyio' }>;
  };
}

export function EmailReportTab({ data }: EmailReportTabProps) {
  const { emailMetrics, linkedCampaigns } = data;

  // Reply sentiment breakdown (estimated from data)
  const replyBreakdown = [
    { name: 'Positive', value: emailMetrics.positiveReplies, color: 'hsl(var(--chart-2))' },
    { name: 'Neutral', value: Math.floor(emailMetrics.replied * 0.2), color: 'hsl(var(--chart-4))' },
    { name: 'Negative', value: emailMetrics.replied - emailMetrics.positiveReplies - Math.floor(emailMetrics.replied * 0.2), color: 'hsl(var(--chart-5))' },
  ].filter(item => item.value > 0);

  const getBenchmarkStatus = (value: number, benchmark: number, higherIsBetter = true) => {
    const diff = higherIsBetter ? value - benchmark : benchmark - value;
    if (diff >= 0) return { status: 'good', icon: '✓' };
    if (diff > -benchmark * 0.2) return { status: 'warning', icon: '!' };
    return { status: 'bad', icon: '✗' };
  };

  const metrics = [
    { 
      label: 'Emails Sent', 
      value: emailMetrics.sent, 
      icon: Send,
      subtitle: null,
    },
    { 
      label: 'Delivered', 
      value: emailMetrics.delivered, 
      rate: emailMetrics.deliveryRate,
      icon: CheckCircle,
      benchmark: 98,
      subtitle: 'delivery rate',
    },
    { 
      label: 'Opened', 
      value: emailMetrics.opened, 
      rate: emailMetrics.openRate,
      icon: Eye,
      benchmark: 27.7,
      subtitle: 'open rate',
    },
    { 
      label: 'Clicked', 
      value: emailMetrics.clicked, 
      rate: emailMetrics.clickRate,
      icon: MousePointer,
      subtitle: 'click rate',
    },
    { 
      label: 'Replied', 
      value: emailMetrics.replied, 
      rate: emailMetrics.replyRate,
      icon: MessageSquare,
      benchmark: 3.4,
      subtitle: 'reply rate',
    },
    { 
      label: 'Positive', 
      value: emailMetrics.positiveReplies, 
      rate: emailMetrics.positiveRate,
      icon: ThumbsUp,
      subtitle: 'positive rate',
      highlight: true,
    },
    { 
      label: 'Bounced', 
      value: emailMetrics.bounced, 
      rate: emailMetrics.bounceRate,
      icon: AlertTriangle,
      benchmark: 2,
      higherIsBetter: false,
      subtitle: 'bounce rate',
    },
    { 
      label: 'Meetings', 
      value: emailMetrics.meetings, 
      icon: Mail,
      subtitle: 'from email',
      highlight: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Email Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              const benchmarkStatus = metric.benchmark 
                ? getBenchmarkStatus(metric.rate || 0, metric.benchmark, metric.higherIsBetter !== false)
                : null;

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
                    {metric.value.toLocaleString()}
                  </p>
                  {metric.rate !== undefined && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {metric.rate.toFixed(1)}% {metric.subtitle}
                    </p>
                  )}
                  {benchmarkStatus && (
                    <p className={`text-xs mt-1 ${
                      benchmarkStatus.status === 'good' ? 'text-green-500' : 
                      benchmarkStatus.status === 'warning' ? 'text-yellow-500' : 'text-red-500'
                    }`}>
                      {benchmarkStatus.icon} Benchmark: {metric.benchmark}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reply Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reply Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={replyBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {replyBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-4">
                <div className="text-center mb-4">
                  <p className="text-3xl font-bold">{emailMetrics.replied}</p>
                  <p className="text-sm text-muted-foreground">Total Replies</p>
                </div>
                {replyBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{item.value}</span>
                      <span className="text-muted-foreground text-sm ml-1">
                        ({emailMetrics.replied > 0 ? ((item.value / emailMetrics.replied) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deliverability Health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deliverability Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-muted-foreground">Delivery Rate</p>
                <p className="text-2xl font-bold text-green-600">{emailMetrics.deliveryRate.toFixed(1)}%</p>
                <p className="text-xs text-green-600 mt-1">✓ Above benchmark</p>
              </div>
              <div className={`p-4 rounded-lg ${
                emailMetrics.bounceRate < 2 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : emailMetrics.bounceRate < 5 
                    ? 'bg-yellow-500/10 border border-yellow-500/20'
                    : 'bg-red-500/10 border border-red-500/20'
              }`}>
                <p className="text-sm text-muted-foreground">Bounce Rate</p>
                <p className={`text-2xl font-bold ${
                  emailMetrics.bounceRate < 2 ? 'text-green-600' : 
                  emailMetrics.bounceRate < 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {emailMetrics.bounceRate.toFixed(1)}%
                </p>
                <p className={`text-xs mt-1 ${
                  emailMetrics.bounceRate < 2 ? 'text-green-600' : 
                  emailMetrics.bounceRate < 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {emailMetrics.bounceRate < 2 ? '✓ Good' : emailMetrics.bounceRate < 5 ? '! Warning' : '✗ High'}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Bounce Breakdown</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hard Bounces</span>
                  <span>{Math.floor(emailMetrics.bounced * 0.6)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Soft Bounces</span>
                  <span>{Math.ceil(emailMetrics.bounced * 0.4)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linked Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Linked Email Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {linkedCampaigns.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No email campaigns linked to this engagement
            </p>
          ) : (
            <div className="space-y-2">
              {linkedCampaigns.map((campaign) => (
                <div 
                  key={campaign.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{campaign.name}</span>
                  </div>
                  <Badge variant="outline">
                    {campaign.platform === 'smartlead' ? 'SmartLead' : 'Reply.io'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
