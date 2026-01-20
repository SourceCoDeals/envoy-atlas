import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEnhancedCallingAnalytics, DateRange, CallActivity } from '@/hooks/useEnhancedCallingAnalytics';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { formatScore, formatCallingDuration, getScoreStatus, getScoreStatusColor } from '@/lib/callingConfig';
import {
  Star,
  TrendingUp,
  Calendar,
  User,
  Play,
  FileText,
  Building2,
  Flame,
  Clock,
  Target,
  Filter,
  ChevronRight,
  Phone,
} from 'lucide-react';
import { format } from 'date-fns';

export default function TopDeals() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [selectedCall, setSelectedCall] = useState<CallActivity | null>(null);
  const { data, isLoading } = useEnhancedCallingAnalytics(dateRange);
  const { config } = useCallingConfig();

  // Best Opportunities: Interest = "yes" AND Seller Interest Score >= config threshold
  const bestOpportunities = useMemo(() => {
    if (!data?.calls) return [];
    return data.calls.filter(call => {
      const interest = (call.interest_in_selling || '').toLowerCase();
      const score = call.seller_interest_score ?? 0;
      return interest === 'yes' && score >= config.hotLeadInterestScore - 1; // 7+ for deals
    }).slice(0, 20);
  }, [data?.calls, config]);

  // Warm Pipeline: Interest = "maybe"
  const warmPipeline = useMemo(() => {
    if (!data?.calls) return [];
    return data.calls.filter(call => {
      const interest = (call.interest_in_selling || '').toLowerCase();
      return interest === 'maybe';
    }).slice(0, 20);
  }, [data?.calls]);

  // Extract deal intelligence from raw_data
  const getDealIntel = (call: CallActivity) => {
    const raw = call.raw_data || {};
    return {
      transactionGoals: raw.transaction_goals as string | null,
      timelineToSell: raw.timeline_to_sell as string | null,
      buyerTypePreference: raw.buyer_type_preference as string | null,
      maDiscussions: raw.ma_discussions as string | null,
      businessDescription: raw.business_description as string | null,
    };
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Top Deals</h1>
            <p className="text-muted-foreground">Best opportunities from calls</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Top Deals</h1>
            <p className="text-muted-foreground">
              Best opportunities identified from calls
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
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Best Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">{bestOpportunities.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Interest = Yes + Score ≥ {config.hotLeadInterestScore - 1}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Warm Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                <span className="text-2xl font-bold">{warmPipeline.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Interest = Maybe
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Hot Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{data?.hotLeads.length || 0}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Seller Interest ≥ {config.hotLeadInterestScore}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Interest Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">
                  {formatScore(data?.avgScores.sellerInterest, config)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all calls
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="best">
          <TabsList>
            <TabsTrigger value="best" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Best Opportunities ({bestOpportunities.length})
            </TabsTrigger>
            <TabsTrigger value="warm" className="flex items-center gap-2">
              <Flame className="h-4 w-4" />
              Warm Pipeline ({warmPipeline.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="best" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Best Opportunities</CardTitle>
                <CardDescription>
                  Interest in Selling = "Yes" AND Seller Interest Score ≥ {config.hotLeadInterestScore - 1}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bestOpportunities.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No best opportunities found in this period</p>
                    <p className="text-sm">Calls with high interest will appear here</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Rep</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Interest Score</TableHead>
                        <TableHead>Timeline</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bestOpportunities.map((call) => {
                        const intel = getDealIntel(call);
                        const status = getScoreStatus(call.seller_interest_score, config.sellerInterestThresholds);
                        return (
                          <TableRow
                            key={call.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedCall(call)}
                          >
                            <TableCell>
                              <div className="font-medium">{call.to_name || call.to_phone}</div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {call.caller_name?.split('@')[0] || 'Unknown'}
                            </TableCell>
                            <TableCell>
                              {call.started_at && format(new Date(call.started_at), 'MMM d')}
                            </TableCell>
                            <TableCell>
                              <Badge className={getScoreStatusColor(status)}>
                                {formatScore(call.seller_interest_score, config)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {intel.timelineToSell || '-'}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm">
                              {call.call_summary || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {call.recording_url && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                    <a href={call.recording_url} target="_blank" rel="noopener noreferrer">
                                      <Play className="h-4 w-4" />
                                    </a>
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="warm" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Warm Pipeline</CardTitle>
                <CardDescription>
                  Interest in Selling = "Maybe" - Follow-up needed
                </CardDescription>
              </CardHeader>
              <CardContent>
                {warmPipeline.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Flame className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No warm pipeline opportunities found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Rep</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Interest Score</TableHead>
                        <TableHead>Next Steps Clarity</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warmPipeline.map((call) => {
                        const raw = call.raw_data || {};
                        const nextStepsScore = raw.next_steps_clarity_score as number | null;
                        return (
                          <TableRow
                            key={call.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedCall(call)}
                          >
                            <TableCell>
                              <div className="font-medium">{call.to_name || call.to_phone}</div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {call.caller_name?.split('@')[0] || 'Unknown'}
                            </TableCell>
                            <TableCell>
                              {call.started_at && format(new Date(call.started_at), 'MMM d')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {formatScore(call.seller_interest_score, config)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {nextStepsScore != null ? (
                                <Badge variant="outline">
                                  {formatScore(nextStepsScore, config)}
                                </Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm">
                              {call.call_summary || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {call.recording_url && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                    <a href={call.recording_url} target="_blank" rel="noopener noreferrer">
                                      <Play className="h-4 w-4" />
                                    </a>
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Extracted Deal Intelligence */}
        {(bestOpportunities.length > 0 || warmPipeline.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Extracted Deal Intelligence</CardTitle>
              <CardDescription>
                Additional context from qualified opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                {/* Transaction Goals */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Transaction Goals
                  </h4>
                  <div className="space-y-2">
                    {bestOpportunities
                      .filter(c => getDealIntel(c).transactionGoals)
                      .slice(0, 5)
                      .map((call) => (
                        <div key={call.id} className="text-sm p-2 bg-muted/50 rounded">
                          <p className="font-medium">{call.to_name || 'Unknown'}</p>
                          <p className="text-muted-foreground truncate">
                            {getDealIntel(call).transactionGoals}
                          </p>
                        </div>
                      ))}
                    {bestOpportunities.filter(c => getDealIntel(c).transactionGoals).length === 0 && (
                      <p className="text-sm text-muted-foreground">No transaction goals captured</p>
                    )}
                  </div>
                </div>

                {/* Timeline to Sell */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Timeline to Sell
                  </h4>
                  <div className="space-y-2">
                    {bestOpportunities
                      .filter(c => getDealIntel(c).timelineToSell)
                      .slice(0, 5)
                      .map((call) => (
                        <div key={call.id} className="text-sm p-2 bg-muted/50 rounded">
                          <p className="font-medium">{call.to_name || 'Unknown'}</p>
                          <p className="text-muted-foreground">{getDealIntel(call).timelineToSell}</p>
                        </div>
                      ))}
                    {bestOpportunities.filter(c => getDealIntel(c).timelineToSell).length === 0 && (
                      <p className="text-sm text-muted-foreground">No timelines captured</p>
                    )}
                  </div>
                </div>

                {/* Buyer Type Preference */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Buyer Type Preference
                  </h4>
                  <div className="space-y-2">
                    {bestOpportunities
                      .filter(c => getDealIntel(c).buyerTypePreference)
                      .slice(0, 5)
                      .map((call) => (
                        <div key={call.id} className="text-sm p-2 bg-muted/50 rounded">
                          <p className="font-medium">{call.to_name || 'Unknown'}</p>
                          <p className="text-muted-foreground">{getDealIntel(call).buyerTypePreference}</p>
                        </div>
                      ))}
                    {bestOpportunities.filter(c => getDealIntel(c).buyerTypePreference).length === 0 && (
                      <p className="text-sm text-muted-foreground">No preferences captured</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Call Detail Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl">
          {selectedCall && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedCall.to_name || selectedCall.to_phone}
                  <Badge className={getScoreStatusColor(getScoreStatus(selectedCall.seller_interest_score, config.sellerInterestThresholds))}>
                    Interest: {formatScore(selectedCall.seller_interest_score, config)}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Call Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Rep: {selectedCall.caller_name?.split('@')[0]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCall.started_at && format(new Date(selectedCall.started_at), 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Duration: {formatCallingDuration(selectedCall.talk_duration)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCall.to_phone}</span>
                  </div>
                </div>

                {/* Summary */}
                {selectedCall.call_summary && (
                  <div>
                    <h4 className="font-medium mb-2">Summary</h4>
                    <p className="text-sm text-muted-foreground">{selectedCall.call_summary}</p>
                  </div>
                )}

                {/* Deal Intelligence */}
                <div>
                  <h4 className="font-medium mb-2">Extracted Intelligence</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {getDealIntel(selectedCall).timelineToSell && (
                      <div>
                        <span className="text-muted-foreground">Timeline:</span>{' '}
                        {getDealIntel(selectedCall).timelineToSell}
                      </div>
                    )}
                    {getDealIntel(selectedCall).buyerTypePreference && (
                      <div>
                        <span className="text-muted-foreground">Buyer Preference:</span>{' '}
                        {getDealIntel(selectedCall).buyerTypePreference}
                      </div>
                    )}
                    {getDealIntel(selectedCall).transactionGoals && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Transaction Goals:</span>{' '}
                        {getDealIntel(selectedCall).transactionGoals}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {selectedCall.recording_url && (
                    <Button variant="outline" className="flex-1" asChild>
                      <a href={selectedCall.recording_url} target="_blank" rel="noopener noreferrer">
                        <Play className="h-4 w-4 mr-2" />
                        Listen
                      </a>
                    </Button>
                  )}
                  {selectedCall.transcription && (
                    <Button variant="outline" className="flex-1">
                      <FileText className="h-4 w-4 mr-2" />
                      View Transcript
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
