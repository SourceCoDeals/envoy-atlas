import { Card, CardContent } from '@/components/ui/card';
import { Star, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { CampaignWithMetrics } from '@/hooks/useCampaigns';

interface CampaignPortfolioOverviewProps {
  campaigns: CampaignWithMetrics[];
}

export interface CampaignTier {
  tier: 'star' | 'solid' | 'optimize' | 'problem';
  score: number;
  recommendation: string;
}

export function calculateCampaignScore(campaign: CampaignWithMetrics): CampaignTier {
  let score = 0;
  
  // Efficiency (40 points max) - based on reply rate and positive rate
  const replyRateBenchmark = 2.8; // Industry average
  const replyRateScore = Math.min((campaign.reply_rate / replyRateBenchmark) * 20, 20);
  
  // Assume positive rate is roughly 40% of replies for estimation
  const estimatedPositiveRate = campaign.reply_rate * 0.4;
  const positiveRateScore = Math.min(estimatedPositiveRate * 4, 20);
  
  score += replyRateScore + positiveRateScore;
  
  // Reliability (20 points max) - based on bounce rate
  const bounceScore = campaign.bounce_rate < 2 ? 20 : 
                      campaign.bounce_rate < 3 ? 15 :
                      campaign.bounce_rate < 5 ? 10 : 0;
  score += bounceScore;
  
  // Health (20 points max) - delivery and consistency
  const deliveryRate = ((campaign.total_sent - (campaign.total_bounced || 0)) / campaign.total_sent) * 100;
  const healthScore = Math.min(deliveryRate / 5, 20);
  score += healthScore;
  
  // Momentum (20 points max) - volume consistency
  const volumeScore = campaign.total_sent > 1000 ? 20 : 
                      campaign.total_sent > 500 ? 15 :
                      campaign.total_sent > 100 ? 10 : 5;
  score += volumeScore;
  
  // Determine tier
  if (score >= 75) {
    return { tier: 'star', score, recommendation: 'Scale' };
  } else if (score >= 55) {
    return { tier: 'solid', score, recommendation: 'Maintain' };
  } else if (score >= 35) {
    return { tier: 'optimize', score, recommendation: 'Optimize' };
  } else {
    return { tier: 'problem', score, recommendation: 'Pause' };
  }
}

export function CampaignPortfolioOverview({ campaigns }: CampaignPortfolioOverviewProps) {
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
      borderClass: 'border-yellow-500/30'
    },
    {
      key: 'solid',
      icon: CheckCircle,
      label: 'SOLID',
      count: tierCounts.solid || 0,
      action: 'Maintain as-is',
      colorClass: 'text-success',
      bgClass: 'bg-success/10',
      borderClass: 'border-success/30'
    },
    {
      key: 'optimize',
      icon: AlertTriangle,
      label: 'OPTIMIZE',
      count: tierCounts.optimize || 0,
      action: 'Fix issues',
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
      borderClass: 'border-warning/30'
    },
    {
      key: 'problem',
      icon: XCircle,
      label: 'PROBLEMS',
      count: tierCounts.problem || 0,
      action: 'Pause/Kill ASAP',
      colorClass: 'text-destructive',
      bgClass: 'bg-destructive/10',
      borderClass: 'border-destructive/30'
    }
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">PORTFOLIO OVERVIEW</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tiers.map(({ key, icon: Icon, label, count, action, colorClass, bgClass, borderClass }) => (
            <div
              key={key}
              className={`rounded-lg border p-4 ${bgClass} ${borderClass} transition-all hover:scale-[1.02]`}
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
