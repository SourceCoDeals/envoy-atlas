import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Database, 
  Users, 
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useDataQuality } from '@/hooks/useDataQuality';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface DataQualityCardProps {
  className?: string;
  showDetails?: boolean;
}

export function DataQualityCard({ className, showDetails = true }: DataQualityCardProps) {
  const { loading, metrics, syncStatuses, refetch } = useDataQuality();
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Quality
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-8 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Quality
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    if (score >= 60) return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  const getAlertBadgeVariant = (severity: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Quality
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {showDetails && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="flex items-center gap-4">
          {getScoreIcon(metrics.overallScore)}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Overall Score</span>
              <span className={cn("text-lg font-bold", getScoreColor(metrics.overallScore))}>
                {metrics.overallScore.toFixed(0)}%
              </span>
            </div>
            <Progress 
              value={metrics.overallScore} 
              className="h-2"
            />
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <ScoreItem 
            icon={<Users className="h-4 w-4" />}
            label="Contacts"
            score={metrics.scoreBreakdown.contactCompleteness}
          />
          <ScoreItem 
            icon={<MessageSquare className="h-4 w-4" />}
            label="Classification"
            score={metrics.scoreBreakdown.classificationRate}
          />
          <ScoreItem 
            icon={<Clock className="h-4 w-4" />}
            label="Sync Freshness"
            score={metrics.scoreBreakdown.syncFreshness}
          />
          <ScoreItem 
            icon={<Database className="h-4 w-4" />}
            label="Consistency"
            score={metrics.scoreBreakdown.dataConsistency}
          />
        </div>

        {/* Alerts */}
        {metrics.missingDataAlerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Issues</h4>
            {metrics.missingDataAlerts.slice(0, expanded ? undefined : 2).map(alert => (
              <Alert key={alert.id} variant={alert.severity === 'critical' || alert.severity === 'high' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="flex items-center gap-2">
                  {alert.title}
                  <Badge variant={getAlertBadgeVariant(alert.severity)}>
                    {alert.severity}
                  </Badge>
                </AlertTitle>
                <AlertDescription className="text-xs">
                  {alert.description}
                  {alert.suggestion && (
                    <span className="block mt-1 text-muted-foreground">
                      💡 {alert.suggestion}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            ))}
            {!expanded && metrics.missingDataAlerts.length > 2 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs"
                onClick={() => setExpanded(true)}
              >
                +{metrics.missingDataAlerts.length - 2} more issues
              </Button>
            )}
          </div>
        )}

        {/* Sync Statuses (expanded view) */}
        {expanded && syncStatuses.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Sync Status</h4>
            <div className="space-y-1">
              {syncStatuses.map(sync => (
                <div 
                  key={`${sync.sourceType}-${sync.sourceName}`}
                  className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                >
                  <span className="font-medium">{sync.sourceName}</span>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={
                        sync.status === 'healthy' ? 'default' : 
                        sync.status === 'stale' ? 'secondary' : 
                        'destructive'
                      }
                      className="text-xs"
                    >
                      {sync.status}
                    </Badge>
                    {sync.lastSyncAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(sync.lastSyncAt).toLocaleDateString()}
                      </span>
                    )}
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

function ScoreItem({ 
  icon, 
  label, 
  score 
}: { 
  icon: React.ReactNode; 
  label: string; 
  score: number;
}) {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className={cn("text-sm font-medium", getColor(score))}>
          {score.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

export default DataQualityCard;
