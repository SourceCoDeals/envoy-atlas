import { useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCallsWithScores } from '@/hooks/useCallIntelligence';
import { Clock, TrendingUp, Calendar, Phone } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { format, getDay, getHours, parseISO, startOfWeek, addDays } from 'date-fns';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

function HeatmapCell({ value, maxValue }: { value: number; maxValue: number }) {
  const intensity = maxValue > 0 ? value / maxValue : 0;
  const bgOpacity = Math.max(0.1, intensity);
  
  return (
    <div 
      className="w-full h-10 flex items-center justify-center text-xs font-medium rounded"
      style={{ 
        backgroundColor: `hsl(var(--primary) / ${bgOpacity})`,
        color: intensity > 0.5 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))'
      }}
    >
      {value > 0 ? `${(value * 100).toFixed(0)}%` : '-'}
    </div>
  );
}

export default function TimingInsights() {
  const { data: callsData = [], isLoading } = useCallsWithScores({ limit: 500 });
  const calls = callsData;
  const aiScores = callsData.filter(c => c.score).map(c => ({ ...c.score!, call_id: c.id }));

  const connectRateHeatmap = useMemo(() => {
    const grid: Record<string, Record<number, { total: number; connected: number }>> = {};
    
    DAYS_OF_WEEK.forEach(day => {
      grid[day] = {};
      HOURS.forEach(hour => {
        grid[day][hour] = { total: 0, connected: 0 };
      });
    });

    calls.forEach(call => {
      if (!call.start_at) return;
      const date = parseISO(call.start_at);
      const day = DAYS_OF_WEEK[getDay(date)];
      const hour = getHours(date);
      
      if (hour >= 8 && hour <= 19 && grid[day][hour]) {
        grid[day][hour].total++;
        if (call.is_connected) {
          grid[day][hour].connected++;
        }
      }
    });

    return { grid, maxRate: 0.5 }; // Assume 50% is a good max for color scaling
  }, [calls]);

  const bestTimes = useMemo(() => {
    const timeSlots: Array<{ day: string; hour: number; rate: number; total: number }> = [];
    
    Object.entries(connectRateHeatmap.grid).forEach(([day, hours]) => {
      Object.entries(hours).forEach(([hour, data]) => {
        if (data.total >= 5) { // Minimum sample size
          timeSlots.push({
            day,
            hour: parseInt(hour),
            rate: data.connected / data.total,
            total: data.total,
          });
        }
      });
    });

    return timeSlots.sort((a, b) => b.rate - a.rate).slice(0, 5);
  }, [connectRateHeatmap]);

  const worstTimes = useMemo(() => {
    const timeSlots: Array<{ day: string; hour: number; rate: number; total: number }> = [];
    
    Object.entries(connectRateHeatmap.grid).forEach(([day, hours]) => {
      Object.entries(hours).forEach(([hour, data]) => {
        if (data.total >= 5) {
          timeSlots.push({
            day,
            hour: parseInt(hour),
            rate: data.connected / data.total,
            total: data.total,
          });
        }
      });
    });

    return timeSlots.sort((a, b) => a.rate - b.rate).slice(0, 5);
  }, [connectRateHeatmap]);

  const hourlyData = useMemo(() => {
    const hourlyStats: Record<number, { total: number; connected: number; avgScore: number; scores: number[] }> = {};
    
    HOURS.forEach(hour => {
      hourlyStats[hour] = { total: 0, connected: 0, avgScore: 0, scores: [] };
    });

    calls.forEach(call => {
      if (!call.start_at) return;
      const hour = getHours(parseISO(call.start_at));
      
      if (hour >= 8 && hour <= 19 && hourlyStats[hour]) {
        hourlyStats[hour].total++;
        if (call.is_connected) {
          hourlyStats[hour].connected++;
        }
        
        const score = aiScores.find(s => s.call_id === call.id);
        if (score?.composite_score) {
          hourlyStats[hour].scores.push(score.composite_score);
        }
      }
    });

    return HOURS.map(hour => {
      const stats = hourlyStats[hour];
      return {
        hour: `${hour}:00`,
        'Connect Rate': stats.total > 0 ? (stats.connected / stats.total) * 100 : 0,
        'Avg AI Score': stats.scores.length > 0 
          ? stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length 
          : 0,
        'Call Volume': stats.total,
      };
    });
  }, [calls, aiScores]);

  const dailyData = useMemo(() => {
    const dailyStats: Record<string, { total: number; connected: number; avgScore: number; scores: number[] }> = {};
    
    DAYS_OF_WEEK.forEach(day => {
      dailyStats[day] = { total: 0, connected: 0, avgScore: 0, scores: [] };
    });

    calls.forEach(call => {
      if (!call.start_at) return;
      const day = DAYS_OF_WEEK[getDay(parseISO(call.start_at))];
      
      dailyStats[day].total++;
      if (call.is_connected) {
        dailyStats[day].connected++;
      }
      
      const score = aiScores.find(s => s.call_id === call.id);
      if (score?.composite_score) {
        dailyStats[day].scores.push(score.composite_score);
      }
    });

    return DAYS_OF_WEEK.slice(1, 6).map(day => { // Mon-Fri only
      const stats = dailyStats[day];
      return {
        day,
        'Connect Rate': stats.total > 0 ? (stats.connected / stats.total) * 100 : 0,
        'Avg AI Score': stats.scores.length > 0 
          ? stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length 
          : 0,
        'Call Volume': stats.total,
      };
    });
  }, [calls, aiScores]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading timing insights...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timing Insights</h1>
          <p className="text-muted-foreground">
            Discover the best times to call based on {calls.length} dials
          </p>
        </div>

        {/* Best/Worst Times */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-5 w-5" />
                Best Times to Call
              </CardTitle>
              <CardDescription>Highest connect rates</CardDescription>
            </CardHeader>
            <CardContent>
              {bestTimes.length === 0 ? (
                <p className="text-muted-foreground text-sm">Not enough data yet</p>
              ) : (
                <div className="space-y-3">
                  {bestTimes.map((slot, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{slot.day}</Badge>
                        <span className="font-medium">{slot.hour}:00 - {slot.hour + 1}:00</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-green-600">
                          {(slot.rate * 100).toFixed(0)}%
                        </span>
                        <span className="text-muted-foreground text-sm ml-2">
                          ({slot.total} calls)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Clock className="h-5 w-5" />
                Times to Avoid
              </CardTitle>
              <CardDescription>Lowest connect rates</CardDescription>
            </CardHeader>
            <CardContent>
              {worstTimes.length === 0 ? (
                <p className="text-muted-foreground text-sm">Not enough data yet</p>
              ) : (
                <div className="space-y-3">
                  {worstTimes.map((slot, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{slot.day}</Badge>
                        <span className="font-medium">{slot.hour}:00 - {slot.hour + 1}:00</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-red-600">
                          {(slot.rate * 100).toFixed(0)}%
                        </span>
                        <span className="text-muted-foreground text-sm ml-2">
                          ({slot.total} calls)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Connect Rate Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle>Connect Rate Heatmap</CardTitle>
            <CardDescription>
              Connect rates by day of week and hour
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-sm font-medium text-muted-foreground">Hour</th>
                    {DAYS_OF_WEEK.slice(1, 6).map(day => (
                      <th key={day} className="p-2 text-sm font-medium text-muted-foreground text-center">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map(hour => (
                    <tr key={hour}>
                      <td className="p-2 text-sm font-medium">{hour}:00</td>
                      {DAYS_OF_WEEK.slice(1, 6).map(day => {
                        const data = connectRateHeatmap.grid[day][hour];
                        const rate = data.total > 0 ? data.connected / data.total : 0;
                        return (
                          <td key={day} className="p-1">
                            <HeatmapCell value={rate} maxValue={0.5} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Hourly Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Hour</CardTitle>
            <CardDescription>Connect rate and AI score trends throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis yAxisId="left" domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="Connect Rate" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="Avg AI Score" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Day</CardTitle>
            <CardDescription>Weekly patterns in connect rate and call quality</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Connect Rate" fill="hsl(var(--primary))" />
                <Bar dataKey="Avg AI Score" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
