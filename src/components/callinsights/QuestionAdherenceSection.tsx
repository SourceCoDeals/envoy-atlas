import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, AlertTriangle, Users } from 'lucide-react';
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  data: CallInsightsData | undefined;
  config: CallingMetricsConfig;
}

export function QuestionAdherenceSection({ data, config }: Props) {
  if (!data) return null;

  const { 
    avgQuestionsCovered, 
    questionDistribution, 
    callsWithZeroQuestions, 
    questionsByRep 
  } = data;

  // Prepare chart data
  const chartData = questionDistribution.length > 0 
    ? questionDistribution 
    : Array.from({ length: 11 }, (_, i) => ({ count: i, calls: 0 }));

  const totalCalls = data.intelRecords.length;
  const zeroQuestionRate = totalCalls > 0 ? (callsWithZeroQuestions / totalCalls) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Questions Covered</CardDescription>
            <CardTitle className="text-3xl">{avgQuestionsCovered.toFixed(1)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Out of {config.questionCoverageTotal} expected
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Coverage Rate</CardDescription>
            <CardTitle className="text-3xl">
              {config.questionCoverageTotal > 0 
                ? ((avgQuestionsCovered / config.questionCoverageTotal) * 100).toFixed(0)
                : 0}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className={cn(callsWithZeroQuestions > 0 && 'border-destructive')}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Calls with 0 Questions
            </CardDescription>
            <CardTitle className="text-3xl text-destructive">{callsWithZeroQuestions}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {zeroQuestionRate.toFixed(1)}% of all calls
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Calls Analyzed</CardDescription>
            <CardTitle className="text-3xl">{totalCalls}</CardTitle>
          </CardHeader>
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
              <BarChart data={chartData}>
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
                  {chartData.map((entry, index) => (
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
                  const isGood = coverageRate >= (config.questionCoverageGoodThreshold / config.questionCoverageTotal) * 100;
                  const isWarning = coverageRate >= (config.questionCoverageWarningThreshold / config.questionCoverageTotal) * 100;
                  
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
    </div>
  );
}
