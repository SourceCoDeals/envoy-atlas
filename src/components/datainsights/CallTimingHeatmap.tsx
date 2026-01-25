import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatHourLabel, BUSINESS_HOURS_ARRAY } from '@/lib/timezone';

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
  // Filter to business hours only and ensure all hours are represented
  const businessHoursData = BUSINESS_HOURS_ARRAY.map(hour => {
    const existing = data.find(d => d.hour === hour);
    return existing || { hour, calls: 0, connects: 0 };
  });

  const maxConnects = Math.max(...businessHoursData.map(d => d.connects), 1);
  
  const getIntensity = (connects: number) => {
    const ratio = connects / maxConnects;
    if (ratio >= 0.8) return 'bg-primary';
    if (ratio >= 0.6) return 'bg-primary/80';
    if (ratio >= 0.4) return 'bg-chart-2';
    if (ratio >= 0.2) return 'bg-chart-4';
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
  const bestHour = businessHoursData.reduce((best, current) => 
    current.connects > best.connects ? current : best
  , businessHoursData[0]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Best Time to Call (ET)</CardTitle>
          {bestHour && bestHour.connects > 0 && (
            <span className="text-sm text-muted-foreground">
              Peak: <span className="font-medium text-primary">{formatHour(bestHour.hour)}</span>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-12">
          {businessHoursData.map((d) => (
            <div 
              key={d.hour}
              className="flex flex-col items-center"
            >
              <div
                className={cn(
                  'w-full aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-colors',
                  getIntensity(d.connects),
                  d.connects > 0 ? 'text-primary-foreground' : 'text-muted-foreground'
                )}
                title={`${formatHour(d.hour)} ET: ${d.connects} connects / ${d.calls} calls (${connectRate(d)}% rate)`}
              >
                {d.connects}
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                {formatHourLabel(d.hour)}
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
            <div className="w-3 h-3 rounded bg-chart-2" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-primary" />
            <span>High</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
