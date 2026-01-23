import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Phone, Calculator, CheckCircle2, AlertTriangle, Database } from 'lucide-react';
import {
  CALLING_BENCHMARKS,
  CONNECTED_DISPOSITIONS,
  VOICEMAIL_DISPOSITIONS,
  POSITIVE_CALL_OUTCOMES,
  POSITIVE_REPLY_CATEGORIES,
  REPLY_CATEGORIES,
} from '@/lib/metrics';
import { getColdCallDispositionMatrix } from '@/lib/constants/dispositions';

interface FormulaRow {
  name: string;
  formula: string;
  function: string;
  description: string;
  benchmark?: string;
}

const emailFormulas: FormulaRow[] = [
  {
    name: 'Reply Rate',
    formula: '(replied / sent) × 100',
    function: 'calculateReplyRate(sent, replied)',
    description: 'Percentage of emails that received a reply',
    benchmark: '> 5% good, > 2% average',
  },
  {
    name: 'Bounce Rate',
    formula: '(bounced / sent) × 100',
    function: 'calculateBounceRate(sent, bounced)',
    description: 'Percentage of emails that bounced',
    benchmark: '< 2% good, < 5% warning',
  },
  {
    name: 'Positive Rate',
    formula: '(positive / sent) × 100',
    function: 'calculatePositiveRate(sent, positive)',
    description: 'Percentage of emails with positive responses',
    benchmark: '> 2% good, > 1% average',
  },
  {
    name: 'Positive Reply Rate',
    formula: '(positive / replied) × 100',
    function: 'calculatePositiveReplyRate(replied, positive)',
    description: 'Percentage of replies that are positive',
  },
  {
    name: 'Delivery Rate',
    formula: '(delivered / sent) × 100',
    function: 'calculateDeliveryRate(sent, delivered)',
    description: 'Percentage of emails successfully delivered',
  },
  {
    name: 'Open Rate',
    formula: '(opened / sent) × 100',
    function: 'calculateOpenRate(sent, opened)',
    description: 'Percentage of emails opened (de-emphasized)',
    benchmark: '> 50% good, > 30% average',
  },
  {
    name: 'Click Rate',
    formula: '(clicked / sent) × 100',
    function: 'calculateClickRate(sent, clicked)',
    description: 'Percentage of emails with link clicks',
  },
  {
    name: 'Meeting Rate',
    formula: '(meetings / sent) × 100',
    function: 'calculateMeetingRate(sent, meetings)',
    description: 'Percentage of emails that led to meetings',
  },
];

const callingFormulas: FormulaRow[] = [
  {
    name: 'Connect Rate',
    formula: '(connections / totalCalls) × 100',
    function: 'calculateCallConnectRate(totalCalls, connections)',
    description: 'Percentage of calls that resulted in a connection',
    benchmark: `${CALLING_BENCHMARKS.connectRate.min}-${CALLING_BENCHMARKS.connectRate.max}% good, < ${CALLING_BENCHMARKS.connectRate.warning}% warning`,
  },
  {
    name: 'Conversation Rate',
    formula: '(conversations / totalCalls) × 100',
    function: 'calculateConversationRate(totalCalls, conversations)',
    description: 'Percentage of calls that became quality conversations',
    benchmark: `${CALLING_BENCHMARKS.conversationRate.min}-${CALLING_BENCHMARKS.conversationRate.max}% good`,
  },
  {
    name: 'Meeting Rate (Calls)',
    formula: '(meetings / totalCalls) × 100',
    function: 'calculateCallMeetingRate(totalCalls, meetings)',
    description: 'Percentage of calls that resulted in meetings booked',
    benchmark: `${CALLING_BENCHMARKS.meetingRate.min}-${CALLING_BENCHMARKS.meetingRate.max}% good`,
  },
  {
    name: 'Voicemail Rate',
    formula: '(voicemails / totalCalls) × 100',
    function: 'calculateVoicemailRate(totalCalls, voicemails)',
    description: 'Percentage of calls that went to voicemail',
    benchmark: `< ${CALLING_BENCHMARKS.voicemailRate.max}% good`,
  },
  {
    name: 'Meeting Conversion',
    formula: '(meetings / conversations) × 100',
    function: 'calculateMeetingConversion(conversations, meetings)',
    description: 'Percentage of conversations that became meetings',
  },
  {
    name: 'DM Conversation Rate',
    formula: '(dmConversations / connections) × 100',
    function: 'calculateDMConversationRate(connections, dmConversations)',
    description: 'Percentage of connections with decision makers',
  },
  {
    name: 'Avg Call Duration',
    formula: 'totalTalkTimeSeconds / totalConnections',
    function: 'calculateAvgCallDuration(totalTalkTimeSeconds, connections)',
    description: 'Average call duration for connected calls (in seconds)',
    benchmark: `${CALLING_BENCHMARKS.avgCallDuration.min / 60}-${CALLING_BENCHMARKS.avgCallDuration.max / 60} min optimal`,
  },
  {
    name: 'Composite Score',
    formula: 'avg(interest, quality, objection, value, script, dm, referral)',
    function: 'Calculated during NocoDB sync',
    description: 'Average of 7 AI-scored dimensions (1-10 scale)',
    benchmark: '≥ 7 excellent, 5-6.9 good, < 5 needs coaching',
  },
];

// Cold Calls disposition matrix for reference
const coldCallDispositions = getColdCallDispositionMatrix();

const callingClassifications = [
  {
    name: 'Connection',
    logic: 'isConnection(disposition) || talk_duration > 30',
    dispositions: CONNECTED_DISPOSITIONS.join(', '),
    description: 'Call resulted in speaking with a human',
  },
  {
    name: 'Voicemail',
    logic: 'voicemail_left || isVoicemail(disposition)',
    dispositions: VOICEMAIL_DISPOSITIONS.join(', '),
    description: 'Call went to voicemail',
  },
  {
    name: 'Conversation',
    logic: 'outcome NOT IN [no_answer, voicemail, busy, wrong_number]',
    dispositions: 'Any outcome except non-conversations',
    description: 'Meaningful exchange occurred',
  },
  {
    name: 'Meeting',
    logic: 'isMeetingBooked(outcome) || callback_scheduled',
    dispositions: 'meeting_booked',
    description: 'Meeting was scheduled',
  },
  {
    name: 'Positive Outcome',
    logic: 'isPositiveCallOutcome(outcome)',
    dispositions: POSITIVE_CALL_OUTCOMES.join(', '),
    description: 'Call had a positive result',
  },
];

const emailClassifications = [
  {
    name: 'Positive Reply',
    logic: 'isPositiveReply(category)',
    categories: POSITIVE_REPLY_CATEGORIES.join(', '),
    description: 'Reply indicates interest or meeting request',
  },
  {
    name: 'Interested Reply',
    logic: 'isInterestedReply(category)',
    categories: 'meeting_request, interested, referral',
    description: 'Reply shows some level of interest',
  },
  {
    name: 'Negative Reply',
    logic: 'isNegativeReply(category)',
    categories: 'not_interested, unsubscribe',
    description: 'Reply indicates no interest',
  },
  {
    name: 'Auto Reply',
    logic: 'isAutoReply(category)',
    categories: 'out_of_office, auto_reply, bounce',
    description: 'Automated response, not human',
  },
];

export function MetricsReferenceSection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Metrics Library Reference
          </CardTitle>
          <CardDescription>
            Single source of truth for all metric calculations defined in <code className="text-xs bg-muted px-1 py-0.5 rounded">src/lib/metrics.ts</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email-formulas">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="email-formulas" className="text-xs">
                <Mail className="h-3 w-3 mr-1" />
                Email Formulas
              </TabsTrigger>
              <TabsTrigger value="calling-formulas" className="text-xs">
                <Phone className="h-3 w-3 mr-1" />
                Calling Formulas
              </TabsTrigger>
              <TabsTrigger value="cold-calls" className="text-xs">
                <Database className="h-3 w-3 mr-1" />
                Cold Calls
              </TabsTrigger>
              <TabsTrigger value="calling-class" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Call Classification
              </TabsTrigger>
              <TabsTrigger value="email-class" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Reply Classification
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email-formulas" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Formula</TableHead>
                    <TableHead>Function</TableHead>
                    <TableHead>Benchmark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailFormulas.map((f) => (
                    <TableRow key={f.name}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">{f.formula}</code>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">{f.function}</code>
                      </TableCell>
                      <TableCell>
                        {f.benchmark ? (
                          <span className="text-xs text-muted-foreground">{f.benchmark}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="calling-formulas" className="mt-4">
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Key Difference:</strong> Cold calling uses <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">totalCalls</code> as the denominator (no "bounce" equivalent), 
                  while email uses <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">delivered = sent - bounced</code>.
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Formula</TableHead>
                    <TableHead>Function</TableHead>
                    <TableHead>Benchmark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callingFormulas.map((f) => (
                    <TableRow key={f.name}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">{f.formula}</code>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">{f.function}</code>
                      </TableCell>
                      <TableCell>
                        {f.benchmark ? (
                          <span className="text-xs text-muted-foreground">{f.benchmark}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="calling-class" className="mt-4">
              <div className="mb-4">
                <h4 className="font-medium mb-2">How Calls Are Classified</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  The <code className="bg-muted px-1 rounded">aggregateCallingMetrics()</code> function uses these rules to classify each call:
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Classification</TableHead>
                    <TableHead>Logic</TableHead>
                    <TableHead>Valid Values</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callingClassifications.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell>
                        <Badge variant="outline">{c.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">{c.logic}</code>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{c.dispositions}</span>
                      </TableCell>
                      <TableCell className="text-sm">{c.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="cold-calls" className="mt-4">
              <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  <strong>cold_calls Table:</strong> Primary data source for Caller Dashboard. Dispositions are normalized (time suffixes stripped) 
                  and boolean flags are pre-computed during NocoDB sync.
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Disposition</TableHead>
                    <TableHead className="text-center">Dials</TableHead>
                    <TableHead className="text-center">Connects</TableHead>
                    <TableHead className="text-center">Meetings</TableHead>
                    <TableHead className="text-center">VMs</TableHead>
                    <TableHead className="text-center">Bad Data</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coldCallDispositions.map((d) => (
                    <TableRow key={d.disposition}>
                      <TableCell>
                        <Badge variant={d.connections ? 'default' : 'outline'}>
                          {d.displayName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        {d.connections ? <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {d.meetings ? <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {d.voicemails ? <CheckCircle2 className="h-4 w-4 text-amber-600 mx-auto" /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {d.badData ? <AlertTriangle className="h-4 w-4 text-red-600 mx-auto" /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2 text-sm">Interest Classification (seller_interest_score)</h4>
                <div className="flex gap-4 text-sm">
                  <Badge variant="default" className="bg-green-600">Yes: ≥ 7</Badge>
                  <Badge variant="outline" className="border-amber-500 text-amber-600">Maybe: 4–6.9</Badge>
                  <Badge variant="outline" className="border-red-500 text-red-600">No: &lt; 4</Badge>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="email-class" className="mt-4">
              <div className="mb-4">
                <h4 className="font-medium mb-2">Reply Category Classification</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  All reply categories: <code className="bg-muted px-1 rounded">{REPLY_CATEGORIES.join(', ')}</code>
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Classification</TableHead>
                    <TableHead>Logic</TableHead>
                    <TableHead>Categories</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailClassifications.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell>
                        <Badge variant={c.name === 'Positive Reply' ? 'default' : 'outline'}>
                          {c.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">{c.logic}</code>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{c.categories}</span>
                      </TableCell>
                      <TableCell className="text-sm">{c.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Benchmarks Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cold Calling Benchmarks</CardTitle>
          <CardDescription>
            Industry standard benchmarks from <code className="text-xs bg-muted px-1 py-0.5 rounded">CALLING_BENCHMARKS</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">Connect Rate</p>
              <p className="text-lg font-bold">{CALLING_BENCHMARKS.connectRate.min}-{CALLING_BENCHMARKS.connectRate.max}%</p>
              <p className="text-xs text-destructive">Warning: &lt;{CALLING_BENCHMARKS.connectRate.warning}%</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">Conversation Rate</p>
              <p className="text-lg font-bold">{CALLING_BENCHMARKS.conversationRate.min}-{CALLING_BENCHMARKS.conversationRate.max}%</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">Meeting Rate</p>
              <p className="text-lg font-bold">{CALLING_BENCHMARKS.meetingRate.min}-{CALLING_BENCHMARKS.meetingRate.max}%</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">Voicemail Rate</p>
              <p className="text-lg font-bold">&lt;{CALLING_BENCHMARKS.voicemailRate.max}%</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">Avg Call Duration</p>
              <p className="text-lg font-bold">{CALLING_BENCHMARKS.avgCallDuration.min / 60}-{CALLING_BENCHMARKS.avgCallDuration.max / 60} min</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">Dials Per Day</p>
              <p className="text-lg font-bold">{CALLING_BENCHMARKS.dialsPerDay.min}-{CALLING_BENCHMARKS.dialsPerDay.max}</p>
            </div>
            <div className="p-3 border rounded-lg col-span-2">
              <p className="text-sm text-muted-foreground">Meetings Per Month</p>
              <p className="text-lg font-bold">Avg: {CALLING_BENCHMARKS.meetingsPerMonth.avg} / Top: {CALLING_BENCHMARKS.meetingsPerMonth.top}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
