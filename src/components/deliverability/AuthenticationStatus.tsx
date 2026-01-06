import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ShieldCheck, 
  ShieldX, 
  ShieldAlert,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface AuthRecord {
  type: 'SPF' | 'DKIM' | 'DMARC';
  status: 'pass' | 'fail' | 'partial' | 'missing';
  details: string;
  lastChecked: string;
}

interface DomainAuth {
  domain: string;
  records: AuthRecord[];
  overallScore: number; // 0-100
  isBulkSender: boolean;
}

interface AuthenticationStatusProps {
  domains: DomainAuth[];
}

export function AuthenticationStatus({ domains }: AuthenticationStatusProps) {
  const getStatusIcon = (status: AuthRecord['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'missing':
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: AuthRecord['status']) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-success/20 text-success border-success/30">Pass</Badge>;
      case 'fail':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Fail</Badge>;
      case 'partial':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Partial</Badge>;
      case 'missing':
        return <Badge variant="outline">Missing</Badge>;
    }
  };

  const getOverallIcon = (score: number) => {
    if (score >= 90) return <ShieldCheck className="h-5 w-5 text-success" />;
    if (score >= 60) return <ShieldAlert className="h-5 w-5 text-warning" />;
    return <ShieldX className="h-5 w-5 text-destructive" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Email Authentication
        </CardTitle>
        <CardDescription>
          SPF, DKIM, and DMARC status for your sending domains
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {domains.map(domain => (
          <div key={domain.domain} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {getOverallIcon(domain.overallScore)}
                <div>
                  <p className="font-medium">{domain.domain}</p>
                  <p className="text-xs text-muted-foreground">
                    Authentication Score: {domain.overallScore}%
                  </p>
                </div>
              </div>
              {domain.isBulkSender && (
                <Badge variant="outline" className="text-orange-500 border-orange-500/30">
                  Bulk Sender
                </Badge>
              )}
            </div>

            <div className="space-y-3">
              {domain.records.map(record => (
                <div 
                  key={record.type} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(record.status)}
                    <div>
                      <p className="text-sm font-medium">{record.type}</p>
                      <p className="text-xs text-muted-foreground">{record.details}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Checked {record.lastChecked}
                    </span>
                    {getStatusBadge(record.status)}
                  </div>
                </div>
              ))}
            </div>

            {domain.overallScore < 100 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {domain.overallScore < 60 
                    ? 'Critical: Fix authentication issues to improve deliverability'
                    : 'Some improvements recommended'}
                </p>
                <Button variant="outline" size="sm">
                  View Setup Guide <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
          </div>
        ))}

        {/* Bulk Sender Warning */}
        {domains.some(d => d.isBulkSender) && (
          <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-warning">Bulk Sender Requirements</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You're sending over 5,000 emails/day to Gmail. Ensure you have:
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>Valid SPF and DKIM authentication</li>
                  <li>DMARC policy set (at minimum p=none)</li>
                  <li>One-click unsubscribe in all messages</li>
                  <li>Spam complaint rate below 0.3%</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
