import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { WeeklyData } from '@/hooks/useOverviewDashboard';

interface WeeklyPerformanceChartProps {
  data: WeeklyData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: entry.color }} 
              />
              <span className="text-muted-foreground">{entry.name}:</span>
            </div>
            <span className="font-mono font-medium">
              {typeof entry.value === 'number' 
                ? entry.name.includes('%') 
                  ? `${entry.value.toFixed(2)}%` 
                  : entry.value.toLocaleString()
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function WeeklyPerformanceChart({ data }: WeeklyPerformanceChartProps) {
  const [showVolume, setShowVolume] = useState(true);
  const [showReplies, setShowReplies] = useState(true);
  const [showPositive, setShowPositive] = useState(true);
  const [showMeetings, setShowMeetings] = useState(false);

  // Check if we have any weeks with actual data
  const weeksWithData = data.filter(w => w.emailsSent > 0);
  
  if (weeksWithData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Week-by-Week Performance</CardTitle>
          <CardDescription>Last 12 weeks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-2">
            <span>No weekly data available</span>
            <span className="text-xs">Data will appear after syncing campaigns</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show data coverage warning if less than 4 weeks
  const hasLimitedData = weeksWithData.length < 4;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Week-by-Week Performance</CardTitle>
            <CardDescription>
              {hasLimitedData 
                ? `${weeksWithData.length} week${weeksWithData.length !== 1 ? 's' : ''} with activity`
                : 'Last 12 weeks'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5">
              <Switch 
                id="show-volume" 
                checked={showVolume} 
                onCheckedChange={setShowVolume}
                className="scale-75"
              />
              <Label htmlFor="show-volume" className="text-xs cursor-pointer">Sent</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch 
                id="show-replies" 
                checked={showReplies} 
                onCheckedChange={setShowReplies}
                className="scale-75"
              />
              <Label htmlFor="show-replies" className="text-xs cursor-pointer">Replies</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch 
                id="show-positive" 
                checked={showPositive} 
                onCheckedChange={setShowPositive}
                className="scale-75"
              />
              <Label htmlFor="show-positive" className="text-xs cursor-pointer">Positive</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch 
                id="show-meetings" 
                checked={showMeetings} 
                onCheckedChange={setShowMeetings}
                className="scale-75"
              />
              <Label htmlFor="show-meetings" className="text-xs cursor-pointer">Meetings</Label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] sm:h-[350px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis 
                dataKey="weekLabel" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px' }}
              />
              
              {showVolume && (
                <Bar 
                  yAxisId="left"
                  dataKey="emailsSent" 
                  name="Emails Sent"
                  fill="hsl(var(--chart-1))"
                  opacity={0.7}
                  radius={[2, 2, 0, 0]}
                />
              )}
              {showReplies && (
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="replies" 
                  name="Total Replies"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-2))', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
              {showPositive && (
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="positiveReplies" 
                  name="Positive Replies"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--success))', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
              {showMeetings && (
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="meetingsBooked" 
                  name="Meetings"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-4))', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
