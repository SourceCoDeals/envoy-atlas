import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users } from 'lucide-react';

interface LeadBreakdownProps {
  total: number;
  byStatus: { status: string; count: number }[];
}

const statusConfig: Record<string, { color: string; label: string }> = {
  new: { color: 'bg-blue-500', label: 'New' },
  contacted: { color: 'bg-primary', label: 'Contacted' },
  replied: { color: 'bg-chart-2', label: 'Replied' },
  interested: { color: 'bg-success', label: 'Interested' },
  not_interested: { color: 'bg-muted-foreground', label: 'Not Interested' },
  bounced: { color: 'bg-destructive', label: 'Bounced' },
  unsubscribed: { color: 'bg-warning', label: 'Unsubscribed' },
  unknown: { color: 'bg-muted', label: 'Unknown' },
};

export function CampaignLeadBreakdown({ total, byStatus }: LeadBreakdownProps) {
  const getStatusConfig = (status: string) => {
    const normalized = status.toLowerCase().replace(/\s+/g, '_');
    return statusConfig[normalized] || { color: 'bg-muted', label: status };
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Lead Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-2xl font-bold">{total.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Leads</p>
          </div>

          <div className="space-y-3">
            {byStatus.map(({ status, count }) => {
              const config = getStatusConfig(status);
              const percentage = total > 0 ? (count / total) * 100 : 0;
              
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${config.color}`} />
                      {config.label}
                    </span>
                    <span className="font-medium">
                      {count.toLocaleString()}
                      <span className="text-muted-foreground ml-1">
                        ({percentage.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <Progress 
                    value={percentage} 
                    className={`h-1.5 [&>div]:${config.color}`}
                  />
                </div>
              );
            })}
          </div>

          {byStatus.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No lead data available
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
