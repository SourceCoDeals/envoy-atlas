import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Search, Download, Star, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { CallingMetricsConfig } from '@/lib/callingConfig';
import { MetricTooltip } from '@/components/ui/metric-tooltip';

interface CallerStats {
  rep: string;
  totalCalls: number;
  connections: number;
  connectRate: number;
  meetings: number;
  meetingRate: number;
  activated: number;
  positiveOutcomeRate: number;
  avgScore: number | null;
}

interface CallerPerformanceTableProps {
  repPerformance: Array<{
    rep: string;
    totalCalls: number;
    connections: number;
    meetings: number;
    avgOverallScore: number | null;
    positiveInterestCount: number;
  }>;
  config: CallingMetricsConfig;
  onCallerClick?: (rep: string) => void;
}

function getCallerStatus(caller: CallerStats): { label: string; color: string; icon: React.ReactNode } {
  const { avgScore, positiveOutcomeRate, meetingRate } = caller;
  const score = avgScore ?? 0;
  
  // Top Performer: High scores across the board
  if (score >= 7 && positiveOutcomeRate >= 60 && meetingRate >= 4) {
    return { label: 'Top Performer', color: 'bg-yellow-500/10 text-yellow-600', icon: <Star className="h-3 w-3" /> };
  }
  
  // On Track: Meeting benchmarks
  if (score >= 6 && positiveOutcomeRate >= 50) {
    return { label: 'On Track', color: 'bg-green-500/10 text-green-600', icon: <CheckCircle className="h-3 w-3" /> };
  }
  
  // Below Average: Some metrics lagging
  if (score >= 5 || positiveOutcomeRate >= 40) {
    return { label: 'Below Avg', color: 'bg-amber-500/10 text-amber-600', icon: <AlertTriangle className="h-3 w-3" /> };
  }
  
  // Needs Review: Multiple issues
  return { label: 'Needs Review', color: 'bg-red-500/10 text-red-600', icon: <XCircle className="h-3 w-3" /> };
}

export function CallerPerformanceTable({ repPerformance, config, onCallerClick }: CallerPerformanceTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const callerStats: CallerStats[] = useMemo(() => {
    return repPerformance.map(rep => {
      // Meeting rate = meetings / connections (completed calls)
      const meetingRate = rep.connections > 0 ? (rep.meetings / rep.connections) * 100 : 0;
      // Connect rate = connections / total
      const connectRate = rep.totalCalls > 0 ? (rep.connections / rep.totalCalls) * 100 : 0;
      // Positive outcome = (meetings + activated) / connections - approximated
      const activated = rep.positiveInterestCount;
      const positiveOutcomeRate = rep.connections > 0 
        ? ((rep.meetings + activated) / rep.connections) * 100 
        : 0;

      return {
        rep: rep.rep,
        totalCalls: rep.totalCalls,
        connections: rep.connections,
        connectRate,
        meetings: rep.meetings,
        meetingRate,
        activated,
        positiveOutcomeRate,
        avgScore: rep.avgOverallScore,
      };
    });
  }, [repPerformance]);

  const filteredCallers = useMemo(() => {
    if (!searchTerm) return callerStats;
    const lower = searchTerm.toLowerCase();
    return callerStats.filter(c => c.rep.toLowerCase().includes(lower));
  }, [callerStats, searchTerm]);

  // Totals
  const totals = useMemo(() => {
    const totalCalls = filteredCallers.reduce((sum, c) => sum + c.totalCalls, 0);
    const totalConnections = filteredCallers.reduce((sum, c) => sum + c.connections, 0);
    const totalMeetings = filteredCallers.reduce((sum, c) => sum + c.meetings, 0);
    const totalActivated = filteredCallers.reduce((sum, c) => sum + c.activated, 0);

    return {
      totalCalls,
      connectRate: totalCalls > 0 ? (totalConnections / totalCalls) * 100 : 0,
      totalMeetings,
      meetingRate: totalConnections > 0 ? (totalMeetings / totalConnections) * 100 : 0,
      positiveOutcomeRate: totalConnections > 0 
        ? ((totalMeetings + totalActivated) / totalConnections) * 100 
        : 0,
      avgScore: filteredCallers.filter(c => c.avgScore !== null).length > 0
        ? filteredCallers.reduce((sum, c) => sum + (c.avgScore ?? 0), 0) / filteredCallers.filter(c => c.avgScore !== null).length
        : null,
    };
  }, [filteredCallers]);

  const handleExport = () => {
    const headers = ['Name', 'Calls', 'Connects', 'Connect Rate', 'Meetings', 'Meeting Rate', 'Positive %', 'Avg Score', 'Status'];
    const rows = filteredCallers.map(c => {
      const status = getCallerStatus(c);
      return [
        c.rep,
        c.totalCalls,
        c.connections,
        `${c.connectRate.toFixed(1)}%`,
        c.meetings,
        `${c.meetingRate.toFixed(1)}%`,
        `${c.positiveOutcomeRate.toFixed(0)}%`,
        c.avgScore?.toFixed(1) ?? 'N/A',
        status.label,
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'caller-performance.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Caller Performance
            </CardTitle>
            <CardDescription>All analysts and associates for selected period</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search callers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            Showing {filteredCallers.length} of {callerStats.length} callers
          </span>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">
                  <MetricTooltip metricKey="caller_calls">Calls</MetricTooltip>
                </TableHead>
                <TableHead className="text-right">
                  <MetricTooltip metricKey="caller_connects">Connects</MetricTooltip>
                </TableHead>
                <TableHead className="text-right">
                  <MetricTooltip metricKey="caller_connect_rate">Connect Rate</MetricTooltip>
                </TableHead>
                <TableHead className="text-right">
                  <MetricTooltip metricKey="caller_meetings">Meetings</MetricTooltip>
                </TableHead>
                <TableHead className="text-right">
                  <MetricTooltip metricKey="caller_meeting_rate">Meeting Rate</MetricTooltip>
                </TableHead>
                <TableHead className="text-right">
                  <MetricTooltip metricKey="caller_positive_pct">Positive %</MetricTooltip>
                </TableHead>
                <TableHead className="text-right">
                  <MetricTooltip metricKey="avg_score">Avg Score</MetricTooltip>
                </TableHead>
                <TableHead className="text-center">
                  <MetricTooltip metricKey="caller_status">Status</MetricTooltip>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCallers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No callers found
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredCallers.map((caller) => {
                    const status = getCallerStatus(caller);
                    const displayName = caller.rep.includes('@') 
                      ? caller.rep.split('@')[0] 
                      : caller.rep;
                    
                    return (
                      <TableRow 
                        key={caller.rep} 
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => onCallerClick?.(caller.rep)}
                      >
                        <TableCell className="font-medium">{displayName}</TableCell>
                        <TableCell className="text-right">{caller.totalCalls}</TableCell>
                        <TableCell className="text-right">{caller.connections}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={caller.connectRate >= 25 ? 'default' : caller.connectRate >= 15 ? 'secondary' : 'outline'}>
                            {caller.connectRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{caller.meetings}</TableCell>
                        <TableCell className="text-right">{caller.meetingRate.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{caller.positiveOutcomeRate.toFixed(0)}%</TableCell>
                        <TableCell className="text-right">
                          {caller.avgScore !== null ? (
                            <Badge variant={caller.avgScore >= 7 ? 'default' : caller.avgScore >= 5 ? 'secondary' : 'destructive'}>
                              {caller.avgScore.toFixed(1)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${status.color} gap-1`} variant="outline">
                            {status.icon}
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>TOTALS</TableCell>
                    <TableCell className="text-right">{totals.totalCalls}</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">{totals.connectRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{totals.totalMeetings}</TableCell>
                    <TableCell className="text-right">{totals.meetingRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{totals.positiveOutcomeRate.toFixed(0)}%</TableCell>
                    <TableCell className="text-right">
                      {totals.avgScore !== null ? totals.avgScore.toFixed(1) : '—'}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
