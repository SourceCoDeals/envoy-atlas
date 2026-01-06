import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Line } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { DailyTrend } from '@/hooks/useMonthlyReportData';

interface MonthlyTrendChartProps {
  dailyTrends: DailyTrend[];
}

const chartConfig = {
  sent: {
    label: 'Emails Sent',
    color: 'hsl(var(--chart-1))',
  },
  replyRate: {
    label: 'Reply Rate %',
    color: 'hsl(var(--chart-2))',
  },
};

export function MonthlyTrendChart({ dailyTrends }: MonthlyTrendChartProps) {
  const chartData = dailyTrends.map(d => ({
    date: d.date,
    dateLabel: format(parseISO(d.date), 'MMM d'),
    sent: d.sent,
    replyRate: d.replyRate,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Performance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No daily data available for this month
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Daily Performance Trend</CardTitle>
        <p className="text-sm text-muted-foreground">
          Emails sent (bars) and reply rate (line) by day
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="dateLabel" 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              className="text-muted-foreground"
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
              className="text-muted-foreground"
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value.toFixed(1)}%`}
              domain={[0, 'auto']}
              className="text-muted-foreground"
            />
            <ChartTooltip 
              content={
                <ChartTooltipContent 
                  formatter={(value, name) => {
                    if (name === 'sent') return [value.toLocaleString(), 'Sent'];
                    if (name === 'replyRate') return [`${Number(value).toFixed(2)}%`, 'Reply Rate'];
                    return [value, name];
                  }}
                />
              } 
            />
            <Bar 
              yAxisId="left"
              dataKey="sent" 
              fill="hsl(var(--chart-1))" 
              opacity={0.6}
              radius={[2, 2, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="replyRate"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
