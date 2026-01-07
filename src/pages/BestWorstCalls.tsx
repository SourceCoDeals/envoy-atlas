import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  AlertTriangle, 
  Play, 
  Brain,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Target
} from 'lucide-react';
import { useTopAndBottomCalls } from '@/hooks/useCallIntelligence';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { formatDistanceToNow, format } from 'date-fns';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

export default function BestWorstCalls() {
  const { data: topBottom, isLoading } = useTopAndBottomCalls(10);

  // Calculate insights from top calls
  const topCallsInsights = topBottom?.topCalls.length ? {
    avgScore: Math.round(
      topBottom.topCalls.reduce((sum, c) => sum + (c.composite_score || 0), 0) / topBottom.topCalls.length
    ),
    commonOpenings: topBottom.topCalls
      .map(c => c.opening_type)
      .filter(Boolean)
      .reduce((acc, type) => {
        acc[type!] = (acc[type!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
  } : null;

  const bottomCallsInsights = topBottom?.bottomCalls.length ? {
    avgScore: Math.round(
      topBottom.bottomCalls.reduce((sum, c) => sum + (c.composite_score || 0), 0) / topBottom.bottomCalls.length
    ),
  } : null;

  const CallCard = ({ 
    item, 
    rank, 
    variant 
  }: { 
    item: typeof topBottom.topCalls[0]; 
    rank: number; 
    variant: 'top' | 'bottom';
  }) => (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
              variant === 'top' 
                ? 'bg-yellow-500/10 text-yellow-500' 
                : 'bg-orange-500/10 text-orange-500'
            }`}
          >
            #{rank}
          </div>
          <div>
            <p className="font-medium">{item.call?.phone_number || 'Unknown'}</p>
            <p className="text-sm text-muted-foreground">
              {item.call?.start_at 
                ? format(new Date(item.call.start_at), 'MMM d, yyyy h:mm a')
                : 'Unknown date'
              }
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${getScoreColor(item.composite_score || 0)}`}>
            {item.composite_score}
          </p>
          <p className="text-xs text-muted-foreground">AI Score</p>
        </div>
      </div>

      {/* Score Details */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-muted/50 rounded p-2">
          <p className="text-lg font-bold">{item.seller_interest_score || '--'}</p>
          <p className="text-xs text-muted-foreground">Interest</p>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <p className="text-lg font-bold">{item.next_step_clarity_score || '--'}</p>
          <p className="text-xs text-muted-foreground">Next Step</p>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <p className="text-xs font-medium capitalize">{item.opening_type || '--'}</p>
          <p className="text-xs text-muted-foreground">Opening</p>
        </div>
        <div className="bg-muted/50 rounded p-2">
          <p className="text-lg font-bold">{item.call?.duration_seconds ? formatDuration(item.call.duration_seconds) : '--'}</p>
          <p className="text-xs text-muted-foreground">Duration</p>
        </div>
      </div>

      {/* Personal Insights */}
      {item.personal_insights && (
        <div className="bg-muted/30 rounded p-3">
          <p className="text-xs text-muted-foreground mb-1">Personal Insights Captured</p>
          <p className="text-sm">{item.personal_insights}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1">
          <Play className="h-4 w-4 mr-2" />
          Listen
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          <Brain className="h-4 w-4 mr-2" />
          Full Analysis
        </Button>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Best & Worst Calls</h1>
          <p className="text-muted-foreground">
            Learn from your top performers and identify coaching opportunities
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Calls Avg</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-green-500">
                  {topCallsInsights?.avgScore || '--'}/100
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bottom Calls Avg</CardTitle>
              <TrendingDown className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-orange-500">
                  {bottomCallsInsights?.avgScore || '--'}/100
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Score Gap</CardTitle>
              <Target className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-blue-500">
                  {topCallsInsights && bottomCallsInsights 
                    ? `+${topCallsInsights.avgScore - bottomCallsInsights.avgScore}` 
                    : '--'
                  }
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Insights Panel */}
        {topCallsInsights && Object.keys(topCallsInsights.commonOpenings).length > 0 && (
          <Card className="bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-600">
                <Lightbulb className="h-5 w-5" />
                What Top Calls Have in Common
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(topCallsInsights.commonOpenings).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="border-yellow-500/50">
                    {type} opening ({count} calls)
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for Top/Bottom */}
        <Tabs defaultValue="top" className="space-y-4">
          <TabsList>
            <TabsTrigger value="top" className="gap-2">
              <Trophy className="h-4 w-4" />
              Top 10 Calls
            </TabsTrigger>
            <TabsTrigger value="bottom" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Bottom 10 Calls
            </TabsTrigger>
          </TabsList>

          <TabsContent value="top">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
            ) : topBottom?.topCalls.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No scored calls yet</p>
                  <p className="text-sm">Process calls to see your top performers</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {topBottom?.topCalls.map((item, index) => (
                  <CallCard key={item.id} item={item} rank={index + 1} variant="top" />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bottom">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
            ) : topBottom?.bottomCalls.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No scored calls yet</p>
                  <p className="text-sm">Process calls to identify coaching opportunities</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {topBottom?.bottomCalls.map((item, index) => (
                  <CallCard key={item.id} item={item} rank={index + 1} variant="bottom" />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
