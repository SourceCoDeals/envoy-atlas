import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, Pause, Square, Clock, TrendingUp, TrendingDown, Trophy } from 'lucide-react';

export interface ExperimentVariant {
  id: string;
  name: string;
  subjectLine: string | null;
  isControl: boolean;
  sentCount: number;
  replyCount: number;
  replyRate: number;
  positiveRate: number;
}

export interface ActiveExperiment {
  id: string;
  name: string;
  hypothesis: string;
  primaryMetric: string;
  status: 'running' | 'completed' | 'needs_data' | 'draft';
  dayNumber: number;
  totalDays: number;
  variants: ExperimentVariant[];
  requiredSamplePerVariant: number;
  currentSampleControl: number;
  currentSampleTreatment: number;
  winner: ExperimentVariant | null;
  confidence: number;
  pValue: number | null;
  lift: number | null;
  estimatedDaysRemaining: number | null;
}

interface ActiveExperimentCardProps {
  experiment: ActiveExperiment;
  onViewDetails?: () => void;
  onPause?: () => void;
  onStop?: () => void;
}

export function ActiveExperimentCard({ experiment, onViewDetails, onPause, onStop }: ActiveExperimentCardProps) {
  const progress = Math.min(
    ((experiment.currentSampleControl + experiment.currentSampleTreatment) / 
    (experiment.requiredSamplePerVariant * 2)) * 100,
    100
  );

  const getStatusBadge = () => {
    switch (experiment.status) {
      case 'completed':
        return <Badge className="bg-success/20 text-success border-success/30"><Trophy className="w-3 h-3 mr-1" />Winner Found</Badge>;
      case 'running':
        return <Badge className="bg-primary/20 text-primary border-primary/30"><Play className="w-3 h-3 mr-1" />Running</Badge>;
      case 'needs_data':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Needs Data</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const getSignificanceStatus = () => {
    if (experiment.status === 'completed' && experiment.winner) {
      return 'Statistically significant';
    }
    if (experiment.confidence >= 80) {
      return 'Promising but not yet significant';
    }
    return 'Collecting data';
  };

  const control = experiment.variants.find(v => v.isControl);
  const treatments = experiment.variants.filter(v => !v.isControl);

  return (
    <Card className={experiment.winner ? 'border-success/30' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{experiment.name}</CardTitle>
            <CardDescription>
              DAY {experiment.dayNumber} of {experiment.totalDays}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hypothesis */}
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-sm">
            <span className="font-medium">Hypothesis:</span> "{experiment.hypothesis}"
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-mono">{progress.toFixed(0)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Control: {experiment.currentSampleControl.toLocaleString()} sends</span>
            <span>Treatment: {experiment.currentSampleTreatment.toLocaleString()} sends</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Required: {experiment.requiredSamplePerVariant.toLocaleString()} per variant
          </p>
        </div>

        {/* Results Table */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variant</TableHead>
                <TableHead className="text-right">Sends</TableHead>
                <TableHead className="text-right">Replies</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">vs Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {control && (
                <TableRow>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {experiment.winner?.id === control.id && <Trophy className="h-4 w-4 text-yellow-500" />}
                      <span>{control.name}</span>
                      <Badge variant="outline" className="text-xs">Control</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{control.sentCount.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{control.replyCount}</TableCell>
                  <TableCell className="text-right font-mono">{control.replyRate.toFixed(2)}%</TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                </TableRow>
              )}
              {treatments.map(treatment => {
                const lift = control && control.replyRate > 0 
                  ? ((treatment.replyRate - control.replyRate) / control.replyRate) * 100 
                  : 0;
                const isWinner = experiment.winner?.id === treatment.id;
                
                return (
                  <TableRow key={treatment.id} className={isWinner ? 'bg-success/5' : ''}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isWinner && <Trophy className="h-4 w-4 text-yellow-500" />}
                        <span>{treatment.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{treatment.sentCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{treatment.replyCount}</TableCell>
                    <TableCell className="text-right font-mono">{treatment.replyRate.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {lift > 0 ? (
                          <TrendingUp className="h-3 w-3 text-success" />
                        ) : lift < 0 ? (
                          <TrendingDown className="h-3 w-3 text-destructive" />
                        ) : null}
                        <span className={lift > 0 ? 'text-success' : lift < 0 ? 'text-destructive' : ''}>
                          {lift >= 0 ? '+' : ''}{lift.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">STATUS: {getSignificanceStatus()}</p>
            {experiment.confidence > 0 && (
              <p className="text-xs text-muted-foreground">
                p = {experiment.pValue?.toFixed(3) || 'N/A'} • Confidence: {experiment.confidence.toFixed(0)}%
              </p>
            )}
            {experiment.estimatedDaysRemaining && experiment.status === 'running' && (
              <p className="text-xs text-muted-foreground">
                ⏱️ Estimated time to significance: {experiment.estimatedDaysRemaining} more days
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onViewDetails}>
              View Details
            </Button>
            {experiment.status === 'running' && (
              <>
                <Button variant="outline" size="sm" onClick={onPause}>
                  <Pause className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={onStop}>
                  <Square className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
