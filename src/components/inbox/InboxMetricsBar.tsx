import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  MessageSquare, 
  Flame, 
  Timer, 
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface InboxMetrics {
  totalPending: number;
  hotCount: number;
  overdueCount: number;
  avgResponseTimeHours: number;
  slaMet: number;
  slaTotal: number;
  todayNew: number;
}

interface InboxMetricsBarProps {
  metrics: InboxMetrics;
}

export function InboxMetricsBar({ metrics }: InboxMetricsBarProps) {
  const slaPercentage = metrics.slaTotal > 0 
    ? Math.round((metrics.slaMet / metrics.slaTotal) * 100) 
    : 100;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{metrics.totalPending}</span>
                </div>
                <p className="text-xs text-muted-foreground">Total Pending</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  +{metrics.todayNew} today
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-red-500" />
                  <span className="text-2xl font-bold text-red-500">{metrics.hotCount}</span>
                </div>
                <p className="text-xs text-muted-foreground">🔴 HOT (P0)</p>
              </div>
              <Badge variant="outline" className="text-red-500 border-red-500/30">
                Need action
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className={metrics.overdueCount > 0 ? 'border-destructive/50' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-destructive" />
                  <span className={`text-2xl font-bold ${metrics.overdueCount > 0 ? 'text-destructive' : ''}`}>
                    {metrics.overdueCount}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">⚠️ Overdue</p>
              </div>
              {metrics.overdueCount > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  SLA miss
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{metrics.avgResponseTimeHours.toFixed(1)} hrs</span>
                </div>
                <p className="text-xs text-muted-foreground">Avg Response Time</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs">
                  <TrendingDown className="h-3 w-3 text-success" />
                  <span className="text-success">-0.8 hrs</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA Performance Bar */}
      <div className="flex items-center gap-4 px-1">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          SLA Performance (7 days): <span className="font-medium text-foreground">{slaPercentage}% met</span>
        </span>
        <Progress value={slaPercentage} className="flex-1 h-2" />
        <Badge 
          variant="outline" 
          className={slaPercentage >= 90 ? 'text-success border-success/30' : slaPercentage >= 70 ? 'text-warning border-warning/30' : 'text-destructive border-destructive/30'}
        >
          {metrics.slaMet}/{metrics.slaTotal}
        </Badge>
      </div>
    </div>
  );
}
