import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatisticalConfidenceBadge } from '@/components/dashboard/StatisticalConfidenceBadge';
import { 
  ArrowRight, 
  ArrowUp, 
  ArrowDown, 
  Minus, 
  Trophy, 
  FlaskConical,
  Copy,
  CheckCircle,
} from 'lucide-react';

interface VariantData {
  variant_id: string;
  subject_line: string;
  body_preview?: string;
  campaign_name: string;
  
  // Metrics
  sent_count: number;
  reply_rate: number;
  positive_rate: number;
  meeting_rate?: number;
  
  // Features
  subject_char_count: number;
  subject_format: string;
  body_word_count: number;
  cta_type: string;
  personalization_count: number;
  has_link: boolean;
  tone?: string;
}

interface CopyComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variants: VariantData[];
  preselectedA?: string;
  preselectedB?: string;
  onDeclareWinner?: (winnerId: string) => void;
  onCreateFollowUpTest?: (variantA: VariantData, variantB: VariantData) => void;
}

const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

const getDiffIcon = (diff: number, inverted = false) => {
  const isPositive = inverted ? diff < 0 : diff > 0;
  if (Math.abs(diff) < 0.1) return <Minus className="h-3 w-3 text-muted-foreground" />;
  return isPositive ? (
    <ArrowUp className="h-3 w-3 text-success" />
  ) : (
    <ArrowDown className="h-3 w-3 text-destructive" />
  );
};

const getImpactLabel = (impact: number): { label: string; color: string } => {
  if (Math.abs(impact) >= 3) return { label: '+++', color: 'text-success' };
  if (Math.abs(impact) >= 1) return { label: '+', color: 'text-success/70' };
  if (Math.abs(impact) < 0.5) return { label: '~', color: 'text-muted-foreground' };
  return { label: '-', color: 'text-destructive/70' };
};

// Calculate p-value for two-proportion z-test
function calculatePValue(rate1: number, n1: number, rate2: number, n2: number): number {
  if (n1 === 0 || n2 === 0) return 1;
  const p1 = rate1 / 100;
  const p2 = rate2 / 100;
  const pooled = (p1 * n1 + p2 * n2) / (n1 + n2);
  if (pooled === 0 || pooled === 1) return 1;
  const se = Math.sqrt(pooled * (1 - pooled) * (1/n1 + 1/n2));
  if (se === 0) return 1;
  const z = Math.abs(p1 - p2) / se;
  // Approximate p-value
  return Math.max(0, Math.min(1, 2 * (1 - 0.5 * (1 + Math.tanh(z * 0.7)))));
}

export function CopyComparisonDialog({
  open,
  onOpenChange,
  variants,
  preselectedA,
  preselectedB,
  onDeclareWinner,
  onCreateFollowUpTest,
}: CopyComparisonDialogProps) {
  const [variantAId, setVariantAId] = useState<string>(preselectedA || '');
  const [variantBId, setVariantBId] = useState<string>(preselectedB || '');

  const variantA = useMemo(() => 
    variants.find(v => v.variant_id === variantAId), [variants, variantAId]
  );
  const variantB = useMemo(() => 
    variants.find(v => v.variant_id === variantBId), [variants, variantBId]
  );

  const comparison = useMemo(() => {
    if (!variantA || !variantB) return null;
    
    const replyDiff = variantB.reply_rate - variantA.reply_rate;
    const positiveDiff = variantB.positive_rate - variantA.positive_rate;
    const meetingDiff = (variantB.meeting_rate || 0) - (variantA.meeting_rate || 0);
    
    const pValue = calculatePValue(
      variantA.reply_rate, variantA.sent_count,
      variantB.reply_rate, variantB.sent_count
    );
    
    const winner = replyDiff > 0 ? 'B' : replyDiff < 0 ? 'A' : null;
    const isSignificant = pValue < 0.05;
    
    // Structural differences
    const structuralDiffs = [
      {
        feature: 'Subject format',
        valueA: variantA.subject_format,
        valueB: variantB.subject_format,
        impact: variantA.subject_format !== variantB.subject_format ? 
          (variantB.subject_format === 'question' ? 1 : -0.5) : 0,
      },
      {
        feature: 'Subject length',
        valueA: `${variantA.subject_char_count} chars`,
        valueB: `${variantB.subject_char_count} chars`,
        impact: Math.abs(variantA.subject_char_count - variantB.subject_char_count) < 10 ? 0 :
          (variantB.subject_char_count < variantA.subject_char_count ? 0.5 : -0.3),
      },
      {
        feature: 'Body length',
        valueA: `${variantA.body_word_count} words`,
        valueB: `${variantB.body_word_count} words`,
        impact: variantB.body_word_count < variantA.body_word_count && variantB.body_word_count >= 50 ? 0.5 :
          (variantB.body_word_count > 150 ? -1 : 0),
      },
      {
        feature: 'CTA type',
        valueA: variantA.cta_type,
        valueB: variantB.cta_type,
        impact: variantB.cta_type === 'binary' || variantB.cta_type === 'choice' ? 2 :
          (variantB.cta_type === 'none' ? -1 : 0.5),
      },
      {
        feature: 'Personalization',
        valueA: `${variantA.personalization_count} token${variantA.personalization_count !== 1 ? 's' : ''}`,
        valueB: `${variantB.personalization_count} token${variantB.personalization_count !== 1 ? 's' : ''}`,
        impact: variantB.personalization_count > variantA.personalization_count ? 0.5 : 0,
      },
      {
        feature: 'Has link',
        valueA: variantA.has_link ? 'Yes' : 'No',
        valueB: variantB.has_link ? 'Yes' : 'No',
        impact: !variantB.has_link && variantA.has_link ? 1 : 
          (variantB.has_link && !variantA.has_link ? -0.8 : 0),
      },
    ];
    
    // Find primary driver
    const significantDiffs = structuralDiffs.filter(d => d.valueA !== d.valueB);
    const sortedByImpact = [...significantDiffs].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    const primaryDriver = sortedByImpact[0];
    
    return {
      replyDiff,
      positiveDiff,
      meetingDiff,
      pValue,
      winner,
      isSignificant,
      structuralDiffs,
      primaryDriver,
    };
  }, [variantA, variantB]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-chart-1" />
            Copy Comparison
          </DialogTitle>
          <DialogDescription>
            Compare two variants with structural analysis and attributed lift
          </DialogDescription>
        </DialogHeader>

        {/* Variant Selection */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Variant A</label>
            <Select value={variantAId} onValueChange={setVariantAId}>
              <SelectTrigger>
                <SelectValue placeholder="Select variant A" />
              </SelectTrigger>
              <SelectContent>
                {variants.map(v => (
                  <SelectItem key={v.variant_id} value={v.variant_id} disabled={v.variant_id === variantBId}>
                    <span className="truncate">{v.subject_line?.slice(0, 40)}...</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Variant B</label>
            <Select value={variantBId} onValueChange={setVariantBId}>
              <SelectTrigger>
                <SelectValue placeholder="Select variant B" />
              </SelectTrigger>
              <SelectContent>
                {variants.map(v => (
                  <SelectItem key={v.variant_id} value={v.variant_id} disabled={v.variant_id === variantAId}>
                    <span className="truncate">{v.subject_line?.slice(0, 40)}...</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {variantA && variantB && comparison && (
          <>
            {/* Variant Cards */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Card className={comparison.winner === 'A' ? 'border-success' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">Variant A</Badge>
                    {comparison.winner === 'A' && comparison.isSignificant && (
                      <Trophy className="h-4 w-4 text-success" />
                    )}
                  </div>
                  <p className="font-medium text-sm mb-1">{variantA.subject_line}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{variantA.body_preview}</p>
                  <div className="mt-3 text-xs text-muted-foreground">
                    <p>Body: {variantA.body_word_count} words | CTA: {variantA.cta_type}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card className={comparison.winner === 'B' ? 'border-success' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">Variant B</Badge>
                    {comparison.winner === 'B' && comparison.isSignificant && (
                      <Trophy className="h-4 w-4 text-success" />
                    )}
                  </div>
                  <p className="font-medium text-sm mb-1">{variantB.subject_line}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{variantB.body_preview}</p>
                  <div className="mt-3 text-xs text-muted-foreground">
                    <p>Body: {variantB.body_word_count} words | CTA: {variantB.cta_type}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Performance Comparison */}
            <div>
              <h4 className="font-medium text-sm mb-3">Performance Comparison</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead className="text-center">Variant A</TableHead>
                    <TableHead className="text-center">Variant B</TableHead>
                    <TableHead className="text-center">Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Sends</TableCell>
                    <TableCell className="text-center font-mono">{variantA.sent_count.toLocaleString()}</TableCell>
                    <TableCell className="text-center font-mono">{variantB.sent_count.toLocaleString()}</TableCell>
                    <TableCell className="text-center"></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Reply Rate</TableCell>
                    <TableCell className="text-center font-mono">{formatRate(variantA.reply_rate)}</TableCell>
                    <TableCell className="text-center font-mono">{formatRate(variantB.reply_rate)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getDiffIcon(comparison.replyDiff)}
                        <span className={comparison.replyDiff > 0 ? 'text-success' : comparison.replyDiff < 0 ? 'text-destructive' : ''}>
                          {comparison.replyDiff > 0 ? '+' : ''}{formatRate(comparison.replyDiff)}
                        </span>
                        {comparison.isSignificant && <CheckCircle className="h-3 w-3 text-success ml-1" />}
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Positive %</TableCell>
                    <TableCell className="text-center font-mono">{formatRate(variantA.positive_rate)}</TableCell>
                    <TableCell className="text-center font-mono">{formatRate(variantB.positive_rate)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getDiffIcon(comparison.positiveDiff)}
                        <span className={comparison.positiveDiff > 0 ? 'text-success' : comparison.positiveDiff < 0 ? 'text-destructive' : ''}>
                          {comparison.positiveDiff > 0 ? '+' : ''}{formatRate(comparison.positiveDiff)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Confidence</TableCell>
                    <TableCell colSpan={2} className="text-center">
                      <StatisticalConfidenceBadge sampleSize={variantA.sent_count + variantB.sent_count} />
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      p={comparison.pValue.toFixed(3)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <Separator />

            {/* Structural Differences */}
            <div>
              <h4 className="font-medium text-sm mb-3">Structural Differences</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead className="text-center">A</TableHead>
                    <TableHead className="text-center">B</TableHead>
                    <TableHead className="text-center">Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.structuralDiffs.map((diff, i) => {
                    const impact = getImpactLabel(diff.impact);
                    const isDifferent = diff.valueA !== diff.valueB;
                    return (
                      <TableRow key={i} className={isDifferent ? '' : 'opacity-50'}>
                        <TableCell className="font-medium text-sm">{diff.feature}</TableCell>
                        <TableCell className="text-center text-sm">{diff.valueA}</TableCell>
                        <TableCell className="text-center text-sm">{diff.valueB}</TableCell>
                        <TableCell className={`text-center font-bold ${impact.color}`}>
                          {isDifferent ? impact.label : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Primary Driver */}
            {comparison.primaryDriver && comparison.primaryDriver.valueA !== comparison.primaryDriver.valueB && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="font-medium text-sm mb-1">PRIMARY DRIVER OF DIFFERENCE</p>
                <p className="text-sm text-muted-foreground">
                  The <span className="font-medium text-foreground">{comparison.primaryDriver.feature}</span> change 
                  ({comparison.primaryDriver.valueA} → {comparison.primaryDriver.valueB}) appears to be 
                  the main driver of Variant {comparison.winner}'s {comparison.winner === 'B' ? 'out' : 'under'}performance.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t">
              {comparison.winner && comparison.isSignificant && onDeclareWinner && (
                <Button onClick={() => onDeclareWinner(comparison.winner === 'A' ? variantA.variant_id : variantB.variant_id)}>
                  <Trophy className="h-4 w-4 mr-2" />
                  Declare {comparison.winner} Winner & Deploy
                </Button>
              )}
              {onCreateFollowUpTest && (
                <Button variant="outline" onClick={() => onCreateFollowUpTest(variantA, variantB)}>
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Create Follow-up Test
                </Button>
              )}
              <Button variant="ghost">
                <Copy className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
