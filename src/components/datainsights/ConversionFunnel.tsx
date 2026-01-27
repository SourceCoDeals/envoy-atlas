import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FunnelStage {
  stage: string;
  count: number;
}

interface ConversionFunnelProps {
  data: FunnelStage[];
  className?: string;
}

export function ConversionFunnel({ data, className }: ConversionFunnelProps) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getConversionRate = (index: number) => {
    if (index === 0 || data[index - 1].count === 0) return null;
    return ((data[index].count / data[index - 1].count) * 100).toFixed(1);
  };

  // Colors for funnel stages - gradient from top to bottom
  const stageColors = [
    'from-blue-500 to-blue-600',
    'from-cyan-500 to-cyan-600',
    'from-teal-500 to-teal-600',
    'from-emerald-500 to-emerald-600',
    'from-green-500 to-green-600',
    'from-green-600 to-green-700',
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-1">
          {data.map((stage, index) => {
            // Calculate width as percentage of max (minimum 20% for visibility)
            const widthPercentage = Math.max((stage.count / maxCount) * 100, 20);
            const convRate = getConversionRate(index);
            
            return (
              <div key={stage.stage} className="w-full flex flex-col items-center">
                {/* Funnel segment - trapezoid shape using clip-path */}
                <div 
                  className="relative group cursor-default"
                  style={{ 
                    width: `${widthPercentage}%`,
                    minWidth: '120px',
                  }}
                >
                  <div
                    className={cn(
                      'h-12 bg-gradient-to-r flex items-center justify-center transition-all duration-300',
                      stageColors[index % stageColors.length],
                      'hover:brightness-110'
                    )}
                    style={{
                      clipPath: index === data.length - 1 
                        ? 'polygon(5% 0%, 95% 0%, 90% 100%, 10% 100%)' // Bottom stage - more tapered
                        : 'polygon(0% 0%, 100% 0%, 95% 100%, 5% 100%)', // Regular trapezoid
                    }}
                  >
                    <div className="text-center text-white px-4">
                      <div className="font-semibold text-sm truncate">{stage.stage}</div>
                      <div className="text-xs opacity-90">{stage.count.toLocaleString()}</div>
                    </div>
                  </div>
                  
                  {/* Conversion rate badge between stages */}
                  {index < data.length - 1 && convRate && (
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10">
                      <div className="bg-background border border-border rounded-full px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
                        {convRate}%
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Spacer for conversion rate badge */}
                {index < data.length - 1 && <div className="h-3" />}
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
