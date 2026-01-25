import { ScoreBreakdown } from '@/lib/callScoring';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Target, MessageSquare, Zap, Check, X } from 'lucide-react';

interface ScoreBreakdownPanelProps {
  breakdown: ScoreBreakdown;
  className?: string;
}

interface ScoreItemProps {
  label: string;
  points: number;
  maxPoints: number;
  earned: boolean;
}

function ScoreItem({ label, points, maxPoints, earned }: ScoreItemProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        {earned ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <X className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
        <span className={cn(!earned && 'text-muted-foreground')}>{label}</span>
      </div>
      <span className={cn(
        'font-medium',
        earned ? 'text-emerald-600' : 'text-muted-foreground/50'
      )}>
        {earned ? `+${points.toFixed(1)}` : `0/${maxPoints}`}
      </span>
    </div>
  );
}

interface CategorySectionProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  score: number;
  maxScore: number;
  children: React.ReactNode;
  weight: string;
}

function CategorySection({ icon: Icon, title, score, maxScore, children, weight }: CategorySectionProps) {
  const percentage = (score / maxScore) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{title}</span>
          <Badge variant="outline" className="text-[10px] px-1.5">{weight}</Badge>
        </div>
        <span className="text-sm font-medium">
          {score.toFixed(1)} / {maxScore}
        </span>
      </div>
      <Progress value={percentage} className="h-1.5" />
      <div className="space-y-1 pl-6">
        {children}
      </div>
    </div>
  );
}

export function ScoreBreakdownPanel({ breakdown, className }: ScoreBreakdownPanelProps) {
  const { normalizedScore } = breakdown;
  
  const scoreColor = normalizedScore >= 8 
    ? 'text-emerald-600' 
    : normalizedScore >= 6 
      ? 'text-blue-600' 
      : normalizedScore >= 4 
        ? 'text-amber-600' 
        : 'text-red-600';

  return (
    <div className={cn('space-y-4 p-4 bg-muted/30 rounded-lg', className)}>
      {/* Final Score */}
      <div className="flex items-center justify-between pb-3 border-b">
        <span className="text-sm font-medium">Enhanced Score</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-2xl font-bold', scoreColor)}>
            {normalizedScore.toFixed(1)}
          </span>
          <span className="text-muted-foreground">/ 10</span>
        </div>
      </div>

      {/* Outcome-Based (50%) */}
      <CategorySection
        icon={Target}
        title="Outcomes"
        score={breakdown.outcomeTotal}
        maxScore={8.5}
        weight="50%"
      >
        <ScoreItem label="DM Reached" points={2} maxPoints={2} earned={breakdown.dmReached > 0} />
        <ScoreItem label="Meeting Set" points={3} maxPoints={3} earned={breakdown.meetingSet > 0} />
        <ScoreItem label="Genuine Interest" points={1.5} maxPoints={1.5} earned={breakdown.genuineInterest > 0} />
        <ScoreItem label="Referral Obtained" points={1} maxPoints={1} earned={breakdown.referralObtained > 0} />
        <ScoreItem label="Follow-up Requested" points={1} maxPoints={1} earned={breakdown.followUpRequested > 0} />
      </CategorySection>

      {/* Conversation Quality (30%) */}
      <CategorySection
        icon={MessageSquare}
        title="Quality"
        score={breakdown.qualityTotal}
        maxScore={5}
        weight="30%"
      >
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            <span>Duration Score</span>
          </div>
          <span className="font-medium text-emerald-600">
            +{breakdown.durationScore.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            <span>Qualifying Info</span>
          </div>
          <span className="font-medium text-emerald-600">
            +{breakdown.qualifyingInfo.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            <span>Objection Handling</span>
          </div>
          <span className="font-medium text-emerald-600">
            +{breakdown.objectionHandled.toFixed(1)}
          </span>
        </div>
      </CategorySection>

      {/* Efficiency (20%) */}
      <CategorySection
        icon={Zap}
        title="Efficiency"
        score={breakdown.efficiencyTotal}
        maxScore={2}
        weight="20%"
      >
        <ScoreItem label="First-Attempt DM" points={1.5} maxPoints={1.5} earned={breakdown.firstAttemptDm > 0} />
        <ScoreItem label="Optimal Call Time" points={0.5} maxPoints={0.5} earned={breakdown.optimalTime > 0} />
      </CategorySection>
    </div>
  );
}
