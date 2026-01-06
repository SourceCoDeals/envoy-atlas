import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Globe, Mail, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { InfrastructureStats, MonthlyMetrics } from '@/hooks/useMonthlyReportData';

interface InfrastructureHealthProps {
  infrastructure: InfrastructureStats;
  currentMetrics: MonthlyMetrics;
}

export function InfrastructureHealth({ infrastructure, currentMetrics }: InfrastructureHealthProps) {
  const monthlyCapacity = infrastructure.totalDailyCapacity * 30;
  const utilization = monthlyCapacity > 0 ? (currentMetrics.sent / monthlyCapacity) * 100 : 0;

  const AuthStatus = ({ label, valid, total }: { label: string; valid: number; total: number }) => {
    const percentage = total > 0 ? (valid / total) * 100 : 0;
    const isHealthy = percentage >= 80;
    const isWarning = percentage >= 50 && percentage < 80;
    
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isHealthy ? 'text-[hsl(var(--success))]' : isWarning ? 'text-[hsl(var(--warning))]' : 'text-destructive'}`}>
            {valid}/{total}
          </span>
          {isHealthy ? (
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Sending Domains */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" />
            Sending Domains
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Domains</span>
            <Badge variant="secondary" className="tabular-nums">
              {infrastructure.totalDomains}
            </Badge>
          </div>
          
          <div className="border-t border-border pt-3 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Authentication Status
            </p>
            <AuthStatus label="SPF Valid" valid={infrastructure.domainsWithSpf} total={infrastructure.totalDomains} />
            <AuthStatus label="DKIM Valid" valid={infrastructure.domainsWithDkim} total={infrastructure.totalDomains} />
            <AuthStatus label="DMARC Valid" valid={infrastructure.domainsWithDmarc} total={infrastructure.totalDomains} />
          </div>

          {infrastructure.domainsWithSpf === 0 && infrastructure.domainsWithDkim === 0 && (
            <div className="bg-[hsl(var(--warning)/0.1)] border border-[hsl(var(--warning)/0.3)] rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-[hsl(var(--warning))] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--warning))]">Authentication Not Configured</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add SPF, DKIM, and DMARC records to improve inbox placement.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Accounts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" />
            Email Accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Mailboxes</p>
              <p className="text-2xl font-bold tabular-nums">{infrastructure.totalMailboxes}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold tabular-nums text-[hsl(var(--success))]">
                {infrastructure.activeMailboxes}
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Monthly Capacity</span>
              <span className="font-medium tabular-nums">{monthlyCapacity.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Utilization</span>
              <span className={`font-medium tabular-nums ${utilization >= 80 ? 'text-[hsl(var(--warning))]' : 'text-foreground'}`}>
                {utilization.toFixed(1)}%
              </span>
            </div>
            <Progress value={utilization} className="h-2" />
          </div>

          <div className="flex items-center justify-between text-sm pt-2">
            <span className="text-muted-foreground">Warmup Enabled</span>
            <Badge variant={infrastructure.warmupEnabled > 0 ? 'default' : 'secondary'}>
              {infrastructure.warmupEnabled} / {infrastructure.totalMailboxes}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
