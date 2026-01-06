import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { WeeklyBreakdown as WeeklyBreakdownType } from '@/hooks/useMonthlyReportData';

interface WeeklyBreakdownProps {
  weeklyData: WeeklyBreakdownType[];
}

export function WeeklyBreakdown({ weeklyData }: WeeklyBreakdownProps) {
  const getTrend = (current: number, previous: number | null) => {
    if (previous === null || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return change;
  };

  const TrendIcon = ({ value }: { value: number | null }) => {
    if (value === null) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (Math.abs(value) < 5) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (value > 0) return <TrendingUp className="h-3 w-3 text-[hsl(var(--success))]" />;
    return <TrendingDown className="h-3 w-3 text-[hsl(var(--metric-negative))]" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Week-by-Week Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Week</TableHead>
              <TableHead>Date Range</TableHead>
              <TableHead className="text-right">Sent</TableHead>
              <TableHead className="text-right">Replies</TableHead>
              <TableHead className="text-right">Positive</TableHead>
              <TableHead className="text-right">Reply Rate</TableHead>
              <TableHead className="text-right">Bounce %</TableHead>
              <TableHead className="text-center">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {weeklyData.map((week, idx) => {
              const replyRate = week.sent > 0 ? (week.replied / week.sent) * 100 : 0;
              const bounceRate = week.sent > 0 ? (week.bounced / week.sent) * 100 : 0;
              const prevWeek = idx > 0 ? weeklyData[idx - 1] : null;
              const prevReplyRate = prevWeek && prevWeek.sent > 0 
                ? (prevWeek.replied / prevWeek.sent) * 100 
                : null;
              const trend = getTrend(replyRate, prevReplyRate);

              return (
                <TableRow key={week.weekLabel}>
                  <TableCell className="font-medium">{week.weekLabel}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {week.weekStart} - {week.weekEnd}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {week.sent.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {week.replied.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {week.positiveReplies.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {replyRate.toFixed(2)}%
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${bounceRate > 5 ? 'text-[hsl(var(--warning))]' : ''}`}>
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

        {weeklyData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No weekly data available for this month
          </div>
        )}
      </CardContent>
    </Card>
  );
}
