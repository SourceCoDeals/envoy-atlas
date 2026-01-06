import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp, Shield, Activity, Zap } from 'lucide-react';
import { CampaignWithMetrics } from '@/hooks/useCampaigns';
import { CampaignTier } from './CampaignPortfolioOverview';

interface CampaignQualityScoreProps {
  campaign: CampaignWithMetrics;
  tier: CampaignTier;
}

export function CampaignQualityScore({ campaign, tier }: CampaignQualityScoreProps) {
  const replyRateBenchmark = 2.8;
  
  // Calculate component scores
  const efficiencyScore = Math.min((campaign.reply_rate / replyRateBenchmark) * 20 + (campaign.reply_rate * 0.4) * 4, 40);
  const reliabilityScore = campaign.bounce_rate < 2 ? 20 : campaign.bounce_rate < 3 ? 15 : campaign.bounce_rate < 5 ? 10 : 0;
  const deliveryRate = ((campaign.total_sent - (campaign.total_bounced || 0)) / campaign.total_sent) * 100;
  const healthScore = Math.min(deliveryRate / 5, 20);
  const momentumScore = campaign.total_sent > 1000 ? 20 : campaign.total_sent > 500 ? 15 : campaign.total_sent > 100 ? 10 : 5;

  const getTierBadge = () => {
    switch (tier.tier) {
      case 'star':
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30"><Star className="w-3 h-3 mr-1" />STAR PERFORMER</Badge>;
      case 'solid':
        return <Badge className="bg-success/20 text-success border-success/30">SOLID</Badge>;
      case 'optimize':
        return <Badge className="bg-warning/20 text-warning border-warning/30">NEEDS OPTIMIZATION</Badge>;
      case 'problem':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">PROBLEM</Badge>;
    }
  };

  const getRecommendation = () => {
    switch (tier.tier) {
      case 'star':
        return 'This campaign significantly outperforms benchmarks. Consider increasing volume by 25-50%.';
      case 'solid':
        return 'Performing well. Maintain current approach and monitor for any changes.';
      case 'optimize':
        return 'Below target performance. Review copy, audience targeting, and send timing.';
      case 'problem':
        return 'Significantly underperforming. Consider pausing and analyzing root cause before continuing.';
    }
  };

  const scoreComponents = [
    { name: 'Efficiency', score: efficiencyScore, max: 40, icon: Zap, description: 'Reply & positive rates' },
    { name: 'Reliability', score: reliabilityScore, max: 20, icon: Shield, description: 'Bounce rate' },
    { name: 'Health', score: healthScore, max: 20, icon: Activity, description: 'Delivery consistency' },
    { name: 'Momentum', score: momentumScore, max: 20, icon: TrendingUp, description: 'Volume & engagement' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quality Score</CardTitle>
        <CardDescription>Campaign performance rating</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Score */}
        <div className="text-center p-6 rounded-lg bg-muted/50">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-5xl font-bold">{Math.round(tier.score)}</span>
            <span className="text-2xl text-muted-foreground">/100</span>
          </div>
          <div className="mb-3">{getTierBadge()}</div>
          <Progress value={tier.score} className="h-2 mb-4" />
          <p className="text-sm text-muted-foreground">
            <strong>Recommendation: {tier.recommendation}</strong>
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            "{getRecommendation()}"
          </p>
        </div>

        {/* Score Components */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Score Components</h4>
          {scoreComponents.map(({ name, score, max, icon: Icon, description }) => (
            <div key={name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{name}</span>
                  <span className="text-xs text-muted-foreground">({description})</span>
                </div>
                <span className="font-mono">{Math.round(score)}/{max}</span>
              </div>
              <Progress value={(score / max) * 100} className="h-1.5" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
