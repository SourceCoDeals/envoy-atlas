import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Mail, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Flame,
  ChevronRight,
} from 'lucide-react';

interface EmailAccount {
  email: string;
  status: 'healthy' | 'warning' | 'critical' | 'warming';
  healthScore: number;
  sent7d: number;
  dailyLimit: number;
  issues: string[];
  warmupDay?: number;
  warmupTotal?: number;
}

interface EmailAccountHealthProps {
  accounts: EmailAccount[];
  onViewAccount?: (email: string) => void;
}

export function EmailAccountHealth({ accounts, onViewAccount }: EmailAccountHealthProps) {
  const getStatusIcon = (status: EmailAccount['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warming':
        return <Flame className="h-4 w-4 text-orange-500" />;
    }
  };

  const getStatusBadge = (status: EmailAccount['status']) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-success/20 text-success border-success/30">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Warning</Badge>;
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warming':
        return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">Warming</Badge>;
    }
  };

  const healthyCount = accounts.filter(a => a.status === 'healthy').length;
  const warningCount = accounts.filter(a => a.status === 'warning').length;
  const criticalCount = accounts.filter(a => a.status === 'critical').length;
  const warmingCount = accounts.filter(a => a.status === 'warming').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Account Health
          </CardTitle>
          <div className="flex gap-1">
            {healthyCount > 0 && (
              <Badge variant="outline" className="text-success border-success/30">
                {healthyCount} healthy
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="text-warning border-warning/30">
                {warningCount} warning
              </Badge>
            )}
            {criticalCount > 0 && (
              <Badge variant="outline" className="text-destructive border-destructive/30">
                {criticalCount} critical
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {accounts.map((account) => (
            <div 
              key={account.email}
              className={`p-3 border rounded-lg ${
                account.status === 'critical' ? 'border-destructive/50 bg-destructive/5' :
                account.status === 'warning' ? 'border-warning/50 bg-warning/5' :
                account.status === 'warming' ? 'border-orange-500/50 bg-orange-500/5' :
                'border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(account.status)}
                  <span className="font-medium text-sm">{account.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(account.status)}
                  {onViewAccount && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => onViewAccount(account.email)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Health Score</p>
                  <div className="flex items-center gap-2">
                    <Progress value={account.healthScore} className="h-1.5 flex-1" />
                    <span className="font-medium">{account.healthScore}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sent (7d)</p>
                  <p className="font-medium">{account.sent7d.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Daily Limit</p>
                  <p className="font-medium">{account.dailyLimit}/day</p>
                </div>
              </div>

              {account.status === 'warming' && account.warmupDay && account.warmupTotal && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Warmup Progress</span>
                    <span className="font-medium">Day {account.warmupDay}/{account.warmupTotal}</span>
                  </div>
                  <Progress value={(account.warmupDay / account.warmupTotal) * 100} className="h-1.5 mt-1" />
                </div>
              )}

              {account.issues.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Issues</p>
                  <div className="flex flex-wrap gap-1">
                    {account.issues.map((issue, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {issue}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {accounts.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No email accounts connected</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
