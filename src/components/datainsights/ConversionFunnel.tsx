import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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

  const getConversionRate = (index: number) => {
    if (index === 0 || data[index - 1].count === 0) return null;
    return ((data[index].count / data[index - 1].count) * 100).toFixed(1);
  };

  // Funnel colors - warm to cool gradient
  const stageColors = [
    { bg: 'hsl(220 70% 55%)', hover: 'hsl(220 70% 48%)' },    // Blue (top)
    { bg: 'hsl(180 50% 45%)', hover: 'hsl(180 50% 38%)' },    // Teal
    { bg: 'hsl(160 55% 42%)', hover: 'hsl(160 55% 35%)' },    // Green-teal
    { bg: 'hsl(142 50% 40%)', hover: 'hsl(142 50% 33%)' },    // Green
    { bg: 'hsl(142 55% 35%)', hover: 'hsl(142 55% 28%)' },    // Darker green
  ];

  // Calculate widths - top is 100%, each subsequent stage is proportionally smaller
  const getWidth = (index: number) => {
    const minWidth = 30;
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
        <div className="flex flex-col items-center space-y-1">
          {data.map((stage, index) => {
            const widthPercent = getWidth(index);
            const color = stageColors[index % stageColors.length];
            const isHovered = hoveredIndex === index;
            const stageInfo = getStageInfo(stage.stage);
            const convRate = getConversionRate(index);
            
            return (
              <div key={stage.stage} className="w-full flex flex-col items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <div 
                      className="relative cursor-pointer transition-all duration-200"
                      style={{ width: `${widthPercent}%`, minWidth: '140px' }}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {/* Trapezoid shape */}
                      <div
                        className="h-14 flex items-center justify-center transition-all duration-200"
                        style={{
                          background: isHovered ? color.hover : color.bg,
                          clipPath: index === data.length - 1 
                            ? 'polygon(8% 0%, 92% 0%, 85% 100%, 15% 100%)' 
                            : 'polygon(0% 0%, 100% 0%, 92% 100%, 8% 100%)',
                        }}
                      >
                        <div className="text-center text-white px-6">
                          <div className="font-semibold text-sm">{stage.stage}</div>
                          <div className="text-xs opacity-90">{stage.count.toLocaleString()}</div>
                        </div>
                      </div>
                      
                      {/* Conversion rate badge */}
                      {index < data.length - 1 && convRate && (
                        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10">
                          <div className="bg-background border border-border rounded-full px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
                            {convRate}%
                          </div>
                        </div>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent 
                    side="right" 
                    className="w-72 p-0"
                    sideOffset={12}
                  >
                    <div className="p-3 space-y-3">
                      {/* Header */}
                      <div className="border-b pb-2">
                        <p className="font-semibold text-base">{stage.stage}</p>
                        <p className="text-2xl font-bold text-primary">{stage.count.toLocaleString()}</p>
                        {convRate && (
                          <p className="text-xs text-muted-foreground">
                            {convRate}% of previous stage
                          </p>
                        )}
                      </div>
                      
                      {/* Calculation */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Info className="h-3 w-3" />
                          <span>How it's calculated</span>
                        </div>
                        <p className="text-sm font-medium">{stageInfo.calculation}</p>
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
                  </PopoverContent>
                </Popover>
                
                {/* Spacer for conversion rate badge */}
                {index < data.length - 1 && <div className="h-2" />}
              </div>
            );
          })}
        </div>

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
