import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TrendingUp, TrendingDown, Minus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCallingDuration, getScoreStatus, getScoreStatusColor } from '@/lib/callingConfig';

export interface RepStats {
  analyst: string;
  totalCalls: number;
  dmConnections: number;
  connectRate: number;
  meetingsSet: number;
  avgScore: number;
  avgDuration: number;
  trend: number; // week-over-week change in connect rate
}

interface RepLeaderboardProps {
  reps: RepStats[];
  onRepClick?: (analyst: string) => void;
  selectedReps?: string[];
  isLoading?: boolean;
}

export function RepLeaderboard({ reps, onRepClick, selectedReps = [], isLoading }: RepLeaderboardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Rep Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const avgConnectRate = reps.length > 0
    ? reps.reduce((sum, r) => sum + r.connectRate, 0) / reps.length
    : 0;

  const sortedReps = [...reps].sort((a, b) => b.connectRate - a.connectRate);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Rep Leaderboard
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Team avg: {avgConnectRate.toFixed(1)}% connect rate
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Rep</TableHead>
              <TableHead className="text-center">Calls</TableHead>
              <TableHead className="text-center">DMs</TableHead>
              <TableHead className="text-center">Mtgs</TableHead>
              <TableHead>Connect %</TableHead>
              <TableHead className="text-center">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedReps.map((rep, index) => {
              const initials = rep.analyst
                .split('@')[0]
                .split('.')
                .map(s => s[0]?.toUpperCase())
                .join('')
                .slice(0, 2);
              
              const vsAvg = rep.connectRate - avgConnectRate;
              const isSelected = selectedReps.includes(rep.analyst);
              
              return (
                <TableRow
                  key={rep.analyst}
                  className={cn(
                    'cursor-pointer hover:bg-accent transition-colors',
                    isSelected && 'bg-primary/10'
                  )}
                  onClick={() => onRepClick?.(rep.analyst)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {rep.analyst.split('@')[0]}
                        </p>
                        {index === 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1">Top</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">{rep.totalCalls}</TableCell>
                  <TableCell className="text-center font-medium">{rep.dmConnections}</TableCell>
                  <TableCell className="text-center font-medium">
                    {rep.meetingsSet > 0 ? (
                      <Badge className="bg-blue-500 text-xs">{rep.meetingsSet}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={Math.min(rep.connectRate, 100)}
                        className="h-2 w-16"
                      />
                      <span className={cn(
                        'text-sm font-medium min-w-[40px]',
                        rep.connectRate >= avgConnectRate ? 'text-emerald-600' : 'text-muted-foreground'
                      )}>
                        {rep.connectRate.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className={cn(
                      'flex items-center justify-center gap-0.5',
                      rep.trend > 0 ? 'text-emerald-600' : rep.trend < 0 ? 'text-red-600' : 'text-muted-foreground'
                    )}>
                      {rep.trend > 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : rep.trend < 0 ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                      {Math.abs(rep.trend) > 0 && (
                        <span className="text-xs">{Math.abs(rep.trend).toFixed(1)}%</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {reps.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No rep data for this period
          </div>
        )}
      </CardContent>
    </Card>
  );
}
