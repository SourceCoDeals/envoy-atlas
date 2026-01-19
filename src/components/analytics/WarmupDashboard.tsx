import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Flame, Mail, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface WarmupAccount {
  email: string;
  warmup_enabled: boolean;
  warmup_status: string;
  warmup_reputation: number;
  warmup_sent_count: number;
  warmup_spam_count: number;
  daily_limit: number;
  current_daily_sent: number;
}

interface WarmupDashboardProps {
  accounts: WarmupAccount[];
  className?: string;
}

export function WarmupDashboard({ accounts, className }: WarmupDashboardProps) {
  const warmupEnabled = accounts.filter(a => a.warmup_enabled);
  const avgReputation = warmupEnabled.length > 0
    ? warmupEnabled.reduce((sum, a) => sum + (a.warmup_reputation || 0), 0) / warmupEnabled.length
    : 0;
  
  const totalSpamCount = accounts.reduce((sum, a) => sum + (a.warmup_spam_count || 0), 0);
  const totalWarmupSent = accounts.reduce((sum, a) => sum + (a.warmup_sent_count || 0), 0);
  const spamRate = totalWarmupSent > 0 ? (totalSpamCount / totalWarmupSent) * 100 : 0;

  const getStatusColor = (reputation: number) => {
    if (reputation >= 80) return 'text-green-500';
    if (reputation >= 60) return 'text-yellow-500';
    return 'text-destructive';
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'active':
      case 'in_progress':
        return <Badge variant="secondary">Warming</Badge>;
      case 'paused':
        return <Badge variant="outline">Paused</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Warmup Dashboard
            </CardTitle>
            <CardDescription>
              Email account warmup status and reputation
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={avgReputation >= 80 ? 'default' : avgReputation >= 60 ? 'secondary' : 'destructive'}>
              {avgReputation.toFixed(0)}% avg reputation
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <Mail className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{accounts.length}</div>
            <div className="text-xs text-muted-foreground">Total Accounts</div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <div className="text-2xl font-bold">{warmupEnabled.length}</div>
            <div className="text-xs text-muted-foreground">Warming</div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <div className="text-2xl font-bold">{totalWarmupSent.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Warmup Sent</div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <div className="text-2xl font-bold">{spamRate.toFixed(2)}%</div>
            <div className="text-xs text-muted-foreground">Spam Rate</div>
          </div>
        </div>

        {/* Account List */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Account Details</h4>
          
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No email accounts configured</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {accounts.map((account, idx) => (
                <div 
                  key={idx} 
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate max-w-[200px]">
                        {account.email}
                      </span>
                      {getStatusBadge(account.warmup_status)}
                    </div>
                    <div className={`text-lg font-bold ${getStatusColor(account.warmup_reputation)}`}>
                      {account.warmup_reputation || 0}%
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Reputation</span>
                      <span>{account.warmup_reputation || 0}%</span>
                    </div>
                    <Progress value={account.warmup_reputation || 0} className="h-1.5" />
                  </div>
                  
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Sent: {account.warmup_sent_count || 0}</span>
                    <span>Spam: {account.warmup_spam_count || 0}</span>
                    <span>Daily: {account.current_daily_sent || 0}/{account.daily_limit || 50}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spam Alert */}
        {spamRate > 1 && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <span className="font-medium">High Spam Rate Warning</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Your warmup spam rate of {spamRate.toFixed(2)}% is above the safe threshold. 
              Consider pausing campaigns and reviewing email content.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}