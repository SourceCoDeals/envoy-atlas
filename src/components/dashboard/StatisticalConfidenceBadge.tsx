import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, TrendingUp, CheckCircle } from 'lucide-react';

type ConfidenceLevel = 'low' | 'medium' | 'high';

interface StatisticalConfidenceBadgeProps {
  sampleSize: number;
  lowThreshold?: number;
  highThreshold?: number;
  showTooltip?: boolean;
  size?: 'sm' | 'default';
}

export function getConfidenceLevel(
  sampleSize: number, 
  lowThreshold = 200, 
  highThreshold = 500
): ConfidenceLevel {
  if (sampleSize < lowThreshold) return 'low';
  if (sampleSize < highThreshold) return 'medium';
  return 'high';
}

export function getConfidenceInfo(level: ConfidenceLevel) {
  switch (level) {
    case 'low':
      return {
        label: 'Low Confidence',
        shortLabel: 'Low',
        description: 'Insufficient data for reliable conclusions. Results may change significantly with more data.',
        icon: AlertCircle,
        color: 'text-destructive',
        bgClass: 'bg-destructive/10 border-destructive/30 text-destructive',
      };
    case 'medium':
      return {
        label: 'Medium Confidence',
        shortLabel: 'Medium',
        description: 'Early signal - results may change with more data. Use with caution.',
        icon: TrendingUp,
        color: 'text-warning',
        bgClass: 'bg-warning/10 border-warning/30 text-warning',
      };
    case 'high':
      return {
        label: 'High Confidence',
        shortLabel: 'High',
        description: 'Statistically reliable result. Safe to make decisions based on this data.',
        icon: CheckCircle,
        color: 'text-success',
        bgClass: 'bg-success/10 border-success/30 text-success',
      };
  }
}

export function StatisticalConfidenceBadge({ 
  sampleSize, 
  lowThreshold = 200,
  highThreshold = 500,
  showTooltip = true,
  size = 'default',
}: StatisticalConfidenceBadgeProps) {
  const level = getConfidenceLevel(sampleSize, lowThreshold, highThreshold);
  const info = getConfidenceInfo(level);
  const Icon = info.icon;

  const badge = (
    <Badge 
      variant="outline" 
      className={`${info.bgClass} ${size === 'sm' ? 'text-xs px-1.5 py-0' : ''}`}
    >
      <Icon className={`mr-1 ${size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
      {size === 'sm' ? info.shortLabel : info.label}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium mb-1">{info.label}</p>
          <p className="text-xs text-muted-foreground mb-2">{info.description}</p>
          <p className="text-xs">
            Sample size: <span className="font-mono">{sampleSize.toLocaleString()}</span>
            {level === 'low' && ` (need ${lowThreshold}+ for medium confidence)`}
            {level === 'medium' && ` (need ${highThreshold}+ for high confidence)`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Confidence interval calculation for reply rates
export function calculateConfidenceInterval(
  rate: number, 
  sampleSize: number, 
  confidenceLevel = 0.95
): { lower: number; upper: number; marginOfError: number } {
  if (sampleSize === 0) {
    return { lower: 0, upper: 0, marginOfError: 0 };
  }

  // Z-score for 95% confidence
  const z = confidenceLevel === 0.95 ? 1.96 : 1.645;
  
  // Standard error for proportion
  const p = rate / 100;
  const standardError = Math.sqrt((p * (1 - p)) / sampleSize);
  
  // Margin of error
  const marginOfError = z * standardError * 100;
  
  return {
    lower: Math.max(0, rate - marginOfError),
    upper: Math.min(100, rate + marginOfError),
    marginOfError,
  };
}

// Display rate with confidence interval
export function formatRateWithConfidence(rate: number, sampleSize: number): string {
  const { lower, upper } = calculateConfidenceInterval(rate, sampleSize);
  const level = getConfidenceLevel(sampleSize);
  
  if (level === 'low') {
    return `${rate.toFixed(1)}% (insufficient data)`;
  }
  
  return `${rate.toFixed(1)}% (${lower.toFixed(1)}% - ${upper.toFixed(1)}%)`;
}
