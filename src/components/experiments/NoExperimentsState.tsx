import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlaskConical, Lightbulb, ArrowRight, BookOpen } from 'lucide-react';
import { ExperimentSuggestions, ExperimentSuggestion } from './ExperimentSuggestions';

interface NoExperimentsStateProps {
  suggestions: ExperimentSuggestion[];
  onCreateExperiment?: (suggestion: ExperimentSuggestion) => void;
}

export function NoExperimentsState({ suggestions, onCreateExperiment }: NoExperimentsStateProps) {
  return (
    <div className="space-y-6">
      {/* Hero Empty State */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <FlaskConical className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Running Experiments</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            A/B tests help you systematically discover what copy, timing, and targeting work best. 
            Start with one of our data-driven suggestions below.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" disabled>
              <BookOpen className="h-4 w-4 mr-2" />
              View Testing Guide
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prominent Suggestions */}
      {suggestions.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-5 w-5 text-warning" />
              <h3 className="font-semibold">Recommended First Experiment</h3>
            </div>
            
            <div className="p-4 rounded-lg border bg-card mb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-sm text-muted-foreground">Based on your data, we recommend:</span>
                  <h4 className="text-lg font-medium mt-1">{suggestions[0].type} Test</h4>
                </div>
                <span className="text-sm font-medium text-success">
                  +{(suggestions[0].expectedLift * 100).toFixed(0)}% expected lift
                </span>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                "{suggestions[0].hypothesis}"
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Control</p>
                  <p>{suggestions[0].controlSuggestion}</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Treatment</p>
                  <p>{suggestions[0].treatmentSuggestion}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Sample: {suggestions[0].requiredSample.toLocaleString()} per variant</span>
                  <span>~{suggestions[0].estimatedDurationDays} days</span>
                </div>
                <Button onClick={() => onCreateExperiment?.(suggestions[0])} disabled>
                  Create This Experiment
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
            
            {suggestions.length > 1 && (
              <p className="text-sm text-muted-foreground text-center">
                + {suggestions.length - 1} more suggestion{suggestions.length > 2 ? 's' : ''} available below
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Suggestions */}
      <ExperimentSuggestions suggestions={suggestions} onCreateExperiment={onCreateExperiment} />

      {/* Why Experiment */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Why Run Experiments?</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="font-medium mb-2">🎯 Find What Works</p>
              <p className="text-sm text-muted-foreground">
                Discover which subject lines, CTAs, and copy patterns drive the best results for YOUR audience.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="font-medium mb-2">📊 Data-Driven Decisions</p>
              <p className="text-sm text-muted-foreground">
                Stop guessing. Statistical significance ensures your winning variants are real, not random.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="font-medium mb-2">📈 Compound Improvements</p>
              <p className="text-sm text-muted-foreground">
                A 20% lift on subject + 20% on CTA + 20% on timing = 73% total improvement.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
