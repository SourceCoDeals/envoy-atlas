import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, ThumbsUp, FileText, HelpCircle } from 'lucide-react';
import { CallInsightsData } from '@/hooks/useExternalCallIntel';
import { CallingMetricsConfig } from '@/lib/callingConfig';
import { ScoreCard } from './ScoreCard';
import { AllScoresTable } from './AllScoresTable';
import { RepScoreHeatmap } from './RepScoreHeatmap';

interface Props {
  data: CallInsightsData | undefined;
  config: CallingMetricsConfig;
}

export function ScoreOverviewSection({ data, config }: Props) {
  if (!data) return null;

  const { scoreOverview, intelRecords } = data;

  // Get key scores for hero cards
  const overallScore = scoreOverview.find(s => s.key === 'overall_quality_score');
  const sellerInterestScore = scoreOverview.find(s => s.key === 'seller_interest_score');
  const scriptScore = scoreOverview.find(s => s.key === 'script_adherence_score');
  const questionScore = scoreOverview.find(s => s.key === 'question_adherence_score');

  // Calculate trends as numeric values
  const getTrend = (item: typeof overallScore) => {
    if (!item?.thisWeekAvg || !item?.lastWeekAvg) return undefined;
    return item.thisWeekAvg - item.lastWeekAvg;
  };

  return (
    <div className="space-y-6">
      {/* Key Score Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <ScoreCard
          title="Overall Quality"
          score={overallScore?.thisWeekAvg ?? null}
          trend={getTrend(overallScore)}
          icon={<Star className="w-5 h-5" />}
          description="Holistic call assessment"
          thresholds={config.overallQualityThresholds}
        />
        <ScoreCard
          title="Seller Interest"
          score={sellerInterestScore?.thisWeekAvg ?? null}
          trend={getTrend(sellerInterestScore)}
          icon={<ThumbsUp className="w-5 h-5" />}
          description="Prospect engagement level"
          thresholds={config.sellerInterestThresholds}
        />
        <ScoreCard
          title="Script Adherence"
          score={scriptScore?.thisWeekAvg ?? null}
          trend={getTrend(scriptScore)}
          icon={<FileText className="w-5 h-5" />}
          description="Following call framework"
          thresholds={config.scriptAdherenceThresholds}
        />
        <ScoreCard
          title="Question Coverage"
          score={questionScore?.thisWeekAvg ?? null}
          trend={getTrend(questionScore)}
          icon={<HelpCircle className="w-5 h-5" />}
          description="Discovery effectiveness"
          thresholds={config.questionAdherenceThresholds}
        />
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Calls Analyzed</div>
            <div className="text-3xl font-bold">{intelRecords.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Avg Questions Covered</div>
            <div className="text-3xl font-bold">{data.avgQuestionsCovered.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">out of {config.questionCoverageTotal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Objection Resolution Rate</div>
            <div className="text-3xl font-bold">{data.overallResolutionRate.toFixed(0)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Positive Interest Rate</div>
            <div className="text-3xl font-bold">
              {intelRecords.length > 0 
                ? ((data.interestBreakdown.yes / intelRecords.length) * 100).toFixed(0)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All 12 Scores Table */}
      <AllScoresTable data={data} config={config} />

      {/* Rep Score Heatmap */}
      <RepScoreHeatmap data={data} />
    </div>
  );
}
