import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAlerts } from '@/hooks/useAlerts';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Bell,
  Loader2,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Check,
  AlertCircle,
  Info,
  Target,
  Settings,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Alerts() {
  const { 
    unresolvedAlerts, 
    resolvedAlerts, 
    criticalCount, 
    highCount, 
    totalUnresolved,
    isLoading, 
    refetch,
    resolveAlert,
    isResolving,
  } = useAlerts();
  const { config, isLoading: configLoading } = useCallingConfig();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (alertId: string) => {
    setResolvingId(alertId);
    resolveAlert(alertId);
    setResolvingId(null);
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          icon: XCircle,
          bgColor: 'bg-destructive/10',
          borderColor: 'border-destructive/30',
          iconColor: 'text-destructive',
          badgeClass: 'bg-destructive text-destructive-foreground',
        };
      case 'high':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-warning/10',
          borderColor: 'border-warning/30',
          iconColor: 'text-warning',
          badgeClass: 'bg-warning text-warning-foreground',
        };
      case 'medium':
        return {
          icon: AlertCircle,
          bgColor: 'bg-chart-4/10',
          borderColor: 'border-chart-4/30',
          iconColor: 'text-chart-4',
          badgeClass: 'bg-chart-4 text-chart-4-foreground',
        };
      default:
        return {
          icon: Info,
          bgColor: 'bg-muted',
          borderColor: 'border-muted-foreground/30',
          iconColor: 'text-muted-foreground',
          badgeClass: 'bg-muted text-muted-foreground',
        };
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'bounce_spike': return 'Bounce Spike';
      case 'stalled': return 'Stalled Campaign';
      case 'reply_drop': return 'Reply Drop';
      case 'deliverability': return 'Deliverability Issue';
      case 'opportunity': return 'Opportunity';
      case 'coaching_needed': return 'Coaching Needed';
      case 'low_quality': return 'Low Quality';
      case 'hot_lead': return 'Hot Lead';
      default: return type;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'opportunity': 
      case 'hot_lead':
        return Target;
      default: 
        return AlertTriangle;
    }
  };

  const loading = isLoading || configLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
            <p className="text-muted-foreground">
              Monitor issues and opportunities across your campaigns
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings?tab=calling">
                <Settings className="h-4 w-4 mr-2" />
                Thresholds
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Alert Thresholds Info */}
        <Card className="bg-muted/30">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-muted-foreground font-medium">Coaching Triggers:</span>
              <span>Quality &lt;{config.coachingAlertOverallQuality}</span>
              <span>Objections &lt;{config.coachingAlertObjectionHandling}</span>
              <span>Script &lt;{config.coachingAlertScriptAdherence}</span>
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground font-medium">Hot Lead:</span>
              <span>Interest ≥{config.hotLeadInterestScore}</span>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Active</p>
                  <p className="text-2xl font-bold">{totalUnresolved}</p>
                </div>
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className={criticalCount > 0 ? 'border-destructive/50' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical</p>
                  <p className={cn("text-2xl font-bold", criticalCount > 0 && "text-destructive")}>
                    {criticalCount}
                  </p>
                </div>
                <XCircle className={cn("h-8 w-8", criticalCount > 0 ? "text-destructive" : "text-muted-foreground")} />
              </div>
            </CardContent>
          </Card>
          <Card className={highCount > 0 ? 'border-warning/50' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">High Priority</p>
                  <p className={cn("text-2xl font-bold", highCount > 0 && "text-warning")}>
                    {highCount}
                  </p>
                </div>
                <AlertTriangle className={cn("h-8 w-8", highCount > 0 ? "text-warning" : "text-muted-foreground")} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolved Today</p>
                  <p className="text-2xl font-bold text-success">
                    {resolvedAlerts.filter(a => {
                      const resolvedDate = a.resolved_at ? new Date(a.resolved_at) : null;
                      if (!resolvedDate) return false;
                      const today = new Date();
                      return resolvedDate.toDateString() === today.toDateString();
                    }).length}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">
                Active
                {totalUnresolved > 0 && (
                  <Badge variant="secondary" className="ml-2">{totalUnresolved}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-3 mt-4">
              {unresolvedAlerts.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">All Clear!</h2>
                    <p className="text-muted-foreground text-center max-w-md">
                      No active alerts. Your campaigns are running smoothly.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                unresolvedAlerts.map((alert) => {
                  const alertConfig = getSeverityConfig(alert.severity);
                  const Icon = alertConfig.icon;
                  const TypeIcon = getTypeIcon(alert.type);

                  return (
                    <Card 
                      key={alert.id} 
                      className={cn("border", alertConfig.bgColor, alertConfig.borderColor)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start gap-4">
                          <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", alertConfig.iconColor)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge className={cn("text-[10px]", alertConfig.badgeClass)}>
                                {alert.severity.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {getTypeLabel(alert.type)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="font-medium text-sm">{alert.message}</p>
                            {alert.campaign_name && (
                              <Link 
                                to={`/campaigns/${alert.campaign_id}`}
                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                              >
                                View {alert.campaign_name}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolve(alert.id)}
                            disabled={isResolving || resolvingId === alert.id}
                            className="shrink-0"
                          >
                            {resolvingId === alert.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Resolve
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="resolved" className="space-y-3 mt-4">
              {resolvedAlerts.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">No resolved alerts yet.</p>
                  </CardContent>
                </Card>
              ) : (
                resolvedAlerts.slice(0, 20).map((alert) => (
                  <Card key={alert.id} className="opacity-70">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-success" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className="text-[10px]">
                              {getTypeLabel(alert.type)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Resolved {alert.resolved_at ? formatDistanceToNow(new Date(alert.resolved_at), { addSuffix: true }) : ''}
                            </span>
                          </div>
                          <p className="font-medium text-sm line-through text-muted-foreground">
                            {alert.message}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
