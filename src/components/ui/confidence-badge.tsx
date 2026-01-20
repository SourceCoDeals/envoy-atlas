import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  sampleSize: number;
  className?: string;
}

export function ConfidenceBadge({ sampleSize, className }: ConfidenceBadgeProps) {
  const getConfidence = () => {
    if (sampleSize >= 1000) return { 
      level: 'high', 
      label: 'High confidence', 
      color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800',
      description: 'Large sample size (1000+) - these numbers are reliable'
    };
    if (sampleSize >= 200) return { 
      level: 'medium', 
      label: 'Medium confidence', 
      color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
      description: 'Decent sample size (200-999) - directionally accurate'
    };
    return { 
      level: 'low', 
      label: 'Low confidence', 
      color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
      description: `Small sample size (${sampleSize}) - need more data for reliable insights`
    };
  };

  const confidence = getConfidence();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("text-xs cursor-help font-mono", confidence.color, className)}>
            n={sampleSize.toLocaleString()}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">{confidence.label}</p>
          <p className="text-xs text-muted-foreground">{confidence.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Minimal confidence indicator (just the level)
interface ConfidenceLevelProps {
  sampleSize: number;
  className?: string;
}

export function ConfidenceLevel({ sampleSize, className }: ConfidenceLevelProps) {
  const getLevel = () => {
    if (sampleSize >= 1000) return { text: '●●●', color: 'text-green-600 dark:text-green-400', label: 'High' };
    if (sampleSize >= 200) return { text: '●●○', color: 'text-amber-600 dark:text-amber-400', label: 'Medium' };
    return { text: '●○○', color: 'text-red-600 dark:text-red-400', label: 'Low' };
  };

  const level = getLevel();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("text-xs cursor-help", level.color, className)}>
            {level.text}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{level.label} confidence (n={sampleSize.toLocaleString()})</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
