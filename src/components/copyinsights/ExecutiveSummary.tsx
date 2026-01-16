import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';

interface InsightItem {
  type: 'positive' | 'negative' | 'neutral' | 'warning';
  title: string;
  description: string;
  impact?: string;
}

interface ExecutiveSummaryProps {
  title: string;
  subtitle?: string;
  insights: InsightItem[];
  bottomLine?: string;
}

export function ExecutiveSummary({ title, subtitle, insights, bottomLine }: ExecutiveSummaryProps) {
  const getIcon = (type: InsightItem['type']) => {
    switch (type) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBadgeVariant = (type: InsightItem['type']) => {
    switch (type) {
      case 'positive':
        return 'bg-success/10 text-success border-success/30';
      case 'negative':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
            <div className="flex-shrink-0 mt-0.5">{getIcon(insight.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{insight.title}</span>
                {insight.impact && (
                  <Badge variant="outline" className={`text-xs ${getBadgeVariant(insight.type)}`}>
                    {insight.impact}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
            </div>
          </div>
        ))}
        
        {bottomLine && (
          <div className="pt-3 border-t border-border/50">
            <p className="text-sm font-medium flex items-center gap-2">
              <span className="text-primary">💡 Bottom Line:</span>
              <span>{bottomLine}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
