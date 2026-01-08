import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface HourlyData {
  hour: number;
  calls: number;
  connects: number;
}

interface CallTimingHeatmapProps {
  data: HourlyData[];
  className?: string;
}

export function CallTimingHeatmap({ data, className }: CallTimingHeatmapProps) {
  const maxConnects = Math.max(...data.map(d => d.connects), 1);
  
  const getIntensity = (connects: number) => {
    const ratio = connects / maxConnects;
    if (ratio >= 0.8) return 'bg-green-500';
    if (ratio >= 0.6) return 'bg-green-400';
    if (ratio >= 0.4) return 'bg-yellow-400';
    if (ratio >= 0.2) return 'bg-orange-400';
    return 'bg-muted';
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  const connectRate = (d: HourlyData) => 
    d.calls > 0 ? ((d.connects / d.calls) * 100).toFixed(0) : '0';

  // Find best time
  const bestHour = data.reduce((best, current) => 
    current.connects > best.connects ? current : best
  , data[0] || { hour: 10, connects: 0, calls: 0 });

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Best Time to Call</CardTitle>
          {bestHour && (
            <span className="text-sm text-muted-foreground">
              Peak: <span className="font-medium text-green-500">{formatHour(bestHour.hour)}</span>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-6 gap-2 md:grid-cols-11">
          {data.map((d) => (
            <div 
              key={d.hour}
              className="flex flex-col items-center"
            >
              <div
                className={cn(
                  'w-full aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-colors',
                  getIntensity(d.connects),
                  d.connects > 0 ? 'text-white' : 'text-muted-foreground'
                )}
                title={`${formatHour(d.hour)}: ${d.connects} connects (${connectRate(d)}% rate)`}
              >
                {d.connects}
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                {d.hour > 12 ? d.hour - 12 : d.hour || 12}
                {d.hour >= 12 ? 'p' : 'a'}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-muted" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-400" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>High</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
