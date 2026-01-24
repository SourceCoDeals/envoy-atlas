import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Trophy, 
  AlertTriangle, 
  Play, 
  Brain,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Target,
  Filter
} from 'lucide-react';
import { useEnhancedCallingAnalytics, DateRange } from '@/hooks/useEnhancedCallingAnalytics';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { formatScore, formatCallingDuration, getScoreStatus, getScoreStatusColor } from '@/lib/callingConfig';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { format } from 'date-fns';
import { useState } from 'react';

export default function BestWorstCalls() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const { data, isLoading } = useEnhancedCallingAnalytics(dateRange);
  const { config } = useCallingConfig();

  // Calculate insights from top and worst calls
  const topCallsAvg = data?.topCalls.length 
    ? data.topCalls.reduce((sum, c) => sum + (c.composite_score || 0), 0) / data.topCalls.length 
    : 0;
  
  const worstCallsAvg = data?.worstCalls.length 
    ? data.worstCalls.reduce((sum, c) => sum + (c.composite_score || 0), 0) / data.worstCalls.length 
    : 0;

  const scoreGap = topCallsAvg - worstCallsAvg;

  const CallCard = ({ 
    call, 
    rank, 
    variant 
  }: { 
    call: typeof data.topCalls[0]; 
    rank: number; 
    variant: 'top' | 'bottom';
  }) => {
    const status = getScoreStatus(call.composite_score, config.overallQualityThresholds);
    
    return (
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
              <p className="font-medium">{call.prospect_name || call.prospect_phone || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">
                {call.called_date ? format(new Date(call.called_date), 'MMM d, yyyy') : 'Unknown date'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${getScoreStatusColor(status)}`}>
              {formatScore(call.composite_score, config)}
            </p>
            <p className="text-xs text-muted-foreground">Overall Score</p>
          </div>
        </div>

        {/* Score Details */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-muted/50 rounded p-2">
            <p className="text-lg font-bold">{formatScore(call.seller_interest_score, config)}</p>
            <p className="text-xs text-muted-foreground">Interest</p>
          </div>
          <div className="bg-muted/50 rounded p-2">
            <p className="text-lg font-bold">{formatScore(call.objection_handling_score, config)}</p>
            <p className="text-xs text-muted-foreground">Objections</p>
          </div>
          <div className="bg-muted/50 rounded p-2">
            <p className="text-lg font-bold">{formatScore(call.script_adherence_score, config)}</p>
            <p className="text-xs text-muted-foreground">Script</p>
          </div>
          <div className="bg-muted/50 rounded p-2">
            <p className="text-lg font-bold">{formatCallingDuration(call.call_duration_sec)}</p>
            <p className="text-xs text-muted-foreground">Duration</p>
          </div>
        </div>

        {/* Rep info */}
        {call.analyst && (
          <div className="text-sm text-muted-foreground">
            Rep: {call.analyst.split('@')[0]}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {call.recording_url && (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <a href={call.recording_url} target="_blank" rel="noopener noreferrer">
                <Play className="h-4 w-4 mr-2" />
                Listen
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className="flex-1">
            <Brain className="h-4 w-4 mr-2" />
            Full Analysis
          </Button>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Best & Worst Calls</h1>
            <p className="text-muted-foreground">
              Learn from your top performers and identify coaching opportunities
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="14d">14 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="90d">90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
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
                  {formatScore(topCallsAvg, config)}/10
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Threshold: ≥ {config.topCallsMinScore}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Worst Calls Avg</CardTitle>
              <TrendingDown className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-orange-500">
                  {formatScore(worstCallsAvg, config)}/10
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Threshold: ≤ {config.worstCallsMaxScore}
              </p>
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
                  +{formatScore(scoreGap, config)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Needs Coaching</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-amber-500">
                  {data?.needsCoaching.length || 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Below threshold ({config.coachingAlertOverallQuality})
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Insights Panel */}
        {data?.topCalls && data.topCalls.length > 0 && (
          <Card className="bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-600">
                <Lightbulb className="h-5 w-5" />
                Configuration Thresholds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-green-500/50">
                  Top calls: Overall ≥ {config.topCallsMinScore}
                </Badge>
                <Badge variant="outline" className="border-red-500/50">
                  Worst calls: Overall ≤ {config.worstCallsMaxScore}
                </Badge>
                <Badge variant="outline" className="border-amber-500/50">
                  Coaching alert: Any score &lt; {config.coachingAlertOverallQuality}
                </Badge>
                <Badge variant="outline" className="border-orange-500/50">
                  Hot lead: Interest ≥ {config.hotLeadInterestScore}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for Top/Bottom */}
        <Tabs defaultValue="top" className="space-y-4">
          <TabsList>
            <TabsTrigger value="top" className="gap-2">
              <Trophy className="h-4 w-4" />
              Top Calls ({data?.topCalls.length || 0})
            </TabsTrigger>
            <TabsTrigger value="bottom" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Worst Calls ({data?.worstCalls.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="top">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
            ) : !data?.topCalls.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No top calls yet</p>
                  <p className="text-sm">Calls with overall score ≥ {config.topCallsMinScore} will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.topCalls.map((call, index) => (
                  <CallCard key={call.id} call={call} rank={index + 1} variant="top" />
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
            ) : !data?.worstCalls.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No worst calls identified</p>
                  <p className="text-sm">Calls with overall score ≤ {config.worstCallsMaxScore} will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.worstCalls.map((call, index) => (
                  <CallCard key={call.id} call={call} rank={index + 1} variant="bottom" />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
