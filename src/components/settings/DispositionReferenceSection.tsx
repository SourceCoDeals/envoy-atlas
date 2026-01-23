import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getPhoneBurnerDispositionMatrix } from '@/lib/constants/dispositions';
import { CALLING_BENCHMARKS } from '@/lib/metrics';

/**
 * Visual reference showing how each PhoneBurner disposition maps to metrics
 * Based on the specification in public/docs/disposition-metrics-mapping.md
 */
export function DispositionReferenceSection() {
  const matrix = getPhoneBurnerDispositionMatrix();

  const MetricCheck = ({ value, conditional }: { value: boolean; conditional?: boolean }) => {
    if (conditional) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <AlertCircle className="h-4 w-4 text-yellow-500 mx-auto" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Conditional - depends on talk duration</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return value ? (
      <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
    ) : (
      <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Disposition → Metrics Matrix
          </CardTitle>
          <CardDescription>
            How each PhoneBurner disposition affects your calling metrics. Reference:{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">public/docs/disposition-metrics-mapping.md</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Key Insight:</strong> "Send Email" uses talk duration &gt;60s to determine if it was a DM conversation.
                Connections ≠ Conversations. A connection means you spoke to someone; a conversation means meaningful dialogue occurred.
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Disposition</TableHead>
                  <TableHead className="text-center w-20">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">Calls</TooltipTrigger>
                        <TooltipContent><p>Total Calls (denominator)</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center w-20">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">Connect</TooltipTrigger>
                        <TooltipContent><p>Counts as Connection</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center w-20">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">Conv</TooltipTrigger>
                        <TooltipContent><p>Counts as Conversation</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center w-20">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">DM</TooltipTrigger>
                        <TooltipContent><p>Decision Maker Conversation</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center w-20">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">VM</TooltipTrigger>
                        <TooltipContent><p>Voicemail</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center w-20">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">Meeting</TooltipTrigger>
                        <TooltipContent><p>Meeting Interest/Booked</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-center w-20">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">Bad</TooltipTrigger>
                        <TooltipContent><p>Bad Data (wrong number, disconnected)</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="min-w-[140px]">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.map((row) => (
                  <TableRow key={row.disposition} className={row.connections ? '' : 'bg-muted/30'}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{row.disposition}</span>
                        {row.meetings && (
                          <Badge variant="default" className="text-[10px] px-1 py-0">
                            MTG
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <MetricCheck value={row.totalCalls} />
                    </TableCell>
                    <TableCell className="text-center">
                      <MetricCheck value={row.connections} />
                    </TableCell>
                    <TableCell className="text-center">
                      <MetricCheck 
                        value={row.conversations} 
                        conditional={row.disposition === 'Send Email'}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <MetricCheck 
                        value={row.dmConversations}
                        conditional={row.disposition === 'Send Email'}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <MetricCheck value={row.voicemails} />
                    </TableCell>
                    <TableCell className="text-center">
                      <MetricCheck value={row.meetings} />
                    </TableCell>
                    <TableCell className="text-center">
                      <MetricCheck value={row.badData} />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{row.notes}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Metric Formulas Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Calling Metric Formulas</CardTitle>
          <CardDescription>
            How each rate is calculated based on disposition classifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-3 border rounded-lg">
              <p className="text-sm font-medium">Connect Rate</p>
              <code className="text-xs bg-muted px-1 rounded">(connections / totalCalls) × 100</code>
              <p className="text-xs text-muted-foreground mt-1">
                Benchmark: {CALLING_BENCHMARKS.connectRate.min}-{CALLING_BENCHMARKS.connectRate.max}% 
                (warning &lt;{CALLING_BENCHMARKS.connectRate.warning}%)
              </p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm font-medium">Conversation Rate</p>
              <code className="text-xs bg-muted px-1 rounded">(conversations / totalCalls) × 100</code>
              <p className="text-xs text-muted-foreground mt-1">
                Benchmark: {CALLING_BENCHMARKS.conversationRate.min}-{CALLING_BENCHMARKS.conversationRate.max}%
              </p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm font-medium">DM Conversation Rate</p>
              <code className="text-xs bg-muted px-1 rounded">(dmConversations / connections) × 100</code>
              <p className="text-xs text-muted-foreground mt-1">
                Benchmark: {CALLING_BENCHMARKS.dmConversationRate.min}-{CALLING_BENCHMARKS.dmConversationRate.max}%
              </p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm font-medium">Meeting Conversion</p>
              <code className="text-xs bg-muted px-1 rounded">(meetings / conversations) × 100</code>
              <p className="text-xs text-muted-foreground mt-1">
                Benchmark: {CALLING_BENCHMARKS.meetingConversion.min}-{CALLING_BENCHMARKS.meetingConversion.max}%
              </p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm font-medium">Meeting Rate</p>
              <code className="text-xs bg-muted px-1 rounded">(meetings / totalCalls) × 100</code>
              <p className="text-xs text-muted-foreground mt-1">
                Benchmark: {CALLING_BENCHMARKS.meetingRate.min}-{CALLING_BENCHMARKS.meetingRate.max}%
              </p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm font-medium">Bad Data Rate</p>
              <code className="text-xs bg-muted px-1 rounded">(badData / totalCalls) × 100</code>
              <p className="text-xs text-muted-foreground mt-1">
                Target: &lt;{CALLING_BENCHMARKS.badDataRate.max}% (warning &gt;{CALLING_BENCHMARKS.badDataRate.warning}%)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Always counts toward this metric</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-muted-foreground/30" />
              <span>Never counts toward this metric</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span>Conditional (based on talk duration)</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-[10px] px-1 py-0">MTG</Badge>
              <span>Counts toward meetings metric</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}