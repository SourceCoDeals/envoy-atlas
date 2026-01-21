import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScoreStatus, ScoreThresholds } from '@/lib/callingConfig';

interface ScoreCardProps {
  title: string;
  score: number | null;
  trend?: number;
  icon: React.ReactNode;
  description: string;
  thresholds?: ScoreThresholds;
}

export function ScoreCard({ title, score, trend, icon, description, thresholds }: ScoreCardProps) {
  const defaultThresholds: ScoreThresholds = { excellent: 8, good: 6, average: 4, poor: 0 };
  const status = getScoreStatus(score, thresholds ?? defaultThresholds);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span className="text-sm font-medium">{title}</span>
          </div>
          {trend !== undefined && trend !== 0 && (
            <Badge 
              variant={trend >= 0 ? 'default' : 'destructive'} 
              className="text-xs"
            >
              {trend >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {trend >= 0 ? '+' : ''}{Math.abs(trend).toFixed(1)}
            </Badge>
          )}
        </div>
        <div className="mt-3">
          <span className={cn(
            "text-4xl font-bold",
            status === 'excellent' && "text-green-600",
            status === 'good' && "text-blue-600",
            status === 'average' && "text-yellow-600",
            status === 'poor' && "text-red-600",
            status === 'none' && "text-muted-foreground",
          )}>
            {score?.toFixed(1) ?? '-'}
          </span>
          <span className="text-lg text-muted-foreground">/10</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
