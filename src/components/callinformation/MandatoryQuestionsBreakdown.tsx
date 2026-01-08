import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle } from 'lucide-react';

interface MandatoryQuestionStats {
  questionId: string;
  questionText: string;
  timesAsked: number;
  totalCalls: number;
  percentage: number;
}

interface MandatoryQuestionsBreakdownProps {
  questions: MandatoryQuestionStats[];
}

export function MandatoryQuestionsBreakdown({ questions }: MandatoryQuestionsBreakdownProps) {
  const overallAdherence = questions.length > 0 
    ? Math.round(questions.reduce((sum, q) => sum + q.percentage, 0) / questions.length)
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Mandatory Questions Adherence</CardTitle>
          <span className={`text-lg font-bold ${
            overallAdherence >= 70 ? 'text-green-500' : 
            overallAdherence >= 50 ? 'text-yellow-500' : 'text-red-500'
          }`}>
            {overallAdherence}% Overall
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {questions.map((q) => (
            <div key={q.questionId} className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {q.percentage >= 70 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <span className="text-sm text-muted-foreground truncate">{q.questionText}</span>
                </div>
                <span className="text-sm font-medium shrink-0">
                  {q.timesAsked}/{q.totalCalls} ({q.percentage}%)
                </span>
              </div>
              <Progress 
                value={q.percentage} 
                className="h-1.5"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
