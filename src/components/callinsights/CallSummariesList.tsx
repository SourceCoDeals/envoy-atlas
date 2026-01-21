import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Headphones, Eye } from 'lucide-react';
import { CallInsightsData } from '@/hooks/useExternalCallIntel';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  data: CallInsightsData;
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

export function CallSummariesList({ data, onOpenDetail }: Props) {
  const callsWithSummaries = data.intelRecords.filter(r => r.next_steps || r.personal_insights);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          AI Call Summaries
        </CardTitle>
        <CardDescription>
          Quick overview of each analyzed call with key insights
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <div className="space-y-4 pr-4">
            {callsWithSummaries.length > 0 ? (
              callsWithSummaries.slice(0, 20).map(call => {
                const callTitle = call.call?.to_name || 'Unknown Contact';
                const callDate = call.call?.started_at 
                  ? format(new Date(call.call.started_at), 'MMM d, yyyy')
                  : '-';
                const rep = call.call?.caller_name || 'Unknown';
                const duration = call.call?.talk_duration || null;
                const recordingUrl = call.call?.recording_url;

                return (
                  <div key={call.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{callTitle}</h4>
                        <p className="text-xs text-muted-foreground">
                          {callDate} • {rep} • {formatDuration(duration)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getScoreBadgeColor(call.overall_quality_score)}>
                          {call.overall_quality_score ?? '-'}/10
                        </Badge>
                        {call.interest_in_selling && (
                          <Badge 
                            variant={
                              call.interest_in_selling.toLowerCase() === 'yes' ? 'default' :
                              call.interest_in_selling.toLowerCase() === 'maybe' ? 'secondary' : 'destructive'
                            }
                          >
                            {call.interest_in_selling}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Next Steps */}
                    {call.next_steps && (
                      <div className="mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Next Steps:</span>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {call.next_steps}
                        </p>
                      </div>
                    )}
                    
                    {/* Personal Insights */}
                    {call.personal_insights && (
                      <div className="mb-3">
                        <span className="text-xs font-medium text-muted-foreground">Key Insight:</span>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {call.personal_insights}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      {recordingUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={recordingUrl} target="_blank" rel="noopener noreferrer">
                            <Headphones className="w-3 h-3 mr-1" />
                            Listen
                          </a>
                        </Button>
                      )}
                      {onOpenDetail && (
                        <Button variant="outline" size="sm" onClick={() => onOpenDetail(call.call_id)}>
                          <Eye className="w-3 h-3 mr-1" />
                          Full Details
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No call summaries available yet
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
