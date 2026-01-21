import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Users, TrendingUp, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { ObjectionCategoriesChart } from './ObjectionCategoriesChart';
import { ObjectionsList } from './ObjectionsList';

interface Props {
  data: CallInsightsData | undefined;
  config: CallingMetricsConfig;
}

interface ObjectionWithResolution {
  objection: string;
  resolved: boolean;
  resolution?: string;
  category?: string;
  callId: string;
  rep: string;
}

export function ObjectionIntelligence({ data, config }: Props) {
  if (!data) return null;

  const { 
    totalObjectionsFaced, 
    totalObjectionsResolved, 
    overallResolutionRate, 
    avgObjectionsPerCall,
    repObjectionStats,
    intelRecords
  } = data;

  // Extract objections with resolution details
  const objectionsWithResolutions: ObjectionWithResolution[] = [];
  intelRecords.forEach(record => {
    const objDetails = record.objection_details as Record<string, { resolved?: boolean; resolution?: string; category?: string }> | null;
    const objList = record.objections_list || [];
    
    objList.forEach((objection, idx) => {
      const detail = objDetails?.[objection] || objDetails?.[`obj_${idx}`] || {};
      objectionsWithResolutions.push({
        objection,
        resolved: detail.resolved ?? false,
        resolution: detail.resolution,
        category: detail.category,
        callId: record.call_id,
        rep: record.call?.caller_name || 'Unknown'
      });
    });
  });

  const getResolutionColor = (rate: number) => {
    if (rate >= config.objectionResolutionGoodThreshold) return 'text-primary';
    if (rate >= config.objectionResolutionWarningThreshold) return 'text-amber-600';
    return 'text-destructive';
  };

  const getResolutionBadge = (rate: number) => {
    if (rate >= config.objectionResolutionGoodThreshold) {
      return <Badge className="bg-primary/10 text-primary border-primary/20">Excellent</Badge>;
    }
    if (rate >= config.objectionResolutionWarningThreshold) {
      return <Badge className="bg-accent text-accent-foreground">Good</Badge>;
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
            <div className="text-3xl font-bold text-primary">{totalObjectionsResolved}</div>
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

      {/* How It Was Resolved - New Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            How Objections Were Resolved
          </CardTitle>
          <CardDescription>
            Detailed view of each objection and the resolution approach used
          </CardDescription>
        </CardHeader>
        <CardContent>
          {objectionsWithResolutions.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {objectionsWithResolutions.slice(0, 50).map((item, idx) => (
                  <div 
                    key={`${item.callId}-${idx}`}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        {item.resolved ? (
                          <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        <span className="font-medium text-sm">{item.objection}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.category && (
                          <Badge variant="outline" className="text-xs">{item.category}</Badge>
                        )}
                        <Badge variant={item.resolved ? 'default' : 'destructive'} className="text-xs">
                          {item.resolved ? 'Resolved' : 'Unresolved'}
                        </Badge>
                      </div>
                    </div>
                    {item.resolution && (
                      <div className="ml-6 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                        <span className="font-medium text-foreground">Resolution: </span>
                        {item.resolution}
                      </div>
                    )}
                    <div className="ml-6 mt-2 text-xs text-muted-foreground">
                      Rep: {item.rep}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No objection resolution details captured yet
            </div>
          )}
          {objectionsWithResolutions.length > 50 && (
            <div className="text-center text-sm text-muted-foreground mt-4">
              Showing first 50 of {objectionsWithResolutions.length} objections
            </div>
          )}
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

      {/* Objections List */}
      <ObjectionsList data={data} />
    </div>
  );
}
