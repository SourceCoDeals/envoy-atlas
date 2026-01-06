import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingDown, Target, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ExperimentProgramHealthProps {
  totalTests: number;
  winnersFound: number;
  noDiffFound: number;
  avgSampleSize: number;
  avgDurationDays: number;
}

export function ExperimentProgramHealth({
  totalTests,
  winnersFound,
  noDiffFound,
  avgSampleSize,
  avgDurationDays
}: ExperimentProgramHealthProps) {
  const winnerRate = totalTests > 0 ? (winnersFound / totalTests) * 100 : 0;
  const expectedWinnerRate = 25; // Healthy programs find winners 20-30% of the time
  
  // Minimum sample sizes for detecting various lifts at 95% confidence, 80% power
  // Based on 3% baseline reply rate (typical cold email)
  const RECOMMENDED_MIN_SAMPLE = 500;
  const RECOMMENDED_MIN_DURATION = 14;
  
  const isUnderpowered = avgSampleSize < RECOMMENDED_MIN_SAMPLE;
  const isTooShort = avgDurationDays < RECOMMENDED_MIN_DURATION;
  const hasHealthyWinRate = winnerRate >= 15;
  
  const getHealthStatus = () => {
    if (totalTests === 0) return { status: 'no_data', label: 'No Data', color: 'text-muted-foreground' };
    if (winnerRate >= 20) return { status: 'healthy', label: 'Healthy', color: 'text-success' };
    if (winnerRate >= 10) return { status: 'warning', label: 'Needs Attention', color: 'text-warning' };
    return { status: 'critical', label: 'Underpowered', color: 'text-destructive' };
  };
  
  const health = getHealthStatus();

  if (totalTests === 0) {
    return null;
  }

  return (
    <Card className={health.status === 'critical' ? 'border-destructive/50' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {health.status === 'critical' ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : health.status === 'warning' ? (
                <AlertCircle className="h-5 w-5 text-warning" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-success" />
              )}
              Experimentation Program Health
            </CardTitle>
            <CardDescription>Meta-analysis of your testing effectiveness</CardDescription>
          </div>
          <Badge className={`${health.color} bg-transparent border`}>
            {health.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Diagnosis Banner */}
        {health.status === 'critical' && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Your testing program may be underpowered</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {winnersFound} winner{winnersFound !== 1 ? 's' : ''} found from {totalTests} tests ({winnerRate.toFixed(1)}% winner rate).
                  Healthy programs typically find winners 20-30% of the time.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Tests Completed</p>
            <p className="text-2xl font-bold">{totalTests}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Winners Found</p>
            <p className={`text-2xl font-bold ${winnersFound === 0 ? 'text-destructive' : 'text-success'}`}>
              {winnersFound}
            </p>
            <p className="text-xs text-muted-foreground">{winnerRate.toFixed(1)}% win rate</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Avg Sample Size</p>
            <p className={`text-2xl font-bold ${isUnderpowered ? 'text-destructive' : ''}`}>
              {avgSampleSize.toLocaleString()}
            </p>
            {isUnderpowered && (
              <p className="text-xs text-destructive">Below {RECOMMENDED_MIN_SAMPLE} min</p>
            )}
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Avg Duration</p>
            <p className={`text-2xl font-bold ${isTooShort ? 'text-warning' : ''}`}>
              {avgDurationDays.toFixed(1)} days
            </p>
            {isTooShort && (
              <p className="text-xs text-warning">Below {RECOMMENDED_MIN_DURATION}d min</p>
            )}
          </div>
        </div>

        {/* Root Cause Analysis */}
        {(isUnderpowered || isTooShort) && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Root Cause Analysis
            </h4>
            <div className="space-y-2 text-sm">
              {isUnderpowered && (
                <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                  <TrendingDown className="h-4 w-4 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium">Sample sizes too small</p>
                    <p className="text-muted-foreground">
                      Average of {avgSampleSize} per variant can only detect ~{Math.round(300 / Math.sqrt(avgSampleSize))}%+ relative lifts. 
                      Realistic 20-50% improvements go undetected → "No difference".
                    </p>
                  </div>
                </div>
              )}
              {isTooShort && (
                <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                  <TrendingDown className="h-4 w-4 text-warning mt-0.5" />
                  <div>
                    <p className="font-medium">Tests ending too early</p>
                    <p className="text-muted-foreground">
                      Average duration of {avgDurationDays.toFixed(1)} days is below the recommended 14-day minimum.
                      Tests need time to reach statistical significance.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="p-4 rounded-lg border bg-card">
          <h4 className="font-medium mb-3">Recommendations</h4>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            {isUnderpowered && (
              <li>Increase minimum sample size to <strong className="text-foreground">{RECOMMENDED_MIN_SAMPLE}+</strong> per variant</li>
            )}
            {isTooShort && (
              <li>Run tests for minimum <strong className="text-foreground">{RECOMMENDED_MIN_DURATION} days</strong></li>
            )}
            <li>Use power calculator before launching tests to set realistic expectations</li>
            <li>Focus on high-volume campaigns for faster results</li>
            <li>Consider testing bolder changes that create larger, more detectable effects</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
