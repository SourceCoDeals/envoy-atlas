import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';

interface RiskFactor {
  factor: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  value?: number | string;
}

interface RiskComponents {
  bounceRisk: number;
  complaintRisk: number;
  reputationRisk: number;
  authRisk: number;
}

interface DeliverabilityRiskScoreProps {
  riskScore: number; // 0-100, lower is better
  riskLevel: 'healthy' | 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  components: RiskComponents;
  trend: 'improving' | 'stable' | 'declining';
  trendValue: number;
}

export function DeliverabilityRiskScore({
  riskScore,
  riskLevel,
  riskFactors,
  components,
  trend,
  trendValue,
}: DeliverabilityRiskScoreProps) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'healthy':
        return 'text-success';
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

  const getRiskIcon = () => {
    switch (riskLevel) {
      case 'healthy':
      case 'low':
        return <ShieldCheck className="h-8 w-8 text-success" />;
      case 'medium':
        return <Shield className="h-8 w-8 text-warning" />;
      case 'high':
        return <ShieldAlert className="h-8 w-8 text-orange-500" />;
      case 'critical':
        return <ShieldX className="h-8 w-8 text-destructive" />;
      default:
        return <Shield className="h-8 w-8" />;
    }
  };

  const getSeverityBadge = (severity: RiskFactor['severity']) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">CRITICAL</Badge>;
      case 'high':
        return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">HIGH</Badge>;
      case 'medium':
        return <Badge className="bg-warning/20 text-warning border-warning/30">MEDIUM</Badge>;
      case 'low':
        return <Badge variant="outline">LOW</Badge>;
    }
  };

  const componentItems = [
    { label: 'Bounce Risk', value: components.bounceRisk, max: 25 },
    { label: 'Complaint Risk', value: components.complaintRisk, max: 30 },
    { label: 'Reputation Risk', value: components.reputationRisk, max: 25 },
    { label: 'Authentication Risk', value: components.authRisk, max: 20 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Deliverability Risk Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Score Display */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center justify-center w-32 h-32 rounded-full border-4 border-muted relative">
            {getRiskIcon()}
            <span className={`text-3xl font-bold mt-1 ${getRiskColor(riskLevel)}`}>
              {riskScore}
            </span>
            <span className="text-xs text-muted-foreground">/100 risk</span>
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Risk Level</p>
                <p className={`text-2xl font-bold capitalize ${getRiskColor(riskLevel)}`}>
                  {riskLevel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">7-day Trend</p>
                <div className={`flex items-center gap-1 ${
                  trend === 'improving' ? 'text-success' : trend === 'declining' ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {trend === 'improving' ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : trend === 'declining' ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : null}
                  <span className="font-medium">
                    {trend === 'improving' ? '-' : trend === 'declining' ? '+' : ''}{Math.abs(trendValue)} pts
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Safe</span>
                <span>At Risk</span>
              </div>
              <Progress 
                value={riskScore} 
                className="h-3"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              {riskLevel === 'healthy' || riskLevel === 'low' ? (
                "Your deliverability is healthy. Continue monitoring key metrics."
              ) : riskLevel === 'medium' ? (
                "Some areas need attention. Review the risk factors below."
              ) : riskLevel === 'high' ? (
                "Multiple risk factors detected. Take action to prevent issues."
              ) : (
                "Critical risk level. Immediate action required to prevent blacklisting."
              )}
            </p>
          </div>
        </div>

        {/* Component Breakdown */}
        <div>
          <h4 className="text-sm font-medium mb-3">Risk Components</h4>
          <div className="space-y-3">
            {componentItems.map(item => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className={item.value > item.max * 0.7 ? 'text-destructive' : item.value > item.max * 0.4 ? 'text-warning' : 'text-success'}>
                    {item.value}/{item.max}
                  </span>
                </div>
                <Progress 
                  value={(item.value / item.max) * 100} 
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Risk Factors */}
        {riskFactors.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Active Risk Factors
            </h4>
            <div className="space-y-2">
              {riskFactors.slice(0, 5).map((factor, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                >
                  <span className="text-sm">{factor.factor}</span>
                  <div className="flex items-center gap-2">
                    {factor.value !== undefined && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {typeof factor.value === 'number' ? `${(factor.value * 100).toFixed(2)}%` : factor.value}
                      </span>
                    )}
                    {getSeverityBadge(factor.severity)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
