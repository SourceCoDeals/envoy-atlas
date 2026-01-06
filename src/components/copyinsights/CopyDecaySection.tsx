import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, TrendingDown, Clock, Pause, RefreshCw, Eye } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface DecayingVariant {
  variant_id: string;
  subject_line: string;
  campaign_name: string;
  initial_reply_rate: number;
  current_reply_rate: number;
  decay_percentage: number;
  total_sends: number;
  weekly_data: { week: string; reply_rate: number; sends: number }[];
  decay_severity: 'mild' | 'moderate' | 'severe';
  diagnosis?: string;
  recommendation?: string;
}

interface CopyDecaySectionProps {
  decayingVariants: DecayingVariant[];
  onPauseVariant?: (variantId: string) => void;
  onViewAudience?: (variantId: string) => void;
}

const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'severe': return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'moderate': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
    case 'mild': return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getSeverityLabel = (severity: string) => {
  switch (severity) {
    case 'severe': return 'Severe Decay';
    case 'moderate': return 'Moderate Decay';
    case 'mild': return 'Mild Decay';
    default: return 'Unknown';
  }
};

export function CopyDecaySection({ 
  decayingVariants, 
  onPauseVariant, 
  onViewAudience 
}: CopyDecaySectionProps) {
  const [expandedVariant, setExpandedVariant] = useState<string | null>(null);

  if (decayingVariants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Copy Freshness & Decay</CardTitle>
          </div>
          <CardDescription>
            No significant decay detected in your copy variants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="text-center">
              <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>All variants performing within normal ranges</p>
              <p className="text-xs mt-1">Decay detection requires 1,000+ sends per variant</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Copy Freshness & Decay</CardTitle>
          </div>
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            {decayingVariants.length} variant{decayingVariants.length > 1 ? 's' : ''} showing decay
          </Badge>
        </div>
        <CardDescription>
          Variants with significant performance decline over time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {decayingVariants.map((variant) => {
          const isExpanded = expandedVariant === variant.variant_id;
          
          return (
            <div 
              key={variant.variant_id} 
              className="p-4 rounded-lg border bg-card"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-xs ${getSeverityColor(variant.decay_severity)}`}>
                      {getSeverityLabel(variant.decay_severity)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {variant.total_sends.toLocaleString()} sends
                    </span>
                  </div>
                  <p className="font-medium text-sm truncate">{variant.subject_line}</p>
                  <p className="text-xs text-muted-foreground">{variant.campaign_name}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-destructive">
                      <TrendingDown className="h-4 w-4" />
                      <span className="font-mono font-bold">-{Math.abs(variant.decay_percentage).toFixed(0)}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatRate(variant.initial_reply_rate)} → {formatRate(variant.current_reply_rate)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Performance Chart */}
              <div className="h-[120px] mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={variant.weekly_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value: number) => [formatRate(value), 'Reply Rate']}
                    />
                    <ReferenceLine 
                      y={variant.initial_reply_rate} 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeDasharray="3 3"
                      label={{ value: 'Initial', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="reply_rate" 
                      stroke="hsl(var(--destructive))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--destructive))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Diagnosis & Recommendation */}
              {variant.diagnosis && (
                <div className="p-3 bg-muted/50 rounded text-sm mb-3">
                  <p className="font-medium text-xs text-muted-foreground mb-1">DIAGNOSIS</p>
                  <p className="text-sm">{variant.diagnosis}</p>
                </div>
              )}
              
              {variant.recommendation && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded text-sm mb-3">
                  <p className="font-medium text-xs text-primary mb-1">RECOMMENDATION</p>
                  <p className="text-sm">{variant.recommendation}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t">
                {onPauseVariant && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => onPauseVariant(variant.variant_id)}
                        >
                          <Pause className="h-3 w-3 mr-1" />
                          Pause Variant
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Stop sending this variant</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Create Replacement
                </Button>
                {onViewAudience && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onViewAudience(variant.variant_id)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View Audience
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {/* Decay Detection Logic Explanation */}
        <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          <p className="font-medium mb-1">Decay Detection Logic:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Flags when reply rate drops &gt;30% from first 1,000 sends</li>
            <li>Requires statistical significance (p &lt; 0.05)</li>
            <li>Controls for deliverability and audience changes</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
