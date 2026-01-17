import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX,
  Mail,
  Globe,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react';
import type { DeliverabilityStats } from '@/hooks/useDeliverabilityData';

interface OverviewHealthScoreProps {
  stats: DeliverabilityStats;
  avgBounceRate?: number;
}

export function OverviewHealthScore({ stats, avgBounceRate }: OverviewHealthScoreProps) {
  // Calculate overall health score (0-100, higher is better)
  const calculateHealthScore = () => {
    let score = 100;
    
    // Bounce rate penalty (max -30 points)
    const bounceRate = avgBounceRate ?? stats.avgBounceRate;
    if (bounceRate > 10) score -= 30;
    else if (bounceRate > 5) score -= 20;
    else if (bounceRate > 2) score -= 10;
    else if (bounceRate > 1) score -= 5;
    
    // Auth penalty (max -25 points)
    const authRate = stats.totalDomains > 0 
      ? (stats.domainsWithFullAuth / stats.totalDomains) * 100 
      : 0;
    score -= (100 - authRate) * 0.25;
    
    // Blacklist penalty (max -25 points)
    if (stats.blacklistedDomains > 0) {
      score -= Math.min(25, stats.blacklistedDomains * 10);
    }
    
    // Critical alerts penalty (max -20 points)
    score -= Math.min(20, stats.criticalAlerts * 5);
    score -= Math.min(10, stats.warningAlerts * 2);
    
    return Math.max(0, Math.round(score));
  };

  const healthScore = calculateHealthScore();
  
  const getHealthLevel = (score: number): 'healthy' | 'low' | 'medium' | 'high' | 'critical' => {
    if (score >= 85) return 'healthy';
    if (score >= 70) return 'low';
    if (score >= 50) return 'medium';
    if (score >= 30) return 'high';
    return 'critical';
  };

  const healthLevel = getHealthLevel(healthScore);
  
  const getHealthColor = (level: string) => {
    switch (level) {
      case 'healthy':
      case 'low':
        return 'text-success';
      case 'medium':
        return 'text-warning';
      case 'high':
        return 'text-orange-500';
      case 'critical':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getHealthIcon = () => {
    switch (healthLevel) {
      case 'healthy':
      case 'low':
        return <ShieldCheck className="h-12 w-12 text-success" />;
      case 'medium':
        return <Shield className="h-12 w-12 text-warning" />;
      case 'high':
        return <ShieldAlert className="h-12 w-12 text-orange-500" />;
      case 'critical':
        return <ShieldX className="h-12 w-12 text-destructive" />;
      default:
        return <Shield className="h-12 w-12" />;
    }
  };

  // Component scores (out of 25 each)
  const bounceScore = Math.max(0, 25 - ((avgBounceRate ?? stats.avgBounceRate) * 2.5));
  const authScore = stats.totalDomains > 0 
    ? (stats.domainsWithFullAuth / stats.totalDomains) * 25 
    : 0;
  const reputationScore = stats.blacklistedDomains === 0 ? 25 : Math.max(0, 25 - (stats.blacklistedDomains * 8));
  const mailboxScore = stats.totalMailboxes > 0 
    ? Math.min(25, (stats.avgHealthScore / 4)) 
    : 0;

  const componentItems = [
    { label: 'Bounce Health', value: bounceScore, max: 25, icon: TrendingDown },
    { label: 'Authentication', value: authScore, max: 25, icon: Shield },
    { label: 'Reputation', value: reputationScore, max: 25, icon: Activity },
    { label: 'Mailbox Health', value: mailboxScore, max: 25, icon: Mail },
  ];

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Infrastructure Health Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Score Display */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center justify-center w-36 h-36 rounded-full border-4 border-muted bg-muted/20 relative">
            {getHealthIcon()}
            <span className={`text-4xl font-bold mt-1 ${getHealthColor(healthLevel)}`}>
              {healthScore}
            </span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
          
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className={`text-2xl font-bold capitalize ${getHealthColor(healthLevel)}`}>
                {healthLevel === 'healthy' ? 'Healthy' : 
                 healthLevel === 'low' ? 'Good' :
                 healthLevel === 'medium' ? 'Needs Attention' :
                 healthLevel === 'high' ? 'At Risk' : 'Critical'}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Mailboxes</span>
                </div>
                <p className="text-lg font-semibold">{stats.totalMailboxes}</p>
              </div>
              <div className="p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Domains</span>
                </div>
                <p className="text-lg font-semibold">{stats.totalDomains}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Component Breakdown */}
        <div>
          <h4 className="text-sm font-medium mb-3">Health Components</h4>
          <div className="space-y-3">
            {componentItems.map(item => {
              const Icon = item.icon;
              const percentage = (item.value / item.max) * 100;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{item.label}</span>
                    </div>
                    <span className={
                      percentage >= 70 ? 'text-success' : 
                      percentage >= 40 ? 'text-warning' : 
                      'text-destructive'
                    }>
                      {Math.round(item.value)}/{item.max}
                    </span>
                  </div>
                  <Progress 
                    value={percentage} 
                    className="h-2"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div className="text-center p-2">
            <p className="text-2xl font-bold tabular-nums">{stats.totalDailyCapacity.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Daily Capacity</p>
          </div>
          <div className="text-center p-2">
            <p className="text-2xl font-bold tabular-nums">{stats.warmingUpCount}</p>
            <p className="text-xs text-muted-foreground">Warming Up</p>
          </div>
        </div>

        {/* Alerts Summary */}
        {(stats.criticalAlerts > 0 || stats.warningAlerts > 0) && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium">Active Alerts</p>
              <div className="flex gap-2 mt-1">
                {stats.criticalAlerts > 0 && (
                  <Badge variant="destructive">{stats.criticalAlerts} Critical</Badge>
                )}
                {stats.warningAlerts > 0 && (
                  <Badge className="bg-warning/20 text-warning border-warning/30">
                    {stats.warningAlerts} Warning
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
