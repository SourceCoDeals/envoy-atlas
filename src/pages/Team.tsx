import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useColdCallAnalytics, DateRange } from '@/hooks/useColdCallAnalytics';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { 
  formatScore, 
  formatCallingDuration, 
  getScoreStatus, 
  getScoreStatusColor,
  needsCoachingReview 
} from '@/lib/callingConfig';
import {
  Users,
  Star,
  TrendingUp,
  AlertTriangle,
  Phone,
  Clock,
  Target,
  Filter,
  BarChart3,
  Award,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export default function Team() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const { data, isLoading } = useColdCallAnalytics(dateRange);
  const { config } = useCallingConfig();

  // Calculate coaching flags from config thresholds
  const coachingFlags = useMemo(() => {
    if (!data?.repPerformance) return [];
    
    return data.repPerformance.filter(rep => {
      // Flag reps with avg scores below thresholds
      return (
        (rep.avgOverallScore != null && rep.avgOverallScore < config.coachingAlertOverallQuality) ||
        rep.needsCoachingCount > 0
      );
    }).map(rep => ({
      rep: rep.rep,
      avgOverallScore: rep.avgOverallScore,
      avgQuestionsCovered: rep.avgQuestionsCovered,
      needsCoachingCount: rep.needsCoachingCount,
      issues: [
        rep.avgOverallScore != null && rep.avgOverallScore < config.coachingAlertOverallQuality
          ? `Avg Overall Quality ${formatScore(rep.avgOverallScore, config)} < ${config.coachingAlertOverallQuality}`
          : null,
        rep.needsCoachingCount > 0
          ? `${rep.needsCoachingCount} calls need review`
          : null,
      ].filter(Boolean),
    }));
  }, [data?.repPerformance, config]);

  // Prepare chart data for score comparison - all 12 dimensions
  const scoreComparisonData = useMemo(() => {
    if (!data?.repPerformance) return [];
    return data.repPerformance.slice(0, 8).map(rep => ({
      name: rep.rep.split('@')[0],
      'Overall': rep.avgOverallScore ?? 0,
      'Script': rep.avgScriptAdherence ?? 0,
      'Questions': rep.avgQuestionAdherence ?? 0,
      'Objections': rep.avgObjectionHandling ?? 0,
      'Interest': rep.avgSellerInterest ?? 0,
      'Quality': rep.avgConversationQuality ?? 0,
    }));
  }, [data?.repPerformance]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team</h1>
            <p className="text-muted-foreground">Rep performance and coaching</p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  const topPerformer = data?.repPerformance[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team</h1>
            <p className="text-muted-foreground">
              Rep performance metrics and coaching insights
            </p>
          </div>
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
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Team Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{data?.repPerformance.length || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Top Performer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-500" />
                <span className="text-lg font-bold truncate">
                  {topPerformer?.rep.split('@')[0] || '-'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Score: {formatScore(topPerformer?.avgOverallScore, config)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Team Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">
                  {formatScore(data?.avgScores.overallQuality, config)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Needs Coaching
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold">{coachingFlags.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Below threshold ({config.coachingAlertOverallQuality})
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Rep Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Rep Performance Table</CardTitle>
            <CardDescription>
              Performance metrics by representative
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.repPerformance && data.repPerformance.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rep (Host Email)</TableHead>
                    <TableHead>Total Calls</TableHead>
                    <TableHead>Avg Duration</TableHead>
                    <TableHead>Avg Overall Score</TableHead>
                    <TableHead>Avg Question Coverage</TableHead>
                    <TableHead>Calls with Interest</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.repPerformance.map((rep, index) => {
                    const status = getScoreStatus(rep.avgOverallScore, config.overallQualityThresholds);
                    const needsCoaching = rep.avgOverallScore != null && 
                      rep.avgOverallScore < config.coachingAlertOverallQuality;
                    
                    return (
                      <TableRow key={rep.rep}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {index === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                            <span className="font-medium">{rep.rep.split('@')[0]}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{rep.rep}</span>
                        </TableCell>
                        <TableCell>{rep.totalCalls}</TableCell>
                        <TableCell>{formatCallingDuration(rep.avgDuration)}</TableCell>
                        <TableCell>
                          <Badge className={getScoreStatusColor(status)}>
                            {formatScore(rep.avgOverallScore, config)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rep.avgQuestionsCovered != null 
                            ? `${rep.avgQuestionsCovered.toFixed(1)} / ${config.questionCoverageTotal}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{rep.positiveInterestCount}</span>
                            {rep.positiveInterestCount > 0 && (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {needsCoaching ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              Coaching
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600">
                              On Track
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No rep performance data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score Comparison Chart */}
        {scoreComparisonData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Score Comparison by Rep
              </CardTitle>
              <CardDescription>
                Comparing average scores across all 12 dimensions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreComparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Overall" fill="hsl(var(--primary))" />
                    <Bar dataKey="Script" fill="hsl(var(--chart-2))" />
                    <Bar dataKey="Questions" fill="hsl(var(--chart-3))" />
                    <Bar dataKey="Objections" fill="hsl(var(--chart-4))" />
                    <Bar dataKey="Interest" fill="hsl(var(--chart-5))" />
                    <Bar dataKey="Quality" fill="hsl(var(--accent))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Coaching Flags */}
        {coachingFlags.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Coaching Flags
              </CardTitle>
              <CardDescription>
                Reps with scores below configured thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {coachingFlags.map((flag) => (
                  <div
                    key={flag.rep}
                    className="flex items-start justify-between p-4 rounded-lg border border-amber-200 bg-background"
                  >
                    <div>
                      <p className="font-medium">{flag.rep.split('@')[0]}</p>
                      <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                        {flag.issues.map((issue, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Button variant="outline" size="sm">
                      Review Calls
                    </Button>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
                <p className="font-medium mb-1">Coaching Thresholds (from Settings):</p>
                <ul className="text-muted-foreground grid grid-cols-2 gap-1">
                  <li>• Overall Quality Alert: &lt; {config.coachingAlertOverallQuality}</li>
                  <li>• Script Adherence Alert: &lt; {config.coachingAlertScriptAdherence}</li>
                  <li>• Question Adherence Alert: &lt; {config.coachingAlertQuestionAdherence}</li>
                  <li>• Objection Handling Alert: &lt; {config.coachingAlertObjectionHandling}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
