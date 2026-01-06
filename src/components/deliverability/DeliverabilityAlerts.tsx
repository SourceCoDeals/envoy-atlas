import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info,
  ArrowRight,
  X,
  Bell,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface DeliverabilityAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  metric?: string;
  trend?: 'up' | 'down';
  action?: {
    label: string;
    onClick: () => void;
  };
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
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No active alerts</p>
            <p className="text-sm">Your deliverability looks healthy</p>
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
      <CardContent className="space-y-3">
        {alerts.map(alert => (
          <div 
            key={alert.id}
            className={`p-4 border rounded-lg ${getAlertStyles(alert.type)}`}
          >
            <div className="flex items-start gap-3">
              {getAlertIcon(alert.type)}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium">{alert.title}</h4>
                  <div className="flex items-center gap-2">
                    {alert.metric && (
                      <Badge variant="outline" className="font-mono">
                        {alert.trend === 'up' && <TrendingUp className="h-3 w-3 mr-1 text-destructive" />}
                        {alert.trend === 'down' && <TrendingDown className="h-3 w-3 mr-1 text-success" />}
                        {alert.metric}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onDismiss(alert.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{alert.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted-foreground">{alert.timestamp}</span>
                  {alert.action && (
                    <Button variant="outline" size="sm" onClick={alert.action.onClick}>
                      {alert.action.label}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
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
