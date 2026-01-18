import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DataErrorFlag, DataErrorType } from '@/components/ui/data-error-flag';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertTriangle, 
  CheckCircle,
  Info,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: number;
  format?: 'percent' | 'number' | 'currency';
  decimals?: number;
  trend?: {
    value: number;
    label?: string;
  };
  target?: {
    value: number;
    label?: string;
  };
  expected?: {
    value: number;
    difference?: number;
  };
  confidence?: 'high' | 'medium' | 'low';
  sampleSize?: number;
  status?: 'good' | 'warning' | 'bad' | 'neutral';
  icon?: LucideIcon;
  iconColor?: string;
  onClick?: () => void;
  actionLabel?: string;
  dataFlag?: {
    type: DataErrorType;
    tooltip?: string;
  };
}

export function KPICard({
  label,
  value,
  format = 'number',
  decimals = 1,
  trend,
  target,
  expected,
  confidence,
  sampleSize,
  status = 'neutral',
  icon: Icon,
  iconColor,
  onClick,
  actionLabel,
  dataFlag,
}: KPICardProps) {
  const formatValue = (val: number) => {
    switch (format) {
      case 'percent':
        return `${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
      case 'currency':
        return `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals })}`;
      case 'number':
      default:
        return val.toLocaleString(undefined, { 
          minimumFractionDigits: 0,
          maximumFractionDigits: decimals 
        });
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'border-success/50';
      case 'warning': return 'border-warning/50';
      case 'bad': return 'border-destructive/50';
      default: return '';
    }
  };

  const getTrendInfo = () => {
    if (!trend) return null;
    
    const isPositive = trend.value > 0;
    const isNegative = trend.value < 0;
    
    return {
      icon: isPositive ? TrendingUp : isNegative ? TrendingDown : Minus,
      color: isPositive ? 'text-success' : isNegative ? 'text-destructive' : 'text-muted-foreground',
      label: `${isPositive ? '+' : ''}${trend.value.toFixed(decimals)}${format === 'percent' ? '%' : ''} ${trend.label || 'wow'}`,
    };
  };

  const getTargetStatus = () => {
    if (!target) return null;
    
    const isAboveTarget = value >= target.value;
    return {
      met: isAboveTarget,
      icon: isAboveTarget ? CheckCircle : AlertTriangle,
      color: isAboveTarget ? 'text-success' : 'text-warning',
      label: `${isAboveTarget ? '✓' : '✗'} vs target: ${formatValue(target.value)}`,
    };
  };

  const getExpectedStatus = () => {
    if (!expected) return null;
    
    const diff = expected.difference ?? (value - expected.value);
    const isAbove = diff >= 0;
    
    return {
      above: isAbove,
      label: isAbove ? 'Above expected' : 'Below expected',
      color: isAbove ? 'text-success' : 'text-warning',
    };
  };

  const trendInfo = getTrendInfo();
  const targetStatus = getTargetStatus();
  const expectedStatus = getExpectedStatus();

  return (
    <Card 
      className={cn(
        "transition-colors",
        getStatusColor(),
        onClick && "cursor-pointer hover:bg-accent/50"
      )}
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-3">
        <div className="space-y-2">
          {/* Value Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {Icon && (
                <Icon className={cn("h-4 w-4", iconColor || "text-muted-foreground")} />
              )}
              <span className="text-2xl font-bold tabular-nums">
                {formatValue(value)}
              </span>
            </div>
            {trendInfo && (
              <div className={cn("flex items-center gap-1 text-sm", trendInfo.color)}>
                <trendInfo.icon className="h-4 w-4" />
                <span className="text-xs">{trendInfo.label}</span>
              </div>
            )}
          </div>

          {/* Label + Data Flag */}
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            {dataFlag && (
              <DataErrorFlag type={dataFlag.type} tooltip={dataFlag.tooltip} size="sm" />
            )}
          </div>
          {targetStatus && (
            <div className={cn("flex items-center gap-1 text-xs", targetStatus.color)}>
              <targetStatus.icon className="h-3 w-3" />
              <span>{targetStatus.label}</span>
            </div>
          )}

          {/* Expected Status */}
          {expectedStatus && !expectedStatus.above && (
            <div className={cn("flex items-center gap-1 text-xs", expectedStatus.color)}>
              <AlertTriangle className="h-3 w-3" />
              <span>{expectedStatus.label}</span>
            </div>
          )}

          {/* Confidence Indicator */}
          {confidence && confidence !== 'high' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Info className="h-3 w-3" />
                    <span>
                      {confidence === 'low' ? 'Low confidence' : 'Medium confidence'}
                      {sampleSize && ` (n=${sampleSize.toLocaleString()})`}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {confidence === 'low' 
                      ? 'Sample size is too small for reliable conclusions'
                      : 'Sample size provides moderate confidence'
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Action Link */}
          {onClick && actionLabel && (
            <button className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
              {actionLabel}
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper to determine KPI status based on thresholds
export function getKPIStatus(
  value: number,
  goodThreshold: number,
  badThreshold: number,
  higherIsBetter: boolean = true
): 'good' | 'warning' | 'bad' {
  if (higherIsBetter) {
    if (value >= goodThreshold) return 'good';
    if (value <= badThreshold) return 'bad';
    return 'warning';
  } else {
    if (value <= goodThreshold) return 'good';
    if (value >= badThreshold) return 'bad';
    return 'warning';
  }
}
