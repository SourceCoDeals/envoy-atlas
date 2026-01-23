import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Brain, TrendingUp, MessageSquare, AlertTriangle, Lightbulb, RotateCcw, Users, Star, ThumbsUp, FileText, Shield
} from 'lucide-react';
import { useColdCallAnalytics, DateRange } from '@/hooks/useColdCallAnalytics';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { formatScore, getScoreStatus, getScoreStatusColor } from '@/lib/callingConfig';
import { ScoreCard } from '@/components/callinsights/ScoreCard';

// Date range options
const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '14d', label: 'Last 14 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'all', label: 'All Time' },
];

export default function CallInsights() {
  const { config, isLoading: configLoading } = useCallingConfig();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [selectedRep, setSelectedRep] = useState<string>('all');
  
  const { data, isLoading } = useColdCallAnalytics(dateRange);

  // Get unique reps from data
  const reps = useMemo(() => {
    if (!data?.calls) return [];
    const repSet = new Set<string>();
    data.calls.forEach(call => {
      if (call.analyst && call.analyst !== 'Unknown') repSet.add(call.analyst);
    });
    return Array.from(repSet).sort();
  }, [data?.calls]);

  // Filter data based on selected rep
  const filteredCalls = useMemo(() => {
    if (!data?.calls) return [];
    if (selectedRep === 'all') return data.calls;
    return data.calls.filter(call => call.analyst === selectedRep);
  }, [data?.calls, selectedRep]);

  // Calculate score averages
  const scoreAverages = useMemo(() => {
    if (!filteredCalls.length) return null;
    
    const avg = (values: (number | null | undefined)[]) => {
      const valid = values.filter((v): v is number => v != null);
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    };
    
    return {
      overallQuality: avg(filteredCalls.map(c => c.composite_score)),
      sellerInterest: avg(filteredCalls.map(c => c.seller_interest_score)),
      scriptAdherence: avg(filteredCalls.map(c => c.script_adherence_score)),
      objectionHandling: avg(filteredCalls.map(c => c.objection_handling_score)),
      conversationQuality: avg(filteredCalls.map(c => c.quality_of_conversation_score)),
      valueProposition: avg(filteredCalls.map(c => c.value_proposition_score)),
      rapportBuilding: avg(filteredCalls.map(c => c.rapport_building_score)),
      nextStepClarity: avg(filteredCalls.map(c => c.next_step_clarity_score)),
    };
  }, [filteredCalls]);

  // Interest breakdown from seller_interest_score
  const interestBreakdown = useMemo(() => {
    const yes = filteredCalls.filter(c => c.interest_in_selling === 'yes').length;
    const maybe = filteredCalls.filter(c => c.interest_in_selling === 'maybe').length;
    const no = filteredCalls.filter(c => c.interest_in_selling === 'no').length;
    const unknown = filteredCalls.filter(c => !c.interest_in_selling).length;
    return { yes, maybe, no, unknown };
  }, [filteredCalls]);

  // Objection stats
  const objectionStats = useMemo(() => {
    // cold_calls has 'objections' as a string field
    const callsWithObjections = filteredCalls.filter(c => c.objections && c.objections.trim() !== '');
    const resolved = filteredCalls.filter(c => (c.resolution_rate || 0) >= 50).length;
    return {
      totalWithObjections: callsWithObjections.length,
      resolvedCount: resolved,
      resolutionRate: callsWithObjections.length > 0 ? (resolved / callsWithObjections.length) * 100 : 0,
    };
  }, [filteredCalls]);

  // Rep performance breakdown
  const repScoreBreakdown = useMemo(() => {
    const repMap = new Map<string, { scores: number[]; count: number }>();
    filteredCalls.forEach(call => {
      const rep = call.analyst || 'Unknown';
      if (rep === 'Unknown') return;
      const existing = repMap.get(rep) || { scores: [], count: 0 };
      if (call.composite_score != null) existing.scores.push(call.composite_score);
      existing.count += 1;
      repMap.set(rep, existing);
    });
    
    return Array.from(repMap.entries())
      .map(([rep, data]) => ({
        rep,
        avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
        callCount: data.count,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [filteredCalls]);

  const resetFilters = () => {
    setDateRange('30d');
    setSelectedRep('all');
  };

  const hasActiveFilters = dateRange !== '30d' || selectedRep !== 'all';
  const loading = isLoading || configLoading;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Call Insights</h1>
              <p className="text-muted-foreground">AI-Extracted Intelligence from Calls</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalCalls = filteredCalls.length;
  const unfilteredTotal = data?.totalCalls || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Call Insights</h1>
              <p className="text-muted-foreground">
                AI-Extracted Intelligence from Calls
              </p>
            </div>
          </div>
          
          <Badge variant="secondary" className="text-sm">
            {totalCalls.toLocaleString()} {totalCalls !== unfilteredTotal && `of ${unfilteredTotal.toLocaleString()}`} calls
          </Badge>
        </div>

        {/* Global Filter Bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Team Member Filter */}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedRep} onValueChange={setSelectedRep}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Reps" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Reps</SelectItem>
                    {reps.map((rep) => (
                      <SelectItem key={rep} value={rep}>
                        {rep}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Reset Button */}
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* No Data State */}
        {totalCalls === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Call Intelligence Data</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {unfilteredTotal > 0 
                  ? 'No calls match the current filters. Try adjusting your filter criteria.'
                  : 'Call intelligence data will appear here once calls are synced.'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" className="mt-4" onClick={resetFilters}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {totalCalls > 0 && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Score Overview
              </TabsTrigger>
              <TabsTrigger value="justifications" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Justifications
              </TabsTrigger>
              <TabsTrigger value="objections" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Objections
              </TabsTrigger>
              <TabsTrigger value="intel" className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Extracted Intel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="space-y-6">
                {/* Key Score Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                  <ScoreCard
                    title="Overall Quality"
                    score={scoreAverages?.overallQuality ?? null}
                    icon={<Star className="h-4 w-4" />}
                    description="Average overall call quality"
                    thresholds={config.overallQualityThresholds}
                  />
                  <ScoreCard
                    title="Seller Interest"
                    score={scoreAverages?.sellerInterest ?? null}
                    icon={<ThumbsUp className="h-4 w-4" />}
                    description="Average seller interest score"
                    thresholds={config.sellerInterestThresholds}
                  />
                  <ScoreCard
                    title="Script Adherence"
                    score={scoreAverages?.scriptAdherence ?? null}
                    icon={<FileText className="h-4 w-4" />}
                    description="Average script adherence"
                    thresholds={config.scriptAdherenceThresholds}
                  />
                  <ScoreCard
                    title="Objection Handling"
                    score={scoreAverages?.objectionHandling ?? null}
                    icon={<Shield className="h-4 w-4" />}
                    description="Average objection handling"
                    thresholds={config.objectionHandlingThresholds}
                  />
                </div>

                {/* All Scores Table */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">All Score Dimensions</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: 'Conversation Quality', value: scoreAverages?.conversationQuality },
                        { label: 'Value Proposition', value: scoreAverages?.valueProposition },
                        { label: 'Rapport Building', value: scoreAverages?.rapportBuilding },
                        { label: 'Next Steps Clarity', value: scoreAverages?.nextStepClarity },
                      ].map(item => (
                        <div key={item.label} className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="text-xl font-bold">
                            {item.value != null ? formatScore(item.value, config) : '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Rep Performance */}
                {repScoreBreakdown.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-4">Rep Performance</h3>
                      <div className="space-y-2">
                        {repScoreBreakdown.slice(0, 10).map((rep, i) => {
                          const status = getScoreStatus(rep.avgScore, config.overallQualityThresholds);
                          return (
                            <div key={rep.rep} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground w-6">#{i + 1}</span>
                                <span className="font-medium">{rep.rep}</span>
                                <Badge variant="outline" className="text-xs">{rep.callCount} calls</Badge>
                              </div>
                              <span className={`font-bold ${getScoreStatusColor(status)}`}>
                                {formatScore(rep.avgScore, config)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="justifications">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">Score Justifications</h3>
                  <p className="text-muted-foreground mb-6">
                    Browse individual call reasoning from AI scoring
                  </p>
                  <div className="space-y-4">
                    {filteredCalls.slice(0, 20).map(call => (
                      <div key={call.id} className="p-4 rounded-lg border bg-muted/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{call.to_name || call.to_number}</span>
                          <Badge variant="outline">
                            Score: {formatScore(call.composite_score, config)}
                          </Badge>
                        </div>
                        {call.conversation_quality_reasoning && (
                          <p className="text-sm text-muted-foreground mb-1">
                            <strong>Quality:</strong> {call.conversation_quality_reasoning}
                          </p>
                        )}
                        {call.script_adherence_reasoning && (
                          <p className="text-sm text-muted-foreground mb-1">
                            <strong>Script:</strong> {call.script_adherence_reasoning}
                          </p>
                        )}
                        {call.objection_handling_reasoning && (
                          <p className="text-sm text-muted-foreground">
                            <strong>Objections:</strong> {call.objection_handling_reasoning}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="objections">
              <div className="space-y-6">
                {/* Objection Summary */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Calls with Objections</p>
                      <p className="text-2xl font-bold">{objectionStats.totalWithObjections}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Resolved</p>
                      <p className="text-2xl font-bold">{objectionStats.resolvedCount}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Resolution Rate</p>
                      <p className="text-2xl font-bold">{Math.round(objectionStats.resolutionRate)}%</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Objection List */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">Recent Objections</h3>
                    <div className="space-y-3">
                      {filteredCalls
                        .filter(c => c.objections && c.objections.trim() !== '')
                        .slice(0, 15)
                        .map(call => (
                          <div key={call.id} className="p-3 rounded-lg border bg-muted/20">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{call.to_name || call.to_number}</span>
                              <Badge variant={call.resolution_rate && call.resolution_rate >= 50 ? 'default' : 'secondary'}>
                                {call.resolution_rate && call.resolution_rate >= 50 ? 'Resolved' : 'Unresolved'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{call.objections}</p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="intel">
              <div className="space-y-6">
                {/* Interest Breakdown */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">Interest in Selling</h3>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-green-500/10">
                        <p className="text-2xl font-bold text-green-600">{interestBreakdown.yes}</p>
                        <p className="text-xs text-muted-foreground">Yes</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-yellow-500/10">
                        <p className="text-2xl font-bold text-yellow-600">{interestBreakdown.maybe}</p>
                        <p className="text-xs text-muted-foreground">Maybe</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-red-500/10">
                        <p className="text-2xl font-bold text-red-600">{interestBreakdown.no}</p>
                        <p className="text-xs text-muted-foreground">No</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted">
                        <p className="text-2xl font-bold">{interestBreakdown.unknown}</p>
                        <p className="text-xs text-muted-foreground">Unknown</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Call Summaries */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">Call Summaries</h3>
                    <div className="space-y-3">
                      {filteredCalls
                        .filter(c => c.call_summary && c.call_summary.trim() !== '')
                        .slice(0, 10)
                        .map(call => (
                          <div key={call.id} className="p-3 rounded-lg border bg-muted/20">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{call.to_name || call.to_number}</span>
                              {call.interest_in_selling && (
                                <Badge variant={
                                  call.interest_in_selling === 'yes' ? 'default' :
                                  call.interest_in_selling === 'maybe' ? 'secondary' : 'outline'
                                }>
                                  {call.interest_in_selling}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{call.call_summary}</p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Key Concerns / Pain Points */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">Key Concerns & Pain Points</h3>
                    <div className="space-y-2">
                      {filteredCalls
                        .filter(c => c.target_pain_points && c.target_pain_points.trim() !== '')
                        .slice(0, 10)
                        .map(call => (
                          <div key={call.id} className="p-2 rounded-lg bg-muted/30 text-sm">
                            <span className="font-medium">{call.to_name || call.to_number}:</span>{' '}
                            <span className="text-muted-foreground">{call.target_pain_points}</span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
