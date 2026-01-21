import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CallInsightsData, ExternalCallIntel } from '@/hooks/useExternalCallIntel';

interface Props {
  data: CallInsightsData;
}

const SCORE_METRICS = [
  { key: 'overall_quality_score', label: 'OQ', fullLabel: 'Overall Quality' },
  { key: 'seller_interest_score', label: 'SI', fullLabel: 'Seller Interest' },
  { key: 'script_adherence_score', label: 'SA', fullLabel: 'Script Adherence' },
  { key: 'question_adherence_score', label: 'QA', fullLabel: 'Question Adherence' },
  { key: 'objection_handling_score', label: 'OH', fullLabel: 'Objection Handling' },
  { key: 'conversation_quality_score', label: 'CQ', fullLabel: 'Conversation Quality' },
  { key: 'rapport_building_score', label: 'RB', fullLabel: 'Rapport Building' },
  { key: 'value_proposition_score', label: 'VP', fullLabel: 'Value Proposition' },
  { key: 'next_steps_clarity_score', label: 'NS', fullLabel: 'Next Steps Clarity' },
  { key: 'personal_insights_score', label: 'PI', fullLabel: 'Personal Insights' },
  { key: 'valuation_discussion_score', label: 'VD', fullLabel: 'Valuation Discussion' },
  { key: 'discovery_score', label: 'DS', fullLabel: 'Discovery' },
];

function getScoreBackgroundColor(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 8) return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
  if (score >= 6) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
  if (score >= 4) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
}

export function RepScoreHeatmap({ data }: Props) {
  // Group records by rep
  const repMap = new Map<string, ExternalCallIntel[]>();
  data.intelRecords.forEach(record => {
    const rep = record.call?.caller_name || 'Unknown';
    if (!repMap.has(rep)) repMap.set(rep, []);
    repMap.get(rep)!.push(record);
  });

  // Calculate averages per rep
  const repScores = Array.from(repMap.entries()).map(([email, records]) => {
    const scores: Record<string, number | null> = {};
    SCORE_METRICS.forEach(metric => {
      const values = records
        .map(r => r[metric.key as keyof ExternalCallIntel] as number | null)
        .filter((v): v is number => v !== null);
      scores[metric.key] = values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
    });
    return { email, totalCalls: records.length, scores };
  }).sort((a, b) => b.totalCalls - a.totalCalls);

  if (repScores.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score Comparison by Rep</CardTitle>
        <CardDescription>
          Hover over cells to see details. Color indicates performance level.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 font-medium">Rep</th>
                <th className="text-center p-1 font-medium text-muted-foreground">Calls</th>
                {SCORE_METRICS.map(metric => (
                  <th 
                    key={metric.key} 
                    className="p-1 text-center font-medium text-muted-foreground"
                    title={metric.fullLabel}
                  >
                    {metric.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {repScores.map(rep => (
                <tr key={rep.email} className="border-t">
                  <td className="p-2 font-medium truncate max-w-[150px]">{rep.email}</td>
                  <td className="text-center p-1 text-muted-foreground">{rep.totalCalls}</td>
                  {SCORE_METRICS.map(metric => {
                    const score = rep.scores[metric.key];
                    return (
                      <td key={metric.key} className="p-1">
                        <div
                          className={cn(
                            "w-8 h-8 rounded flex items-center justify-center text-xs font-medium mx-auto",
                            getScoreBackgroundColor(score)
                          )}
                          title={`${metric.fullLabel}: ${score?.toFixed(1) ?? '-'}`}
                        >
                          {score?.toFixed(0) ?? '-'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/50" /> Excellent (8-10)
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/50" /> Good (6-7)
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/50" /> Average (4-5)
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/50" /> Poor (1-3)
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
