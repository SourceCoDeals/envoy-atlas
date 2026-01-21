import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, AlertTriangle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CallForReview {
  id: string;
  to_name: string | null;
  caller_name: string | null;
  composite_score: number | null;
}

interface CoachingInsightsPanelProps {
  topCalls: CallForReview[];
  needsCoaching: CallForReview[];
  topCallsThreshold: number;
  coachingThreshold: number;
}

export function CoachingInsightsPanel({
  topCalls,
  needsCoaching,
  topCallsThreshold,
  coachingThreshold,
}: CoachingInsightsPanelProps) {
  const navigate = useNavigate();

  const formatName = (name: string | null) => {
    if (!name) return 'Unknown';
    // If it's an email, get just the name part
    if (name.includes('@')) return name.split('@')[0];
    return name;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          ✨ Coaching Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Calls */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <span className="font-medium">TOP CALLS TO LEARN FROM</span>
            </div>
            <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg space-y-2">
              <p className="text-sm font-medium text-green-700">
                {topCalls.length} calls with score ≥ {topCallsThreshold}
              </p>
              <div className="space-y-1">
                {topCalls.slice(0, 3).map((call) => (
                  <p key={call.id} className="text-sm text-muted-foreground">
                    • {formatName(call.to_name)} ({call.composite_score?.toFixed(1)}) - {formatName(call.caller_name)}
                  </p>
                ))}
                {topCalls.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    + {topCalls.length - 3} more...
                  </p>
                )}
              </div>
              <Button 
                variant="link" 
                className="p-0 h-auto text-green-700 hover:text-green-800"
                onClick={() => navigate('/top-calls')}
              >
                View Best Calls <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Needs Coaching */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="font-medium">CALLS NEEDING REVIEW</span>
            </div>
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-2">
              <p className="text-sm font-medium text-amber-700">
                {needsCoaching.length} calls with score &lt; {coachingThreshold}
              </p>
              <div className="space-y-1">
                {needsCoaching.slice(0, 3).map((call) => (
                  <p key={call.id} className="text-sm text-muted-foreground">
                    • {formatName(call.to_name)} ({call.composite_score?.toFixed(1)}) - {formatName(call.caller_name)}
                  </p>
                ))}
                {needsCoaching.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    + {needsCoaching.length - 3} more...
                  </p>
                )}
              </div>
              <Button 
                variant="link" 
                className="p-0 h-auto text-amber-700 hover:text-amber-800"
                onClick={() => navigate('/training-queue')}
              >
                Review These Calls <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
