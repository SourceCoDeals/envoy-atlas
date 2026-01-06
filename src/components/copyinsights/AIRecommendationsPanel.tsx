import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Sparkles, 
  Lightbulb, 
  TrendingUp, 
  FlaskConical, 
  ChevronDown, 
  ChevronRight,
  Target,
  RefreshCw,
  FileText,
  MessageSquare,
  Wand2,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AIRecommendation {
  type: 'subject_improvement' | 'body_improvement' | 'new_variant' | 'pattern_combination';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  supporting_patterns?: string[];
  original_copy?: string;
  suggested_copy?: string;
  expected_lift?: string;
}

export interface ExperimentIdea {
  hypothesis: string;
  control_pattern: string;
  test_pattern: string;
  expected_outcome: string;
}

export interface AIRecommendationsData {
  summary: string;
  recommendations: AIRecommendation[];
  experiment_ideas: ExperimentIdea[];
  generated_at?: string;
  patterns_analyzed?: number;
  variants_analyzed?: number;
  baseline_reply_rate?: number;
}

interface AIRecommendationsPanelProps {
  workspaceId: string | undefined;
  hasData: boolean;
}

const getTypeIcon = (type: AIRecommendation['type']) => {
  switch (type) {
    case 'subject_improvement':
      return <MessageSquare className="h-4 w-4" />;
    case 'body_improvement':
      return <FileText className="h-4 w-4" />;
    case 'new_variant':
      return <Wand2 className="h-4 w-4" />;
    case 'pattern_combination':
      return <Layers className="h-4 w-4" />;
    default:
      return <Lightbulb className="h-4 w-4" />;
  }
};

const getTypeLabel = (type: AIRecommendation['type']) => {
  switch (type) {
    case 'subject_improvement':
      return 'Subject Line';
    case 'body_improvement':
      return 'Body Copy';
    case 'new_variant':
      return 'New Variant';
    case 'pattern_combination':
      return 'Pattern Combo';
    default:
      return type;
  }
};

const getConfidenceColor = (confidence: AIRecommendation['confidence']) => {
  switch (confidence) {
    case 'high':
      return 'bg-success/10 text-success border-success/30';
    case 'medium':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
    case 'low':
      return 'bg-muted text-muted-foreground';
    default:
      return '';
  }
};

export function AIRecommendationsPanel({ workspaceId, hasData }: AIRecommendationsPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<AIRecommendationsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecs, setExpandedRecs] = useState<Set<number>>(new Set());

  const generateRecommendations = async () => {
    if (!workspaceId) {
      toast.error('No workspace selected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('generate-copy-recommendations', {
        body: { workspace_id: workspaceId },
      });

      if (fnError) throw fnError;
      if (result.error) {
        if (result.error.includes('Rate limit')) {
          toast.error('Rate limit exceeded. Please try again in a moment.');
        } else if (result.error.includes('credits')) {
          toast.error('AI credits exhausted. Please add credits to continue.');
        } else {
          throw new Error(result.error);
        }
        setError(result.error);
        return;
      }

      setData(result);
      toast.success('AI recommendations generated!');
    } catch (err: any) {
      console.error('Error generating recommendations:', err);
      setError(err.message || 'Failed to generate recommendations');
      toast.error('Failed to generate recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedRecs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRecs(newExpanded);
  };

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Recommendations</CardTitle>
          </div>
          <CardDescription>Need copy data to generate AI insights</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect your email platform and sync campaigns to unlock AI-powered copy recommendations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Recommendations</CardTitle>
          </div>
          <Button 
            onClick={generateRecommendations} 
            disabled={isLoading}
            size="sm"
            className="gap-2"
          >
            {isLoading ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Analyzing...</>
            ) : data ? (
              <><RefreshCw className="h-4 w-4" /> Refresh</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate</>
            )}
          </Button>
        </div>
        <CardDescription>
          AI-powered insights based on your pattern data
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium mb-1">Summary</p>
              <p className="text-sm text-muted-foreground">{data.summary}</p>
              {data.baseline_reply_rate !== undefined && (
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span>Baseline: {data.baseline_reply_rate.toFixed(2)}%</span>
                  <span>Patterns: {data.patterns_analyzed}</span>
                  <span>Variants: {data.variants_analyzed}</span>
                </div>
              )}
            </div>

            {/* Recommendations */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Recommendations ({data.recommendations.length})
              </h4>
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {data.recommendations.map((rec, index) => (
                    <Collapsible 
                      key={index} 
                      open={expandedRecs.has(index)}
                      onOpenChange={() => toggleExpanded(index)}
                    >
                      <div className="rounded-lg border bg-card">
                        <CollapsibleTrigger asChild>
                          <button className="w-full p-3 flex items-start gap-3 text-left hover:bg-muted/50 transition-colors">
                            <div className="mt-0.5 text-muted-foreground">
                              {getTypeIcon(rec.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{rec.title}</span>
                                <Badge variant="outline" className="text-xs">
                                  {getTypeLabel(rec.type)}
                                </Badge>
                                <Badge className={`text-xs ${getConfidenceColor(rec.confidence)}`}>
                                  {rec.confidence}
                                </Badge>
                                {rec.expected_lift && (
                                  <Badge className="text-xs bg-success/10 text-success border-success/30">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    {rec.expected_lift}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {rec.description}
                              </p>
                            </div>
                            {expandedRecs.has(index) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 pt-0 space-y-3 border-t">
                            <p className="text-sm text-muted-foreground pt-3">
                              {rec.description}
                            </p>
                            
                            {rec.original_copy && rec.suggested_copy && (
                              <div className="grid gap-2">
                                <div className="p-2 rounded bg-destructive/5 border border-destructive/20">
                                  <p className="text-xs font-medium text-destructive mb-1">Before</p>
                                  <p className="text-sm">{rec.original_copy}</p>
                                </div>
                                <div className="p-2 rounded bg-success/5 border border-success/20">
                                  <p className="text-xs font-medium text-success mb-1">After (Suggested)</p>
                                  <p className="text-sm">{rec.suggested_copy}</p>
                                </div>
                              </div>
                            )}
                            
                            {rec.supporting_patterns && rec.supporting_patterns.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-xs text-muted-foreground">Patterns:</span>
                                {rec.supporting_patterns.map((pattern, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {pattern}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Experiment Ideas */}
            {data.experiment_ideas.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-chart-1" />
                  A/B Test Ideas
                </h4>
                <div className="space-y-2">
                  {data.experiment_ideas.map((exp, index) => (
                    <div key={index} className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <p className="text-sm font-medium">{exp.hypothesis}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Control: </span>
                          <span>{exp.control_pattern}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Test: </span>
                          <span>{exp.test_pattern}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Expected: </span>{exp.expected_outcome}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Click "Generate" to analyze your copy patterns and get AI-powered recommendations.
            </p>
            <Button onClick={generateRecommendations} disabled={isLoading}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate AI Insights
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
