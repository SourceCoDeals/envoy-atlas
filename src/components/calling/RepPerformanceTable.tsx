import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, TrendingUp, TrendingDown, Minus, Phone, Calendar } from 'lucide-react';
import { formatCallDuration, getCallingBenchmarkStatus, getCallingBenchmarkColorClass } from '@/lib/metrics';
import { cn } from '@/lib/utils';
import type { RepWithMetrics } from '@/hooks/useReps';

interface Props {
  reps: RepWithMetrics[];
  isLoading?: boolean;
}

export function RepPerformanceTable({ reps, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading rep performance...
        </CardContent>
      </Card>
    );
  }

  if (!reps.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Rep Performance
          </CardTitle>
          <CardDescription>No rep data available yet</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          Call data will be attributed to reps once synced from PhoneBurner
        </CardContent>
      </Card>
    );
  }

  const avgConnectRate = reps.length > 0
    ? reps.reduce((sum, r) => sum + r.connectRate, 0) / reps.length
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Rep Performance</CardTitle>
              <CardDescription>
                Individual rep metrics sorted by connect rate
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-sm">
            Team Avg: {avgConnectRate.toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Rep</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Phone className="h-4 w-4" />
                    Calls
                  </div>
                </TableHead>
                <TableHead className="text-center">Connections</TableHead>
                <TableHead className="text-center">Connect Rate</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Meetings
                  </div>
                </TableHead>
                <TableHead className="text-center">Avg Duration</TableHead>
                <TableHead className="text-center">vs Team</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reps.map((rep, index) => {
                const status = getCallingBenchmarkStatus('connectRate', rep.connectRate);
                const colorClass = getCallingBenchmarkColorClass(status);
                const vsTeam = rep.connectRate - avgConnectRate;

                return (
                  <TableRow key={rep.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {rep.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {rep.name}
                            {index === 0 && reps.length > 1 && (
                              <Badge variant="default" className="text-xs">Top</Badge>
                            )}
                          </div>
                          {rep.email && rep.email !== `${rep.name}@unknown.local` && (
                            <div className="text-xs text-muted-foreground">{rep.email}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {rep.totalCalls.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      {rep.connections.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Progress 
                          value={Math.min(rep.connectRate, 100)} 
                          className="w-16 h-2" 
                        />
                        <span className={cn('font-semibold', colorClass)}>
                          {rep.connectRate.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium text-primary">
                      {rep.meetings}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {formatCallDuration(rep.avgCallDuration)}
                    </TableCell>
                    <TableCell className="text-center">
                      {vsTeam > 1 ? (
                        <div className="flex items-center justify-center gap-1 text-primary">
                          <TrendingUp className="h-4 w-4" />
                          +{vsTeam.toFixed(1)}%
                        </div>
                      ) : vsTeam < -1 ? (
                        <div className="flex items-center justify-center gap-1 text-destructive">
                          <TrendingDown className="h-4 w-4" />
                          {vsTeam.toFixed(1)}%
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Minus className="h-4 w-4" />
                          Avg
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
