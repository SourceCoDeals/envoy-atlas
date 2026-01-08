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

  const stageColors = [
    'bg-blue-500',
    'bg-blue-400',
    'bg-cyan-500',
    'bg-emerald-500',
    'bg-green-500',
    'bg-green-600',
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((stage, index) => {
            const widthPercentage = (stage.count / maxCount) * 100;
            const convRate = getConversionRate(index);
            
            return (
              <div key={stage.stage} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{stage.stage}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{stage.count.toLocaleString()}</span>
                    {convRate && (
                      <span className="text-xs text-muted-foreground">
                        ({convRate}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-8 bg-muted rounded-md overflow-hidden relative">
                  <div
                    className={cn(
                      'h-full rounded-md transition-all duration-500 flex items-center justify-center',
                      stageColors[index % stageColors.length]
                    )}
                    style={{ 
                      width: `${Math.max(widthPercentage, 5)}%`,
                      marginLeft: `${(100 - widthPercentage) / 2}%`,
                      marginRight: `${(100 - widthPercentage) / 2}%`,
                    }}
                  />
                </div>
                {index < data.length - 1 && (
                  <div className="flex justify-center my-1">
                    <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-muted-foreground/30" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {data.length > 1 && data[0].count > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Conversion</span>
              <span className="font-bold text-primary">
                {((data[data.length - 1].count / data[0].count) * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
