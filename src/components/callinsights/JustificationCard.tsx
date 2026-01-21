import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Headphones, Eye, Quote } from 'lucide-react';
import { ExternalCallIntel } from '@/hooks/useExternalCallIntel';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface JustificationCardProps {
  call: ExternalCallIntel;
  scoreType: string;
  onOpenDetail?: (callId: string) => void;
}

function getScoreBadgeColor(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 8) return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
  if (score >= 6) return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
  if (score >= 4) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function JustificationCard({ call, scoreType, onOpenDetail }: JustificationCardProps) {
  const scoreKey = `${scoreType}_score` as keyof ExternalCallIntel;
  const justificationKey = `${scoreType}_justification` as keyof ExternalCallIntel;
  
  const score = call[scoreKey] as number | null;
  const justification = call[justificationKey] as string | null;

  const callTitle = call.call?.to_name || 'Unknown Contact';
  const callDate = call.call?.started_at 
    ? format(new Date(call.call.started_at), 'MMM d, yyyy')
    : '-';
  const rep = call.call?.caller_name || 'Unknown Rep';
  const duration = call.call?.talk_duration || null;
  const recordingUrl = call.call?.recording_url;

  // Other scores preview
  const otherScoreKeys = [
    { key: 'overall_quality', label: 'Overall' },
    { key: 'seller_interest', label: 'Interest' },
    { key: 'script_adherence', label: 'Script' },
    { key: 'question_adherence', label: 'Questions' },
  ].filter(s => s.key !== scoreType);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Badge className={cn("text-lg px-3 py-1", getScoreBadgeColor(score))}>
                {score ?? '-'}/10
              </Badge>
              <div>
                <h3 className="font-semibold truncate max-w-md">
                  {callTitle}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {callDate} • {rep} • {formatDuration(duration)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {recordingUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={recordingUrl} target="_blank" rel="noopener noreferrer">
                  <Headphones className="w-4 h-4 mr-1" />
                  Listen
                </a>
              </Button>
            )}
            {onOpenDetail && (
              <Button variant="outline" size="sm" onClick={() => onOpenDetail(call.call_id)}>
                <Eye className="w-4 h-4 mr-1" />
                Details
              </Button>
            )}
          </div>
        </div>
        
        {/* Justification Text */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Quote className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm leading-relaxed">
              {justification || "No justification provided"}
            </p>
          </div>
        </div>
        
        {/* Other Scores Preview */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Other scores:</span>
          {otherScoreKeys.map(({ key, label }) => {
            const otherScoreKey = `${key}_score` as keyof ExternalCallIntel;
            const otherScore = call[otherScoreKey] as number | null;
            return (
              <Badge key={key} variant="outline" className="text-xs">
                {label}: {otherScore ?? '-'}
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
