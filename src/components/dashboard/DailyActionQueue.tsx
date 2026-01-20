import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Target, 
  Lightbulb,
  ChevronRight,
  CheckCircle,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateCampaignActions, type CampaignActionItem } from '@/lib/campaignHealth';

interface Campaign {
  id: string;
  name: string;
  status: string;
  bounce_rate: number;
  reply_rate: number;
  positive_rate: number;
  open_rate?: number;
  total_sent: number;
}

interface DailyActionQueueProps {
  campaigns: Campaign[];
  className?: string;
  maxItems?: number;
}

export function DailyActionQueue({ campaigns, className, maxItems = 3 }: DailyActionQueueProps) {
  const actions = useMemo(() => {
    const campaignInputs = campaigns.map(c => ({
      ...c,
      open_rate: c.open_rate || 0,
    }));
    return generateCampaignActions(campaignInputs).slice(0, maxItems);
  }, [campaigns, maxItems]);

  const getTypeConfig = (type: CampaignActionItem['type']) => {
    switch (type) {
      case 'warning':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-destructive/10',
          borderColor: 'border-destructive/30',
          iconColor: 'text-destructive',
          badgeClass: 'bg-destructive text-destructive-foreground',
          badgeLabel: 'ACTION NEEDED',
        };
      case 'opportunity':
        return {
          icon: Target,
          bgColor: 'bg-warning/10',
          borderColor: 'border-warning/30',
          iconColor: 'text-warning',
          badgeClass: 'bg-warning text-warning-foreground',
          badgeLabel: 'OPPORTUNITY',
        };
      case 'info':
        return {
          icon: Lightbulb,
          bgColor: 'bg-chart-4/10',
          borderColor: 'border-chart-4/30',
          iconColor: 'text-chart-4',
          badgeClass: 'bg-chart-4 text-chart-4-foreground',
          badgeLabel: 'INSIGHT',
        };
    }
  };

  if (actions.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-success">
            <CheckCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">All campaigns healthy</p>
              <p className="text-sm text-muted-foreground">No immediate actions required</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Today's Actions</CardTitle>
              <CardDescription>{actions.length} thing{actions.length !== 1 ? 's' : ''} to address</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => {
          const config = getTypeConfig(action.type);
          const Icon = config.icon;

          return (
            <div
              key={`${action.campaignId}-${index}`}
              className={cn(
                'rounded-lg border p-3 transition-all',
                config.bgColor,
                config.borderColor
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', config.iconColor)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={cn('text-[10px] px-1.5 py-0', config.badgeClass)}>
                      {config.badgeLabel}
                    </Badge>
                  </div>
                  <p className="font-medium text-sm">{action.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {action.description}
                  </p>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-6 p-0 mt-1.5 text-xs"
                    asChild
                  >
                    <Link to={action.actionLink}>
                      {action.actionLabel}
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
