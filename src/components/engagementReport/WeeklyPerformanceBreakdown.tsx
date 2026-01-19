import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';

export interface WeeklyPerformance {
  weekLabel: string;
  weekStart: string;
  sent: number;
  replied: number;
  positiveReplies: number;
  bounced: number;
}

interface WeeklyPerformanceBreakdownProps {
  weeklyData: WeeklyPerformance[];
}

export function WeeklyPerformanceBreakdown({ weeklyData }: WeeklyPerformanceBreakdownProps) {
  const getTrend = (current: number, previous: number | null) => {
    if (previous === null || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return change;
  };

  const TrendIcon = ({ value }: { value: number | null }) => {
    if (value === null) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (Math.abs(value) < 5) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (value > 0) return <TrendingUp className="h-3 w-3 text-success" />;
    return <TrendingDown className="h-3 w-3 text-destructive" />;
  };

  if (weeklyData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Week-by-Week Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No weekly data available yet. Data will appear once syncs complete.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Week-by-Week Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Replies</TableHead>
                <TableHead className="text-right">Reply Rate</TableHead>
                <TableHead className="text-right">Positive</TableHead>
                <TableHead className="text-right">Positive Rate</TableHead>
                <TableHead className="text-right">Bounced</TableHead>
                <TableHead className="text-right">Bounce %</TableHead>
                <TableHead className="text-center">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeklyData.map((week, idx) => {
                const replyRate = week.sent > 0 ? (week.replied / week.sent) * 100 : 0;
                const positiveRate = week.sent > 0 ? (week.positiveReplies / week.sent) * 100 : 0;
                const bounceRate = week.sent > 0 ? (week.bounced / week.sent) * 100 : 0;
                const prevWeek = idx > 0 ? weeklyData[idx - 1] : null;
                const prevReplyRate = prevWeek && prevWeek.sent > 0 
                  ? (prevWeek.replied / prevWeek.sent) * 100 
                  : null;
                const trend = getTrend(replyRate, prevReplyRate);

                return (
                  <TableRow key={week.weekLabel}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {week.weekLabel}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {week.sent.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {week.replied.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {replyRate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-success">
                      {week.positiveReplies.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {positiveRate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {week.bounced.toLocaleString()}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${bounceRate > 5 ? 'text-warning' : ''}`}>
                      {bounceRate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-center">
                      <TrendIcon value={trend} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Summary Row */}
        <div className="mt-4 p-4 rounded-lg bg-muted/30 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Sent</p>
            <p className="text-lg font-bold">
              {weeklyData.reduce((sum, w) => sum + w.sent, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Replies</p>
            <p className="text-lg font-bold">
              {weeklyData.reduce((sum, w) => sum + w.replied, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Positive</p>
            <p className="text-lg font-bold text-success">
              {weeklyData.reduce((sum, w) => sum + w.positiveReplies, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Avg Reply Rate</p>
            <p className="text-lg font-bold">
              {(() => {
                const totalSent = weeklyData.reduce((sum, w) => sum + w.sent, 0);
                const totalReplied = weeklyData.reduce((sum, w) => sum + w.replied, 0);
                return totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(2) : '0.00';
              })()}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
