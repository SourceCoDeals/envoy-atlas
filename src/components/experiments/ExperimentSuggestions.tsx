import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, TrendingUp, Clock, ArrowRight } from 'lucide-react';

export interface ExperimentSuggestion {
  id: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  hypothesis: string;
  rationale: string;
  expectedLift: number;
  requiredSample: number;
  estimatedDurationDays: number;
  controlSuggestion: string;
  treatmentSuggestion: string;
}

interface ExperimentSuggestionsProps {
  suggestions: ExperimentSuggestion[];
  onCreateExperiment?: (suggestion: ExperimentSuggestion) => void;
}

export function ExperimentSuggestions({ suggestions, onCreateExperiment }: ExperimentSuggestionsProps) {
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Medium Priority</Badge>;
      default:
        return <Badge variant="outline">Low Priority</Badge>;
    }
  };

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Suggestions Yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            As you gather more data, we'll suggest experiments based on your copy patterns, 
            audience performance, and timing analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-warning" />
          AI-Suggested Experiments
        </CardTitle>
        <CardDescription>
          Based on your current data and performance patterns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.map((suggestion, idx) => (
          <div
            key={suggestion.id}
            className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                <Badge variant="outline">{suggestion.type}</Badge>
                {getPriorityBadge(suggestion.priority)}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-success" />
                <span>+{(suggestion.expectedLift * 100).toFixed(0)}% expected</span>
              </div>
            </div>

            <p className="font-medium mb-2">"{suggestion.hypothesis}"</p>
            <p className="text-sm text-muted-foreground mb-3">{suggestion.rationale}</p>

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div className="p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Control</p>
                <p>{suggestion.controlSuggestion}</p>
              </div>
              <div className="p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Treatment</p>
                <p>{suggestion.treatmentSuggestion}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Sample: {suggestion.requiredSample.toLocaleString()} per variant</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  ~{suggestion.estimatedDurationDays} days
                </span>
              </div>
              <Button 
                size="sm" 
                onClick={() => onCreateExperiment?.(suggestion)}
                className="gap-1"
              >
                Create Experiment
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
