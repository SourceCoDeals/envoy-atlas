import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TimeHeatmapProps {
  data: { day: number; hour: number; value: number }[];
  title?: string;
  description?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function TimeHeatmap({ data, title = 'Response Heatmap', description = 'Best times to send emails' }: TimeHeatmapProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  const getValue = (day: number, hour: number) => {
    const item = data.find(d => d.day === day && d.hour === hour);
    return item?.value || 0;
  };

  const getIntensity = (value: number) => {
    if (value === 0) return 'bg-muted';
    const ratio = value / maxValue;
    if (ratio > 0.75) return 'bg-success';
    if (ratio > 0.5) return 'bg-success/70';
    if (ratio > 0.25) return 'bg-success/40';
    return 'bg-success/20';
  };

  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h}${ampm}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-10" />
              {HOURS.filter((_, i) => i % 3 === 0).map(hour => (
                <div key={hour} className="flex-1 text-center text-xs text-muted-foreground">
                  {formatHour(hour)}
                </div>
              ))}
            </div>
            
            {/* Grid */}
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex items-center gap-1 mb-1">
                <div className="w-10 text-xs text-muted-foreground">{day}</div>
                <div className="flex-1 flex gap-[2px]">
                  {HOURS.map(hour => {
                    const value = getValue(dayIndex, hour);
                    return (
                      <Tooltip key={hour}>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex-1 h-6 rounded-sm ${getIntensity(value)} transition-colors cursor-default`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{day} {formatHour(hour)}</p>
                          <p className="text-sm text-muted-foreground">{value} replies</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4">
              <span className="text-xs text-muted-foreground">Less</span>
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded-sm bg-muted" />
                <div className="w-4 h-4 rounded-sm bg-success/20" />
                <div className="w-4 h-4 rounded-sm bg-success/40" />
                <div className="w-4 h-4 rounded-sm bg-success/70" />
                <div className="w-4 h-4 rounded-sm bg-success" />
              </div>
              <span className="text-xs text-muted-foreground">More</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
