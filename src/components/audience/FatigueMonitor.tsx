import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  AlertCircle,
  Pause,
  Settings,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type FatigueLevel = 'healthy' | 'warning' | 'fatigued' | 'critical';

export interface SegmentFatigue {
  segmentId: string;
  segmentName: string;
  fatigueScore: number; // 0-100
  fatigueLevel: FatigueLevel;
  avgEmailsPerLead: number;
  optimalFrequency: number;
  replyRateFirstTouch: number;
  replyRateSubsequent: number;
  degradationPercent: number;
  trend30d: number; // percentage change
  unsubscribeRate: number;
  performanceByFrequency: {
    range: string;
    replyRate: number;
  }[];
  recommendation: string;
  recoveryEstimateDays?: number;
}

interface FatigueMonitorProps {
  segments: SegmentFatigue[];
  onPauseSegment?: (segmentId: string) => void;
  onSetFrequencyCap?: (segmentId: string) => void;
}

export function FatigueMonitor({
  segments,
  onPauseSegment,
  onSetFrequencyCap,
}: FatigueMonitorProps) {
  const getFatigueLevelInfo = (level: FatigueLevel) => {
    switch (level) {
      case 'healthy':
        return { color: 'bg-success', text: 'text-success', label: 'HEALTHY' };
      case 'warning':
        return { color: 'bg-warning', text: 'text-warning', label: 'WARNING' };
      case 'fatigued':
        return { color: 'bg-orange-500', text: 'text-orange-500', label: 'FATIGUED' };
      case 'critical':
        return { color: 'bg-destructive', text: 'text-destructive', label: 'CRITICAL' };
    }
  };

  const criticalSegments = segments.filter(s => s.fatigueLevel === 'critical' || s.fatigueLevel === 'fatigued');
  const warningSegments = segments.filter(s => s.fatigueLevel === 'warning');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Segment Health & Fatigue</CardTitle>
            <CardDescription>Monitor contact frequency and engagement degradation</CardDescription>
          </div>
          {criticalSegments.length > 0 && (
            <Badge variant="destructive">
              {criticalSegments.length} segment{criticalSegments.length > 1 ? 's' : ''} need attention
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fatigue Risk Map (simplified) */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/50 text-sm">
          <div className="text-center">
            <p className="font-medium text-success">{segments.filter(s => s.fatigueLevel === 'healthy').length}</p>
            <p className="text-xs text-muted-foreground">Healthy</p>
          </div>
          <div className="text-center">
            <p className="font-medium text-warning">{warningSegments.length}</p>
            <p className="text-xs text-muted-foreground">Warning</p>
          </div>
          <div className="text-center">
            <p className="font-medium text-destructive">{criticalSegments.length}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </div>
        </div>

        {/* Fatigued Segments Detail */}
        {criticalSegments.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Segments Requiring Action
            </h4>

            {criticalSegments.map((segment) => {
              const levelInfo = getFatigueLevelInfo(segment.fatigueLevel);
              
              return (
                <div 
                  key={segment.segmentId}
                  className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-xs", levelInfo.color, "text-white")}>
                          {levelInfo.label}
                        </Badge>
                        <h4 className="font-medium">{segment.segmentName}</h4>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Fatigue Score</p>
                      <p className={cn("font-mono font-bold", levelInfo.text)}>
                        {segment.fatigueScore}/100
                      </p>
                    </div>
                  </div>

                  <Progress 
                    value={segment.fatigueScore} 
                    className={cn("h-2", levelInfo.color)} 
                  />

                  {/* Indicators */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Avg contact frequency</p>
                      <p className="font-mono">
                        {segment.avgEmailsPerLead.toFixed(1)} emails/lead
                        {segment.avgEmailsPerLead > segment.optimalFrequency * 1.5 && (
                          <span className="text-destructive text-xs ml-1">
                            ({((segment.avgEmailsPerLead / segment.optimalFrequency) - 1) * 100}% over optimal)
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Reply rate degradation</p>
                      <p className="font-mono text-destructive">
                        -{segment.degradationPercent.toFixed(0)}% from first touch
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">30-day trend</p>
                      <p className="font-mono flex items-center gap-1">
                        <TrendingDown className="h-3 w-3 text-destructive" />
                        <span className="text-destructive">{segment.trend30d.toFixed(0)}%</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Unsubscribe rate</p>
                      <p className={cn(
                        "font-mono",
                        segment.unsubscribeRate > 0.01 ? "text-destructive" : ""
                      )}>
                        {(segment.unsubscribeRate * 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {/* Performance by Frequency */}
                  {segment.performanceByFrequency.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Performance by contact frequency:</p>
                      <div className="flex gap-2">
                        {segment.performanceByFrequency.map((pf, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {pf.range}: {pf.replyRate.toFixed(1)}%
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendation */}
                  <div className="p-2 rounded bg-background/50 text-sm">
                    <p>{segment.recommendation}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => onPauseSegment?.(segment.segmentId)}
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      Pause Segment
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onSetFrequencyCap?.(segment.segmentId)}
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Set Frequency Cap
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Warning Segments Summary */}
        {warningSegments.length > 0 && criticalSegments.length === 0 && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning">
                  {warningSegments.length} segment{warningSegments.length > 1 ? 's' : ''} showing early fatigue signs
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Monitor these segments and consider reducing contact frequency if performance continues to decline.
                </p>
              </div>
            </div>
          </div>
        )}

        {criticalSegments.length === 0 && warningSegments.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">All segments are performing at healthy contact frequencies.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper to calculate fatigue from metrics
export function calculateSegmentFatigue(
  segmentId: string,
  segmentName: string,
  metrics: {
    avgEmailsPerLead: number;
    replyRateFirstTouch: number;
    replyRateSubsequent: number;
    trend30d: number;
    unsubscribeRate: number;
  }
): SegmentFatigue {
  let score = 0;
  
  // Factor 1: Contact frequency (30 points max)
  if (metrics.avgEmailsPerLead > 5) score += 30;
  else if (metrics.avgEmailsPerLead > 4) score += 25;
  else if (metrics.avgEmailsPerLead > 3) score += 20;
  else if (metrics.avgEmailsPerLead > 2) score += 10;

  // Factor 2: Performance degradation (30 points max)
  if (metrics.replyRateFirstTouch > 0) {
    const degradation = 1 - (metrics.replyRateSubsequent / metrics.replyRateFirstTouch);
    if (degradation > 0.5) score += 30;
    else if (degradation > 0.3) score += 20;
    else if (degradation > 0.1) score += 10;
  }

  // Factor 3: Trend (20 points max)
  if (metrics.trend30d < -30) score += 20;
  else if (metrics.trend30d < -20) score += 15;
  else if (metrics.trend30d < -10) score += 10;

  // Factor 4: Unsubscribe rate (20 points max)
  if (metrics.unsubscribeRate > 0.02) score += 20;
  else if (metrics.unsubscribeRate > 0.01) score += 15;
  else if (metrics.unsubscribeRate > 0.005) score += 10;

  score = Math.min(score, 100);

  let fatigueLevel: FatigueLevel;
  if (score >= 70) fatigueLevel = 'critical';
  else if (score >= 50) fatigueLevel = 'fatigued';
  else if (score >= 30) fatigueLevel = 'warning';
  else fatigueLevel = 'healthy';

  const degradationPercent = metrics.replyRateFirstTouch > 0
    ? (1 - metrics.replyRateSubsequent / metrics.replyRateFirstTouch) * 100
    : 0;

  const recommendation = fatigueLevel === 'critical'
    ? `Pause this segment immediately for 3-4 weeks to allow recovery. When resumed, cap at 2 emails per lead per month.`
    : fatigueLevel === 'fatigued'
    ? `Reduce contact frequency by 50% and monitor for improvement over 2 weeks.`
    : fatigueLevel === 'warning'
    ? `Consider reducing volume and monitoring performance trends.`
    : `Segment is healthy. Continue current approach.`;

  return {
    segmentId,
    segmentName,
    fatigueScore: score,
    fatigueLevel,
    avgEmailsPerLead: metrics.avgEmailsPerLead,
    optimalFrequency: 2.5,
    replyRateFirstTouch: metrics.replyRateFirstTouch,
    replyRateSubsequent: metrics.replyRateSubsequent,
    degradationPercent,
    trend30d: metrics.trend30d,
    unsubscribeRate: metrics.unsubscribeRate,
    // NOTE: Performance by frequency is not actually tracked per-lead
    // Only showing first touch data - multi-touch tracking requires lead-level sequence analytics
    performanceByFrequency: [
      { range: '1-2 emails', replyRate: metrics.replyRateFirstTouch },
      { range: '3-4 emails', replyRate: 0 }, // Not tracked
      { range: '5+ emails', replyRate: 0 }, // Not tracked
    ],
    recommendation,
    recoveryEstimateDays: fatigueLevel === 'critical' ? 21 : fatigueLevel === 'fatigued' ? 14 : undefined,
  };
}
