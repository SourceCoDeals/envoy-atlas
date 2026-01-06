import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle, 
  Clock,
  Plus,
  ArrowRight,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ICPStatus = 'confirmed' | 'rejected' | 'inconclusive' | 'validating';

export interface ICPHypothesis {
  id: string;
  name: string;
  description?: string;
  criteria: {
    dimension: string;
    values: string[];
  }[];
  status: ICPStatus;
  confidence: 'high' | 'medium' | 'low';
  icpReplyRate: number;
  nonIcpReplyRate: number;
  icpPositiveRate: number;
  nonIcpPositiveRate: number;
  icpMeetingRate: number;
  nonIcpMeetingRate: number;
  icpSampleSize: number;
  nonIcpSampleSize: number;
  lift: number; // percentage
  pValue?: number;
  recommendation: string;
  recommendedActions: {
    type: 'expand' | 'refine' | 'continue' | 'reconsider';
    label: string;
  }[];
}

interface ICPValidationSectionProps {
  hypotheses: ICPHypothesis[];
  onAddHypothesis?: () => void;
  onAction?: (hypothesis: ICPHypothesis, action: string) => void;
}

export function ICPValidationSection({
  hypotheses,
  onAddHypothesis,
  onAction,
}: ICPValidationSectionProps) {
  const getStatusInfo = (status: ICPStatus) => {
    switch (status) {
      case 'confirmed':
        return { 
          icon: CheckCircle, 
          label: 'CONFIRMED', 
          color: 'text-success',
          bg: 'bg-success/10 border-success/30',
        };
      case 'rejected':
        return { 
          icon: AlertTriangle, 
          label: 'REJECTED', 
          color: 'text-destructive',
          bg: 'bg-destructive/10 border-destructive/30',
        };
      case 'inconclusive':
        return { 
          icon: HelpCircle, 
          label: 'INCONCLUSIVE', 
          color: 'text-warning',
          bg: 'bg-warning/10 border-warning/30',
        };
      case 'validating':
      default:
        return { 
          icon: Clock, 
          label: 'VALIDATING', 
          color: 'text-muted-foreground',
          bg: 'bg-muted border-muted-foreground/30',
        };
    }
  };

  const getConfidenceBadge = (confidence: ICPHypothesis['confidence']) => {
    const colors = {
      high: 'bg-success/20 text-success',
      medium: 'bg-warning/20 text-warning',
      low: 'bg-muted text-muted-foreground',
    };
    return colors[confidence];
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">ICP Validation</CardTitle>
          </div>
          {onAddHypothesis && (
            <Button variant="outline" size="sm" onClick={onAddHypothesis}>
              <Plus className="h-4 w-4 mr-1" />
              Add New ICP
            </Button>
          )}
        </div>
        <CardDescription>Test and validate your ideal customer profile hypotheses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hypotheses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No ICP hypotheses defined yet.</p>
            <p className="text-xs mt-1">Define criteria to validate your ideal customer profile.</p>
          </div>
        ) : (
          hypotheses.map((hypothesis) => {
            const statusInfo = getStatusInfo(hypothesis.status);
            
            return (
              <div 
                key={hypothesis.id}
                className={cn(
                  "rounded-lg border p-4 space-y-4",
                  statusInfo.bg
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{hypothesis.name}</h3>
                    {hypothesis.description && (
                      <p className="text-sm text-muted-foreground mt-1">{hypothesis.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getConfidenceBadge(hypothesis.confidence)}>
                      {hypothesis.confidence.toUpperCase()}
                    </Badge>
                    <div className={cn("flex items-center gap-1", statusInfo.color)}>
                      <statusInfo.icon className="h-4 w-4" />
                      <span className="text-xs font-medium">{statusInfo.label}</span>
                    </div>
                  </div>
                </div>

                {/* Criteria */}
                <div className="flex flex-wrap gap-2">
                  {hypothesis.criteria.map((c, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {c.dimension}: {c.values.join(', ')}
                    </Badge>
                  ))}
                </div>

                {/* Performance Comparison */}
                <div className="grid grid-cols-4 gap-4 p-3 rounded-lg bg-background/50">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Sample</p>
                    <p className="font-mono text-sm">
                      {hypothesis.icpSampleSize.toLocaleString()} vs {hypothesis.nonIcpSampleSize.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Reply Rate</p>
                    <p className="font-mono text-sm">
                      <span className="text-success">{hypothesis.icpReplyRate.toFixed(1)}%</span>
                      <span className="text-muted-foreground mx-1">vs</span>
                      {hypothesis.nonIcpReplyRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Positive Rate</p>
                    <p className="font-mono text-sm">
                      <span className="text-success">{hypothesis.icpPositiveRate.toFixed(1)}%</span>
                      <span className="text-muted-foreground mx-1">vs</span>
                      {hypothesis.nonIcpPositiveRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Lift</p>
                    <p className={cn(
                      "font-mono text-sm font-medium",
                      hypothesis.lift > 0 ? "text-success" : "text-destructive"
                    )}>
                      {hypothesis.lift > 0 ? '+' : ''}{hypothesis.lift.toFixed(0)}%
                      {hypothesis.pValue !== undefined && hypothesis.pValue < 0.05 && ' ✓'}
                    </p>
                  </div>
                </div>

                {/* Recommendation */}
                <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                  <p className="text-sm">{hypothesis.recommendation}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {hypothesis.recommendedActions.map((action, i) => (
                    <Button
                      key={i}
                      variant={i === 0 ? "default" : "outline"}
                      size="sm"
                      onClick={() => onAction?.(hypothesis, action.type)}
                    >
                      {action.label}
                      {i === 0 && <ArrowRight className="h-3 w-3 ml-1" />}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// Helper to create mock ICP hypothesis from data
export function createICPHypothesis(
  id: string,
  name: string,
  criteria: { dimension: string; values: string[] }[],
  icpMetrics: { sent: number; replied: number; positive: number; meetings: number },
  nonIcpMetrics: { sent: number; replied: number; positive: number; meetings: number }
): ICPHypothesis {
  const icpReplyRate = icpMetrics.sent > 0 ? (icpMetrics.replied / icpMetrics.sent) * 100 : 0;
  const nonIcpReplyRate = nonIcpMetrics.sent > 0 ? (nonIcpMetrics.replied / nonIcpMetrics.sent) * 100 : 0;
  const icpPositiveRate = icpMetrics.sent > 0 ? (icpMetrics.positive / icpMetrics.sent) * 100 : 0;
  const nonIcpPositiveRate = nonIcpMetrics.sent > 0 ? (nonIcpMetrics.positive / nonIcpMetrics.sent) * 100 : 0;
  const icpMeetingRate = icpMetrics.positive > 0 ? (icpMetrics.meetings / icpMetrics.positive) * 100 : 0;
  const nonIcpMeetingRate = nonIcpMetrics.positive > 0 ? (nonIcpMetrics.meetings / nonIcpMetrics.positive) * 100 : 0;
  
  const lift = nonIcpReplyRate > 0 ? ((icpReplyRate - nonIcpReplyRate) / nonIcpReplyRate) * 100 : 0;
  
  // Determine status based on sample size and lift
  let status: ICPStatus;
  let confidence: 'high' | 'medium' | 'low';
  
  if (icpMetrics.sent < 500) {
    status = 'validating';
    confidence = 'low';
  } else if (lift > 20 && icpMetrics.sent >= 2000) {
    status = 'confirmed';
    confidence = 'high';
  } else if (lift > 20 && icpMetrics.sent >= 500) {
    status = 'confirmed';
    confidence = 'medium';
  } else if (lift < -10 && icpMetrics.sent >= 1000) {
    status = 'rejected';
    confidence = 'high';
  } else {
    status = 'inconclusive';
    confidence = icpMetrics.sent >= 1000 ? 'medium' : 'low';
  }

  const recommendation = status === 'confirmed'
    ? `Your ICP hypothesis is validated. This segment generates ${(lift / 100 + 1).toFixed(1)}x more engagement than non-ICP contacts.`
    : status === 'rejected'
    ? `This ICP underperforms your average. Consider re-evaluating these targeting criteria.`
    : status === 'inconclusive'
    ? `Results are not yet conclusive. Continue testing to gather more data.`
    : `Still gathering data. Need ${Math.max(0, 500 - icpMetrics.sent).toLocaleString()} more sends for initial insights.`;

  const recommendedActions: { type: 'expand' | 'refine' | 'continue' | 'reconsider'; label: string }[] = 
    status === 'confirmed'
      ? [{ type: 'expand', label: 'Expand This Segment' }, { type: 'refine', label: 'Test Sub-Segments' }]
      : status === 'rejected'
      ? [{ type: 'reconsider', label: 'Modify Criteria' }]
      : [{ type: 'continue', label: 'Continue Testing' }];

  return {
    id,
    name,
    criteria,
    status,
    confidence,
    icpReplyRate,
    nonIcpReplyRate,
    icpPositiveRate,
    nonIcpPositiveRate,
    icpMeetingRate,
    nonIcpMeetingRate,
    icpSampleSize: icpMetrics.sent,
    nonIcpSampleSize: nonIcpMetrics.sent,
    lift,
    recommendation,
    recommendedActions,
  };
}
