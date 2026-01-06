import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, CheckCircle, XCircle, BookOpen, Rocket, FlaskConical } from 'lucide-react';
import { ActiveExperiment } from './ActiveExperimentCard';

interface ExperimentResultsCardProps {
  experiment: ActiveExperiment;
  onAddToPlaybook?: () => void;
  onApplyToCampaigns?: () => void;
  onCreateFollowUp?: () => void;
}

export function ExperimentResultsCard({ 
  experiment, 
  onAddToPlaybook, 
  onApplyToCampaigns, 
  onCreateFollowUp 
}: ExperimentResultsCardProps) {
  const hasWinner = experiment.winner !== null;
  const control = experiment.variants.find(v => v.isControl);
  
  const lift = control && experiment.winner && control.replyRate > 0
    ? ((experiment.winner.replyRate - control.replyRate) / control.replyRate) * 100
    : 0;

  const getResultBadge = () => {
    if (hasWinner) {
      return (
        <Badge className="bg-success/20 text-success border-success/30">
          <Trophy className="w-3 h-3 mr-1" />
          WINNER DECLARED
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <XCircle className="w-3 h-3 mr-1" />
        NO SIGNIFICANT DIFFERENCE
      </Badge>
    );
  };

  const getConclusion = () => {
    if (hasWinner && experiment.winner) {
      return `"${experiment.winner.name}" outperforms control with ${experiment.confidence.toFixed(0)}% confidence. This represents a ${lift > 0 ? '+' : ''}${lift.toFixed(1)}% improvement in ${experiment.primaryMetric}.`;
    }
    return 'No statistically significant difference was detected between the variants. Consider testing a more distinct variation or extending the sample size.';
  };

  const getRecommendedActions = () => {
    if (hasWinner) {
      return [
        'Deploy winning variant across all active campaigns',
        'Update playbook with this finding',
        `Test additional variations of the winning approach`
      ];
    }
    return [
      'Consider testing more distinct variations',
      'Review if the hypothesis was specific enough',
      'Analyze qualitative differences in replies'
    ];
  };

  return (
    <Card className={hasWinner ? 'border-success/30' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{experiment.name}</CardTitle>
            <CardDescription>
              Completed • {experiment.variants.reduce((sum, v) => sum + v.sentCount, 0).toLocaleString()} total sends
            </CardDescription>
          </div>
          {getResultBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Winner Announcement */}
        {hasWinner && experiment.winner && (
          <div className="p-4 rounded-lg bg-success/10 border border-success/30">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="font-bold text-success">
                {experiment.winner.name} wins with {experiment.confidence.toFixed(1)}% confidence
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {experiment.primaryMetric} Improvement: <span className="font-bold text-success">+{lift.toFixed(1)}%</span> (p={experiment.pValue?.toFixed(4)})
            </p>
          </div>
        )}

        {/* Detailed Results Table */}
        <div>
          <h4 className="text-sm font-medium mb-3">Detailed Results</h4>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">Sample</TableHead>
                  <TableHead className="text-right">Reply Rate</TableHead>
                  <TableHead className="text-right">Positive Rate</TableHead>
                  <TableHead className="text-right">Lift</TableHead>
                  <TableHead className="text-right">Sig?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {experiment.variants.map(variant => {
                  const variantLift = control && !variant.isControl && control.replyRate > 0
                    ? ((variant.replyRate - control.replyRate) / control.replyRate) * 100
                    : 0;
                  const isWinner = experiment.winner?.id === variant.id;
                  
                  return (
                    <TableRow key={variant.id} className={isWinner ? 'bg-success/5' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isWinner && <Trophy className="h-4 w-4 text-yellow-500" />}
                          {variant.name}
                          {variant.isControl && <Badge variant="outline" className="text-xs">Control</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{variant.sentCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">{variant.replyRate.toFixed(2)}%</TableCell>
                      <TableCell className="text-right font-mono">{variant.positiveRate.toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-mono">
                        {variant.isControl ? '—' : (
                          <span className={variantLift > 0 ? 'text-success' : variantLift < 0 ? 'text-destructive' : ''}>
                            {variantLift >= 0 ? '+' : ''}{variantLift.toFixed(1)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {variant.isControl ? '—' : (
                          isWinner ? (
                            <CheckCircle className="h-4 w-4 text-success inline" />
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Confidence Visualization */}
        {hasWinner && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Confidence Interval</h4>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="relative h-8 bg-muted rounded">
                <div className="absolute top-0 left-1/2 h-full w-px bg-border" />
                <div 
                  className="absolute top-1 h-6 bg-success/30 rounded"
                  style={{ 
                    left: `${Math.max(50 + (lift - 30) / 2, 10)}%`,
                    width: `${Math.min(60, 40)}%`
                  }}
                />
                <div 
                  className="absolute top-2 h-4 w-2 bg-success rounded"
                  style={{ left: `${50 + lift / 2}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>-20%</span>
                <span>0%</span>
                <span>+{lift.toFixed(1)}%</span>
                <span>+60%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                95% CI: Entire confidence interval is positive → statistically significant
              </p>
            </div>
          </div>
        )}

        {/* Conclusion */}
        <div className="p-4 rounded-lg bg-muted/50">
          <h4 className="text-sm font-medium mb-2">Conclusion</h4>
          <p className="text-sm text-muted-foreground">{getConclusion()}</p>
          
          <h4 className="text-sm font-medium mt-4 mb-2">Recommended Actions</h4>
          <ul className="space-y-1">
            {getRecommendedActions().map((action, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary">{idx + 1}.</span>
                {action}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={onAddToPlaybook} className="gap-2">
            <BookOpen className="h-4 w-4" />
            Add to Playbook
          </Button>
          {hasWinner && (
            <Button variant="outline" onClick={onApplyToCampaigns} className="gap-2">
              <Rocket className="h-4 w-4" />
              Apply to Campaigns
            </Button>
          )}
          <Button variant="outline" onClick={onCreateFollowUp} className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Create Follow-up Test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
