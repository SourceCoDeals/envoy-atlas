import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  Filter, 
  Phone, 
  Clock, 
  Brain, 
  FileText,
  Play,
  ChevronDown,
  ChevronUp,
  MessageSquare
} from 'lucide-react';
import { useCallsWithScores } from '@/hooks/useCallIntelligence';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { formatDistanceToNow, format } from 'date-fns';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 70) return 'default';
  if (score >= 50) return 'secondary';
  return 'destructive';
}

const quickFilters = [
  { label: 'High Interest', filter: { minScore: 70 } },
  { label: 'Needs Coaching', filter: { maxScore: 50 } },
  { label: 'Has Transcript', filter: { hasTranscript: true } },
];

export default function CallSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    minScore?: number;
    maxScore?: number;
    hasTranscript?: boolean;
    disposition?: string;
  }>({});

  const { data: calls, isLoading } = useCallsWithScores({
    search: searchQuery || undefined,
    ...filters,
    limit: 50,
  });

  const toggleExpanded = (callId: string) => {
    setExpandedCallId(expandedCallId === callId ? null : callId);
  };

  const applyQuickFilter = (filterConfig: typeof quickFilters[0]['filter']) => {
    setFilters(prev => {
      // Toggle off if same filter is applied
      const isSame = JSON.stringify(prev) === JSON.stringify(filterConfig);
      return isSame ? {} : filterConfig;
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call Search</h1>
          <p className="text-muted-foreground">
            Search and filter through all transcribed calls
          </p>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transcripts, objections, keywords..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap gap-2">
                {quickFilters.map((qf) => (
                  <Button
                    key={qf.label}
                    variant={JSON.stringify(filters) === JSON.stringify(qf.filter) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => applyQuickFilter(qf.filter)}
                  >
                    {qf.label}
                  </Button>
                ))}
                {Object.keys(filters).length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters({})}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Search Results
            </CardTitle>
            <CardDescription>
              {isLoading ? 'Loading...' : `${calls?.length || 0} calls found`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : calls?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No calls found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="space-y-3">
                {calls?.map((call) => (
                  <div 
                    key={call.id}
                    className="border rounded-lg overflow-hidden"
                  >
                    {/* Call Header */}
                    <div 
                      className="flex items-center justify-between p-4 bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => toggleExpanded(call.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{call.phone_number || 'Unknown number'}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {call.start_at 
                                ? format(new Date(call.start_at), 'MMM d, yyyy h:mm a')
                                : 'Unknown date'
                              }
                            </span>
                            {call.duration_seconds && (
                              <span>{formatDuration(call.duration_seconds)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {call.disposition && (
                          <Badge variant="outline">{call.disposition}</Badge>
                        )}
                        {call.transcript?.transcription_status === 'completed' && (
                          <Badge variant="secondary" className="gap-1">
                            <FileText className="h-3 w-3" />
                            Transcribed
                          </Badge>
                        )}
                        {call.score?.composite_score !== null && (
                          <Badge variant={getScoreBadgeVariant(call.score.composite_score || 0)}>
                            <Brain className="h-3 w-3 mr-1" />
                            {call.score.composite_score}/100
                          </Badge>
                        )}
                        {expandedCallId === call.id ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedCallId === call.id && (
                      <div className="border-t bg-muted/30 p-4 space-y-4">
                        {/* Score Breakdown */}
                        {call.score && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-sm">AI Score Breakdown</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-card rounded-lg p-3">
                                <p className="text-xs text-muted-foreground">Seller Interest</p>
                                <p className="text-lg font-bold">{call.score.seller_interest_score || '--'}/10</p>
                              </div>
                              <div className="bg-card rounded-lg p-3">
                                <p className="text-xs text-muted-foreground">Objection Handling</p>
                                <p className="text-lg font-bold">{call.score.objection_handling_score || '--'}/10</p>
                              </div>
                              <div className="bg-card rounded-lg p-3">
                                <p className="text-xs text-muted-foreground">Rapport Building</p>
                                <p className="text-lg font-bold">{call.score.rapport_building_score || '--'}/10</p>
                              </div>
                              <div className="bg-card rounded-lg p-3">
                                <p className="text-xs text-muted-foreground">Next Step Clarity</p>
                                <p className="text-lg font-bold">{call.score.next_step_clarity_score || '--'}/10</p>
                              </div>
                            </div>

                            {/* Insights */}
                            <div className="flex flex-wrap gap-2">
                              {call.score.opening_type && (
                                <Badge variant="outline">Opening: {call.score.opening_type}</Badge>
                              )}
                              {call.score.timeline_to_sell && (
                                <Badge variant="outline">Timeline: {call.score.timeline_to_sell}</Badge>
                              )}
                            </div>

                            {call.score.personal_insights && (
                              <div className="bg-card rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">Personal Insights</p>
                                <p className="text-sm">{call.score.personal_insights}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Transcript Preview */}
                        {call.transcript?.transcript_text && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Transcript Preview
                            </h4>
                            <div className="bg-card rounded-lg p-4 max-h-64 overflow-y-auto">
                              <pre className="text-sm whitespace-pre-wrap font-sans">
                                {call.transcript.transcript_text.slice(0, 1000)}
                                {call.transcript.transcript_text.length > 1000 && '...'}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          {call.recording_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={call.recording_url} target="_blank" rel="noopener noreferrer">
                                <Play className="h-4 w-4 mr-2" />
                                Listen
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
