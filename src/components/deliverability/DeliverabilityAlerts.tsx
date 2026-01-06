import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info,
  ArrowRight,
  X,
  Bell,
  TrendingUp,
  TrendingDown,
  CheckCircle,
} from 'lucide-react';

interface AlertCause {
  description: string;
  value?: string;
}

interface AlertAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'destructive';
}

export interface DeliverabilityAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  metric?: string;
  trend?: 'up' | 'down';
  threshold?: string;
  thresholdPercent?: number;
  causes?: AlertCause[];
  recommendations?: string[];
  actions?: AlertAction[];
  timestamp: string;
}

interface DeliverabilityAlertsProps {
  alerts: DeliverabilityAlert[];
  onDismiss: (id: string) => void;
}

export function DeliverabilityAlerts({ alerts, onDismiss }: DeliverabilityAlertsProps) {
  const getAlertIcon = (type: DeliverabilityAlert['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case 'info':
        return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const getAlertStyles = (type: DeliverabilityAlert['type']) => {
    switch (type) {
      case 'critical':
        return 'border-destructive/50 bg-destructive/5';
      case 'warning':
        return 'border-warning/50 bg-warning/5';
      case 'info':
        return 'border-primary/50 bg-primary/5';
    }
  };

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Deliverability Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 mb-3">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <p className="font-medium">No active alerts</p>
            <p className="text-sm text-muted-foreground">Your deliverability looks healthy</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Deliverability Alerts
          </CardTitle>
          <Badge variant="outline">{alerts.length} active</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.map(alert => (
          <div 
            key={alert.id}
            className={`p-4 border rounded-lg ${getAlertStyles(alert.type)}`}
          >
            <div className="flex items-start gap-3">
              {getAlertIcon(alert.type)}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{alert.title}</h4>
                  <div className="flex items-center gap-2">
                    {alert.metric && (
                      <Badge variant="outline" className="font-mono">
                        {alert.trend === 'up' && <TrendingUp className="h-3 w-3 mr-1 text-destructive" />}
                        {alert.trend === 'down' && <TrendingDown className="h-3 w-3 mr-1 text-success" />}
                        {alert.metric}
                      </Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDismiss(alert.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-3">{alert.description}</p>

                {alert.threshold && alert.thresholdPercent !== undefined && (
                  <div className="mb-3 p-2 bg-background/50 rounded">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Threshold: {alert.threshold}</span>
                      <span className={alert.thresholdPercent > 80 ? 'text-warning font-medium' : ''}>
                        {alert.thresholdPercent.toFixed(0)}% of limit
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(alert.thresholdPercent, 100)} 
                      className={`h-1.5 ${alert.thresholdPercent > 100 ? '[&>div]:bg-destructive' : alert.thresholdPercent > 80 ? '[&>div]:bg-warning' : ''}`}
                    />
                  </div>
                )}

                {alert.causes && alert.causes.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Likely causes:</p>
                    <ul className="text-sm space-y-1">
                      {alert.causes.map((cause, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-muted-foreground">•</span>
                          <span>{cause.description}</span>
                          {cause.value && <Badge variant="outline" className="text-xs font-mono">{cause.value}</Badge>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {alert.recommendations && alert.recommendations.length > 0 && (
                  <div className="mb-3 p-2 bg-background/50 rounded">
                    <p className="text-xs font-medium mb-1">Recommended actions:</p>
                    <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                      {alert.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                    </ol>
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">{alert.timestamp}</span>
                  {alert.actions && alert.actions.length > 0 && (
                    <div className="flex gap-2">
                      {alert.actions.map((action, i) => (
                        <Button key={i} variant={action.variant || 'outline'} size="sm" onClick={action.onClick}>
                          {action.label}
                          {i === alert.actions!.length - 1 && <ArrowRight className="h-3 w-3 ml-1" />}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
