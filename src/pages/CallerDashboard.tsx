import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEnhancedCallingAnalytics, DateRange } from '@/hooks/useEnhancedCallingAnalytics';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { 
  formatScore, 
  formatCallingDuration, 
  getScoreStatus, 
  getScoreStatusColor 
} from '@/lib/callingConfig';
import {
  Phone,
  PhoneCall,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  Star,
  AlertTriangle,
  Zap,
  Loader2,
  Users,
  Filter,
  Flame,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function CallerDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [selectedRep, setSelectedRep] = useState<string>('all');
  
  const { data, isLoading } = useEnhancedCallingAnalytics(dateRange);
  const { config } = useCallingConfig();

  // Get unique reps for filter
  const uniqueReps = useMemo(() => {
    if (!data?.repPerformance) return [];
    return data.repPerformance.map(r => r.rep);
  }, [data?.repPerformance]);

  // Filter data by selected rep
  const filteredStats = useMemo(() => {
    if (!data) return null;
    
    if (selectedRep === 'all') {
      return {
        totalCalls: data.totalCalls,
        connections: data.connections,
        conversations: data.conversations,
        meetings: data.meetings,
        talkTime: data.totalDuration,
        avgScore: data.avgScores.overallQuality,
        positiveInterest: data.positiveInterestCount,
        hotLeads: data.hotLeads.length,
        needsCoaching: data.needsCoaching.length,
      };
    }

    const repData = data.repPerformance.find(r => r.rep === selectedRep);
    if (!repData) return null;

    return {
      totalCalls: repData.totalCalls,
      connections: repData.connections,
      conversations: Math.round(repData.connections * 0.6),
      meetings: repData.positiveInterestCount,
      talkTime: repData.avgDuration * repData.totalCalls,
      avgScore: repData.avgOverallScore,
      positiveInterest: repData.positiveInterestCount,
      hotLeads: 0,
      needsCoaching: repData.needsCoachingCount,
    };
  }, [data, selectedRep]);

  // Calculate goals progress
  const goals = useMemo(() => {
    if (!filteredStats) return [];
    return [
      { label: 'Total Dials', current: filteredStats.totalCalls, target: 100, unit: '' },
      { label: 'Connections', current: filteredStats.connections, target: 30, unit: '' },
      { label: 'Meetings Set', current: filteredStats.meetings, target: 5, unit: '' },
      { label: 'Talk Time', current: Math.round(filteredStats.talkTime / 60), target: 120, unit: 'min' },
    ];
  }, [filteredStats]);

  // Generate coaching tips based on config thresholds
  const coachingTips = useMemo(() => {
    if (!data || !config) return [];
    const tips: { type: 'strength' | 'improvement'; title: string; description: string }[] = [];

    if (data.topCalls.length > 0) {
      tips.push({
        type: 'strength',
        title: `${data.topCalls.length} top-quality calls`,
        description: `Calls with overall score ≥ ${config.topCallsMinScore}. Keep up the great work!`,
      });
    }

    if (data.needsCoaching.length > 0) {
      tips.push({
        type: 'improvement',
        title: `${data.needsCoaching.length} calls need review`,
        description: `Calls below coaching threshold (${config.coachingAlertOverallQuality}). Review and improve.`,
      });
    }

    if (data.hotLeads.length > 0) {
      tips.push({
        type: 'strength',
        title: `${data.hotLeads.length} hot leads identified`,
        description: `Interest score ≥ ${config.hotLeadInterestScore}. Prioritize follow-up!`,
      });
    }

    const questionScore = data.avgScores.overallQuality;
    if (questionScore && questionScore < config.coachingAlertQuestionAdherence) {
      tips.push({
        type: 'improvement',
        title: 'Improve overall quality',
        description: `Average quality is ${formatScore(questionScore, config)}. Target: ${config.questionCoverageGoodThreshold}/${config.questionCoverageTotal} questions.`,
      });
    }

    return tips.slice(0, 4);
  }, [data, config]);

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const overallStatus = getScoreStatus(filteredStats?.avgScore ?? null, config.overallQualityThresholds);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {selectedRep !== 'all' ? selectedRep : 'Caller Dashboard'}
            </h1>
            <p className="text-muted-foreground">
              {data?.totalCalls || 0} calls • Using workspace thresholds
            </p>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger className="w-[120px]">
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
            
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedRep} onValueChange={setSelectedRep}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reps</SelectItem>
                  {uniqueReps.map(rep => (
                    <SelectItem key={rep} value={rep}>
                      {rep.split('@')[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Activity Summary */}
        <div className="grid gap-4 md:grid-cols-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{filteredStats?.totalCalls || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Dials</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <PhoneCall className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{filteredStats?.connections || 0}</p>
                  <p className="text-sm text-muted-foreground">Connections</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-chart-3" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{filteredStats?.meetings || 0}</p>
                  <p className="text-sm text-muted-foreground">Meetings</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-chart-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCallingDuration(filteredStats?.talkTime || 0)}</p>
                  <p className="text-sm text-muted-foreground">Talk Time</p>
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
                  <p className="text-2xl font-bold">{formatScore(filteredStats?.avgScore ?? null, config)}</p>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
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
                  <p className="text-2xl font-bold">{filteredStats?.hotLeads || 0}</p>
                  <p className="text-sm text-muted-foreground">Hot Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Goal Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Goal Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {goals.map((goal, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{goal.label}</span>
                    <span className="text-muted-foreground">
                      {goal.current} / {goal.target} {goal.unit}
                    </span>
                  </div>
                  <Progress value={Math.min((goal.current / goal.target) * 100, 100)} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Coaching Tips - derived from config thresholds */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Coaching Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {coachingTips.length === 0 ? (
                <p className="text-muted-foreground text-sm">No insights available yet. Make more calls!</p>
              ) : (
                coachingTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-lg ${
                      tip.type === 'strength' ? 'bg-green-500/10' : 'bg-amber-500/10'
                    }`}
                  >
                    {tip.type === 'strength' ? (
                      <Star className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{tip.title}</p>
                      <p className="text-xs text-muted-foreground">{tip.description}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Daily Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Daily Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.dailyTrends && data.dailyTrends.length > 0 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.dailyTrends.slice(-14)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }}
                        tickFormatter={(val) => val.slice(-5)}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="totalCalls"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                        name="Calls"
                      />
                      <Line
                        type="monotone"
                        dataKey="connections"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={false}
                        name="Connections"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  No trend data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interest Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Interest Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.interestBreakdown && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Yes (Positive)</span>
                    <div className="flex items-center gap-2">
                      <Progress value={data.totalCalls > 0 ? (data.interestBreakdown.yes / data.totalCalls) * 100 : 0} className="w-32 h-2" />
                      <span className="text-sm font-medium w-12 text-right">{data.interestBreakdown.yes}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Maybe</span>
                    <div className="flex items-center gap-2">
                      <Progress value={data.totalCalls > 0 ? (data.interestBreakdown.maybe / data.totalCalls) * 100 : 0} className="w-32 h-2" />
                      <span className="text-sm font-medium w-12 text-right">{data.interestBreakdown.maybe}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">No</span>
                    <div className="flex items-center gap-2">
                      <Progress value={data.totalCalls > 0 ? (data.interestBreakdown.no / data.totalCalls) * 100 : 0} className="w-32 h-2" />
                      <span className="text-sm font-medium w-12 text-right">{data.interestBreakdown.no}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Unknown</span>
                    <div className="flex items-center gap-2">
                      <Progress value={data.totalCalls > 0 ? (data.interestBreakdown.unknown / data.totalCalls) * 100 : 0} className="w-32 h-2" />
                      <span className="text-sm font-medium w-12 text-right">{data.interestBreakdown.unknown}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Positive values: {config.interestValuesPositive.join(', ')}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Team Performance Table */}
        {data?.repPerformance && data.repPerformance.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Team Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b">
                    <th className="pb-2">Rep</th>
                    <th className="pb-2">Calls</th>
                    <th className="pb-2">Connections</th>
                    <th className="pb-2">Avg Score</th>
                    <th className="pb-2">Positive Interest</th>
                    <th className="pb-2">Needs Coaching</th>
                  </tr>
                </thead>
                <tbody>
                  {data.repPerformance.slice(0, 10).map(rep => {
                    const status = getScoreStatus(rep.avgOverallScore, config.overallQualityThresholds);
                    return (
                      <tr key={rep.rep} className="border-b">
                        <td className="py-3 font-medium">{rep.rep.split('@')[0]}</td>
                        <td>{rep.totalCalls}</td>
                        <td>{rep.connections}</td>
                        <td>
                          <Badge variant="outline" className={getScoreStatusColor(status)}>
                            {formatScore(rep.avgOverallScore, config)}
                          </Badge>
                        </td>
                        <td>{rep.positiveInterestCount}</td>
                        <td>
                          {rep.needsCoachingCount > 0 ? (
                            <Badge variant="destructive">{rep.needsCoachingCount}</Badge>
                          ) : (
                            <Badge variant="outline">0</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
