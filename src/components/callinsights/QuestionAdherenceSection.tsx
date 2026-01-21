import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, AlertTriangle, Users, HelpCircle } from 'lucide-react';
import { CallInsightsData, ExternalCallIntel } from '@/hooks/useExternalCallIntel';
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

interface Props {
  data: CallInsightsData | undefined;
  config: CallingMetricsConfig;
}

const REQUIRED_QUESTIONS = [
  { label: 'Company growth and future prospects', key: 'growth' },
  { label: 'Valuation expectations', key: 'valuation' },
  { label: 'Past or ongoing M&A discussions', key: 'ma_discussions' },
  { label: 'Historical and projected revenue & EBITDA', key: 'financials' },
  { label: 'Interest in selling', key: 'interest' },
  { label: 'Mobile number', key: 'mobile' },
  { label: 'Reasons for exit (why and when)', key: 'exit_reason' },
  { label: 'Past growth history', key: 'growth_history' },
  { label: 'Future growth plans', key: 'future_plans' },
  { label: 'Key business pain points', key: 'pain_points' },
  { label: 'Employee count', key: 'employees' },
  { label: 'Post-sale involvement duration', key: 'involvement' },
  { label: 'Annual revenue', key: 'revenue' },
  { label: 'Ownership structure', key: 'ownership' },
  { label: 'EBITDA (number or description)', key: 'ebitda' },
  { label: 'Brief company history', key: 'history' },
  { label: "Owner's transaction goals", key: 'transaction_goals' },
];

export function QuestionAdherenceSection({ data, config }: Props) {
  if (!data) return null;

  const { 
    avgQuestionsCovered, 
    questionDistribution, 
    callsWithZeroQuestions, 
    questionsByRep,
    intelRecords
  } = data;

  const totalCalls = intelRecords.length;
  const zeroQuestionRate = totalCalls > 0 ? (callsWithZeroQuestions / totalCalls) * 100 : 0;

  // Calculate good/poor coverage counts
  const callsWithGoodCoverage = intelRecords.filter(r => 
    (r.questions_covered_count || 0) >= config.questionCoverageGoodThreshold
  ).length;
  const callsWithPoorCoverage = intelRecords.filter(r => 
    (r.questions_covered_count || 0) < config.questionCoverageWarningThreshold
  ).length;

  // Get question justifications for examples
  const questionJustifications = intelRecords
    .filter(r => r.question_adherence_justification)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Questions</div>
            <div className="text-3xl font-bold">{config.questionCoverageTotal}</div>
            <p className="text-xs text-muted-foreground">Required per call</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Avg Coverage</div>
            <div className="text-3xl font-bold">
              {avgQuestionsCovered.toFixed(1)}
              <span className="text-lg text-muted-foreground">/{config.questionCoverageTotal}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {config.questionCoverageTotal > 0 
                ? ((avgQuestionsCovered / config.questionCoverageTotal) * 100).toFixed(0)
                : 0}% coverage rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Good Coverage</div>
            <div className="text-3xl font-bold text-green-600">
              {callsWithGoodCoverage}
            </div>
            <p className="text-xs text-muted-foreground">
              Calls with ≥{config.questionCoverageGoodThreshold} questions
            </p>
          </CardContent>
        </Card>
        <Card className={cn(callsWithZeroQuestions > 0 && 'border-destructive')}>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Zero Question Calls
            </div>
            <div className="text-3xl font-bold text-destructive">{callsWithZeroQuestions}</div>
            <p className="text-xs text-muted-foreground">
              {zeroQuestionRate.toFixed(1)}% of all calls
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Questions Covered Distribution
          </CardTitle>
          <CardDescription>
            Number of calls by questions covered count
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={questionDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="count" 
                  label={{ value: 'Questions Covered', position: 'bottom', offset: -5 }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  label={{ value: 'Number of Calls', angle: -90, position: 'insideLeft' }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`${value} calls`, 'Count']}
                  labelFormatter={(label) => `${label} questions covered`}
                />
                <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
                  {questionDistribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.count === 0 
                        ? 'hsl(var(--destructive))' 
                        : entry.count >= config.questionCoverageGoodThreshold 
                          ? 'hsl(142.1 76.2% 36.3%)' 
                          : 'hsl(var(--primary))'
                      } 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* The 17 Required Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            The {REQUIRED_QUESTIONS.length} Required Questions
          </CardTitle>
          <CardDescription>
            Questions that should be covered in every discovery call
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {REQUIRED_QUESTIONS.map((question, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-primary/10 text-primary">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{question.label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* By Rep Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Question Coverage by Rep
          </CardTitle>
          <CardDescription>
            Average questions covered and zero-question calls per rep
          </CardDescription>
        </CardHeader>
        <CardContent>
          {questionsByRep.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead className="text-center">Avg Questions</TableHead>
                  <TableHead className="text-center">Coverage Rate</TableHead>
                  <TableHead className="text-center">Zero Question Calls</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questionsByRep.map((rep) => {
                  const coverageRate = config.questionCoverageTotal > 0 
                    ? (rep.avgQuestions / config.questionCoverageTotal) * 100 
                    : 0;
                  const isGood = rep.avgQuestions >= config.questionCoverageGoodThreshold;
                  const isWarning = rep.avgQuestions >= config.questionCoverageWarningThreshold;
                  
                  return (
                    <TableRow key={rep.rep}>
                      <TableCell className="font-medium">{rep.rep}</TableCell>
                      <TableCell className="text-center">{rep.avgQuestions.toFixed(1)}</TableCell>
                      <TableCell className="text-center">{coverageRate.toFixed(0)}%</TableCell>
                      <TableCell className="text-center">
                        {rep.zeroCount > 0 ? (
                          <Badge variant="destructive">{rep.zeroCount}</Badge>
                        ) : (
                          <Badge variant="secondary">0</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isGood ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Excellent
                          </Badge>
                        ) : isWarning ? (
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Needs Work
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Below Target</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No rep-level question data available yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question Adherence Justifications */}
      <Card>
        <CardHeader>
          <CardTitle>Question Adherence Feedback</CardTitle>
          <CardDescription>
            AI explanations of what questions were missed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4 pr-4">
              {questionJustifications.length > 0 ? (
                questionJustifications.map(call => (
                  <div key={call.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={(call.question_adherence_score || 0) >= 8 ? 'default' : 'destructive'}>
                          {call.questions_covered_count || 0}/{config.questionCoverageTotal} covered
                        </Badge>
                        <span className="font-medium truncate max-w-xs">
                          {call.call?.to_name || 'Unknown'}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {call.call?.started_at 
                          ? format(new Date(call.call.started_at), 'MMM d, yyyy')
                          : '-'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                      {call.question_adherence_justification || 'No justification provided'}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No question adherence feedback available yet
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
