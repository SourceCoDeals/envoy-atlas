import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Clock, TrendingUp, Users, Loader2, Phone, Star, AlertTriangle, Flame } from 'lucide-react';
import { useEnhancedCallingAnalytics, DateRange } from '@/hooks/useEnhancedCallingAnalytics';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { 
  formatScore, 
  formatCallingDuration, 
  getScoreStatus, 
  getScoreStatusColor 
} from '@/lib/callingConfig';
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
import { useState } from 'react';

export default function CallAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const { data, isLoading, error } = useEnhancedCallingAnalytics(dateRange);
  const { config } = useCallingConfig();

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
          Error loading analytics
        </div>
      </DashboardLayout>
    );
  }

  if (!data || data.totalCalls === 0) {
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

  // Prepare funnel data from metrics
  const funnelData = [
    { stage: 'Total Dials', count: data.totalCalls },
    { stage: 'Connections', count: data.connections },
    { stage: 'Conversations', count: data.conversations },
    { stage: 'Meetings Set', count: data.meetings },
  ];

  // Prepare hourly data for heatmap
  const hourlyData = data.hourlyData.map(h => ({
    hour: h.hour,
    calls: h.calls,
    connects: h.connections,
  }));

  // Get overall score status for color coding
  const overallStatus = getScoreStatus(data.avgScores.overallQuality, config.overallQualityThresholds);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Call Analytics</h1>
            <p className="text-muted-foreground">
              Deep dive into your calling performance metrics • {data.totalCalls.toLocaleString()} calls analyzed
            </p>
          </div>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="14d">14 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards using config */}
        <div className="grid gap-4 md:grid-cols-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.totalCalls}</p>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCallingDuration(data.totalDuration)}</p>
                  <p className="text-sm text-muted-foreground">Total Talk Time</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${getScoreStatusColor(overallStatus)}`}>
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatScore(data.avgScores.overallQuality, config)}</p>
                  <p className="text-sm text-muted-foreground">Avg Quality</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.positiveInterestCount}</p>
                  <p className="text-sm text-muted-foreground">Positive Interest</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.hotLeads.length}</p>
                  <p className="text-sm text-muted-foreground">Hot Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.needsCoaching.length}</p>
                  <p className="text-sm text-muted-foreground">Needs Coaching</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Disposition Funnel */}
          <ConversionFunnel data={funnelData} />

          {/* Best Time to Call */}
          <CallTimingHeatmap data={hourlyData} />

          {/* Team Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.repPerformance.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.repPerformance.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis
                        type="category"
                        dataKey="rep"
                        width={80}
                        className="text-xs"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(val) => val.split('@')[0]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === 'totalCalls') return [value, 'Total Calls'];
                          if (name === 'connections') return [value, 'Connections'];
                          if (name === 'avgOverallScore') return [value.toFixed(1), 'Avg Score'];
                          return [value, name];
                        }}
                      />
                      <Bar dataKey="totalCalls" fill="hsl(var(--primary))" name="totalCalls" />
                      <Bar dataKey="connections" fill="hsl(var(--chart-2))" name="connections" />
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
                Daily Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.dailyTrends.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.dailyTrends}>
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
                          if (name === 'totalCalls') return [value, 'Calls'];
                          if (name === 'connections') return [value, 'Connections'];
                          if (name === 'positiveInterest') return [value, 'Positive Interest'];
                          return [value, name];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="totalCalls"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                        name="totalCalls"
                      />
                      <Line
                        type="monotone"
                        dataKey="connections"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={false}
                        name="connections"
                      />
                      <Line
                        type="monotone"
                        dataKey="positiveInterest"
                        stroke="hsl(var(--chart-4))"
                        strokeWidth={2}
                        dot={false}
                        name="positiveInterest"
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

        {/* Score Overview - uses config thresholds */}
        <Card>
          <CardHeader>
            <CardTitle>Score Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              {[
                { label: 'Overall Quality', score: data.avgScores.overallQuality, thresholds: config.overallQualityThresholds },
                { label: 'Seller Interest', score: data.avgScores.sellerInterest, thresholds: config.sellerInterestThresholds },
                { label: 'Script Adherence', score: data.avgScores.scriptAdherence, thresholds: config.scriptAdherenceThresholds },
                { label: 'Objection Handling', score: data.avgScores.objectionHandling, thresholds: config.objectionHandlingThresholds },
                { label: 'Conversation Quality', score: data.avgScores.conversationQuality, thresholds: config.conversationQualityThresholds },
              ].map(({ label, score, thresholds }) => {
                const status = getScoreStatus(score, thresholds);
                return (
                  <div key={label} className="text-center p-4 rounded-lg bg-muted/50">
                    <p className={`text-2xl font-bold ${getScoreStatusColor(status)}`}>
                      {formatScore(score, config)}
                    </p>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <Badge variant="outline" className="mt-2 capitalize">{status}</Badge>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Thresholds: Excellent ≥ {config.overallQualityThresholds.excellent} | Good ≥ {config.overallQualityThresholds.good} | Average ≥ {config.overallQualityThresholds.average}
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
