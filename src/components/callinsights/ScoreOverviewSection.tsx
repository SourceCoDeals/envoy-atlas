import { Card, CardContent } from '@/components/ui/card';
import { Star, ThumbsUp, FileText, ArrowRight } from 'lucide-react';
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

  // Get key scores for hero cards (per spec: Overall, Seller Interest, Script Adherence, Next Steps)
  const overallScore = scoreOverview.find(s => s.key === 'overall_quality_score');
  const sellerInterestScore = scoreOverview.find(s => s.key === 'seller_interest_score');
  const scriptScore = scoreOverview.find(s => s.key === 'script_adherence_score');
  const nextStepsScore = scoreOverview.find(s => s.key === 'next_steps_clarity_score');

  // Calculate trends as numeric values
  const getTrend = (item: typeof overallScore) => {
    if (!item?.thisWeekAvg || !item?.lastWeekAvg) return undefined;
    return item.thisWeekAvg - item.lastWeekAvg;
  };

  // Calculate positive interest rate (yes + maybe) / total
  const positiveInterestRate = intelRecords.length > 0
    ? ((data.interestBreakdown.yes + data.interestBreakdown.maybe) / intelRecords.length) * 100
    : 0;

  // Calculate avg script adherence from all records
  const avgScriptAdherence = () => {
    const scores = intelRecords
      .map(r => r.script_adherence_score)
      .filter((s): s is number => s !== null);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  };

  return (
    <div className="space-y-6">
      {/* Key Score Cards - Updated per spec */}
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
          description="Lead qualification"
          thresholds={config.sellerInterestThresholds}
        />
        <ScoreCard
          title="Script Adherence"
          score={scriptScore?.thisWeekAvg ?? null}
          trend={getTrend(scriptScore)}
          icon={<FileText className="w-5 h-5" />}
          description="Training compliance"
          thresholds={config.scriptAdherenceThresholds}
        />
        <ScoreCard
          title="Next Steps Clarity"
          score={nextStepsScore?.thisWeekAvg ?? null}
          trend={getTrend(nextStepsScore)}
          icon={<ArrowRight className="w-5 h-5" />}
          description="Pipeline progression"
          thresholds={config.nextStepsClarityThresholds}
        />
      </div>

      {/* Quick Stats Row - Key Counts */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground"># Interested in Selling</div>
            <div className="text-3xl font-bold text-primary">{data.interestBreakdown.yes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground"># Owners Willing to Sell</div>
            <div className="text-3xl font-bold text-primary">{data.interestBreakdown.yes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground"># Gatekeepers</div>
            <div className="text-3xl font-bold text-accent-foreground">
              {intelRecords.filter(r => r.call?.disposition?.toLowerCase().includes('gatekeeper')).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground"># Not Interested</div>
            <div className="text-3xl font-bold text-destructive">{data.interestBreakdown.no}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Calls</div>
            <div className="text-3xl font-bold">{intelRecords.length}</div>
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
