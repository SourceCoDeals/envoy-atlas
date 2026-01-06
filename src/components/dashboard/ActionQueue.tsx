import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle,
  ChevronRight,
  X,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export interface ActionItem {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  reason: string;
  category: 'deliverability' | 'copy' | 'audience' | 'timing' | 'general';
  steps?: string[];
  expectedImpact?: string;
  primaryLink?: string;
  primaryLinkLabel?: string;
  secondaryLink?: string;
  secondaryLinkLabel?: string;
  priorityScore?: number;
}

interface ActionQueueProps {
  actions: ActionItem[];
  onDismiss?: (id: string) => void;
  onActionClick?: (action: ActionItem, link?: string) => void;
  maxVisible?: number;
}

export function ActionQueue({ 
  actions, 
  onDismiss, 
  onActionClick,
  maxVisible = 4 
}: ActionQueueProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const getSeverityInfo = (severity: ActionItem['severity']) => {
    switch (severity) {
      case 'critical':
        return { 
          icon: AlertCircle, 
          color: 'text-destructive', 
          bg: 'bg-destructive/10 border-destructive/30',
          badge: 'bg-destructive text-destructive-foreground',
          label: 'CRITICAL',
        };
      case 'high':
        return { 
          icon: AlertTriangle, 
          color: 'text-warning', 
          bg: 'bg-warning/10 border-warning/30',
          badge: 'bg-warning text-warning-foreground',
          label: 'HIGH',
        };
      case 'medium':
        return { 
          icon: Info, 
          color: 'text-chart-4', 
          bg: 'bg-chart-4/10 border-chart-4/30',
          badge: 'bg-chart-4 text-chart-4-foreground',
          label: 'MEDIUM',
        };
      case 'low':
        return { 
          icon: Info, 
          color: 'text-muted-foreground', 
          bg: 'bg-muted border-muted-foreground/30',
          badge: 'bg-muted text-muted-foreground',
          label: 'LOW',
        };
    }
  };

  const sortedActions = [...actions].sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const visibleActions = showAll ? sortedActions : sortedActions.slice(0, maxVisible);
  const hiddenCount = sortedActions.length - maxVisible;

  if (actions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-success">
            <CheckCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">No actions required</p>
              <p className="text-sm text-muted-foreground">Your outbound system is performing well</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Action Queue</CardTitle>
            <CardDescription>Prioritized issues requiring attention</CardDescription>
          </div>
          <Badge variant="outline">
            {actions.length} item{actions.length !== 1 ? 's' : ''} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleActions.map((action) => {
          const severity = getSeverityInfo(action.severity);
          const isExpanded = expandedId === action.id;
          
          return (
            <div 
              key={action.id}
              className={cn(
                "rounded-lg border transition-all",
                severity.bg
              )}
            >
              <div className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <severity.icon className={cn("h-5 w-5 mt-0.5 shrink-0", severity.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("text-[10px] px-1.5 py-0", severity.badge)}>
                          {severity.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">
                          {action.category}
                        </span>
                      </div>
                      <p className="font-medium text-sm mt-1">{action.action}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {action.reason}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {action.steps && action.steps.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setExpandedId(isExpanded ? null : action.id)}
                      >
                        <ChevronRight className={cn(
                          "h-4 w-4 transition-transform",
                          isExpanded && "rotate-90"
                        )} />
                      </Button>
                    )}
                    {onDismiss && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => onDismiss(action.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded Steps */}
                {isExpanded && action.steps && (
                  <div className="mt-3 pt-3 border-t border-current/10 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Steps:</p>
                    <ul className="space-y-1.5 pl-1">
                      {action.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-xs font-mono text-muted-foreground mt-0.5">
                            {i + 1}.
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                    {action.expectedImpact && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Expected impact: <span className="text-success">{action.expectedImpact}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-3">
                  {action.primaryLink && (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onActionClick?.(action, action.primaryLink)}
                    >
                      {action.primaryLinkLabel || 'Take Action'}
                    </Button>
                  )}
                  {action.secondaryLink && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onActionClick?.(action, action.secondaryLink)}
                    >
                      {action.secondaryLinkLabel || 'View Details'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {hiddenCount > 0 && !showAll && (
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => setShowAll(true)}
          >
            Show {hiddenCount} more action{hiddenCount !== 1 ? 's' : ''}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Helper to generate action items from system state
export function generateActionItems(
  healthData: {
    spamRate: number;
    bounceRate: number;
    replyRate: number;
    expectedReplyRate?: number;
    deliverabilityScore?: number;
  },
  failureMode?: {
    primaryCause: string;
    evidence: string[];
    recommendedActions: { action: string; expectedImpact?: string }[];
  },
  decayingVariants?: { subject: string; decayPercent: number }[],
  underperformingSegments?: { name: string; replyRate: number; avgReplyRate: number }[]
): ActionItem[] {
  const actions: ActionItem[] = [];

  // CRITICAL: High spam complaint rate
  if (healthData.spamRate > 0.3) {
    actions.push({
      id: 'spam-critical',
      severity: 'critical',
      action: 'Reduce Send Volume Immediately',
      reason: `Spam complaints at ${healthData.spamRate.toFixed(2)}% — risk of domain blacklist`,
      category: 'deliverability',
      steps: [
        'Pause all campaigns immediately',
        'Review last 48 hours of content for spam triggers',
        'Check for list quality issues',
        'Resume at 50% volume after 48 hours',
      ],
      expectedImpact: 'Prevent domain blacklisting',
      primaryLink: '/campaigns',
      primaryLinkLabel: 'Pause Campaigns',
      secondaryLink: '/deliverability',
      secondaryLinkLabel: 'View Spam Sources',
    });
  }

  // HIGH: High bounce rate
  if (healthData.bounceRate > 5) {
    actions.push({
      id: 'bounce-high',
      severity: 'high',
      action: 'Clean Email List',
      reason: `Bounce rate at ${healthData.bounceRate.toFixed(1)}% — damaging sender reputation`,
      category: 'deliverability',
      steps: [
        'Export bounced emails from last 7 days',
        'Remove all hard bounces from lists',
        'Verify email addresses before next campaign',
        'Consider email verification service',
      ],
      primaryLink: '/deliverability',
      primaryLinkLabel: 'View Bounces',
    });
  }

  // HIGH: Reply rate below expected
  const expectedReply = healthData.expectedReplyRate ?? 3;
  if (healthData.replyRate < expectedReply * 0.7 && failureMode) {
    actions.push({
      id: 'reply-low',
      severity: 'high',
      action: `Investigate ${failureMode.primaryCause.charAt(0).toUpperCase() + failureMode.primaryCause.slice(1)} Issue`,
      reason: `Reply rate ${healthData.replyRate.toFixed(1)}% is 30%+ below expected ${expectedReply.toFixed(1)}%`,
      category: failureMode.primaryCause as ActionItem['category'],
      steps: failureMode.recommendedActions.slice(0, 4).map(a => a.action),
      expectedImpact: failureMode.recommendedActions[0]?.expectedImpact,
    });
  }

  // MEDIUM: Decaying variants
  if (decayingVariants && decayingVariants.length > 0) {
    const worstDecay = decayingVariants.sort((a, b) => b.decayPercent - a.decayPercent)[0];
    actions.push({
      id: `decay-${worstDecay.subject.substring(0, 10)}`,
      severity: 'medium',
      action: `Rotate Copy: "${worstDecay.subject.substring(0, 35)}..."`,
      reason: `Variant down ${worstDecay.decayPercent.toFixed(0)}% from initial performance`,
      category: 'copy',
      steps: [
        'Create fresh variant with similar positioning',
        'A/B test new variant against current',
        'Retire old variant after winner confirmed',
        'Add learnings to playbook',
      ],
      primaryLink: '/copy-insights',
      primaryLinkLabel: 'View Decay Analysis',
    });
  }

  // MEDIUM: Underperforming segments
  if (underperformingSegments && underperformingSegments.length > 0) {
    const worstSegment = underperformingSegments[0];
    const decline = ((worstSegment.avgReplyRate - worstSegment.replyRate) / worstSegment.avgReplyRate) * 100;
    actions.push({
      id: `segment-${worstSegment.name}`,
      severity: 'medium',
      action: `Optimize or Pause Segment: ${worstSegment.name}`,
      reason: `Segment performing at ${worstSegment.replyRate.toFixed(1)}% vs ${worstSegment.avgReplyRate.toFixed(1)}% average (-${decline.toFixed(0)}%)`,
      category: 'audience',
      primaryLink: '/audience-insights',
      primaryLinkLabel: 'View Segment',
      secondaryLink: '/campaigns',
      secondaryLinkLabel: 'Pause Segment',
    });
  }

  return actions;
}
