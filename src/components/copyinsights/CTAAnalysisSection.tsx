import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatisticalConfidenceBadge } from '@/components/dashboard/StatisticalConfidenceBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';

interface CTAMetrics {
  cta_type: string;
  reply_rate: number;
  positive_rate: number;
  meeting_rate: number;
  sample_size: number;
  lift_vs_baseline: number;
}

interface CTAAnalysisSectionProps {
  ctaMetrics: CTAMetrics[];
  stepData?: {
    step: string;
    cta_type: string;
    reply_rate: number;
    sample_size: number;
  }[];
}

const ctaLabels: Record<string, { label: string; description: string }> = {
  soft: { label: 'Soft Ask', description: '"Would you be open to..." - Low-pressure first touch' },
  direct: { label: 'Direct', description: '"Can we schedule 15 mins?" - Clear intent' },
  meeting: { label: 'Meeting', description: '"Quick call" / "Chat briefly" - Direct meeting request' },
  binary: { label: 'Choice', description: '"Tuesday or Thursday?" - Reduces friction' },
  calendar: { label: 'Calendar', description: 'Calendly/Cal.com booking link' },
  permission: { label: 'Permission', description: '"Okay if I send?" - Ask before delivering' },
  info: { label: 'Value', description: '"Want me to send the benchmark?" - Give before get' },
  question_only: { label: 'Question', description: '"How are you handling X?" - Pure engagement' },
  none: { label: 'No CTA', description: 'Follow-up / nurture without ask' },
};

const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

export function CTAAnalysisSection({ ctaMetrics, stepData }: CTAAnalysisSectionProps) {
  // Sort by reply rate
  const sortedMetrics = [...ctaMetrics].sort((a, b) => b.reply_rate - a.reply_rate);
  
  // Generate heatmap data
  const steps = ['Email 1', 'Email 2', 'Email 3', 'Follow-up'];
  const ctaTypes = ['binary', 'direct', 'soft', 'info'];
  
  // Get heatmap value from actual step data only (no fake fallbacks)
  const getHeatmapValue = (step: string, cta: string): number => {
    if (stepData) {
      const found = stepData.find(d => d.step === step && d.cta_type === cta);
      return found?.reply_rate || 0;
    }
    // No data available - return 0 instead of fake values
    return 0;
  };
  
  // Check if we have any step data to show the heatmap
  const hasStepData = stepData && stepData.length > 0;

  const getHeatmapColor = (value: number, maxValue: number) => {
    const intensity = maxValue > 0 ? value / maxValue : 0;
    if (intensity > 0.8) return 'bg-success/80 text-success-foreground';
    if (intensity > 0.6) return 'bg-success/60 text-success-foreground';
    if (intensity > 0.4) return 'bg-success/40 text-foreground';
    if (intensity > 0.2) return 'bg-success/20 text-foreground';
    return 'bg-muted text-muted-foreground';
  };

  // Calculate max value for heatmap
  const allHeatmapValues = steps.flatMap(step => 
    ctaTypes.map(cta => getHeatmapValue(step, cta))
  );
  const maxHeatmapValue = Math.max(...allHeatmapValues);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-chart-2" />
          <CardTitle className="text-lg">Call-to-Action Analysis</CardTitle>
        </div>
        <CardDescription>
          Compare CTA styles and their impact on reply and meeting conversion
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* CTA Performance Table */}
        <div>
          <h4 className="text-sm font-medium mb-3">CTA Type Performance Matrix</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CTA Type</TableHead>
                <TableHead className="text-right">Reply %</TableHead>
                <TableHead className="text-right">Positive %</TableHead>
                <TableHead className="text-right">vs Baseline</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMetrics.map((metric) => {
                const ctaInfo = ctaLabels[metric.cta_type] || { label: metric.cta_type, description: '' };
                const isPositiveLift = metric.lift_vs_baseline > 0;
                
                return (
                  <TableRow key={metric.cta_type}>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-start gap-2 text-left">
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              {ctaInfo.label}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p>{ctaInfo.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatRate(metric.reply_rate)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatRate(metric.positive_rate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`flex items-center justify-end gap-1 font-medium ${isPositiveLift ? 'text-success' : 'text-destructive'}`}>
                        {isPositiveLift ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isPositiveLift ? '+' : ''}{metric.lift_vs_baseline.toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <StatisticalConfidenceBadge sampleSize={metric.sample_size} size="sm" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* CTA × Email Step Heatmap */}
        <div>
          <h4 className="text-sm font-medium mb-3">CTA × Email Step Heatmap</h4>
          <p className="text-xs text-muted-foreground mb-4">
            Reply rate by CTA type and email sequence position (darker = higher conversion)
          </p>
          
          {hasStepData ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-muted-foreground p-2 w-24"></th>
                    {steps.map(step => (
                      <th key={step} className="text-center text-xs font-medium text-muted-foreground p-2">
                        {step}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ctaTypes.map(cta => (
                    <tr key={cta}>
                      <td className="text-xs font-medium p-2">
                        {ctaLabels[cta]?.label || cta}
                      </td>
                      {steps.map(step => {
                        const value = getHeatmapValue(step, cta);
                        return (
                          <td key={`${cta}-${step}`} className="p-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`h-10 rounded flex items-center justify-center text-xs font-mono ${getHeatmapColor(value, maxHeatmapValue)}`}>
                                    {formatRate(value)}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{ctaLabels[cta]?.label} in {step}</p>
                                  <p className="text-xs text-muted-foreground">Reply rate: {formatRate(value)}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <p className="text-sm">No step-level CTA data available</p>
              <p className="text-xs mt-1">CTA analysis by sequence step requires email variant tagging</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
