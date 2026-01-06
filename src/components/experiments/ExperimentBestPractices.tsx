import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Target, ChevronDown, ChevronUp, Lightbulb, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export function ExperimentBestPractices() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  A/B Testing Best Practices
                </CardTitle>
                <CardDescription>Guidelines for rigorous experimentation</CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Core Principles */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <p className="font-medium">Test ONE Variable</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Change only one element per test (subject line, CTA, send time) for clear attribution. 
                  Multi-variable tests require 4x the sample size.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <p className="font-medium">Calculate Sample Size First</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Use the power calculator before starting. At 3% baseline reply rate, you need 
                  <strong> 500+ sends per variant</strong> to detect 50% relative lifts.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <p className="font-medium">Document Learnings</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Add results to your Playbook to build institutional knowledge. 
                  Even "no difference" results are valuable learnings.
                </p>
              </div>
            </div>

            {/* Common Mistakes */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Common Mistakes to Avoid
              </h4>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Stopping too early</p>
                    <p className="text-muted-foreground">
                      Don't end tests when one variant is "winning" — wait for statistical significance (95%+ confidence).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Too small sample sizes</p>
                    <p className="text-muted-foreground">
                      100 sends per variant can only detect 200%+ lifts. You'll miss real improvements.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Testing tiny variations</p>
                    <p className="text-muted-foreground">
                      "Hi [Name]" vs "Hello [Name]" won't produce detectable differences. Test bold changes.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Ignoring external factors</p>
                    <p className="text-muted-foreground">
                      Seasonality, holidays, and news events can skew results. Run tests for at least 14 days.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Good Hypothesis Examples */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-warning" />
                Writing Good Hypotheses
              </h4>
              <div className="p-4 rounded-lg border bg-card">
                <p className="text-sm text-muted-foreground mb-3">
                  A good hypothesis is specific, measurable, and based on data:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
                    <div>
                      <p className="font-medium">Good:</p>
                      <p className="text-muted-foreground italic">
                        "Question-based subject lines will increase reply rate by 25%+ because 
                        our data shows questions get 23% higher engagement in similar segments."
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium">Bad:</p>
                      <p className="text-muted-foreground italic">
                        "This new subject line will perform better."
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sample Size Quick Reference */}
            <div className="space-y-3">
              <h4 className="font-medium">Quick Sample Size Reference (at 3% baseline)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Lift to Detect</th>
                      <th className="text-right py-2 font-medium">Sample/Variant</th>
                      <th className="text-right py-2 font-medium">At 500/day</th>
                      <th className="text-left py-2 font-medium pl-4">Practical?</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="py-2">10% relative (+0.3% absolute)</td>
                      <td className="text-right font-mono">~12,000</td>
                      <td className="text-right">~48 days</td>
                      <td className="pl-4 text-warning">Difficult</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2">25% relative (+0.75% absolute)</td>
                      <td className="text-right font-mono">~2,000</td>
                      <td className="text-right">~8 days</td>
                      <td className="pl-4 text-success">Practical</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2">50% relative (+1.5% absolute)</td>
                      <td className="text-right font-mono">~550</td>
                      <td className="text-right">~3 days</td>
                      <td className="pl-4 text-success">Easy</td>
                    </tr>
                    <tr>
                      <td className="py-2">100% relative (+3% absolute)</td>
                      <td className="text-right font-mono">~150</td>
                      <td className="text-right">~1 day</td>
                      <td className="pl-4 text-success">Very Easy</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Based on 95% confidence level and 80% statistical power. Actual requirements may vary.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
