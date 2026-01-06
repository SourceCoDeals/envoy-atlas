import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Activity, 
  Shield, 
  MessageSquare, 
  Target, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Minus,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// Subscore interfaces for the 4-component health system
interface DeliverabilityIntegrity {
  inboxPlacement: number; // 0-10
  bounceVelocity: number; // 0-8
  spamComplaints: number; // 0-7
  total: number; // 0-25
  issues: string[];
}

interface SenderReputation {
  domainHealth: number; // 0-8
  authentication: number; // 0-6
  ispSignals: number; // 0-6
  total: number; // 0-20
  issues: string[];
}

interface EngagementQuality {
  replyRateVsExpected: number; // 0-10
  positiveRate: number; // 0-8
  timeToReply: number; // 0-4
  replyDepth: number; // 0-3
  total: number; // 0-25
  issues: string[];
}

interface ConversionEfficiency {
  replyToPositive: number; // 0-12
  positiveToMeeting: number; // 0-10
  meetingVelocity: number; // 0-5
  conversionTrend: number; // 0-3
  total: number; // 0-30
  issues: string[];
}

export interface SystemHealthData {
  deliverability: DeliverabilityIntegrity;
  reputation: SenderReputation;
  engagement: EngagementQuality;
  conversion: ConversionEfficiency;
  overallScore: number;
  trend: number; // Points change from last week
  status: 'healthy' | 'warning' | 'problem' | 'critical';
  statusMessage: string;
}

interface HealthInputData {
  bounceRate: number;
  bounceRateLastWeek?: number;
  spamRate: number;
  openRate: number;
  replyRate: number;
  expectedReplyRate?: number;
  positiveReplyRate: number;
  deliveredRate: number;
  avgTimeToReply?: number; // hours
  avgThreadLength?: number;
  replyToPositiveRate?: number;
  positiveToMeetingRate?: number;
  meetingsBooked?: number;
  avgDaysToMeeting?: number;
  conversionTrendDirection?: 'up' | 'stable' | 'down';
  spfValid?: boolean;
  dkimValid?: boolean;
  dmarcValid?: boolean;
  domainAgeMonths?: number;
  totalSent?: number;
}

export function calculateSystemHealth(data: HealthInputData): SystemHealthData {
  const issues: { deliverability: string[]; reputation: string[]; engagement: string[]; conversion: string[] } = {
    deliverability: [],
    reputation: [],
    engagement: [],
    conversion: [],
  };

  // DELIVERABILITY INTEGRITY (25 points max)
  // Inbox Placement Proxy (10 points)
  const deliveryFactor = Math.min(data.deliveredRate / 100, 1);
  const openFactor = Math.min(data.openRate / 40, 1); // 40% is high benchmark
  const replyFactor = data.expectedReplyRate 
    ? Math.min(data.replyRate / data.expectedReplyRate, 1)
    : Math.min(data.replyRate / 3, 1); // 3% baseline
  const inboxPlacement = Math.round((deliveryFactor * 0.3 + openFactor * 0.3 + replyFactor * 0.4) * 10);

  // Bounce Velocity (8 points)
  const currentBounceRate = data.bounceRate;
  const lastWeekBounce = data.bounceRateLastWeek ?? data.bounceRate;
  const bounceAcceleration = lastWeekBounce > 0 ? (currentBounceRate - lastWeekBounce) / lastWeekBounce : 0;
  
  let bouncePenalty = currentBounceRate * 4 + Math.max(0, bounceAcceleration) * 4;
  if (currentBounceRate > 5) bouncePenalty = 8;
  else if (currentBounceRate > 3) bouncePenalty = Math.max(bouncePenalty, 4);
  if (bounceAcceleration > 0.5) bouncePenalty += 2;
  const bounceVelocity = Math.max(0, 8 - Math.min(bouncePenalty, 8));
  
  if (currentBounceRate > 3) issues.deliverability.push(`Bounce rate at ${currentBounceRate.toFixed(1)}%`);
  if (bounceAcceleration > 0.3) issues.deliverability.push('Bounce rate accelerating');

  // Spam Complaints (7 points)
  let spamPenalty = 0;
  if (data.spamRate < 0.1) spamPenalty = 0;
  else if (data.spamRate < 0.2) spamPenalty = 2;
  else if (data.spamRate < 0.3) spamPenalty = 4;
  else if (data.spamRate < 0.5) spamPenalty = 6;
  else spamPenalty = 7;
  const spamComplaints = Math.max(0, 7 - spamPenalty);
  
  if (data.spamRate >= 0.2) issues.deliverability.push(`Spam complaints at ${data.spamRate.toFixed(2)}%`);

  const deliverabilityTotal = inboxPlacement + bounceVelocity + spamComplaints;

  // SENDER REPUTATION (20 points max)
  // Domain Health (8 points)
  const ageMonths = data.domainAgeMonths ?? 12;
  const ageFactor = Math.min(ageMonths / 3, 1); // 3 months to mature
  const historyFactor = Math.max(0, 1 - (data.spamRate * 10));
  const domainHealth = Math.round((ageFactor * 0.3 + historyFactor * 0.7) * 8);

  // Authentication (6 points)
  const spfScore = data.spfValid !== false ? 2 : 0;
  const dkimScore = data.dkimValid !== false ? 2 : 0;
  const dmarcScore = data.dmarcValid !== false ? 2 : 0;
  const authentication = spfScore + dkimScore + dmarcScore;
  
  if (!data.spfValid && data.spfValid !== undefined) issues.reputation.push('SPF not configured');
  if (!data.dkimValid && data.dkimValid !== undefined) issues.reputation.push('DKIM not configured');
  if (!data.dmarcValid && data.dmarcValid !== undefined) issues.reputation.push('DMARC not configured');

  // ISP Signals (6 points) - approximated from engagement
  const ispSignals = Math.round(Math.min((data.openRate / 30 + data.replyRate / 5) / 2 * 6, 6));

  const reputationTotal = domainHealth + authentication + ispSignals;

  // ENGAGEMENT QUALITY (25 points max)
  // Reply Rate vs Expected (10 points)
  const expectedReply = data.expectedReplyRate ?? 3;
  const replyRatioScore = Math.min(data.replyRate / expectedReply, 1) * 10;
  const replyRateVsExpected = Math.round(replyRatioScore);
  
  if (data.replyRate < expectedReply * 0.7) {
    issues.engagement.push(`Reply rate ${data.replyRate.toFixed(1)}% below expected ${expectedReply.toFixed(1)}%`);
  }

  // Positive Rate (8 points) - target 40% of replies being positive
  const targetPositiveRatio = 0.4;
  const actualPositiveRatio = data.replyRate > 0 ? data.positiveReplyRate / data.replyRate : 0;
  const positiveRate = Math.round(Math.min(actualPositiveRatio / targetPositiveRatio, 1) * 8);
  
  if (actualPositiveRatio < 0.3) issues.engagement.push('Low positive reply ratio');

  // Time to Reply (4 points)
  const avgTTR = data.avgTimeToReply ?? 24;
  const normalizedTTR = Math.min(avgTTR / 72, 1);
  const timeToReply = Math.round((1 - normalizedTTR) * 4);

  // Reply Depth (3 points)
  const avgThreadLen = data.avgThreadLength ?? 1.5;
  const replyDepth = Math.round(Math.min(avgThreadLen / 3, 1) * 3);

  const engagementTotal = replyRateVsExpected + positiveRate + timeToReply + replyDepth;

  // CONVERSION EFFICIENCY (30 points max)
  // Reply to Positive (12 points)
  const r2pRate = data.replyToPositiveRate ?? (data.replyRate > 0 ? (data.positiveReplyRate / data.replyRate) * 100 : 0);
  const targetR2P = 40;
  const replyToPositive = Math.round(Math.min(r2pRate / targetR2P, 1) * 12);

  // Positive to Meeting (10 points)
  const p2mRate = data.positiveToMeetingRate ?? 30;
  const targetP2M = 30;
  const positiveToMeeting = Math.round(Math.min(p2mRate / targetP2M, 1) * 10);

  // Meeting Velocity (5 points)
  const daysToMeeting = data.avgDaysToMeeting ?? 7;
  const normalizedMeetingTime = Math.min(daysToMeeting / 14, 1);
  const meetingVelocity = Math.round((1 - normalizedMeetingTime) * 5);

  // Conversion Trend (3 points)
  let conversionTrend = 1.5;
  if (data.conversionTrendDirection === 'up') conversionTrend = 3;
  else if (data.conversionTrendDirection === 'down') conversionTrend = 0;

  const conversionTotal = replyToPositive + positiveToMeeting + meetingVelocity + conversionTrend;

  // OVERALL SCORE
  const overallScore = deliverabilityTotal + reputationTotal + engagementTotal + conversionTotal;

  // Determine status
  let status: 'healthy' | 'warning' | 'problem' | 'critical';
  let statusMessage: string;
  
  if (overallScore >= 85) {
    status = 'healthy';
    statusMessage = 'Systems operating normally';
  } else if (overallScore >= 70) {
    status = 'warning';
    statusMessage = 'One or more areas need attention';
  } else if (overallScore >= 50) {
    status = 'problem';
    statusMessage = 'Significant issues detected';
  } else {
    status = 'critical';
    statusMessage = 'Critical issues require immediate action';
  }

  // Determine primary issue for status message
  const allIssues = [...issues.deliverability, ...issues.reputation, ...issues.engagement, ...issues.conversion];
  if (allIssues.length > 0 && status !== 'healthy') {
    statusMessage = allIssues[0];
  }

  return {
    deliverability: {
      inboxPlacement,
      bounceVelocity,
      spamComplaints,
      total: deliverabilityTotal,
      issues: issues.deliverability,
    },
    reputation: {
      domainHealth,
      authentication,
      ispSignals,
      total: reputationTotal,
      issues: issues.reputation,
    },
    engagement: {
      replyRateVsExpected,
      positiveRate,
      timeToReply,
      replyDepth,
      total: engagementTotal,
      issues: issues.engagement,
    },
    conversion: {
      replyToPositive,
      positiveToMeeting,
      meetingVelocity,
      conversionTrend,
      total: conversionTotal,
      issues: issues.conversion,
    },
    overallScore,
    trend: 0, // Would need historical data
    status,
    statusMessage,
  };
}

interface SystemHealthScoreProps {
  data: SystemHealthData;
  onViewDiagnostics?: () => void;
  onViewRecommendations?: () => void;
}

export function SystemHealthScore({ data, onViewDiagnostics, onViewRecommendations }: SystemHealthScoreProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const getStatusColor = (status: typeof data.status) => {
    switch (status) {
      case 'healthy': return 'text-success';
      case 'warning': return 'text-warning';
      case 'problem': return 'text-orange-500';
      case 'critical': return 'text-destructive';
    }
  };

  const getStatusBg = (status: typeof data.status) => {
    switch (status) {
      case 'healthy': return 'bg-success/10 border-success/30';
      case 'warning': return 'bg-warning/10 border-warning/30';
      case 'problem': return 'bg-orange-500/10 border-orange-500/30';
      case 'critical': return 'bg-destructive/10 border-destructive/30';
    }
  };

  const getStatusIcon = (status: typeof data.status) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-success" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'problem': return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'critical': return <AlertCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getScoreColor = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 85) return 'bg-success';
    if (pct >= 70) return 'bg-warning';
    if (pct >= 50) return 'bg-orange-500';
    return 'bg-destructive';
  };

  const getTrendIcon = () => {
    if (data.trend > 0) return <TrendingUp className="h-4 w-4 text-success" />;
    if (data.trend < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const sections = [
    {
      key: 'deliverability',
      label: 'Deliverability Integrity',
      icon: Activity,
      score: data.deliverability.total,
      max: 25,
      subsections: [
        { label: 'Inbox Placement', score: data.deliverability.inboxPlacement, max: 10 },
        { label: 'Bounce Velocity', score: data.deliverability.bounceVelocity, max: 8 },
        { label: 'Spam Complaints', score: data.deliverability.spamComplaints, max: 7 },
      ],
      issues: data.deliverability.issues,
    },
    {
      key: 'reputation',
      label: 'Sender Reputation',
      icon: Shield,
      score: data.reputation.total,
      max: 20,
      subsections: [
        { label: 'Domain Health', score: data.reputation.domainHealth, max: 8 },
        { label: 'Authentication', score: data.reputation.authentication, max: 6 },
        { label: 'ISP Signals', score: data.reputation.ispSignals, max: 6 },
      ],
      issues: data.reputation.issues,
    },
    {
      key: 'engagement',
      label: 'Engagement Quality',
      icon: MessageSquare,
      score: data.engagement.total,
      max: 25,
      subsections: [
        { label: 'Reply Rate vs Expected', score: data.engagement.replyRateVsExpected, max: 10 },
        { label: 'Positive Rate', score: data.engagement.positiveRate, max: 8 },
        { label: 'Time to Reply', score: data.engagement.timeToReply, max: 4 },
        { label: 'Reply Depth', score: data.engagement.replyDepth, max: 3 },
      ],
      issues: data.engagement.issues,
    },
    {
      key: 'conversion',
      label: 'Conversion Efficiency',
      icon: Target,
      score: data.conversion.total,
      max: 30,
      subsections: [
        { label: 'Reply → Positive', score: data.conversion.replyToPositive, max: 12 },
        { label: 'Positive → Meeting', score: data.conversion.positiveToMeeting, max: 10 },
        { label: 'Meeting Velocity', score: data.conversion.meetingVelocity, max: 5 },
        { label: 'Conversion Trend', score: data.conversion.conversionTrend, max: 3 },
      ],
      issues: data.conversion.issues,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">System Health</CardTitle>
            <CardDescription>Composite health of your outbound program</CardDescription>
          </div>
          <div className="text-right">
            <div className={cn("text-5xl font-bold tabular-nums", getStatusColor(data.status))}>
              {Math.round(data.overallScore)}
            </div>
            <div className="flex items-center justify-end gap-1 mt-1">
              {getTrendIcon()}
              <span className="text-sm text-muted-foreground">
                {data.trend > 0 ? '+' : ''}{data.trend} pts
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Banner */}
        <div className={cn(
          "p-3 rounded-lg border flex items-center gap-3",
          getStatusBg(data.status)
        )}>
          {getStatusIcon(data.status)}
          <div className="flex-1">
            <p className={cn("font-medium text-sm", getStatusColor(data.status))}>
              Status: {data.status.toUpperCase()}
            </p>
            <p className="text-sm text-muted-foreground">{data.statusMessage}</p>
          </div>
        </div>

        {/* Score Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Score</span>
            <span className="font-mono">{Math.round(data.overallScore)}/100</span>
          </div>
          <Progress 
            value={data.overallScore} 
            className={cn("h-3", getScoreColor(data.overallScore, 100))} 
          />
        </div>

        {/* Component Breakdown */}
        <div className="space-y-2 pt-2">
          <h4 className="text-sm font-medium text-muted-foreground">Component Breakdown</h4>
          {sections.map((section) => (
            <div key={section.key} className="border rounded-lg overflow-hidden">
              <button
                className="w-full p-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
                onClick={() => setExpandedSection(expandedSection === section.key ? null : section.key)}
              >
                <div className="flex items-center gap-3">
                  <section.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{section.label}</span>
                  {section.issues.length > 0 && (
                    <Badge variant="outline" className="text-xs border-warning/50 text-warning">
                      {section.issues.length} issue{section.issues.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24">
                    <Progress 
                      value={(section.score / section.max) * 100} 
                      className={cn("h-2", getScoreColor(section.score, section.max))} 
                    />
                  </div>
                  <span className="font-mono text-sm w-12 text-right">
                    {section.score}/{section.max}
                  </span>
                  {expandedSection === section.key ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>
              
              {expandedSection === section.key && (
                <div className="px-3 pb-3 space-y-2 border-t bg-accent/20">
                  <div className="pt-2 space-y-2">
                    {section.subsections.map((sub) => (
                      <div key={sub.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground pl-7">{sub.label}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16">
                            <Progress 
                              value={(sub.score / sub.max) * 100} 
                              className={cn("h-1.5", getScoreColor(sub.score, sub.max))} 
                            />
                          </div>
                          <span className="font-mono text-xs w-8 text-right">
                            {sub.score}/{sub.max}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {section.issues.length > 0 && (
                    <div className="pl-7 pt-2 space-y-1">
                      {section.issues.map((issue, i) => (
                        <p key={i} className="text-xs text-warning flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {issue}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
