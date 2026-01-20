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
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Total Objections Faced
            </CardDescription>
            <CardTitle className="text-3xl">{totalObjectionsFaced}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Sum across all analyzed calls
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Total Resolved
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{totalObjectionsResolved}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Successfully handled objections
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overall Resolution Rate</CardDescription>
            <CardTitle className={cn('text-3xl', getResolutionColor(overallResolutionRate))}>
              {overallResolutionRate.toFixed(0)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress 
              value={overallResolutionRate} 
              className="h-2"
            />
            <div className="text-sm text-muted-foreground mt-2">
              Target: {config.objectionResolutionGoodThreshold}%+
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Objections Per Call</CardDescription>
            <CardTitle className="text-3xl">{avgObjectionsPerCall.toFixed(1)}</CardTitle>
          </CardHeader>
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
              <Progress value={100} className="h-4 bg-red-100" />
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
    </div>
  );
}
