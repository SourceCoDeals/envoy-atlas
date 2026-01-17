import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { 
  Mail, 
  ChevronDown, 
  ChevronUp, 
  Server, 
  Flame,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { InboxHealth, DomainHealth } from '@/hooks/useCampaignSummary';

interface CampaignInfrastructureProps {
  inboxes: InboxHealth[];
  domains: DomainHealth[];
  totalDailyCapacity: number;
  warmupCount: number;
}

export function CampaignInfrastructure({ 
  inboxes, 
  domains, 
  totalDailyCapacity, 
  warmupCount 
}: CampaignInfrastructureProps) {
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [isDomainOpen, setIsDomainOpen] = useState(false);

  const activeInboxes = inboxes.filter(i => i.is_active).length;
  const avgHealthScore = inboxes.length > 0 
    ? inboxes.reduce((s, i) => s + (i.health_score || 0), 0) / inboxes.length 
    : 0;

  const getHealthColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getAuthIcon = (valid: boolean | null) => {
    if (valid === true) return <CheckCircle className="h-4 w-4 text-success" />;
    if (valid === false) return <XCircle className="h-4 w-4 text-destructive" />;
    return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Inboxes Card */}
      <Card>
        <Collapsible open={isInboxOpen} onOpenChange={setIsInboxOpen}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Sending Infrastructure
              </CardTitle>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isInboxOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CardContent>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-1">
                <p className="text-2xl font-bold">{activeInboxes}</p>
                <p className="text-xs text-muted-foreground">Active Inboxes</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{totalDailyCapacity.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Daily Capacity</p>
              </div>
              <div className="space-y-1">
                <p className={`text-2xl font-bold ${getHealthColor(avgHealthScore)}`}>
                  {avgHealthScore.toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Health Score</p>
              </div>
              <div className="space-y-1 flex items-center gap-2">
                <Flame className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-2xl font-bold">{warmupCount}</p>
                  <p className="text-xs text-muted-foreground">In Warmup</p>
                </div>
              </div>
            </div>

            <CollapsibleContent>
              <div className="border-t pt-4 space-y-3 max-h-[300px] overflow-y-auto">
                {inboxes.map((inbox) => (
                  <div 
                    key={inbox.id} 
                    className={`flex items-center justify-between p-2 rounded-md ${
                      inbox.is_active ? 'bg-muted/50' : 'bg-muted/20 opacity-60'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inbox.email}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{inbox.daily_limit}/day</span>
                        {inbox.warmup_enabled && (
                          <Badge variant="outline" className="text-xs py-0">
                            <Flame className="h-3 w-3 mr-1 text-warning" />
                            Warmup
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {inbox.health_score !== null && (
                        <div className="w-16">
                          <Progress 
                            value={inbox.health_score} 
                            className={`h-1.5 ${
                              inbox.health_score >= 80 ? '[&>div]:bg-success' : 
                              inbox.health_score >= 60 ? '[&>div]:bg-warning' : '[&>div]:bg-destructive'
                            }`}
                          />
                          <p className={`text-xs text-right ${getHealthColor(inbox.health_score)}`}>
                            {inbox.health_score}%
                          </p>
                        </div>
                      )}
                      <Badge variant={inbox.is_active ? 'default' : 'secondary'}>
                        {inbox.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                ))}
                {inboxes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No inbox data available
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Collapsible>
      </Card>

      {/* Domain Health Card */}
      <Card>
        <Collapsible open={isDomainOpen} onOpenChange={setIsDomainOpen}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="h-5 w-5" />
                Domain Authentication
              </CardTitle>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isDomainOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CardContent>
            {/* Summary */}
            <div className="flex items-center gap-4 mb-4">
              <div className="space-y-1">
                <p className="text-2xl font-bold">{domains.length}</p>
                <p className="text-xs text-muted-foreground">Domains</p>
              </div>
              <div className="flex-1 flex items-center gap-3 justify-end">
                <div className="flex items-center gap-1 text-sm">
                  {getAuthIcon(domains.every(d => d.spf_valid))}
                  <span>SPF</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  {getAuthIcon(domains.every(d => d.dkim_valid))}
                  <span>DKIM</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  {getAuthIcon(domains.every(d => d.dmarc_valid))}
                  <span>DMARC</span>
                </div>
              </div>
            </div>

            <CollapsibleContent>
              <div className="border-t pt-4 space-y-3 max-h-[300px] overflow-y-auto">
                {domains.map((domain) => (
                  <div 
                    key={domain.domain} 
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{domain.domain}</p>
                      <p className="text-xs text-muted-foreground">
                        {domain.inbox_count} inbox{domain.inbox_count !== 1 ? 'es' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1" title="SPF">
                        {getAuthIcon(domain.spf_valid)}
                      </div>
                      <div className="flex items-center gap-1" title="DKIM">
                        {getAuthIcon(domain.dkim_valid)}
                      </div>
                      <div className="flex items-center gap-1" title="DMARC">
                        {getAuthIcon(domain.dmarc_valid)}
                      </div>
                    </div>
                  </div>
                ))}
                {domains.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No domain data available
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </CardContent>
        </Collapsible>
      </Card>
    </div>
  );
}
