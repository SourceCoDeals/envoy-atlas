import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Send,
  TrendingUp,
  TrendingDown,
  Clock,
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface DailyVolume {
  day: string;
  sent: number;
  capacity: number;
}

interface SendingVolumeAnalysisProps {
  totalSent7d: number;
  dailyAverage: number;
  dailyCapacity: number;
  utilizationPercent: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  trendPercent: number;
  volumeByDay: DailyVolume[];
  peakHour?: number;
}

export function SendingVolumeAnalysis({
  totalSent7d,
  dailyAverage,
  dailyCapacity,
  utilizationPercent,
  trend,
  trendPercent,
  volumeByDay,
  peakHour,
}: SendingVolumeAnalysisProps) {
  const getTrendIcon = () => {
    if (trend === 'increasing') return <TrendingUp className="h-4 w-4" />;
    if (trend === 'decreasing') return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  const getTrendColor = () => {
    if (trend === 'increasing') return 'text-success';
    if (trend === 'decreasing') return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Send className="h-5 w-5" />
          Sending Volume
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">7-Day Total</p>
            <p className="text-2xl font-bold">{totalSent7d.toLocaleString()}</p>
            <div className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{trendPercent > 0 ? '+' : ''}{trendPercent.toFixed(0)}% vs previous</span>
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Daily Average</p>
            <p className="text-2xl font-bold">{dailyAverage.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">of {dailyCapacity.toLocaleString()} capacity</p>
          </div>
        </div>

        {/* Capacity Utilization */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Capacity Utilization</span>
            <span className="font-medium">{utilizationPercent}%</span>
          </div>
          <Progress 
            value={utilizationPercent} 
            className={`h-2 ${utilizationPercent > 90 ? '[&>div]:bg-warning' : ''}`}
          />
          {utilizationPercent > 90 && (
            <p className="text-xs text-warning">Near capacity — consider adding more accounts</p>
          )}
        </div>

        {/* Volume Chart */}
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeByDay} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 10 }} 
                className="text-muted-foreground"
              />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [value.toLocaleString(), 'Sent']}
              />
              <Bar dataKey="sent" radius={[4, 4, 0, 0]}>
                {volumeByDay.map((entry, index) => (
                  <Cell 
                    key={index} 
                    fill={entry.sent > entry.capacity * 0.9 
                      ? 'hsl(var(--warning))' 
                      : 'hsl(var(--primary))'
                    } 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Hour */}
        {peakHour !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Peak sending hour:</span>
            <Badge variant="outline">
              {peakHour === 0 ? '12 AM' : 
               peakHour < 12 ? `${peakHour} AM` : 
               peakHour === 12 ? '12 PM' : 
               `${peakHour - 12} PM`}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
