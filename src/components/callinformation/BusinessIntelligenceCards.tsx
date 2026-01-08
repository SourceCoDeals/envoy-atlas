import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, TrendingDown, AlertTriangle } from 'lucide-react';

interface BusinessIntelligence {
  totalPipelineRevenue: number;
  totalPipelineEbitda: number;
  interestedSellersCount: number;
  topExitReasons: { reason: string; count: number }[];
  topPainPoints: { point: string; count: number }[];
}

interface BusinessIntelligenceCardsProps {
  data: BusinessIntelligence;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function BusinessIntelligenceCards({ data }: BusinessIntelligenceCardsProps) {
  return (
    <div className="space-y-4">
      {/* Pipeline Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Pipeline Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.totalPipelineRevenue)}</p>
            <p className="text-xs text-muted-foreground">From interested sellers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Pipeline EBITDA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(data.totalPipelineEbitda)}</p>
            <p className="text-xs text-muted-foreground">Combined EBITDA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Interested Sellers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.interestedSellersCount}</p>
            <p className="text-xs text-muted-foreground">Confirmed interest</p>
          </CardContent>
        </Card>
      </div>

      {/* Exit Reasons & Pain Points */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Top Exit Reasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topExitReasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No exit reasons recorded</p>
            ) : (
              <div className="space-y-2">
                {data.topExitReasons.map((reason, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{reason.reason}</span>
                    <Badge variant="secondary">{reason.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Top Pain Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topPainPoints.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pain points recorded</p>
            ) : (
              <div className="space-y-2">
                {data.topPainPoints.map((point, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{point.point}</span>
                    <Badge variant="secondary">{point.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
