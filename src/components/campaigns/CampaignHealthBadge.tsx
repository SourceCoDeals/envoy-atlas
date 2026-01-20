import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { calculateCampaignHealthScore, type CampaignHealthInput, type CampaignHealthResult } from '@/lib/campaignHealth';
import { Heart, AlertTriangle, XCircle, CheckCircle, TrendingUp } from 'lucide-react';

interface CampaignHealthBadgeProps {
  campaign: CampaignHealthInput;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CampaignHealthBadge({ 
  campaign, 
  showTooltip = true, 
  size = 'md',
  className 
}: CampaignHealthBadgeProps) {
  const health = calculateCampaignHealthScore(campaign);

  const getLevelConfig = (level: CampaignHealthResult['level']) => {
    switch (level) {
      case 'excellent':
        return {
          icon: TrendingUp,
          bgColor: 'bg-success/15',
          borderColor: 'border-success/30',
          textColor: 'text-success',
          label: 'Excellent',
        };
      case 'good':
        return {
          icon: CheckCircle,
          bgColor: 'bg-success/10',
          borderColor: 'border-success/20',
          textColor: 'text-success',
          label: 'Good',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-warning/15',
          borderColor: 'border-warning/30',
          textColor: 'text-warning',
          label: 'Needs Attention',
        };
      case 'critical':
        return {
          icon: XCircle,
          bgColor: 'bg-destructive/15',
          borderColor: 'border-destructive/30',
          textColor: 'text-destructive',
          label: 'Critical',
        };
    }
  };

  const config = getLevelConfig(health.level);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  const badge = (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-medium',
        config.bgColor,
        config.borderColor,
        config.textColor,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      <span className="font-mono font-bold">{health.score}</span>
    </span>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="max-w-xs p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Health Score</span>
              <span className={cn('font-mono font-bold', config.textColor)}>
                {health.score}/100
              </span>
            </div>
            
            <div className="text-xs space-y-1 border-t pt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deliverability</span>
                <span>{health.breakdown.deliverability}/30</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reply Rate</span>
                <span>{health.breakdown.replyRate}/35</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Positive Rate</span>
                <span>{health.breakdown.positiveRate}/20</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sample Size</span>
                <span>{health.breakdown.sampleSize}/15</span>
              </div>
            </div>

            {health.issues.length > 0 && (
              <div className="text-xs border-t pt-2">
                <span className="text-muted-foreground font-medium">Issues:</span>
                <ul className="mt-1 space-y-0.5">
                  {health.issues.slice(0, 3).map((issue, i) => (
                    <li key={i} className="text-muted-foreground">• {issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
