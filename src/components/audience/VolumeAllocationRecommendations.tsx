import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VolumeRecommendation {
  segmentId: string;
  segmentName: string;
  currentShare: number; // percentage
  recommendedShare: number; // percentage
  change: number; // percentage points
  action: 'increase' | 'decrease' | 'maintain';
  meetingsPer1000: number;
  fatigueLevel: 'healthy' | 'warning' | 'fatigued' | 'critical';
  reason: string;
}

export interface VolumeProjection {
  meetingIncreasePercent: number;
  replyRateIncreasePercent: number;
  confidence: 'high' | 'medium' | 'low';
}

interface VolumeAllocationProps {
  recommendations: VolumeRecommendation[];
  projection: VolumeProjection;
  onApply?: () => void;
  onSimulate?: () => void;
}

export function VolumeAllocationRecommendations({
  recommendations,
  projection,
  onApply,
  onSimulate,
}: VolumeAllocationProps) {
  const sortedRecs = [...recommendations].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  
  const getActionBadge = (action: VolumeRecommendation['action'], change: number) => {
    if (action === 'increase') {
      return (
        <Badge className="bg-success/20 text-success border-success/30 gap-1">
          <TrendingUp className="h-3 w-3" />
          +{change.toFixed(0)}%
        </Badge>
      );
    }
    if (action === 'decrease') {
      return (
        <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
          <TrendingDown className="h-3 w-3" />
          {change.toFixed(0)}%
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Maintain
      </Badge>
    );
  };

  const getFatigueColor = (level: VolumeRecommendation['fatigueLevel']) => {
    switch (level) {
      case 'healthy': return 'text-success';
      case 'warning': return 'text-warning';
      case 'fatigued': return 'text-orange-500';
      case 'critical': return 'text-destructive';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Volume Optimization</CardTitle>
        <CardDescription>
          Recommended allocation based on efficiency (meetings per 1000 emails) and fatigue risk
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recommendations Table */}
        <div className="rounded-lg border overflow-hidden">
          <div className="grid grid-cols-6 gap-2 p-3 bg-muted text-xs font-medium text-muted-foreground">
            <div className="col-span-2">Segment</div>
            <div className="text-right">Current</div>
            <div className="text-right">Recommended</div>
            <div className="text-center">Change</div>
            <div className="text-right">Mtgs/1K</div>
          </div>
          
          {sortedRecs.map((rec) => (
            <div 
              key={rec.segmentId}
              className="grid grid-cols-6 gap-2 p-3 border-t items-center text-sm"
            >
              <div className="col-span-2">
                <p className="font-medium">{rec.segmentName}</p>
                <p className={cn("text-xs", getFatigueColor(rec.fatigueLevel))}>
                  {rec.fatigueLevel}
                </p>
              </div>
              <div className="text-right font-mono text-muted-foreground">
                {rec.currentShare.toFixed(0)}%
              </div>
              <div className="text-right font-mono">
                {rec.recommendedShare.toFixed(0)}%
              </div>
              <div className="text-center">
                {getActionBadge(rec.action, rec.change)}
              </div>
              <div className="text-right font-mono">
                {rec.meetingsPer1000.toFixed(1)}
              </div>
            </div>
          ))}
        </div>

        {/* Reasons Summary */}
        <div className="space-y-2">
          {sortedRecs.filter(r => r.action !== 'maintain').slice(0, 3).map((rec) => (
            <div key={rec.segmentId} className="text-xs text-muted-foreground flex items-start gap-2">
              <span className={cn(
                "shrink-0 font-medium",
                rec.action === 'increase' ? "text-success" : "text-destructive"
              )}>
                {rec.segmentName}:
              </span>
              <span>{rec.reason}</span>
            </div>
          ))}
        </div>

        {/* Projected Impact */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
          <h4 className="font-medium text-sm">Projected Impact</h4>
          <p className="text-sm text-muted-foreground">
            If you reallocate volume as recommended:
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Expected meeting increase</p>
              <p className="text-lg font-bold text-success">
                +{projection.meetingIncreasePercent.toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expected reply rate increase</p>
              <p className="text-lg font-bold text-success">
                +{projection.replyRateIncreasePercent.toFixed(1)}%
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Confidence: {projection.confidence.toUpperCase()} (based on current performance data)
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {onApply && (
            <Button onClick={onApply}>
              Apply Recommendations
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {onSimulate && (
            <Button variant="outline" onClick={onSimulate}>
              Simulate Different Allocation
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper to generate volume recommendations
export function generateVolumeRecommendations(
  segments: Array<{
    id: string;
    name: string;
    sent: number;
    meetings: number;
    fatigueLevel: 'healthy' | 'warning' | 'fatigued' | 'critical';
  }>,
  totalSent: number
): { recommendations: VolumeRecommendation[]; projection: VolumeProjection } {
  // Calculate efficiency for each segment
  const withEfficiency = segments.map(s => ({
    ...s,
    meetingsPer1000: s.sent > 0 ? (s.meetings / s.sent) * 1000 : 0,
    currentShare: totalSent > 0 ? (s.sent / totalSent) * 100 : 0,
    fatigueMultiplier: s.fatigueLevel === 'critical' ? 0 : s.fatigueLevel === 'fatigued' ? 0.5 : s.fatigueLevel === 'warning' ? 0.8 : 1,
  }));

  // Calculate efficiency scores
  const withScores = withEfficiency.map(s => ({
    ...s,
    efficiencyScore: s.meetingsPer1000 * s.fatigueMultiplier,
  }));

  const totalEfficiency = withScores.reduce((sum, s) => sum + s.efficiencyScore, 0);

  // Generate recommendations
  const recommendations: VolumeRecommendation[] = withScores.map(s => {
    const recommendedShare = totalEfficiency > 0 
      ? (s.efficiencyScore / totalEfficiency) * 100 
      : 100 / segments.length;
    const change = recommendedShare - s.currentShare;
    
    let action: 'increase' | 'decrease' | 'maintain';
    if (change > 5) action = 'increase';
    else if (change < -5) action = 'decrease';
    else action = 'maintain';

    let reason = '';
    if (action === 'increase') {
      reason = `Highest efficiency at ${s.meetingsPer1000.toFixed(1)} meetings per 1000 emails`;
    } else if (action === 'decrease') {
      if (s.fatigueLevel === 'critical' || s.fatigueLevel === 'fatigued') {
        reason = `${s.fatigueLevel.charAt(0).toUpperCase() + s.fatigueLevel.slice(1)} fatigue level`;
      } else {
        reason = `Lower efficiency at ${s.meetingsPer1000.toFixed(1)} meetings per 1000 emails`;
      }
    }

    return {
      segmentId: s.id,
      segmentName: s.name,
      currentShare: s.currentShare,
      recommendedShare,
      change,
      action,
      meetingsPer1000: s.meetingsPer1000,
      fatigueLevel: s.fatigueLevel,
      reason,
    };
  });

  // Calculate projected impact
  const currentMeetings = segments.reduce((sum, s) => sum + s.meetings, 0);
  const projectedMeetings = recommendations.reduce((sum, r) => {
    const projectedVolume = (r.recommendedShare / 100) * totalSent;
    return sum + (r.meetingsPer1000 / 1000) * projectedVolume;
  }, 0);

  const projection: VolumeProjection = {
    meetingIncreasePercent: currentMeetings > 0 
      ? ((projectedMeetings - currentMeetings) / currentMeetings) * 100 
      : 0,
    replyRateIncreasePercent: 0.6, // Placeholder
    confidence: segments.every(s => s.sent >= 500) ? 'high' : segments.some(s => s.sent >= 200) ? 'medium' : 'low',
  };

  return { recommendations, projection };
}
