import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, Percent, Calendar } from 'lucide-react';

interface WeeklyData {
  week: string;
  avgScore: number;
  connectRate: number;
  meetings: number;
}

interface TrendsMiniChartsProps {
  data: WeeklyData[];
  isLoading?: boolean;
}

export function TrendsMiniCharts({ data, isLoading }: TrendsMiniChartsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-4 w-24 bg-muted rounded animate-pulse mb-3" />
              <div className="h-20 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Avg Score Trend */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Avg Score Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 px-4">
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [value.toFixed(1), 'Avg Score']}
                />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{data[0]?.week || ''}</span>
            <span>{data[data.length - 1]?.week || ''}</span>
          </div>
        </CardContent>
      </Card>

      {/* Connect Rate Trend */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Percent className="h-4 w-4 text-muted-foreground" />
            Connect Rate Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 px-4">
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Connect Rate']}
                />
                <Line
                  type="monotone"
                  dataKey="connectRate"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{data[0]?.week || ''}</span>
            <span>{data[data.length - 1]?.week || ''}</span>
          </div>
        </CardContent>
      </Card>

      {/* Meetings Per Week */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Meetings Per Week
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 px-4">
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [value, 'Meetings']}
                />
                <Bar
                  dataKey="meetings"
                  fill="hsl(var(--chart-3))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{data[0]?.week || ''}</span>
            <span>{data[data.length - 1]?.week || ''}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
