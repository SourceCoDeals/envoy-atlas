import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Activity, Shield, MessageSquare, Target, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

interface HealthScoreProps {
  deliverabilityScore: number;
  reputationScore: number;
  engagementScore: number;
  conversionScore: number;
}

interface HealthScoreData {
  bounceRate: number;
  spamRate: number;
  replyRate: number;
  positiveReplyRate: number;
  meetingRate?: number;
  deliveredRate: number;
}

// Calculate composite health score based on framework
export function calculateHealthScore(data: HealthScoreData): HealthScoreProps {
  // Deliverability Score: Based on delivered rate
  let deliverabilityScore = 40; // default
  if (data.deliveredRate >= 98) deliverabilityScore = 100;
  else if (data.deliveredRate >= 95) deliverabilityScore = 80;
  else if (data.deliveredRate >= 90) deliverabilityScore = 60;
  
  // Reputation Score: Start at 100, subtract for problems
  let reputationScore = 100;
  reputationScore -= (data.bounceRate * 10); // 2% bounce = -20
  reputationScore -= (data.spamRate * 100); // 0.1% spam = -10
  reputationScore = Math.max(0, Math.min(100, reputationScore));
  
  // Engagement Score: Reply rate relative to 8% target
  const targetReplyRate = 8;
  const engagementScore = Math.min(100, (data.replyRate / targetReplyRate) * 100);
  
  // Conversion Score: Positive reply rate relative to 3% target
  const targetPositiveRate = 3;
  const conversionScore = Math.min(100, (data.positiveReplyRate / targetPositiveRate) * 100);
  
  return {
    deliverabilityScore,
    reputationScore,
    engagementScore,
    conversionScore,
  };
}

export function getOverallHealthScore(scores: HealthScoreProps): number {
  // Weighted composite: Deliverability 30%, Reputation 25%, Engagement 25%, Conversion 20%
  return (
    scores.deliverabilityScore * 0.30 +
    scores.reputationScore * 0.25 +
    scores.engagementScore * 0.25 +
    scores.conversionScore * 0.20
  );
}

export function getHealthLevel(score: number): { level: 'healthy' | 'warning' | 'problem' | 'critical'; label: string; color: string } {
  if (score >= 85) return { level: 'healthy', label: 'Healthy', color: 'text-success' };
  if (score >= 70) return { level: 'warning', label: 'Warning', color: 'text-warning' };
  if (score >= 50) return { level: 'problem', label: 'Problems', color: 'text-orange-500' };
  return { level: 'critical', label: 'Critical', color: 'text-destructive' };
}

export function EmailHealthScore({ 
  deliverabilityScore, 
  reputationScore, 
  engagementScore, 
  conversionScore 
}: HealthScoreProps) {
  const overallScore = getOverallHealthScore({ deliverabilityScore, reputationScore, engagementScore, conversionScore });
  const health = getHealthLevel(overallScore);
  
  const components = [
    { 
      name: 'Deliverability', 
      score: deliverabilityScore, 
      icon: Activity, 
      description: 'Emails reaching inboxes',
      weight: '30%',
    },
    { 
      name: 'Reputation', 
      score: reputationScore, 
      icon: Shield, 
      description: 'Sender trust score',
      weight: '25%',
    },
    { 
      name: 'Engagement', 
      score: engagementScore, 
      icon: MessageSquare, 
      description: 'Reply rate vs target',
      weight: '25%',
    },
    { 
      name: 'Conversion', 
      score: conversionScore, 
      icon: Target, 
      description: 'Positive outcomes',
      weight: '20%',
    },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-success';
    if (score >= 70) return 'bg-warning';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-destructive';
  };

  const getHealthIcon = () => {
    if (health.level === 'healthy') return <CheckCircle className="h-5 w-5 text-success" />;
    if (health.level === 'warning') return <AlertTriangle className="h-5 w-5 text-warning" />;
    return <AlertCircle className="h-5 w-5 text-destructive" />;
  };

  const getActionText = () => {
    if (health.level === 'healthy') return 'Systems working. Focus on scaling and optimization.';
    if (health.level === 'warning') return 'One or more systems showing stress. Investigate before scaling.';
    if (health.level === 'problem') return 'Something is broken. Stop scaling, diagnose, fix.';
    return 'Pause sending. Major issues need immediate attention.';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Email Health Score
              {getHealthIcon()}
            </CardTitle>
            <CardDescription>Composite health of your email program</CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${health.color}`}>
              {Math.round(overallScore)}
            </div>
            <Badge 
              variant="outline" 
              className={`mt-1 ${
                health.level === 'healthy' ? 'border-success/50 bg-success/10 text-success' :
                health.level === 'warning' ? 'border-warning/50 bg-warning/10 text-warning' :
                'border-destructive/50 bg-destructive/10 text-destructive'
              }`}
            >
              {health.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {components.map(({ name, score, icon: Icon, description, weight }) => (
            <div key={name} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{name}</span>
                </div>
                <span className="text-muted-foreground text-xs">{weight}</span>
              </div>
              <Progress value={score} className={`h-2 ${getScoreColor(score)}`} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{description}</span>
                <span className="text-xs font-mono">{Math.round(score)}</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className={`p-3 rounded-lg text-sm ${
          health.level === 'healthy' ? 'bg-success/10 text-success' :
          health.level === 'warning' ? 'bg-warning/10 text-warning' :
          'bg-destructive/10 text-destructive'
        }`}>
          <p className="flex items-center gap-2">
            {getHealthIcon()}
            {getActionText()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
