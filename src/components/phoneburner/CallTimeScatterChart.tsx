import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ZAxis } from 'recharts';
import { format, parseISO } from 'date-fns';

interface ScatterDataPoint {
  date: string;
  hour: number;
  analyst: string;
}

interface CallTimeScatterChartProps {
  data: ScatterDataPoint[];
  analysts: string[];
}

const COLOR_PALETTE = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(220, 70%, 50%)',
];

export function CallTimeScatterChart({ data, analysts }: CallTimeScatterChartProps) {
  // Assign colors to analysts
  const analystColors: Record<string, string> = {};
  analysts.forEach((analyst, idx) => {
    analystColors[analyst] = COLOR_PALETTE[idx % COLOR_PALETTE.length];
  });

  // Aggregate calls by date, hour, and analyst - count calls at each point
  const aggregatedByAnalyst = analysts.map(analyst => {
    const counts: Record<string, number> = {};
    data.filter(d => d.analyst === analyst).forEach(d => {
      const key = `${d.date}-${d.hour}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    
    return {
      analyst,
      data: Object.entries(counts).map(([key, count]) => {
        const [date, hour] = key.split('-');
        return { x: date, y: parseInt(hour), z: count, analyst };
      }),
    };
  });

  // Get all unique dates for x-axis
  const allDates = [...new Set(data.map(d => d.date))].sort();

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Call Time Distribution</CardTitle>
          <CardDescription>When calls are made throughout the day</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center text-muted-foreground">
          No data available for the selected filters
        </CardContent>
      </Card>
    );
  }

  // Calculate max count for proper bubble sizing
  const maxCount = Math.max(
    ...aggregatedByAnalyst.flatMap(a => a.data.map(d => d.z)),
    1
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call Time Distribution</CardTitle>
        <CardDescription>Hours of day (Y-axis) vs. Date (X-axis) — bubble size = number of calls</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="x" 
                type="category"
                allowDuplicatedCategory={false}
                tickFormatter={(val) => {
                  try {
                    return format(parseISO(val), 'M/d');
                  } catch {
                    return val;
                  }
                }}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                dataKey="y" 
                type="number"
                domain={[6, 20]}
                tickFormatter={formatHour}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <ZAxis 
                dataKey="z" 
                type="number"
                range={[40, 400]} 
                domain={[1, maxCount]}
              />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const point = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                        <p className="font-medium text-foreground">{point.analyst || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          Date: {format(parseISO(point.x), 'MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Time: {formatHour(point.y)}
                        </p>
                        <p className="text-sm font-medium text-primary mt-1">
                          {point.z} call{point.z !== 1 ? 's' : ''}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              {aggregatedByAnalyst.map(({ analyst, data: scatterData }) => (
                <Scatter
                  key={analyst}
                  name={analyst}
                  data={scatterData}
                  fill={analystColors[analyst] || 'hsl(var(--primary))'}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
