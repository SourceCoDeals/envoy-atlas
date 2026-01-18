import { Card, CardContent } from '@/components/ui/card';
import { Star, CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { CampaignWithMetrics } from '@/hooks/useCampaigns';

interface CampaignPortfolioOverviewProps {
  campaigns: CampaignWithMetrics[];
  onTierFilterChange?: (tier: string) => void;
  activeTierFilter?: string;
}

export type ConfidenceLevel = 'none' | 'low' | 'medium' | 'good' | 'high';

export interface CampaignTier {
  tier: 'star' | 'solid' | 'optimize' | 'problem' | 'insufficient';
  score: number | null;
  recommendation: string;
  confidence: ConfidenceLevel;
  scoreBreakdown: {
    efficiency: number;
    reliability: number;
    health: number;
    momentum: number;
  };
}

// Minimum sends required before calculating a score
const MIN_SENDS_FOR_SCORE = 100;

export function getConfidenceLevel(sent: number): ConfidenceLevel {
  if (sent < 50) return 'none';
  if (sent < 200) return 'low';
  if (sent < 500) return 'medium';
  if (sent < 1000) return 'good';
  return 'high';
}

function getConfidenceMultiplier(sent: number): number {
  if (sent < MIN_SENDS_FOR_SCORE) return 0;
  if (sent < 300) return 0.7;
  if (sent < 500) return 0.85;
  if (sent < 1000) return 0.95;
  return 1.0;
}

export function calculateCampaignScore(campaign: CampaignWithMetrics): CampaignTier {
  const confidence = getConfidenceLevel(campaign.total_sent);
  
  // Don't score campaigns with insufficient data
  if (campaign.total_sent < MIN_SENDS_FOR_SCORE) {
    return {
      tier: 'insufficient',
      score: null,
      recommendation: 'Gather Data',
      confidence,
      scoreBreakdown: { efficiency: 0, reliability: 0, health: 0, momentum: 0 }
    };
  }

  // Efficiency (40 points max) - based on reply rate only
  // NOTE: Positive rate is not tracked - would require sentiment analysis
  const replyRateBenchmark = 2.8;
  const replyRateScore = Math.min((campaign.reply_rate / replyRateBenchmark) * 20, 20);
  
  // Positive rate is NOT tracked - using 0 for scoring
  // Would require message_events sentiment classification
  const positiveRateScore = 0;
  const efficiency = replyRateScore + positiveRateScore;
  
  // Reliability (20 points max) - based on bounce rate
  const reliability = campaign.bounce_rate < 2 ? 20 : 
                      campaign.bounce_rate < 3 ? 15 :
                      campaign.bounce_rate < 5 ? 10 : 0;
  
  // Health (20 points max) - delivery and consistency
  const deliveryRate = ((campaign.total_sent - (campaign.total_bounced || 0)) / campaign.total_sent) * 100;
  const health = Math.min(deliveryRate / 5, 20);
  
  // Momentum (20 points max) - volume shows commitment/scale
  const momentum = campaign.total_sent > 2000 ? 20 : 
                   campaign.total_sent > 1000 ? 18 :
                   campaign.total_sent > 500 ? 15 :
                   campaign.total_sent > 200 ? 12 : 10;
  
  const rawScore = efficiency + reliability + health + momentum;
  
  // Apply confidence multiplier to penalize low sample sizes
  const confidenceMultiplier = getConfidenceMultiplier(campaign.total_sent);
  const adjustedScore = rawScore * confidenceMultiplier;
  
  // Determine tier based on adjusted score
  let tier: CampaignTier['tier'];
  let recommendation: string;
  
  if (adjustedScore >= 70 && confidence !== 'low') {
    tier = 'star';
    recommendation = 'Scale';
  } else if (adjustedScore >= 50) {
    tier = 'solid';
    recommendation = 'Maintain';
  } else if (adjustedScore >= 30) {
    tier = 'optimize';
    recommendation = 'Optimize';
  } else {
    tier = 'problem';
    recommendation = 'Pause';
  }

  // Override recommendation for low confidence
  if (confidence === 'low' && tier === 'star') {
    recommendation = 'Scale (verify)';
  }
  
  return {
    tier,
    score: Math.round(adjustedScore),
    recommendation,
    confidence,
    scoreBreakdown: {
      efficiency: Math.round(efficiency),
      reliability: Math.round(reliability),
      health: Math.round(health),
      momentum: Math.round(momentum)
    }
  };
}

export function CampaignPortfolioOverview({ 
  campaigns, 
  onTierFilterChange,
  activeTierFilter 
}: CampaignPortfolioOverviewProps) {
  const tierCounts = campaigns.reduce((acc, campaign) => {
    const { tier } = calculateCampaignScore(campaign);
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const tiers = [
    {
      key: 'star',
      icon: Star,
      label: 'STARS',
      count: tierCounts.star || 0,
      action: 'Scale these',
      colorClass: 'text-yellow-500',
      bgClass: 'bg-yellow-500/10',
      borderClass: 'border-yellow-500/30',
      activeClass: 'ring-2 ring-yellow-500'
    },
    {
      key: 'solid',
      icon: CheckCircle,
      label: 'SOLID',
      count: tierCounts.solid || 0,
      action: 'Maintain as-is',
      colorClass: 'text-success',
      bgClass: 'bg-success/10',
      borderClass: 'border-success/30',
      activeClass: 'ring-2 ring-success'
    },
    {
      key: 'optimize',
      icon: AlertTriangle,
      label: 'OPTIMIZE',
      count: tierCounts.optimize || 0,
      action: 'Fix issues',
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
      borderClass: 'border-warning/30',
      activeClass: 'ring-2 ring-warning'
    },
    {
      key: 'problem',
      icon: XCircle,
      label: 'PROBLEMS',
      count: tierCounts.problem || 0,
      action: 'Pause/Kill ASAP',
      colorClass: 'text-destructive',
      bgClass: 'bg-destructive/10',
      borderClass: 'border-destructive/30',
      activeClass: 'ring-2 ring-destructive'
    },
    {
      key: 'insufficient',
      icon: HelpCircle,
      label: 'NEEDS DATA',
      count: tierCounts.insufficient || 0,
      action: '<100 sends',
      colorClass: 'text-muted-foreground',
      bgClass: 'bg-muted/50',
      borderClass: 'border-muted',
      activeClass: 'ring-2 ring-muted-foreground'
    }
  ];

  const handleTierClick = (tierKey: string) => {
    if (onTierFilterChange) {
      onTierFilterChange(activeTierFilter === tierKey ? 'all' : tierKey);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">PORTFOLIO OVERVIEW — Click to filter</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {tiers.map(({ key, icon: Icon, label, count, action, colorClass, bgClass, borderClass, activeClass }) => (
            <div
              key={key}
              onClick={() => handleTierClick(key)}
              className={`rounded-lg border p-4 ${bgClass} ${borderClass} transition-all hover:scale-[1.02] cursor-pointer ${
                activeTierFilter === key ? activeClass : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${colorClass}`} />
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
              </div>
              <p className={`text-3xl font-bold ${colorClass}`}>{count}</p>
              <p className="text-xs text-muted-foreground mt-1">{action}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}