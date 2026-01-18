import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { CampaignWithMetrics } from '@/hooks/useCampaigns';
import { DataErrorFlag } from '@/components/ui/data-error-flag';

interface CampaignFunnelAnalysisProps {
  campaign: CampaignWithMetrics;
}

interface FunnelStep {
  name: string;
  count: number;
  rate: number;
  benchmark: number;
  vsBenchmark: number;
}

export function CampaignFunnelAnalysis({ campaign }: CampaignFunnelAnalysisProps) {
  const delivered = campaign.total_sent - (campaign.total_bounced || 0);
  const deliveryRate = campaign.total_sent > 0 ? (delivered / campaign.total_sent) * 100 : 0;
  
  // NOTE: Positive replies are not tracked in campaign metrics
  // Would require message_events classification data
  // Showing 0 to indicate this is not available
  const actualPositiveReplies = 0;
  const positiveRate = 0;
  
  // Meetings are NOT tracked from email campaigns - requires calendar integration
  // Show 0 to indicate this data is not available
  const actualMeetings = 0;
  const meetingRate = 0;

  const funnelSteps: FunnelStep[] = [
    { name: 'SENT', count: campaign.total_sent, rate: 100, benchmark: 100, vsBenchmark: 0 },
    { name: 'DELIVERED', count: delivered, rate: deliveryRate, benchmark: 95, vsBenchmark: deliveryRate - 95 },
    { name: 'REPLIED', count: campaign.total_replied, rate: campaign.reply_rate, benchmark: 2.8, vsBenchmark: campaign.reply_rate - 2.8 },
    { name: 'POSITIVE', count: actualPositiveReplies, rate: positiveRate, benchmark: 40, vsBenchmark: positiveRate - 40 },
    { name: 'MEETINGS', count: actualMeetings, rate: meetingRate, benchmark: 15, vsBenchmark: meetingRate - 15 },
  ];

  const maxCount = campaign.total_sent;
  const hasDropoff = funnelSteps.some((step, idx) => idx > 0 && step.vsBenchmark < -5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Funnel Analysis</CardTitle>
        <CardDescription>Conversion flow from sent to meetings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Funnel Visualization */}
        <div className="space-y-2">
          {funnelSteps.map((step, idx) => {
            const width = (step.count / maxCount) * 100;
            const isFirst = idx === 0;
            
            return (
              <div key={step.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-1">
                    {step.name}
                    {(step.name === 'POSITIVE' || step.name === 'MEETINGS') && (
                      <DataErrorFlag type="not-tracked" size="sm" tooltip={step.name === 'POSITIVE' ? 'Requires reply sentiment tracking' : 'Requires calendar integration'} />
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{step.count.toLocaleString()}</span>
                    {!isFirst && (
                      <span className="text-muted-foreground">({step.rate.toFixed(1)}%)</span>
                    )}
                  </div>
                </div>
                <div className="h-6 bg-muted rounded overflow-hidden">
                  <div 
                    className="h-full bg-primary/80 transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(width, 2)}%` }}
                  >
                    {width > 15 && (
                      <span className="text-xs text-primary-foreground font-medium">
                        {step.rate.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Benchmark Comparison */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">vs Benchmark</h4>
          <div className="flex flex-wrap gap-3">
            {funnelSteps.slice(1).map(step => (
              <div key={step.name} className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground">{step.name}:</span>
                <span className={step.vsBenchmark >= 0 ? 'text-success' : 'text-destructive'}>
                  {step.vsBenchmark >= 0 ? '+' : ''}{step.vsBenchmark.toFixed(1)}%
                </span>
                {step.vsBenchmark >= 0 ? (
                  <CheckCircle className="h-3 w-3 text-success" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="p-3 rounded-lg bg-muted/50">
          {hasDropoff ? (
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium">Significant drop-off detected</p>
                <p className="text-xs text-muted-foreground">
                  Review stages below benchmark for optimization opportunities
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-success mt-0.5" />
              <div>
                <p className="text-sm font-medium">No significant drop-off detected</p>
                <p className="text-xs text-muted-foreground">
                  Funnel conversion rates are at or above benchmarks
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
