import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FunnelStage {
  stage: string;
  count: number;
}

interface ConversionFunnelProps {
  data: FunnelStage[];
  className?: string;
}

export function ConversionFunnel({ data, className }: ConversionFunnelProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getConversionRate = (index: number) => {
    if (index === 0 || data[index - 1].count === 0) return null;
    return ((data[index].count / data[index - 1].count) * 100).toFixed(1);
  };

  // Funnel colors - warm to cool gradient
  const stageColors = [
    { bg: 'hsl(0 55% 62%)', hover: 'hsl(0 55% 55%)' },      // Coral/Red
    { bg: 'hsl(43 77% 70%)', hover: 'hsl(43 77% 63%)' },    // Yellow
    { bg: 'hsl(195 25% 45%)', hover: 'hsl(195 25% 38%)' },  // Teal/Slate
    { bg: 'hsl(25 30% 35%)', hover: 'hsl(25 30% 28%)' },    // Brown
    { bg: 'hsl(142 50% 40%)', hover: 'hsl(142 50% 33%)' },  // Green
    { bg: 'hsl(220 50% 50%)', hover: 'hsl(220 50% 43%)' },  // Blue
  ];

  // Calculate widths - top is 100%, each subsequent stage is proportionally smaller
  const getWidth = (index: number) => {
    const minWidth = 25;
    const maxWidth = 100;
    const step = (maxWidth - minWidth) / Math.max(data.length - 1, 1);
    return maxWidth - (step * index);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="flex gap-6">
            {/* Funnel visualization */}
            <div className="flex-1 flex flex-col items-center">
              <svg 
                viewBox="0 0 200 240" 
                className="w-full max-w-[280px]"
                preserveAspectRatio="xMidYMid meet"
              >
                {data.map((stage, index) => {
                  const topWidth = getWidth(index);
                  const bottomWidth = index < data.length - 1 ? getWidth(index + 1) : topWidth * 0.7;
                  const segmentHeight = 200 / data.length;
                  const y = index * segmentHeight + 10;
                  
                  const topLeft = (200 - (topWidth * 2)) / 2;
                  const topRight = topLeft + (topWidth * 2);
                  const bottomLeft = (200 - (bottomWidth * 2)) / 2;
                  const bottomRight = bottomLeft + (bottomWidth * 2);
                  
                  const color = stageColors[index % stageColors.length];
                  const isHovered = hoveredIndex === index;
                  
                  return (
                    <Tooltip key={stage.stage}>
                      <TooltipTrigger asChild>
                        <g
                          onMouseEnter={() => setHoveredIndex(index)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          className="cursor-pointer"
                        >
                          <path
                            d={`M ${topLeft} ${y} 
                                L ${topRight} ${y} 
                                L ${bottomRight} ${y + segmentHeight - 2} 
                                L ${bottomLeft} ${y + segmentHeight - 2} Z`}
                            fill={isHovered ? color.hover : color.bg}
                            className="transition-all duration-200"
                          />
                        </g>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[200px]">
                        <div className="space-y-1">
                          <p className="font-semibold">{stage.stage}</p>
                          <p className="text-lg font-bold">{stage.count.toLocaleString()}</p>
                          {getConversionRate(index) && (
                            <p className="text-xs text-muted-foreground">
                              {getConversionRate(index)}% of previous stage
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </svg>
            </div>

            {/* Labels on the right */}
            <div className="flex flex-col justify-around py-2 min-w-[120px]">
              {data.map((stage, index) => {
                const convRate = getConversionRate(index);
                const isHovered = hoveredIndex === index;
                
                return (
                  <div 
                    key={stage.stage}
                    className={cn(
                      "flex flex-col transition-opacity duration-200",
                      hoveredIndex !== null && !isHovered && "opacity-50"
                    )}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <span className="text-sm font-medium text-foreground truncate">
                      {stage.stage}
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      {stage.count.toLocaleString()}
                    </span>
                    {convRate && (
                      <span className="text-xs text-muted-foreground">
                        {convRate}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TooltipProvider>

        {/* Overall conversion summary */}
        {data.length > 1 && data[0].count > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {data[0].stage} → {data[data.length - 1].stage}
              </span>
              <span className="font-bold text-primary">
                {((data[data.length - 1].count / data[0].count) * 100).toFixed(2)}% overall
              </span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {data[0].count.toLocaleString()} {data[0].stage.toLowerCase()} → {data[data.length - 1].count.toLocaleString()} {data[data.length - 1].stage.toLowerCase()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
