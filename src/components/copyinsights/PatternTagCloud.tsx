import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PatternTag {
  pattern: string;
  description?: string;
  lift: number; // percentage lift vs baseline
  sampleSize: number;
  isSignificant: boolean;
}

interface PatternTagCloudProps {
  patterns: PatternTag[];
  className?: string;
  maxTags?: number;
  onPatternClick?: (pattern: PatternTag) => void;
}

export function PatternTagCloud({ 
  patterns, 
  className, 
  maxTags = 12,
  onPatternClick 
}: PatternTagCloudProps) {
  // Sort by absolute lift, then filter to max
  const sortedPatterns = [...patterns]
    .sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift))
    .slice(0, maxTags);

  if (patterns.length === 0) {
    return (
      <div className={cn("text-center text-muted-foreground py-4", className)}>
        <p className="text-sm">No patterns detected yet. Run pattern analysis to discover what works.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {sortedPatterns.map((pattern, index) => {
        const isPositive = pattern.lift > 10;
        const isNegative = pattern.lift < -10;
        const isNeutral = !isPositive && !isNegative;

        return (
          <TooltipProvider key={index}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline"
                  className={cn(
                    "cursor-pointer transition-all hover:scale-105",
                    isPositive && "bg-success/10 text-success border-success/30 hover:bg-success/20",
                    isNegative && "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20",
                    isNeutral && "bg-muted hover:bg-muted/80",
                    !pattern.isSignificant && "opacity-60"
                  )}
                  onClick={() => onPatternClick?.(pattern)}
                >
                  {isPositive && <TrendingUp className="h-3 w-3 mr-1" />}
                  {isNegative && <TrendingDown className="h-3 w-3 mr-1" />}
                  {isNeutral && <Minus className="h-3 w-3 mr-1" />}
                  {pattern.pattern}
                  <span className="ml-1 font-mono text-[10px]">
                    {pattern.lift > 0 ? '+' : ''}{pattern.lift.toFixed(0)}%
                  </span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-medium">{pattern.pattern}</p>
                  {pattern.description && (
                    <p className="text-xs text-muted-foreground">{pattern.description}</p>
                  )}
                  <p className="text-xs">
                    <strong>{pattern.lift > 0 ? '+' : ''}{pattern.lift.toFixed(1)}%</strong> vs baseline
                  </p>
                  <p className="text-xs text-muted-foreground">
                    n={pattern.sampleSize.toLocaleString()} 
                    {pattern.isSignificant ? ' (statistically significant)' : ' (needs more data)'}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

// Compact version for inline use
export function PatternTagInline({ 
  pattern, 
  lift, 
  className 
}: { 
  pattern: string; 
  lift: number; 
  className?: string; 
}) {
  const isPositive = lift > 10;
  const isNegative = lift < -10;

  return (
    <Badge 
      variant="outline"
      className={cn(
        "text-xs",
        isPositive && "bg-success/10 text-success border-success/30",
        isNegative && "bg-destructive/10 text-destructive border-destructive/30",
        !isPositive && !isNegative && "bg-muted",
        className
      )}
    >
      {pattern}
      <span className="ml-1 font-mono">
        {lift > 0 ? '+' : ''}{lift.toFixed(0)}%
      </span>
    </Badge>
  );
}
