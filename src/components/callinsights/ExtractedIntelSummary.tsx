import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ThumbsUp, Search, Clock, Users, Target, Brain, AlertCircle
} from 'lucide-react';
import { CallInsightsData } from '@/hooks/useExternalCallIntel';
import { CallingMetricsConfig, formatScore } from '@/lib/callingConfig';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CallSummariesList } from './CallSummariesList';

interface Props {
  data: CallInsightsData | undefined;
  config: CallingMetricsConfig;
}

export function ExtractedIntelSummary({ data, config }: Props) {
  const [insightSearch, setInsightSearch] = useState('');
  const [painPointSearch, setPainPointSearch] = useState('');

  if (!data) return null;

  const { 
    interestBreakdown, 
    timelineBreakdown, 
    buyerTypeBreakdown,
    personalInsightsList,
    painPointsList 
  } = data;

  const totalCalls = data.intelRecords.length;

  // Filter insights
  const filteredInsights = personalInsightsList.filter(item =>
    item.insight.toLowerCase().includes(insightSearch.toLowerCase())
  );

  // Filter pain points
  const filteredPainPoints = painPointsList.filter(item =>
    item.painPoint.toLowerCase().includes(painPointSearch.toLowerCase())
  );

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const maxTimelineCount = Math.max(...timelineBreakdown.map(t => t.count), 1);

  return (
    <div className="space-y-6">
      {/* Interest in Selling Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5" />
            Interest in Selling
          </CardTitle>
          <CardDescription>
            Breakdown of prospect interest responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-900">
              <div className="text-3xl font-bold text-green-600">{interestBreakdown.yes}</div>
              <div className="text-sm text-green-700 dark:text-green-400">Yes</div>
              <div className="text-xs text-green-600 dark:text-green-500 mt-1">
                {totalCalls > 0 ? ((interestBreakdown.yes / totalCalls) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-900">
              <div className="text-3xl font-bold text-yellow-600">{interestBreakdown.maybe}</div>
              <div className="text-sm text-yellow-700 dark:text-yellow-400">Maybe</div>
              <div className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                {totalCalls > 0 ? ((interestBreakdown.maybe / totalCalls) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900">
              <div className="text-3xl font-bold text-red-600">{interestBreakdown.no}</div>
              <div className="text-sm text-red-700 dark:text-red-400">No</div>
              <div className="text-xs text-red-600 dark:text-red-500 mt-1">
                {totalCalls > 0 ? ((interestBreakdown.no / totalCalls) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted border">
              <div className="text-3xl font-bold text-muted-foreground">{interestBreakdown.notAsked}</div>
              <div className="text-sm text-muted-foreground">Not Asked</div>
              <div className="text-xs text-muted-foreground mt-1">
                {totalCalls > 0 ? ((interestBreakdown.notAsked / totalCalls) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline and Buyer Type */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Timeline to Sell */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timeline to Sell
            </CardTitle>
            <CardDescription>When captured from conversations</CardDescription>
          </CardHeader>
          <CardContent>
            {timelineBreakdown.length > 0 ? (
              <div className="space-y-3">
                {timelineBreakdown.slice(0, 10).map((item) => (
                  <div key={item.value} className="flex items-center justify-between gap-4">
                    <span className="text-sm truncate flex-1">{item.value}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(item.count / maxTimelineCount) * 100}%` }}
                        />
                      </div>
                      <Badge variant="secondary" className="min-w-[32px] justify-center">
                        {item.count}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No timeline data captured yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Buyer Type Preference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Buyer Type Preference
            </CardTitle>
            <CardDescription>When captured from conversations</CardDescription>
          </CardHeader>
          <CardContent>
            {buyerTypeBreakdown.length > 0 ? (
              <div className="space-y-3">
                {buyerTypeBreakdown.slice(0, 10).map((item) => (
                  <div key={item.value} className="flex items-center justify-between gap-4">
                    <span className="text-sm truncate flex-1 max-w-[200px]">{item.value}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No buyer preference data captured yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pain Points Database */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Pain Points Database
          </CardTitle>
          <CardDescription>
            Business challenges extracted from conversations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search pain points..."
              value={painPointSearch}
              onChange={(e) => setPainPointSearch(e.target.value)}
              className="pl-10 max-w-sm"
            />
          </div>
          {filteredPainPoints.length > 0 ? (
            <ScrollArea className="h-[200px]">
              <div className="flex flex-wrap gap-2 pr-4">
                {filteredPainPoints.slice(0, 50).map((item) => (
                  <Badge 
                    key={item.painPoint} 
                    variant="outline"
                    className="text-sm py-1.5 px-3"
                  >
                    {item.painPoint}
                    <span className="ml-2 text-muted-foreground">({item.count})</span>
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {painPointSearch ? 'No pain points match your search' : 'No pain points captured yet'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personal Insights Database */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Personal Insights Database
          </CardTitle>
          <CardDescription>
            Searchable list of AI-extracted personal insights with scores. 
            Useful for understanding prospect psychology.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search personal insights..."
              value={insightSearch}
              onChange={(e) => setInsightSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <ScrollArea className="h-[400px]">
            {filteredInsights.length > 0 ? (
              <div className="space-y-2 pr-4">
                {filteredInsights.slice(0, 100).map((item, index) => (
                  <div 
                    key={`${item.callId}-${index}`}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm flex-1">{item.insight}</p>
                      {item.score !== null && (
                        <Badge className={cn('shrink-0', getScoreColor(item.score))}>
                          {formatScore(item.score, config)}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {insightSearch ? 'No insights match your search' : 'No personal insights captured yet'}
              </div>
            )}
          </ScrollArea>
          {filteredInsights.length > 100 && (
            <div className="text-center text-sm text-muted-foreground">
              Showing first 100 of {filteredInsights.length} insights
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Summaries */}
      <CallSummariesList data={data} />
    </div>
  );
}
