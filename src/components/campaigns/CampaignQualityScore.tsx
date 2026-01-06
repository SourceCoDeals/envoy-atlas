import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp, Shield, Activity, Zap, CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { CampaignWithMetrics } from '@/hooks/useCampaigns';
import { CampaignTier } from './CampaignPortfolioOverview';

interface CampaignQualityScoreProps {
  campaign: CampaignWithMetrics;
  tier: CampaignTier;
}

export function CampaignQualityScore({ campaign, tier }: CampaignQualityScoreProps) {
  const getTierBadge = () => {
    switch (tier.tier) {
      case 'star':
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30"><Star className="w-3 h-3 mr-1" />STAR PERFORMER</Badge>;
      case 'solid':
        return <Badge className="bg-success/20 text-success border-success/30"><CheckCircle className="w-3 h-3 mr-1" />SOLID</Badge>;
      case 'optimize':
        return <Badge className="bg-warning/20 text-warning border-warning/30"><AlertTriangle className="w-3 h-3 mr-1" />NEEDS OPTIMIZATION</Badge>;
      case 'problem':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30"><XCircle className="w-3 h-3 mr-1" />PROBLEM</Badge>;
      case 'insufficient':
        return <Badge variant="outline" className="text-muted-foreground"><HelpCircle className="w-3 h-3 mr-1" />INSUFFICIENT DATA</Badge>;
    }
  };

  const getConfidenceBadge = () => {
    switch (tier.confidence) {
      case 'high':
        return <Badge variant="outline" className="text-success border-success/30">High Confidence</Badge>;
      case 'good':
        return <Badge variant="outline" className="text-success/70 border-success/30">Good Confidence</Badge>;
      case 'medium':
        return <Badge variant="outline" className="text-warning border-warning/30">Medium Confidence</Badge>;
      case 'low':
        return <Badge variant="outline" className="text-warning/70 border-warning/30">Low Confidence</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">No Confidence</Badge>;
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
      case 'insufficient':
        return 'Not enough data to evaluate. Continue sending to gather at least 100 sends before analyzing.';
    }
  };

  const scoreComponents = [
    { 
      name: 'Efficiency', 
      score: tier.scoreBreakdown.efficiency, 
      max: 40, 
      icon: Zap, 
      description: 'Reply & positive rates' 
    },
    { 
      name: 'Reliability', 
      score: tier.scoreBreakdown.reliability, 
      max: 20, 
      icon: Shield, 
      description: 'Bounce rate' 
    },
    { 
      name: 'Health', 
      score: tier.scoreBreakdown.health, 
      max: 20, 
      icon: Activity, 
      description: 'Delivery consistency' 
    },
    { 
      name: 'Momentum', 
      score: tier.scoreBreakdown.momentum, 
      max: 20, 
      icon: TrendingUp, 
      description: 'Volume & scale' 
    },
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
            {tier.score !== null ? (
              <>
                <span className="text-5xl font-bold">{tier.score}</span>
                <span className="text-2xl text-muted-foreground">/100</span>
              </>
            ) : (
              <span className="text-3xl font-bold text-muted-foreground">—</span>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 mb-3">
            {getTierBadge()}
            {getConfidenceBadge()}
          </div>
          {tier.score !== null && <Progress value={tier.score} className="h-2 mb-4" />}
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
                <span className="font-mono">{score}/{max}</span>
              </div>
              <Progress value={(score / max) * 100} className="h-1.5" />
            </div>
          ))}
        </div>

        {/* Confidence Note */}
        {tier.confidence !== 'high' && tier.confidence !== 'good' && tier.score !== null && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
            <p className="text-warning font-medium">⚠️ Low confidence score</p>
            <p className="text-muted-foreground text-xs mt-1">
              Score has been adjusted down due to limited sample size ({campaign.total_sent.toLocaleString()} sends). 
              Continue sending to increase statistical confidence.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}