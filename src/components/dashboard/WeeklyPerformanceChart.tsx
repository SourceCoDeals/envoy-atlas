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
import { AlertTriangle, CheckCircle2, Database, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type DataSourceType = 'snapshots' | 'nocodb_aggregate' | 'activity_level' | 'daily_metrics' | 'mixed';

interface WeeklyPerformanceChartProps {
  data: WeeklyData[];
  dataCompleteness?: { dailyTotal: number; campaignTotal: number };
  dataSource?: DataSourceType;
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

export function WeeklyPerformanceChart({ data, dataCompleteness, dataSource = 'nocodb_aggregate' }: WeeklyPerformanceChartProps) {
  const [showVolume, setShowVolume] = useState(true);
  const [showReplies, setShowReplies] = useState(true);
  const [showPositive, setShowPositive] = useState(true);
  const [showMeetings, setShowMeetings] = useState(false);

  // Calculate data completeness percentage
  const completenessPercent = dataCompleteness && dataCompleteness.campaignTotal > 0
    ? Math.round((dataCompleteness.dailyTotal / dataCompleteness.campaignTotal) * 100)
    : 100;
  const isComplete = completenessPercent >= 95;

  // Data source labels
  const dataSourceInfo: Record<DataSourceType, { label: string; description: string; icon: typeof Database }> = {
    snapshots: {
      label: 'Snapshots',
      description: 'Real-time daily snapshots from NocoDB sync with accurate day-over-day tracking.',
      icon: CheckCircle2,
    },
    nocodb_aggregate: {
      label: 'NocoDB',
      description: 'Campaign totals from NocoDB. Time-series distribution is estimated.',
      icon: Database,
    },
    activity_level: {
      label: 'Real-time',
      description: 'Individual email activities with actual timestamps.',
      icon: CheckCircle2,
    },
    daily_metrics: {
      label: 'Daily Metrics',
      description: 'Aggregated daily metrics from sync.',
      icon: Database,
    },
    mixed: {
      label: 'Mixed',
      description: 'Combination of NocoDB aggregates and real-time activity data.',
      icon: Info,
    },
  };
  
  const sourceInfo = dataSourceInfo[dataSource];

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
          <div className="flex items-center gap-2">
            <div>
              <CardTitle className="text-lg">Week-by-Week Performance</CardTitle>
              <CardDescription>
                {hasLimitedData 
                  ? `${weeksWithData.length} week${weeksWithData.length !== 1 ? 's' : ''} with activity`
                  : 'Last 12 weeks'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Data Source Indicator */}
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="text-xs gap-1 text-muted-foreground border-border cursor-help"
                    >
                      <sourceInfo.icon className="h-3 w-3" />
                      {sourceInfo.label}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">{sourceInfo.description}</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
              
              {/* Data Completeness Indicator */}
              {dataCompleteness && dataCompleteness.campaignTotal > 0 && (
                <Badge 
                  variant={isComplete ? "outline" : "secondary"} 
                  className={`text-xs gap-1 ${isComplete ? 'text-success border-success/50' : 'text-warning border-warning/50'}`}
                >
                  {isComplete ? (
                    <><CheckCircle2 className="h-3 w-3" /> Complete</>
                  ) : (
                    <><AlertTriangle className="h-3 w-3" /> {completenessPercent}% synced</>
                  )}
                </Badge>
              )}
            </div>
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
