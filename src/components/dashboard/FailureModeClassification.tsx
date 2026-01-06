import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Mail, 
  FileText, 
  Users, 
  Clock,
  CheckCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export type FailureMode = 'deliverability' | 'copy' | 'audience' | 'timing' | 'none';

export interface FailureModeData {
  primaryCause: FailureMode;
  primaryConfidence: number;
  secondaryCause?: FailureMode;
  secondaryConfidence?: number;
  evidence: string[];
  recommendedActions: {
    action: string;
    expectedImpact?: string;
    link?: string;
    linkLabel?: string;
  }[];
}

interface FailureModeInputs {
  bounceRate: number;
  bounceRatePrev: number;
  spamRate: number;
  openRate: number;
  openRatePrev: number;
  replyRate: number;
  replyRatePrev: number;
  replyRateVarianceByVariant?: number;
  replyRateVarianceBySegment?: number;
  unsubscribeRate: number;
  unsubscribeRatePrev: number;
  deliverabilityScore?: number;
  decayingVariants?: { subject: string; decayPercent: number }[];
  fatigueSegments?: { name: string; declinePercent: number }[];
  replyRateVarianceByHour?: number;
  replyRateVarianceByDay?: number;
}

export function classifyFailureMode(inputs: FailureModeInputs): FailureModeData {
  const signals: Record<FailureMode, number> = {
    deliverability: 0,
    copy: 0,
    audience: 0,
    timing: 0,
    none: 0,
  };
  const evidence: string[] = [];

  // DELIVERABILITY SIGNALS
  const bounceChange = inputs.bounceRatePrev > 0 
    ? ((inputs.bounceRate - inputs.bounceRatePrev) / inputs.bounceRatePrev) * 100 
    : 0;
  if (bounceChange > 50) {
    signals.deliverability += 3;
    evidence.push(`Bounce rate up ${bounceChange.toFixed(0)}% vs last period`);
  }

  if (inputs.spamRate > 0.2) {
    signals.deliverability += 4;
    evidence.push(`Spam complaints at ${inputs.spamRate.toFixed(2)}%`);
  }

  const openChange = inputs.openRatePrev > 0
    ? (inputs.openRate - inputs.openRatePrev) / inputs.openRatePrev
    : 0;
  if (openChange < -0.3) {
    // Opens dropped uniformly = deliverability
    signals.deliverability += 2;
    evidence.push('Open rate dropped significantly across campaigns');
  }

  // COPY SIGNALS
  const replyChange = inputs.replyRatePrev > 0
    ? (inputs.replyRate - inputs.replyRatePrev) / inputs.replyRatePrev
    : 0;
  if (replyChange < -0.2 && (inputs.deliverabilityScore ?? 80) > 70) {
    if ((inputs.replyRateVarianceByVariant ?? 0) > 0.3) {
      signals.copy += 3;
      evidence.push('Reply rates vary significantly by variant (copy issue)');
    } else {
      signals.copy += 1;
    }
  }

  // Check for copy decay
  const decayingVariants = inputs.decayingVariants ?? [];
  if (decayingVariants.length > 0) {
    const worstDecay = decayingVariants.sort((a, b) => b.decayPercent - a.decayPercent)[0];
    signals.copy += 2;
    evidence.push(`Copy decay: "${worstDecay.subject.substring(0, 30)}..." down ${worstDecay.decayPercent.toFixed(0)}%`);
  }

  // AUDIENCE SIGNALS
  if ((inputs.replyRateVarianceBySegment ?? 0) > 0.4) {
    signals.audience += 3;
    evidence.push('Reply rates vary significantly by audience segment');
  }

  const unsubChange = inputs.unsubscribeRatePrev > 0
    ? ((inputs.unsubscribeRate - inputs.unsubscribeRatePrev) / inputs.unsubscribeRatePrev) * 100
    : 0;
  if (unsubChange > 50) {
    signals.audience += 2;
    evidence.push(`Unsubscribe rate up ${unsubChange.toFixed(0)}% vs last period`);
  }

  const fatigueSegments = inputs.fatigueSegments ?? [];
  if (fatigueSegments.length > 0) {
    const worstFatigue = fatigueSegments.sort((a, b) => b.declinePercent - a.declinePercent)[0];
    signals.audience += 2;
    evidence.push(`Segment "${worstFatigue.name}" showing fatigue (down ${worstFatigue.declinePercent.toFixed(0)}%)`);
  }

  // TIMING SIGNALS
  if ((inputs.replyRateVarianceByHour ?? 0) > 0.5) {
    signals.timing += 2;
    evidence.push('Reply rates vary significantly by send hour');
  }

  if ((inputs.replyRateVarianceByDay ?? 0) > 0.4) {
    signals.timing += 2;
    evidence.push('Reply rates vary significantly by day of week');
  }

  // CLASSIFY
  const sortedSignals = Object.entries(signals)
    .filter(([key]) => key !== 'none')
    .sort(([, a], [, b]) => b - a);

  const totalSignal = sortedSignals.reduce((sum, [, val]) => sum + val, 0);
  
  if (totalSignal === 0) {
    return {
      primaryCause: 'none',
      primaryConfidence: 1,
      evidence: ['No significant issues detected'],
      recommendedActions: [],
    };
  }

  const primary = sortedSignals[0];
  const secondary = sortedSignals[1]?.[1] > 2 ? sortedSignals[1] : null;

  const actionsMap: Record<FailureMode, { action: string; expectedImpact?: string; link?: string; linkLabel?: string }[]> = {
    deliverability: [
      { action: 'Check SPF/DKIM/DMARC authentication status', link: '/deliverability', linkLabel: 'View Deliverability' },
      { action: 'Review bounce types (hard vs soft)', expectedImpact: 'Identify list quality issues' },
      { action: 'Reduce send volume by 30% for 48 hours', expectedImpact: 'Stabilize sender reputation' },
      { action: 'Check domain against blocklists' },
      { action: 'Review recent content for spam triggers', link: '/copy-insights', linkLabel: 'View Copy' },
    ],
    copy: [
      { action: 'Audit top-volume variants for decay', link: '/copy-insights', linkLabel: 'View Copy Insights' },
      { action: 'Run A/B test with fresh subject lines', expectedImpact: '+0.5-1% reply rate' },
      { action: 'Review CTA effectiveness by step' },
      { action: 'Check personalization token accuracy' },
      { action: 'Compare performing vs underperforming copy' },
    ],
    audience: [
      { action: 'Analyze reply rates by segment', link: '/audience-insights', linkLabel: 'View Audience' },
      { action: 'Check for over-contacted leads', expectedImpact: 'Reduce fatigue' },
      { action: 'Review recent list sources' },
      { action: 'Pause lowest-performing segments', expectedImpact: '+0.4% overall reply rate' },
      { action: 'Validate ICP criteria against responders' },
    ],
    timing: [
      { action: 'Review send time heatmap', link: '/', linkLabel: 'View Heatmap' },
      { action: 'Check timezone distribution of audience' },
      { action: 'Compare weekday vs weekend performance' },
      { action: 'Analyze time-to-reply patterns' },
      { action: 'Test different send windows' },
    ],
    none: [],
  };

  let recommendedActions = [...actionsMap[primary[0] as FailureMode]];
  if (secondary) {
    recommendedActions = [
      ...recommendedActions.slice(0, 3),
      ...actionsMap[secondary[0] as FailureMode].slice(0, 2),
    ];
  }

  return {
    primaryCause: primary[0] as FailureMode,
    primaryConfidence: totalSignal > 0 ? primary[1] / totalSignal : 0,
    secondaryCause: secondary ? secondary[0] as FailureMode : undefined,
    secondaryConfidence: secondary && totalSignal > 0 ? secondary[1] / totalSignal : undefined,
    evidence,
    recommendedActions: recommendedActions.slice(0, 5),
  };
}

interface FailureModeClassificationProps {
  data: FailureModeData;
  onActionClick?: (action: string, link?: string) => void;
}

export function FailureModeClassification({ data, onActionClick }: FailureModeClassificationProps) {
  const [expanded, setExpanded] = useState(false);

  if (data.primaryCause === 'none') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-success">
            <CheckCircle className="h-5 w-5" />
            <p className="font-medium">No performance issues detected</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getCauseInfo = (cause: FailureMode) => {
    switch (cause) {
      case 'deliverability':
        return { icon: Mail, label: 'Deliverability', color: 'text-destructive', bg: 'bg-destructive/10' };
      case 'copy':
        return { icon: FileText, label: 'Copy', color: 'text-chart-4', bg: 'bg-chart-4/10' };
      case 'audience':
        return { icon: Users, label: 'Audience Fatigue', color: 'text-warning', bg: 'bg-warning/10' };
      case 'timing':
        return { icon: Clock, label: 'Timing', color: 'text-chart-2', bg: 'bg-chart-2/10' };
      default:
        return { icon: AlertTriangle, label: 'Unknown', color: 'text-muted-foreground', bg: 'bg-muted' };
    }
  };

  const primary = getCauseInfo(data.primaryCause);
  const secondary = data.secondaryCause ? getCauseInfo(data.secondaryCause) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <CardTitle className="text-lg">System Diagnosis</CardTitle>
        </div>
        <CardDescription>Performance issue detected</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Cause */}
        <div className={cn("p-4 rounded-lg border", primary.bg)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <primary.icon className={cn("h-5 w-5", primary.color)} />
              <div>
                <p className="text-sm text-muted-foreground">Primary Cause</p>
                <p className={cn("font-semibold", primary.color)}>{primary.label}</p>
              </div>
            </div>
            <Badge variant="outline" className={cn("border-current", primary.color)}>
              {(data.primaryConfidence * 100).toFixed(0)}% confidence
            </Badge>
          </div>
        </div>

        {/* Secondary Cause */}
        {secondary && data.secondaryConfidence && (
          <div className={cn("p-3 rounded-lg border opacity-70", secondary.bg)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <secondary.icon className={cn("h-4 w-4", secondary.color)} />
                <div>
                  <p className="text-xs text-muted-foreground">Secondary Factor</p>
                  <p className={cn("text-sm font-medium", secondary.color)}>{secondary.label}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {(data.secondaryConfidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}

        {/* Evidence */}
        <div className="space-y-2">
          <button 
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            Evidence
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {expanded && (
            <ul className="space-y-1.5 pl-4">
              {data.evidence.map((e, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recommended Actions */}
        <div className="space-y-2 pt-2 border-t">
          <h4 className="text-sm font-medium">Recommended Actions</h4>
          <div className="space-y-2">
            {data.recommendedActions.slice(0, 3).map((action, i) => (
              <div 
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{action.action}</p>
                    {action.expectedImpact && (
                      <p className="text-xs text-muted-foreground">
                        Expected: {action.expectedImpact}
                      </p>
                    )}
                  </div>
                </div>
                {action.link && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-xs"
                    onClick={() => onActionClick?.(action.action, action.link)}
                  >
                    {action.linkLabel || 'View'}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
