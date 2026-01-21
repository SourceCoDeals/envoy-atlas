import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Users, TrendingUp } from 'lucide-react';
import { CallInsightsData } from '@/hooks/useExternalCallIntel';
import { CallingMetricsConfig } from '@/lib/callingConfig';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ObjectionCategoriesChart } from './ObjectionCategoriesChart';
import { ObjectionsList } from './ObjectionsList';

interface Props {
  data: CallInsightsData | undefined;
  config: CallingMetricsConfig;
}

export function ObjectionIntelligence({ data, config }: Props) {
  if (!data) return null;

  const { 
    totalObjectionsFaced, 
    totalObjectionsResolved, 
    overallResolutionRate, 
    avgObjectionsPerCall,
    repObjectionStats 
  } = data;

  const getResolutionColor = (rate: number) => {
    if (rate >= config.objectionResolutionGoodThreshold) return 'text-green-600';
    if (rate >= config.objectionResolutionWarningThreshold) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getResolutionBadge = (rate: number) => {
    if (rate >= config.objectionResolutionGoodThreshold) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Excellent</Badge>;
    }
    if (rate >= config.objectionResolutionWarningThreshold) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Good</Badge>;
    }
    return <Badge variant="destructive">Needs Work</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Total Objections
            </div>
            <div className="text-3xl font-bold">{totalObjectionsFaced}</div>
            <p className="text-xs text-muted-foreground">Across all calls</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Resolved
            </div>
            <div className="text-3xl font-bold text-green-600">{totalObjectionsResolved}</div>
            <p className="text-xs text-muted-foreground">Successfully addressed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Resolution Rate</div>
            <div className={cn('text-3xl font-bold', getResolutionColor(overallResolutionRate))}>
              {overallResolutionRate.toFixed(1)}%
            </div>
            <Progress 
              value={overallResolutionRate} 
              className="h-2 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Benchmark: ≥{config.objectionResolutionGoodThreshold}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Avg Per Call</div>
            <div className="text-3xl font-bold">{avgObjectionsPerCall.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Objections encountered</p>
          </CardContent>
        </Card>
      </div>

      {/* Resolution Rate Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Objection Resolution Overview
          </CardTitle>
          <CardDescription>
            Visual breakdown of objection handling performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Faced</span>
                <span className="text-sm text-muted-foreground">{totalObjectionsFaced}</span>
              </div>
              <Progress value={100} className="h-4" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Resolved</span>
                <span className="text-sm text-muted-foreground">{totalObjectionsResolved}</span>
              </div>
              <Progress value={overallResolutionRate} className="h-4" />
            </div>
          </div>
          <div className="mt-4 text-center">
            {getResolutionBadge(overallResolutionRate)}
          </div>
        </CardContent>
      </Card>

      {/* Objection Categories */}
      <ObjectionCategoriesChart data={data} />

      {/* By Rep Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Objection Handling by Rep
          </CardTitle>
          <CardDescription>
            Individual rep performance in handling objections
          </CardDescription>
        </CardHeader>
        <CardContent>
          {repObjectionStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead className="text-center">Objections Faced</TableHead>
                  <TableHead className="text-center">Resolved</TableHead>
                  <TableHead className="text-center">Resolution Rate</TableHead>
                  <TableHead className="text-center">Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repObjectionStats
                  .sort((a, b) => b.resolutionRate - a.resolutionRate)
                  .map((rep) => (
                    <TableRow key={rep.rep}>
                      <TableCell className="font-medium">{rep.rep}</TableCell>
                      <TableCell className="text-center">{rep.objectionsFaced}</TableCell>
                      <TableCell className="text-center">{rep.resolved}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn('font-semibold', getResolutionColor(rep.resolutionRate))}>
                          {rep.resolutionRate.toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {getResolutionBadge(rep.resolutionRate)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No rep-level objection data available yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Objections List */}
      <ObjectionsList data={data} />
    </div>
  );
}
