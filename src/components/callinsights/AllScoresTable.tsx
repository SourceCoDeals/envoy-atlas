import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Users, AlertTriangle, BarChart3, Star, ThumbsUp, FileText, HelpCircle, Shield, MessageCircle, Heart, Gem, ArrowRight, User, DollarSign, Search as SearchIcon } from 'lucide-react';
import { CallInsightsData } from '@/hooks/useExternalCallIntel';
import { CallingMetricsConfig, formatScore } from '@/lib/callingConfig';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MiniDistribution } from './MiniDistribution';

interface Props {
  data: CallInsightsData;
  config: CallingMetricsConfig;
}

const SCORE_METRICS = [
  { key: 'overall_quality_score', label: 'Overall Quality', icon: Star, benchmark: 7 },
  { key: 'seller_interest_score', label: 'Seller Interest', icon: ThumbsUp, benchmark: 7 },
  { key: 'script_adherence_score', label: 'Script Adherence', icon: FileText, benchmark: 6 },
  { key: 'question_adherence_score', label: 'Question Adherence', icon: HelpCircle, benchmark: 8 },
  { key: 'objection_handling_score', label: 'Objection Handling', icon: Shield, benchmark: 6 },
  { key: 'conversation_quality_score', label: 'Conversation Quality', icon: MessageCircle, benchmark: 6 },
  { key: 'rapport_building_score', label: 'Rapport Building', icon: Heart, benchmark: 5 },
  { key: 'value_proposition_score', label: 'Value Proposition', icon: Gem, benchmark: 6 },
  { key: 'next_steps_clarity_score', label: 'Next Steps Clarity', icon: ArrowRight, benchmark: 6 },
  { key: 'personal_insights_score', label: 'Personal Insights', icon: User, benchmark: 5 },
  { key: 'valuation_discussion_score', label: 'Valuation Discussion', icon: DollarSign, benchmark: 4 },
  { key: 'discovery_score', label: 'Discovery', icon: SearchIcon, benchmark: 6 },
];

function getScoreBadgeColor(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 8) return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
  if (score >= 6) return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
  if (score >= 4) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
}

export function AllScoresTable({ data, config }: Props) {
  const { scoreOverview, intelRecords } = data;

  // Build distribution data for each score
  const distributions = SCORE_METRICS.map(metric => {
    const dist = Array(10).fill(0);
    intelRecords.forEach(record => {
      const score = record[metric.key as keyof typeof record] as number | null;
      if (score !== null && score >= 1 && score <= 10) {
        dist[Math.floor(score) - 1]++;
      }
    });
    return dist;
  });

  // Find best and worst rep for each score
  const repStats = SCORE_METRICS.map(metric => {
    const repScores = new Map<string, number[]>();
    intelRecords.forEach(r => {
      const rep = r.call?.caller_name || 'Unknown';
      const score = r[metric.key as keyof typeof r] as number | null;
      if (score !== null) {
        if (!repScores.has(rep)) repScores.set(rep, []);
        repScores.get(rep)!.push(score);
      }
    });

    let bestRep = '-';
    let worstRep = '-';
    let bestAvg = 0;
    let worstAvg = 10;

    repScores.forEach((scores, rep) => {
      if (scores.length >= 2) { // Need at least 2 calls
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestRep = rep;
        }
        if (avg < worstAvg) {
          worstAvg = avg;
          worstRep = rep;
        }
      }
    });

    return { bestRep, worstRep };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          All Score Dimensions
        </CardTitle>
        <CardDescription>
          Average scores across all analyzed calls with distribution and rep performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Score Dimension</TableHead>
              <TableHead className="text-center">Avg Score</TableHead>
              <TableHead className="text-center">Trend</TableHead>
              <TableHead className="text-center">Distribution</TableHead>
              <TableHead>Best Rep</TableHead>
              <TableHead>Needs Work</TableHead>
              <TableHead className="text-center">Benchmark</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SCORE_METRICS.map((metric, index) => {
              const overview = scoreOverview.find(s => s.key === metric.key);
              const Icon = metric.icon;
              const distribution = distributions[index];
              const { bestRep, worstRep } = repStats[index];

              const avgScore = overview?.thisWeekAvg ?? null;
              const trend = overview?.trend ?? 'flat';
              const trendDiff = overview?.thisWeekAvg && overview?.lastWeekAvg
                ? overview.thisWeekAvg - overview.lastWeekAvg
                : 0;

              return (
                <TableRow key={metric.key}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      {metric.label}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn('font-semibold', getScoreBadgeColor(avgScore))}>
                      {avgScore?.toFixed(1) ?? '-'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {trend === 'up' ? (
                      <span className="text-green-600 flex items-center justify-center gap-1">
                        <TrendingUp className="w-3 h-3" /> +{trendDiff.toFixed(1)}
                      </span>
                    ) : trend === 'down' ? (
                      <span className="text-red-600 flex items-center justify-center gap-1">
                        <TrendingDown className="w-3 h-3" /> {trendDiff.toFixed(1)}
                      </span>
                    ) : (
                      <Minus className="w-3 h-3 mx-auto text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <MiniDistribution data={distribution} />
                  </TableCell>
                  <TableCell className="text-sm text-green-600 truncate max-w-[100px]">
                    {bestRep}
                  </TableCell>
                  <TableCell className="text-sm text-red-600 truncate max-w-[100px]">
                    {worstRep}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    ≥{metric.benchmark}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
