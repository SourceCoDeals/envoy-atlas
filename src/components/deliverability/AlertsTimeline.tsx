import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  X, 
  Clock,
  CheckCircle,
  TrendingUp,
  Shield,
  Mail,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { DeliverabilityAlert } from '@/hooks/useDeliverabilityData';

interface AlertsTimelineProps {
  alerts: DeliverabilityAlert[];
  onDismiss: (id: string) => void;
  onMarkRead?: (id: string) => void;
  maxHeight?: string;
}

export function AlertsTimeline({ alerts, onDismiss, onMarkRead, maxHeight = '500px' }: AlertsTimelineProps) {
  const getSeverityIcon = (severity: DeliverabilityAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'info':
        return <Info className="h-5 w-5 text-info" />;
    }
  };

  const getSeverityBadge = (severity: DeliverabilityAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">CRITICAL</Badge>;
      case 'warning':
        return <Badge className="bg-warning/20 text-warning border-warning/30">WARNING</Badge>;
      case 'info':
        return <Badge className="bg-info/20 text-info border-info/30">INFO</Badge>;
    }
  };

  const getAlertTypeIcon = (alertType: string) => {
    switch (alertType) {
      case 'bounce_rate':
        return <TrendingUp className="h-4 w-4" />;
      case 'spam_complaint':
        return <AlertTriangle className="h-4 w-4" />;
      case 'blacklist':
        return <Shield className="h-4 w-4" />;
      case 'auth_failure':
        return <Shield className="h-4 w-4" />;
      case 'warmup_stalled':
        return <Clock className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const infoCount = alerts.filter(a => a.severity === 'info').length;

  // Group alerts by date
  const groupedAlerts = alerts.reduce((acc, alert) => {
    const date = new Date(alert.createdAt).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(alert);
    return acc;
  }, {} as Record<string, DeliverabilityAlert[]>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Deliverability Alerts ({alerts.length})
          </CardTitle>
          <div className="flex gap-1">
            {criticalCount > 0 && (
              <Badge variant="destructive">{criticalCount} critical</Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-warning/20 text-warning border-warning/30">
                {warningCount} warning
              </Badge>
            )}
            {infoCount > 0 && (
              <Badge variant="outline">{infoCount} info</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mb-3 text-success" />
            <p className="text-lg font-medium">All Clear</p>
            <p className="text-sm">No active deliverability alerts</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }} className="pr-4">
            <div className="space-y-6">
              {Object.entries(groupedAlerts).map(([date, dateAlerts]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">{date}</span>
                  </div>
                  <div className="space-y-3 pl-6 border-l-2 border-muted">
                    {dateAlerts.map((alert) => (
                      <div 
                        key={alert.id}
                        className={`relative p-4 rounded-lg border transition-colors ${
                          alert.severity === 'critical' 
                            ? 'border-destructive/50 bg-destructive/5' 
                            : alert.severity === 'warning'
                            ? 'border-warning/50 bg-warning/5'
                            : 'border-border bg-muted/30'
                        } ${!alert.isRead ? 'ring-1 ring-primary/30' : ''}`}
                        onClick={() => !alert.isRead && onMarkRead?.(alert.id)}
                      >
                        {/* Timeline dot */}
                        <div className={`absolute -left-[calc(1.5rem+5px)] w-2.5 h-2.5 rounded-full ${
                          alert.severity === 'critical' ? 'bg-destructive' :
                          alert.severity === 'warning' ? 'bg-warning' :
                          'bg-muted-foreground'
                        }`} />
                        
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            {getSeverityIcon(alert.severity)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {getSeverityBadge(alert.severity)}
                                {!alert.isRead && (
                                  <Badge variant="outline" className="text-xs">New</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                              <h4 className="font-medium text-sm mb-1">{alert.title}</h4>
                              <p className="text-sm text-muted-foreground">{alert.message}</p>
                              
                              {(alert.metricValue !== null || alert.entityName) && (
                                <div className="flex items-center gap-3 mt-2 text-xs">
                                  {alert.metricValue !== null && alert.thresholdValue !== null && (
                                    <span className="flex items-center gap-1">
                                      {getAlertTypeIcon(alert.alertType)}
                                      <span className="text-destructive font-medium">
                                        {alert.metricValue.toFixed(2)}%
                                      </span>
                                      <span className="text-muted-foreground">
                                        (threshold: {alert.thresholdValue}%)
                                      </span>
                                    </span>
                                  )}
                                  {alert.entityName && (
                                    <span className="text-muted-foreground">
                                      {alert.entityType}: {alert.entityName}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismiss(alert.id);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
