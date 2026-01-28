import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface FunnelStage {
  stage: string;
  count: number;
}

interface ConversionFunnelProps {
  data: FunnelStage[];
  className?: string;
}

// Define calculation details and dispositions for each funnel stage
const FUNNEL_STAGE_INFO: Record<string, { 
  calculation: string; 
  dispositions?: string[];
  description: string;
}> = {
  'Total Dials': {
    calculation: 'Count of all call attempts',
    description: 'Every outbound call made by the team',
    dispositions: ['All dispositions included'],
  },
  'Dials': {
    calculation: 'Count of all call attempts',
    description: 'Every outbound call made by the team',
    dispositions: ['All dispositions included'],
  },
  'Connections': {
    calculation: 'Calls where talk_duration > 30 seconds',
    description: 'Calls that reached a live person',
    dispositions: [
      'Meeting Booked',
      'Callback Requested', 
      'Send Email',
      'Not Interested',
      'Not Qualified',
      'Referral',
    ],
  },
  'Quality Conversations': {
    calculation: 'Calls where talk_duration > 60 seconds',
    description: 'Meaningful conversations with decision makers',
    dispositions: [
      'Meeting Booked',
      'Callback Requested',
      'Send Email (>60s)',
      'Not Interested (engaged)',
    ],
  },
  'Completed': {
    calculation: 'Calls marked as completed conversations',
    description: 'Full conversations that reached a conclusion',
    dispositions: [
      'Meeting Booked',
      'Callback Requested',
      'Send Email',
      'Not Interested',
      'Not Qualified',
    ],
  },
  'Meetings': {
    calculation: 'conversation_outcome contains "meeting" or "scheduled"',
    description: 'Calls resulting in a scheduled meeting',
    dispositions: ['Meeting Booked', 'Meeting Scheduled'],
  },
  'Meetings Booked': {
    calculation: 'conversation_outcome contains "meeting" or "scheduled"',
    description: 'Calls resulting in a scheduled meeting',
    dispositions: ['Meeting Booked', 'Meeting Scheduled'],
  },
  'Owners Willing to Sell': {
    calculation: 'seller_interest_score >= 7 (Yes)',
    description: 'Contacts who expressed interest in selling',
    dispositions: ['Seller Interest = Yes'],
  },
  'Activated': {
    calculation: 'seller_interest_score >= 7 (Yes)',
    description: 'Contacts willing to engage further',
    dispositions: ['Seller Interest = Yes'],
  },
  'Interested': {
    calculation: 'is_interested = true OR seller_interest >= 7',
    description: 'Contacts showing genuine interest',
    dispositions: ['Meeting Booked', 'Callback', 'High Interest Score'],
  },
  'Closed Deals': {
    calculation: 'Opportunities marked as won',
    description: 'Successfully closed sales',
    dispositions: ['Deal Closed', 'Won'],
  },
};

// Fallback for unknown stages
const getStageInfo = (stageName: string) => {
  // Try exact match first
  if (FUNNEL_STAGE_INFO[stageName]) {
    return FUNNEL_STAGE_INFO[stageName];
  }
  
  // Try partial match
  const lowerStage = stageName.toLowerCase();
  for (const [key, value] of Object.entries(FUNNEL_STAGE_INFO)) {
    if (lowerStage.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerStage)) {
      return value;
    }
  }
  
  return {
    calculation: 'Count of matching records',
    description: stageName,
    dispositions: undefined,
  };
};

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
        <TooltipProvider delayDuration={0}>
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
                  const stageInfo = getStageInfo(stage.stage);
                  
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
                      <TooltipContent 
                        side="right" 
                        className="max-w-[280px] p-0"
                        sideOffset={10}
                      >
                        <div className="p-3 space-y-3">
                          {/* Header */}
                          <div className="border-b pb-2">
                            <p className="font-semibold text-base">{stage.stage}</p>
                            <p className="text-2xl font-bold text-primary">{stage.count.toLocaleString()}</p>
                            {getConversionRate(index) && (
                              <p className="text-xs text-muted-foreground">
                                {getConversionRate(index)}% of previous stage
                              </p>
                            )}
                          </div>
                          
                          {/* Calculation */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <Info className="h-3 w-3" />
                              <span>How it's calculated</span>
                            </div>
                            <p className="text-sm">{stageInfo.calculation}</p>
                            <p className="text-xs text-muted-foreground">{stageInfo.description}</p>
                          </div>
                          
                          {/* Dispositions */}
                          {stageInfo.dispositions && stageInfo.dispositions.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">
                                Included Dispositions
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {stageInfo.dispositions.map((disp) => (
                                  <span 
                                    key={disp}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
                                  >
                                    {disp}
                                  </span>
                                ))}
                              </div>
                            </div>
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
                      "flex flex-col transition-opacity duration-200 cursor-pointer",
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
