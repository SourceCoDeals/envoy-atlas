import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ConfidenceBadge } from '@/components/ui/confidence-badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Mail, 
  MousePointer, 
  MessageSquare, 
  ThumbsUp,
  Copy,
  BookMarked,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface VariantDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: {
    variant_id: string;
    campaign_name: string;
    subject_line: string;
    body_preview?: string | null;
    sent_count: number;
    open_count?: number;
    reply_count: number;
    positive_count?: number;
    open_rate: number;
    reply_rate: number;
    positive_rate: number;
    format_type?: string;
    personalization_type?: string;
    char_count?: number;
    word_count?: number;
    cta_type?: string;
  } | null;
  baselineReplyRate: number;
  onSaveToLibrary?: () => void;
}

export function VariantDetailModal({ 
  open, 
  onOpenChange, 
  variant, 
  baselineReplyRate,
  onSaveToLibrary 
}: VariantDetailModalProps) {
  if (!variant) return null;

  const liftVsBaseline = baselineReplyRate > 0 
    ? ((variant.reply_rate - baselineReplyRate) / baselineReplyRate) * 100 
    : 0;

  const handleCopySubject = () => {
    navigator.clipboard.writeText(variant.subject_line);
    toast.success('Subject line copied to clipboard');
  };

  const handleCopyBody = () => {
    if (variant.body_preview) {
      navigator.clipboard.writeText(variant.body_preview);
      toast.success('Body copy copied to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Variant Performance Details
          </DialogTitle>
          <DialogDescription>
            Campaign: {variant.campaign_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Performance Summary */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="bg-muted/30">
              <CardContent className="pt-3 pb-2 text-center">
                <div className="text-xs text-muted-foreground mb-1">Sent</div>
                <div className="text-xl font-bold">{variant.sent_count.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="pt-3 pb-2 text-center">
                <div className="text-xs text-muted-foreground mb-1">Open Rate</div>
                <div className="text-xl font-bold">{variant.open_rate.toFixed(1)}%</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="pt-3 pb-2 text-center">
                <div className="text-xs text-muted-foreground mb-1">Reply Rate</div>
                <div className="text-xl font-bold flex items-center justify-center gap-1">
                  {variant.reply_rate.toFixed(1)}%
                  {liftVsBaseline > 10 && <TrendingUp className="h-4 w-4 text-success" />}
                  {liftVsBaseline < -10 && <TrendingDown className="h-4 w-4 text-destructive" />}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="pt-3 pb-2 text-center">
                <div className="text-xs text-muted-foreground mb-1">Positive %</div>
                <div className="text-xl font-bold text-success">{variant.positive_rate.toFixed(0)}%</div>
              </CardContent>
            </Card>
          </div>

          {/* vs Baseline indicator */}
          <div className={`p-3 rounded-lg text-sm ${
            liftVsBaseline > 10 ? 'bg-success/10 text-success border border-success/30' :
            liftVsBaseline < -10 ? 'bg-destructive/10 text-destructive border border-destructive/30' :
            'bg-muted/50'
          }`}>
            <strong>vs Baseline ({baselineReplyRate.toFixed(1)}% reply rate):</strong>{' '}
            {liftVsBaseline > 0 ? '+' : ''}{liftVsBaseline.toFixed(0)}% 
            {liftVsBaseline > 10 && ' — This variant is a top performer!'}
            {liftVsBaseline < -10 && ' — Consider testing different approaches.'}
            {Math.abs(liftVsBaseline) <= 10 && ' — Performing around baseline.'}
          </div>

          <Separator />

          {/* Subject Line */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Subject Line
              </h4>
              <Button variant="ghost" size="sm" onClick={handleCopySubject}>
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg font-mono text-sm">
              {variant.subject_line}
            </div>
            <div className="flex gap-2 mt-2">
              {variant.format_type && (
                <Badge variant="outline">{variant.format_type}</Badge>
              )}
              {variant.personalization_type && variant.personalization_type !== 'none' && (
                <Badge variant="outline" className="bg-primary/10">{variant.personalization_type}</Badge>
              )}
              {variant.char_count && (
                <Badge variant="secondary">{variant.char_count} chars</Badge>
              )}
              <ConfidenceBadge sampleSize={variant.sent_count} />
            </div>
          </div>

          {/* Body Copy */}
          {variant.body_preview && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Body Preview
                </h4>
                <Button variant="ghost" size="sm" onClick={handleCopyBody}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg text-sm max-h-48 overflow-y-auto whitespace-pre-wrap">
                {variant.body_preview}
              </div>
              <div className="flex gap-2 mt-2">
                {variant.cta_type && (
                  <Badge variant="outline">CTA: {variant.cta_type}</Badge>
                )}
                {variant.word_count && (
                  <Badge variant="secondary">{variant.word_count} words</Badge>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            {onSaveToLibrary && (
              <Button variant="outline" onClick={onSaveToLibrary}>
                <BookMarked className="h-4 w-4 mr-2" />
                Save to Library
              </Button>
            )}
            <Button variant="default" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
