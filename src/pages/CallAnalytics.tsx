import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BarChart3, Clock, TrendingUp, Users, Loader2 } from 'lucide-react';
import { useCallAnalytics } from '@/hooks/useCallAnalytics';
import { ConversionFunnel } from '@/components/datainsights/ConversionFunnel';
import { CallTimingHeatmap } from '@/components/datainsights/CallTimingHeatmap';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { format, parseISO } from 'date-fns';

export default function CallAnalytics() {
  const { data, isLoading, error } = useCallAnalytics();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-destructive">
          Error loading analytics: {error}
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Call Analytics</h1>
            <p className="text-muted-foreground">No call data available yet</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call Analytics</h1>
          <p className="text-muted-foreground">
            Deep dive into your calling performance metrics • {data.totalCalls.toLocaleString()} calls analyzed
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Disposition Funnel */}
          <ConversionFunnel data={data.funnel} />

          {/* Best Time to Call */}
          <CallTimingHeatmap data={data.hourlyData} />

          {/* Team Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.teamPerformance.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.teamPerformance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={80}
                        className="text-xs"
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === 'totalCalls') return [value, 'Total Calls'];
                          if (name === 'connects') return [value, 'Connects'];
                          if (name === 'avgScore') return [value.toFixed(1), 'Avg Score'];
                          return [value, name];
                        }}
                      />
                      <Bar dataKey="totalCalls" fill="hsl(var(--primary))" name="totalCalls" />
                      <Bar dataKey="connects" fill="hsl(var(--chart-2))" name="connects" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No team data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Weekly Trends (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.weeklyTrends.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.weeklyTrends}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        className="text-xs"
                        tickFormatter={(value) => format(parseISO(value), 'MMM d')}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelFormatter={(value) => format(parseISO(value), 'MMM d, yyyy')}
                        formatter={(value: number, name: string) => {
                          if (name === 'calls') return [value, 'Calls'];
                          if (name === 'connects') return [value, 'Connects'];
                          if (name === 'avgScore') return [value.toFixed(1), 'Avg Score'];
                          return [value, name];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="calls"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                        name="calls"
                      />
                      <Line
                        type="monotone"
                        dataKey="connects"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={false}
                        name="connects"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No trend data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
