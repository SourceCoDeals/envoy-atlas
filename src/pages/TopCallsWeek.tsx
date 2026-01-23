import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useColdCallAnalytics, DateRange, ColdCall } from '@/hooks/useColdCallAnalytics';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { formatScore, formatCallingDuration, getScoreStatus, getScoreStatusColor } from '@/lib/callingConfig';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Trophy,
  Play,
  FileText,
  BookOpen,
  Star,
  Loader2,
  Phone,
  User,
  Zap,
  Filter,
  Flame,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function TopCallsWeek() {
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const { data, isLoading } = useColdCallAnalytics(dateRange);
  const [selectedCall, setSelectedCall] = useState<ColdCall | null>(null);
  const { config } = useCallingConfig();

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Trophy className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Trophy className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-medium">{index + 1}</span>;
  };

  // Generate pattern insights from top calls
  const patterns = data?.topCalls.length ? [
    {
      category: 'High Scores',
      insight: `Top calls average ${formatScore(
        data.topCalls.reduce((sum, c) => sum + (c.composite_score || 0), 0) / data.topCalls.length,
        config
      )} overall score`,
      frequency: `${data.topCalls.length} calls`,
    },
    {
      category: 'Duration',
      insight: 'Longer conversations correlate with higher scores',
      frequency: `Avg ${formatCallingDuration(
        data.topCalls.reduce((sum, c) => sum + (c.call_duration_sec || 0), 0) / data.topCalls.length
      )}`,
    },
    {
      category: 'Hot Leads',
      insight: `${data.hotLeads.length} hot leads identified`,
      frequency: `Interest ≥ ${config.hotLeadInterestScore}`,
    },
  ] : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Top Calls</h1>
            <p className="text-muted-foreground">Best performing calls for learning and recognition</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">This Week</SelectItem>
                <SelectItem value="14d">2 Weeks</SelectItem>
                <SelectItem value="30d">This Month</SelectItem>
                <SelectItem value="90d">Quarter</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Leaderboard */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Top 10 Leaderboard
                  </CardTitle>
                  <CardDescription>
                    Ranked by overall score (threshold: ≥ {config.topCallsMinScore})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data?.topCalls && data.topCalls.length > 0 ? (
                    data.topCalls.slice(0, 10).map((call, index) => {
                      const status = getScoreStatus(call.composite_score, config.overallQualityThresholds);
                      const isDmConversation = call.is_connection && call.seller_interest_score !== null;
                      return (
                        <div
                          key={call.id}
                          className={`flex items-center gap-4 p-3 rounded-lg border transition-colors hover:border-primary/50 ${
                            index < 3 ? 'bg-accent/30' : ''
                          }`}
                        >
                          {/* Rank */}
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-background flex items-center justify-center">
                            {getRankIcon(index)}
                          </div>

                          {/* Call Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{call.to_name || call.to_number || 'Unknown'}</p>
                              {isDmConversation && (
                                <Badge variant="secondary" className="text-xs">DM</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {call.analyst?.split('@')[0] || 'Unknown'}
                              </span>
                              <span>
                                {formatCallingDuration(call.call_duration_sec)}
                              </span>
                              {call.called_date && (
                                <span>
                                  {format(parseISO(call.called_date), 'MMM d')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Score */}
                          <div className="text-right">
                            <p className={`text-xl font-bold ${getScoreStatusColor(status)}`}>
                              {formatScore(call.composite_score, config)}
                            </p>
                            <p className="text-xs text-muted-foreground">Score</p>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1">
                            {call.call_recording_url && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                <a href={call.call_recording_url} target="_blank" rel="noopener noreferrer">
                                  <Play className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {call.call_transcript && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => setSelectedCall(call)}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No top calls this period</p>
                      <p className="text-sm">Calls with score ≥ {config.topCallsMinScore} will appear here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Pattern Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Pattern Analysis
                  </CardTitle>
                  <CardDescription>Common elements in top calls</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {patterns.map((pattern, index) => (
                    <div key={index} className="p-3 rounded-lg bg-accent/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{pattern.category}</p>
                        <Badge variant="outline" className="text-xs">
                          {pattern.frequency}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{pattern.insight}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Training Module CTA */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Create Training</CardTitle>
                  <CardDescription>Turn patterns into modules</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Create Training Module
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Automatically generate training from top call patterns
                  </p>
                </CardContent>
              </Card>

              {/* Call of the Week Highlight */}
              {data?.topCalls && data.topCalls.length > 0 && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Star className="h-5 w-5 text-yellow-500" />
                      Call of the Week
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="font-medium">{data.topCalls[0].to_name || data.topCalls[0].to_number}</p>
                      <p className="text-sm text-muted-foreground">
                        Rep: {data.topCalls[0].analyst?.split('@')[0]}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge className={getScoreStatusColor(getScoreStatus(data.topCalls[0].composite_score, config.overallQualityThresholds))}>
                          Score: {formatScore(data.topCalls[0].composite_score, config)}
                        </Badge>
                        <Badge variant="outline">
                          {formatCallingDuration(data.topCalls[0].call_duration_sec)}
                        </Badge>
                      </div>
                      {data.topCalls[0].call_recording_url && (
                        <Button variant="outline" className="w-full mt-3" asChild>
                          <a href={data.topCalls[0].call_recording_url} target="_blank" rel="noopener noreferrer">
                            <Play className="h-4 w-4 mr-2" />
                            Listen to Call
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Hot Leads */}
              {data?.hotLeads && data.hotLeads.length > 0 && (
                <Card className="border-orange-500/30 bg-orange-500/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Flame className="h-5 w-5 text-orange-500" />
                      Hot Leads ({data.hotLeads.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      Interest score ≥ {config.hotLeadInterestScore}
                      {config.hotLeadRequiresInterestYes && ' + positive interest'}
                    </p>
                    <div className="space-y-2">
                      {data.hotLeads.slice(0, 3).map(lead => (
                        <div key={lead.id} className="flex items-center justify-between text-sm">
                          <span className="truncate">{lead.to_name || lead.to_number}</span>
                          <Badge variant="outline" className="text-orange-500">
                            {formatScore(lead.seller_interest_score, config)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Transcript Dialog */}
        <Dialog open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Call Transcript
              </DialogTitle>
              <DialogDescription>
                {selectedCall?.to_name || selectedCall?.to_number} • {selectedCall?.analyst?.split('@')[0]}
                {selectedCall?.called_date && ` • ${format(parseISO(selectedCall.called_date), 'MMM d, yyyy')}`}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {selectedCall?.call_transcript || 'No transcript available for this call.'}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}