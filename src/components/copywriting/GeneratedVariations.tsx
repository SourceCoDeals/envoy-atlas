import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Copy, 
  Save, 
  Star, 
  AlertTriangle, 
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { CopyVariation, GenerationContext } from '@/hooks/useCopywritingStudio';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GeneratedVariationsProps {
  variations: CopyVariation[];
  contextUsed: GenerationContext;
  onSaveToLibrary: (variation: CopyVariation, category: string) => Promise<boolean>;
}

export function GeneratedVariations({ 
  variations, 
  contextUsed, 
  onSaveToLibrary 
}: GeneratedVariationsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number>(0);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleSave = async (variation: CopyVariation, index: number) => {
    setSavingIndex(index);
    const category = 'custom'; // Could be enhanced with a picker
    await onSaveToLibrary(variation, category);
    setSavingIndex(null);
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (score >= 75) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (score >= 60) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  return (
    <div className="space-y-4">
      {/* Context Summary */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>
          Generated using {contextUsed.best_practices_count} best practices
          {contextUsed.winning_patterns_count > 0 && `, ${contextUsed.winning_patterns_count} winning patterns`}
          {contextUsed.top_copy_count > 0 && `, ${contextUsed.top_copy_count} top performers`}
          {contextUsed.industry_intel_count > 0 && `, ${contextUsed.industry_intel_count} industry insights`}
        </span>
      </div>

      {/* Variations */}
      {variations.map((variation, index) => (
        <Card 
          key={index} 
          className={cn(
            "bg-card/50 border-border/50 transition-all",
            index === 0 && "ring-1 ring-primary/50"
          )}
        >
          <CardHeader 
            className="pb-2 cursor-pointer"
            onClick={() => setExpandedIndex(expandedIndex === index ? -1 : index)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      Variation {index + 1}
                    </CardTitle>
                    {index === 0 && (
                      <Badge variant="secondary" className="bg-primary/20 text-primary border-0">
                        <Star className="h-3 w-3 mr-1" />
                        Best Match
                      </Badge>
                    )}
                    <Badge className={cn("border", getScoreBadgeColor(variation.quality_score))}>
                      Score: {variation.quality_score}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {variation.variation_style} • {variation.word_count} words
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {expandedIndex === index ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>

          {expandedIndex === index && (
            <CardContent className="pt-0 space-y-4">
              {/* Validation Alerts */}
              {(variation.validation.issues.length > 0 || variation.validation.warnings.length > 0) && (
                <div className="space-y-2">
                  {variation.validation.issues.map((issue, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {issue}
                    </div>
                  ))}
                  {variation.validation.warnings.map((warning, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-amber-400 bg-amber-400/10 rounded-md p-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              {/* Subject Line */}
              {variation.subject_line && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Subject Line
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {variation.subject_line.length} chars
                    </span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 font-medium">
                    {variation.subject_line}
                  </div>
                </div>
              )}

              <Separator />

              {/* Body */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Body
                </span>
                <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm leading-relaxed">
                  {variation.body}
                </div>
              </div>

              {/* Patterns Used */}
              {variation.patterns_used.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Patterns Used
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {variation.patterns_used.map((pattern, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        <Check className="h-3 w-3 mr-1 text-emerald-400" />
                        {pattern}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => copyToClipboard(`${variation.subject_line}\n\n${variation.body}`)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => handleSave(variation, index)}
                  disabled={savingIndex === index}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingIndex === index ? 'Saving...' : 'Save to Library'}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
