import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Users, AlertTriangle } from 'lucide-react';
import { CallInsightsData } from '@/hooks/useExternalCallIntel';
import { CallingMetricsConfig, formatScore, getScoreStatusColor } from '@/lib/callingConfig';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Props {
  data: CallInsightsData | undefined;
  config: CallingMetricsConfig;
}

export function ScoreOverviewSection({ data, config }: Props) {
  if (!data) return null;

  const { scoreOverview } = data;

  const getTrendIcon = (trend: 'up' | 'down' | 'flat') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    if (score >= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Calls Analyzed</CardDescription>
            <CardTitle className="text-3xl">{data.intelRecords.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Questions Covered</CardDescription>
            <CardTitle className="text-3xl">{data.avgQuestionsCovered.toFixed(1)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Objection Resolution Rate</CardDescription>
            <CardTitle className="text-3xl">{data.overallResolutionRate.toFixed(0)}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Positive Interest Rate</CardDescription>
            <CardTitle className="text-3xl">
              {data.intelRecords.length > 0 
                ? ((data.interestBreakdown.yes / data.intelRecords.length) * 100).toFixed(0)
                : 0}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 12 Score Overview Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            12 Score Overview
          </CardTitle>
          <CardDescription>
            Weekly averages, trends, and performance breakdown for all AI-extracted scores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Score</TableHead>
                <TableHead className="text-center">This Week Avg</TableHead>
                <TableHead className="text-center">Last Week Avg</TableHead>
                <TableHead className="text-center">Trend</TableHead>
                <TableHead className="text-center">Best Rep</TableHead>
                <TableHead className="text-center">Needs Coaching</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scoreOverview.map((item) => (
                <TableRow key={item.key}>
                  <TableCell className="font-medium">{item.label}</TableCell>
                  <TableCell className="text-center">
                    <span className={cn('font-semibold', getScoreColor(item.thisWeekAvg))}>
                      {item.thisWeekAvg !== null ? formatScore(item.thisWeekAvg, config) : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={cn('text-muted-foreground')}>
                      {item.lastWeekAvg !== null ? formatScore(item.lastWeekAvg, config) : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      {getTrendIcon(item.trend)}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {item.bestRep ? (
                      <Badge variant="outline" className="flex items-center gap-1 w-fit mx-auto">
                        <Users className="h-3 w-3" />
                        {item.bestRep}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.needsCoachingCount > 0 ? (
                      <Badge variant="destructive" className="flex items-center gap-1 w-fit mx-auto">
                        <AlertTriangle className="h-3 w-3" />
                        {item.needsCoachingCount}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">0</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
