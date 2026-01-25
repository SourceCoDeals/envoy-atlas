import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColdCall } from '@/hooks/useColdCallAnalytics';
import { shouldFlagForReview, formatEnhancedScore, getEnhancedScoreStatus, calculateScoreBreakdown } from '@/lib/callScoring';
import { formatCallingDuration } from '@/lib/callingConfig';
import { AlertTriangle, Play, ChevronRight, Clock, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface CallsNeedingReviewProps {
  calls: ColdCall[];
  onViewCall?: (call: ColdCall) => void;
  isLoading?: boolean;
}

export function CallsNeedingReview({ calls, onViewCall, isLoading }: CallsNeedingReviewProps) {
  // Get calls that should be flagged for review
  const flaggedCalls = calls
    .map(call => {
      const { flagged, reason } = shouldFlagForReview(call);
      return { call, flagged, reason };
    })
    .filter(({ flagged }) => flagged)
    .slice(0, 5);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Needs Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Needs Review
          {flaggedCalls.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {flaggedCalls.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {flaggedCalls.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No calls flagged for review</p>
          </div>
        ) : (
          <div className="space-y-2">
            {flaggedCalls.map(({ call, reason }) => {
              const breakdown = calculateScoreBreakdown(call);
              const status = getEnhancedScoreStatus(breakdown.normalizedScore);
              
              return (
                <button
                  key={call.id}
                  onClick={() => onViewCall?.(call)}
                  className="w-full p-3 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {call.to_name || call.to_number || 'Unknown'}
                        </p>
                        <Badge variant="outline" className={cn('text-xs', status.color)}>
                          {formatEnhancedScore(breakdown.normalizedScore)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {call.analyst?.split('@')[0]}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatCallingDuration(call.call_duration_sec)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      {reason}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
