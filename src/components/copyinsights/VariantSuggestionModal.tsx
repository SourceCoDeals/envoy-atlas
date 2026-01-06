import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sparkles, 
  TrendingUp, 
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AIRecommendation } from './AIRecommendationsPanel';

interface VariantSuggestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: {
    id: string;
    subject_line: string;
    body_preview: string;
    campaign_name: string;
    reply_rate: number;
    sent_count: number;
  } | null;
  workspaceId: string | undefined;
}

export function VariantSuggestionModal({ 
  open, 
  onOpenChange, 
  variant, 
  workspaceId 
}: VariantSuggestionModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AIRecommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const generateSuggestions = async () => {
    if (!workspaceId || !variant) {
      toast.error('Missing workspace or variant');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('generate-copy-recommendations', {
        body: { 
          workspace_id: workspaceId,
          variant_id: variant.id,
        },
      });

      if (fnError) throw fnError;
      if (result.error) {
        setError(result.error);
        return;
      }

      setRecommendations(result.recommendations);
      toast.success('Suggestions generated!');
    } catch (err: any) {
      console.error('Error generating suggestions:', err);
      setError(err.message || 'Failed to generate suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Reset state when modal closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setRecommendations(null);
      setError(null);
    }
    onOpenChange(open);
  };

  if (!variant) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Copy Suggestions
          </DialogTitle>
          <DialogDescription>
            Get AI-powered improvements for this variant
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Variant Info */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Current Variant</p>
              <Badge variant="outline" className="text-xs">
                {variant.reply_rate.toFixed(1)}% reply rate
              </Badge>
            </div>
            <p className="font-medium text-sm">{variant.subject_line}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{variant.body_preview}</p>
            <p className="text-xs text-muted-foreground">
              {variant.campaign_name} • {variant.sent_count.toLocaleString()} sent
            </p>
          </div>

          {/* Generate Button */}
          {!recommendations && !isLoading && !error && (
            <div className="text-center py-4">
              <Button onClick={generateSuggestions}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Suggestions
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Recommendations */}
          {recommendations && recommendations.length > 0 && (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4">
                {recommendations.map((rec, index) => (
                  <div key={index} className="p-4 rounded-lg border bg-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{rec.title}</span>
                          {rec.expected_lift && (
                            <Badge className="text-xs bg-success/10 text-success border-success/30">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {rec.expected_lift}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{rec.description}</p>
                      </div>
                    </div>

                    {rec.suggested_copy && (
                      <div className="space-y-2">
                        {rec.original_copy && (
                          <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground mb-0.5">Original</p>
                              <p className="text-sm">{rec.original_copy}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded bg-success/5 border border-success/20">
                          <div className="flex-1">
                            <p className="text-xs text-success mb-0.5 font-medium">Suggested</p>
                            <p className="text-sm">{rec.suggested_copy}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 flex-shrink-0"
                            onClick={() => copyToClipboard(rec.suggested_copy!, index)}
                          >
                            {copiedIndex === index ? (
                              <Check className="h-4 w-4 text-success" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {rec.supporting_patterns && rec.supporting_patterns.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-muted-foreground">Based on:</span>
                        {rec.supporting_patterns.slice(0, 3).map((pattern, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {pattern}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={generateSuggestions}
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}

          {recommendations && recommendations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No specific suggestions generated. Try with a different variant.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
