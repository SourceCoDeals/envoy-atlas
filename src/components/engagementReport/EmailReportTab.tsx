import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Send, CheckCircle, MessageSquare, 
  ThumbsUp, AlertTriangle, Mail, Globe, Inbox, Activity,
  ChevronDown, ChevronUp, Shield, ShieldCheck, ShieldX,
  Flame, Gauge, Users, Clock, UserPlus
} from 'lucide-react';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { InfrastructureMetrics, DomainBreakdown, EnrollmentMetrics, WeeklyEnrollmentTrend, WeeklyPerformance } from '@/hooks/useEngagementReport';
import { DataAvailabilityWarning } from './DataAvailabilityWarning';
import { DataErrorFlag } from '@/components/ui/data-error-flag';
import { SentimentAnalysisNotAvailable } from '@/components/ui/data-status-banner';
import { WeeklyPerformanceBreakdown } from './WeeklyPerformanceBreakdown';

interface DataAvailability {
  emailDailyMetrics: boolean;
  emailCampaignFallback: boolean;
  callingData: boolean;
  infrastructureData: boolean;
  syncInProgress: boolean;
}

interface EmailReportTabProps {
  data: {
    emailMetrics: {
      sent: number;
      delivered: number;
      deliveryRate: number;
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
    infrastructureMetrics: InfrastructureMetrics;
    enrollmentMetrics?: EnrollmentMetrics;
    weeklyEnrollmentTrend?: WeeklyEnrollmentTrend[];
    weeklyPerformance?: WeeklyPerformance[];
    dataAvailability?: DataAvailability;
  };
}

export function EmailReportTab({ data }: EmailReportTabProps) {
  const { emailMetrics, linkedCampaigns, infrastructureMetrics, enrollmentMetrics, weeklyEnrollmentTrend, weeklyPerformance, dataAvailability } = data;
  const [domainsExpanded, setDomainsExpanded] = useState(false);

  // Default infrastructure metrics if not available
  const infra = infrastructureMetrics ?? {
    totalDomains: 0,
    totalMailboxes: 0,
    activeMailboxes: 0,
    totalDailyCapacity: 0,
    currentDailySending: 0,
    utilizationRate: 0,
    warmupCount: 0,
    domainsWithFullAuth: 0,
    avgHealthScore: 0,
    avgBounceRate: 0,
    domainBreakdown: [],
  };

  const getBenchmarkStatus = (value: number, benchmark: number, higherIsBetter = true) => {
    const diff = higherIsBetter ? value - benchmark : benchmark - value;
    if (diff >= 0) return { status: 'good', icon: '✓' };
    if (diff > -benchmark * 0.2) return { status: 'warning', icon: '!' };
    return { status: 'bad', icon: '✗' };
  };

  const getAuthIcon = (valid: boolean | null) => {
    if (valid === true) return <ShieldCheck className="h-4 w-4 text-green-500" />;
    if (valid === false) return <ShieldX className="h-4 w-4 text-red-500" />;
    return <Shield className="h-4 w-4 text-muted-foreground" />;
  };

  const metrics = [
    { 
      label: 'Emails Sent', 
      value: emailMetrics.sent, 
      icon: Send,
      subtitle: null,
      isActual: true,
    },
    { 
      label: 'Delivered', 
      value: emailMetrics.delivered, 
      rate: emailMetrics.deliveryRate,
      icon: CheckCircle,
      benchmark: 98,
      subtitle: 'delivery rate',
      isActual: true,
    },
    { 
      label: 'Replied', 
      value: emailMetrics.replied, 
      rate: emailMetrics.replyRate,
      icon: MessageSquare,
      benchmark: 3.4,
      subtitle: 'reply rate',
      isActual: true,
    },
    { 
      label: 'Positive', 
      value: emailMetrics.positiveReplies, 
      rate: emailMetrics.positiveRate,
      icon: ThumbsUp,
      subtitle: 'positive rate',
      highlight: true,
      isActual: emailMetrics.positiveReplies > 0, // Only marked as actual if we have data
      tooltip: emailMetrics.positiveReplies === 0 ? 'Not classified - requires reply text sync' : undefined,
    },
    { 
      label: 'Bounced', 
      value: emailMetrics.bounced, 
      rate: emailMetrics.bounceRate,
      icon: AlertTriangle,
      benchmark: 2,
      higherIsBetter: false,
      subtitle: 'bounce rate',
      isActual: true,
    },
    { 
      label: 'Meetings', 
      value: emailMetrics.meetings, 
      icon: Mail,
      subtitle: 'from email',
      highlight: emailMetrics.meetings > 0,
      isActual: false, // Not tracked - requires calendar integration
      tooltip: 'Not tracked - requires calendar integration',
    },
  ];

  const hasEnrollmentData = enrollmentMetrics && enrollmentMetrics.totalLeads > 0;
  const hasBacklog = enrollmentMetrics && enrollmentMetrics.notStarted > 0;

  return (
    <div className="space-y-6">
      {/* Backlog Alert */}
      {hasBacklog && (
        <Alert variant="destructive" className="border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sending Backlog Detected</AlertTitle>
          <AlertDescription>
            {enrollmentMetrics.notStarted.toLocaleString()} contacts are enrolled but haven't received their first email yet. 
            This may be due to campaign sending limits or mailbox capacity constraints.
          </AlertDescription>
        </Alert>
      )}

      {/* Lead Enrollment Status */}
      {hasEnrollmentData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Lead Enrollment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Enrolled</span>
                </div>
                <p className="text-2xl font-bold">{enrollmentMetrics.totalLeads.toLocaleString()}</p>
              </div>
              
              <div className={`p-4 rounded-lg border ${hasBacklog ? 'bg-warning/10 border-warning/30' : 'bg-card'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-warning" />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Backlog (Not Started)</span>
                </div>
                <p className={`text-2xl font-bold ${hasBacklog ? 'text-warning' : ''}`}>
                  {enrollmentMetrics.notStarted.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {enrollmentMetrics.backlogRate.toFixed(1)}% of enrolled
                </p>
              </div>
              
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">In Progress</span>
                </div>
                <p className="text-2xl font-bold">{enrollmentMetrics.inProgress.toLocaleString()}</p>
              </div>
              
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed</span>
                </div>
                <p className="text-2xl font-bold text-success">{enrollmentMetrics.completed.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Enrollment Trend Chart */}
      {weeklyEnrollmentTrend && weeklyEnrollmentTrend.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              New Leads Enrolled Per Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyEnrollmentTrend}>
                <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="newLeadsEnrolled" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="New Leads"
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="backlog" 
                  stroke="hsl(var(--warning))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Backlog"
                  dot={{ fill: 'hsl(var(--warning))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Week-by-Week Performance Breakdown */}
      {weeklyPerformance && weeklyPerformance.length > 0 && (
        <WeeklyPerformanceBreakdown weeklyData={weeklyPerformance} />
      )}

      {/* Data Availability Warning */}
      {dataAvailability?.emailCampaignFallback && (
        <DataAvailabilityWarning type="fallback" />
      )}
      {dataAvailability?.syncInProgress && (
        <DataAvailabilityWarning type="syncing" />
      )}
      
      {/* Sending Infrastructure */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Sending Infrastructure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Domains</span>
              </div>
              <p className="text-2xl font-bold">{infra.totalDomains}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {infra.domainsWithFullAuth} fully authenticated
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Inbox className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mailboxes</span>
              </div>
              <p className="text-2xl font-bold">{infra.totalMailboxes}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {infra.activeMailboxes} active
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Send className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Daily Capacity</span>
              </div>
              <p className="text-2xl font-bold">{infra.totalDailyCapacity.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">emails/day</p>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Utilization</span>
              </div>
              <p className={`text-2xl font-bold ${
                infra.utilizationRate > 80 ? 'text-red-500' : 
                infra.utilizationRate > 60 ? 'text-yellow-500' : 'text-green-500'
              }`}>
                {infra.utilizationRate.toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {infra.currentDailySending.toLocaleString()} sent/day
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Warmup</span>
              </div>
              <p className="text-2xl font-bold">{infra.warmupCount}</p>
              <p className="text-xs text-muted-foreground mt-1">inboxes warming</p>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Health Score</span>
              </div>
              <p className={`text-2xl font-bold ${
                infra.avgHealthScore >= 80 ? 'text-green-500' : 
                infra.avgHealthScore >= 60 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {infra.avgHealthScore}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                avg bounce: {infra.avgBounceRate.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Capacity Utilization Bar */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Capacity Utilization</span>
              <span className="text-sm text-muted-foreground">
                {infra.currentDailySending.toLocaleString()} / {infra.totalDailyCapacity.toLocaleString()} emails/day
              </span>
            </div>
            <Progress 
              value={Math.min(infra.utilizationRate, 100)} 
              className="h-3"
            />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>0%</span>
              <span className={
                infra.utilizationRate > 80 ? 'text-red-500 font-medium' : 
                infra.utilizationRate > 60 ? 'text-yellow-500 font-medium' : ''
              }>
                {infra.utilizationRate.toFixed(1)}% used
              </span>
              <span>100%</span>
            </div>
          </div>

          {/* Domain Authentication Table */}
          <Collapsible open={domainsExpanded} onOpenChange={setDomainsExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="font-medium">Domain Authentication</span>
                <Badge variant="outline" className="ml-2">
                  {infra.domainsWithFullAuth}/{infra.totalDomains} verified
                </Badge>
              </div>
              {domainsExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Domain</th>
                      <th className="text-center p-3 font-medium">Inboxes</th>
                      <th className="text-center p-3 font-medium">Capacity</th>
                      <th className="text-center p-3 font-medium">SPF</th>
                      <th className="text-center p-3 font-medium">DKIM</th>
                      <th className="text-center p-3 font-medium">DMARC</th>
                      <th className="text-center p-3 font-medium">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {infra.domainBreakdown.slice(0, 10).map((domain) => (
                      <tr key={domain.domain} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">{domain.domain}</td>
                        <td className="p-3 text-center">{domain.mailboxCount}</td>
                        <td className="p-3 text-center">{domain.dailyCapacity.toLocaleString()}</td>
                        <td className="p-3 text-center">{getAuthIcon(domain.spfValid)}</td>
                        <td className="p-3 text-center">{getAuthIcon(domain.dkimValid)}</td>
                        <td className="p-3 text-center">{getAuthIcon(domain.dmarcValid)}</td>
                        <td className="p-3 text-center">
                          <Badge variant={
                            domain.healthScore >= 80 ? 'default' :
                            domain.healthScore >= 60 ? 'secondary' : 'destructive'
                          }>
                            {domain.healthScore}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {infra.domainBreakdown.length > 10 && (
                  <div className="p-3 text-center text-sm text-muted-foreground bg-muted/30">
                    +{infra.domainBreakdown.length - 10} more domains
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Email Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                    {!metric.isActual && (
                      <DataErrorFlag type="not-tracked" size="sm" tooltip={metric.tooltip} />
                    )}
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

      {/* Reply Analysis - Show only actual data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reply Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <SentimentAnalysisNotAvailable />
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className={`p-4 ${emailMetrics.positiveReplies > 0 ? 'bg-green-500/10 border-green-500/20' : 'border-dashed'}`}>
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Positive Replies</p>
                {emailMetrics.positiveReplies === 0 && (
                  <DataErrorFlag type="not-tracked" size="sm" tooltip="Not classified - requires reply text sync" />
                )}
              </div>
              <p className={`text-3xl font-bold mt-1 ${emailMetrics.positiveReplies > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                {emailMetrics.positiveReplies > 0 ? emailMetrics.positiveReplies : '—'}
              </p>
              <p className={`text-xs mt-1 ${emailMetrics.positiveReplies > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                {emailMetrics.positiveReplies > 0 ? '✓ Tracked' : 'Not classified'}
              </p>
            </Card>
            
            <Card className="p-4 border-dashed">
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Neutral Replies</p>
                <DataErrorFlag type="not-tracked" size="sm" />
              </div>
              <p className="text-3xl font-bold text-muted-foreground mt-1">—</p>
              <p className="text-xs text-muted-foreground mt-1">Not classified</p>
            </Card>
            
            <Card className="p-4 border-dashed">
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Negative Replies</p>
                <DataErrorFlag type="not-tracked" size="sm" />
              </div>
              <p className="text-3xl font-bold text-muted-foreground mt-1">—</p>
              <p className="text-xs text-muted-foreground mt-1">Not classified</p>
            </Card>
          </div>
          
          <div className="mt-4 p-3 rounded-lg bg-muted/30">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Replies</span>
              <span className="text-lg font-bold">{emailMetrics.replied}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unsubscribes - marked as not tracked */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Unsubscribes
            <DataErrorFlag type="not-tracked" size="sm" tooltip="Not tracked - Smartlead/Reply.io data" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-muted-foreground">—</p>
          <p className="text-xs text-muted-foreground mt-1">Requires platform integration</p>
        </CardContent>
      </Card>
    </div>
  );
}