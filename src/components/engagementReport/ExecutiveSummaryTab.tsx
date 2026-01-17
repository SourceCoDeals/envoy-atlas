import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Progress } from '@/components/ui/progress';
import {
  Building2, Users, Zap, ThumbsUp, CalendarCheck, TrendingUp, Mail, Phone
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend
} from 'recharts';

interface ExecutiveSummaryTabProps {
  data: {
    keyMetrics: {
      companiesContacted: number;
      contactsReached: number;
      totalTouchpoints: number;
      emailTouchpoints: number;
      callTouchpoints: number;
      positiveResponses: number;
      meetingsScheduled: number;
      opportunities: number;
      responseRate: number;
      meetingRate: number;
    };
    funnel: Array<{ name: string; count: number; percentage: number }>;
    channelComparison: Array<{
      channel: string;
      attempts: number;
      engagementRate: number;
      responseRate: number;
      positiveRate: number;
      meetings: number;
      meetingsPerHundred: number;
    }>;
    trendData: Array<{
      date: string;
      week: string;
      emails: number;
      calls: number;
      responses: number;
      meetings: number;
    }>;
    engagement: {
      meetings_target: number | null;
      total_calls_target: number | null;
    } | null;
  };
}

export function ExecutiveSummaryTab({ data }: ExecutiveSummaryTabProps) {
  const { keyMetrics, funnel, channelComparison, trendData, engagement } = data;

  // Calculate health score based on meeting rate, response rate, and activity
  const meetingProgress = engagement?.meetings_target 
    ? (keyMetrics.meetingsScheduled / engagement.meetings_target) * 100 
    : 50;
  const healthScore = Math.min(100, Math.round(
    (keyMetrics.responseRate * 5) + // Response rate weight
    (keyMetrics.meetingRate * 10) + // Meeting rate weight
    (meetingProgress * 0.3) + // Progress to target weight
    (keyMetrics.totalTouchpoints > 0 ? 20 : 0) // Activity bonus
  ));

  const getHealthColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Campaign Health Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Campaign Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className={`text-5xl font-bold ${getHealthColor(healthScore)}`}>
                {healthScore}
              </div>
              <p className="text-sm text-muted-foreground mt-1">out of 100</p>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Response Rate</span>
                  <span className="font-medium">{keyMetrics.responseRate.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, keyMetrics.responseRate * 10)} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Meeting Conversion</span>
                  <span className="font-medium">{keyMetrics.meetingRate.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, keyMetrics.meetingRate * 20)} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Meetings Progress</span>
                  <span className="font-medium">
                    {keyMetrics.meetingsScheduled} / {engagement?.meetings_target || '—'}
                  </span>
                </div>
                <Progress value={Math.min(100, meetingProgress)} className="h-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Companies</p>
              <p className="text-2xl font-bold mt-1">{keyMetrics.companiesContacted.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">contacted</p>
            </div>
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Contacts</p>
              <p className="text-2xl font-bold mt-1">{keyMetrics.contactsReached.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">reached</p>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Touchpoints</p>
              <p className="text-2xl font-bold mt-1">{keyMetrics.totalTouchpoints.toLocaleString()}</p>
              <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {keyMetrics.emailTouchpoints.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {keyMetrics.callTouchpoints.toLocaleString()}
                </span>
              </div>
            </div>
            <Zap className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Positive</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{keyMetrics.positiveResponses.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">responses</p>
            </div>
            <ThumbsUp className="h-5 w-5 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Meetings</p>
              <p className="text-2xl font-bold mt-1 text-primary">{keyMetrics.meetingsScheduled}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {keyMetrics.meetingRate.toFixed(1)}% rate
              </p>
            </div>
            <CalendarCheck className="h-5 w-5 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Opportunities</p>
              <p className="text-2xl font-bold mt-1">{keyMetrics.opportunities}</p>
              <p className="text-xs text-muted-foreground mt-1">identified</p>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
      </div>

      {/* Funnel Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Outreach Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {funnel.map((stage, index) => (
              <div key={stage.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{stage.name}</span>
                  <span className="text-muted-foreground">
                    {stage.count.toLocaleString()} {index > 0 && `(${stage.percentage}%)`}
                  </span>
                </div>
                <div className="h-8 rounded bg-muted/50 overflow-hidden">
                  <div 
                    className="h-full bg-primary/80 transition-all duration-500"
                    style={{ width: `${Math.max(5, (stage.count / (funnel[0]?.count || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Channel Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Channel Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Metric</th>
                  {channelComparison.map(c => (
                    <th key={c.channel} className="text-center py-3 px-4 font-medium">
                      {c.channel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-2">Total Attempts</td>
                  {channelComparison.map(c => (
                    <td key={c.channel} className="text-center py-3 px-4 font-medium">
                      {c.attempts.toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Engagement Rate</td>
                  {channelComparison.map(c => (
                    <td key={c.channel} className="text-center py-3 px-4">
                      {c.engagementRate.toFixed(1)}%
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Response Rate</td>
                  {channelComparison.map(c => (
                    <td key={c.channel} className="text-center py-3 px-4">
                      {c.responseRate.toFixed(1)}%
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Positive Rate</td>
                  {channelComparison.map(c => (
                    <td key={c.channel} className="text-center py-3 px-4">
                      {c.positiveRate.toFixed(1)}%
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Meetings Generated</td>
                  {channelComparison.map(c => (
                    <td key={c.channel} className="text-center py-3 px-4 font-medium text-primary">
                      {c.meetings}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-2">Meetings per 100 Attempts</td>
                  {channelComparison.map(c => (
                    <td key={c.channel} className="text-center py-3 px-4">
                      {c.meetingsPerHundred.toFixed(2)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Activity Trend */}
      {trendData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activity & Results Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="emails" 
                    name="Emails Sent"
                    stackId="1"
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))"
                    fillOpacity={0.3}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="calls" 
                    name="Calls Made"
                    stackId="2"
                    stroke="hsl(var(--chart-2))" 
                    fill="hsl(var(--chart-2))"
                    fillOpacity={0.3}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="responses" 
                    name="Responses"
                    stroke="hsl(var(--chart-3))" 
                    fill="hsl(var(--chart-3))"
                    fillOpacity={0.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
