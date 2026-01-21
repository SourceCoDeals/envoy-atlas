import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Brain, TrendingUp, MessageSquare, AlertTriangle, Lightbulb, RotateCcw, Users, Folder
} from 'lucide-react';
import { useExternalCallIntel } from '@/hooks/useExternalCallIntel';
import { useCallingConfig } from '@/hooks/useCallingConfig';
import { ScoreOverviewSection } from '@/components/callinsights/ScoreOverviewSection';
import { ScoreJustificationBrowser } from '@/components/callinsights/ScoreJustificationBrowser';
import { ObjectionIntelligence } from '@/components/callinsights/ObjectionIntelligence';
import { ExtractedIntelSummary } from '@/components/callinsights/ExtractedIntelSummary';
import { DateRangeFilter, DateRangeOption, getDateRange } from '@/components/dashboard/DateRangeFilter';
import { parseISO, isWithinInterval } from 'date-fns';

export default function CallInsights() {
  const { data, isLoading, error } = useExternalCallIntel();
  const { config } = useCallingConfig();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<DateRangeOption>('last30');
  const [selectedEngagement, setSelectedEngagement] = useState<string>('all');
  const [selectedRep, setSelectedRep] = useState<string>('all');

  // Get unique engagements and reps from data
  const { engagements, reps } = useMemo(() => {
    if (!data?.intelRecords) return { engagements: [], reps: [] };
    
    const engagementSet = new Set<string>();
    const repSet = new Set<string>();
    
    data.intelRecords.forEach(record => {
      if (record.engagement_id) engagementSet.add(record.engagement_id);
      const rep = record.call?.caller_name;
      if (rep && rep !== 'Unknown') repSet.add(rep);
    });
    
    return {
      engagements: Array.from(engagementSet),
      reps: Array.from(repSet).sort(),
    };
  }, [data?.intelRecords]);

  // Filter data based on selected filters
  const filteredData = useMemo(() => {
    if (!data) return data;
    
    const { startDate, endDate } = getDateRange(dateRange);
    
    const filteredRecords = data.intelRecords.filter(record => {
      // Date filter
      if (startDate && record.call?.started_at) {
        const callDate = parseISO(record.call.started_at);
        if (!isWithinInterval(callDate, { start: startDate, end: endDate })) {
          return false;
        }
      }
      
      // Engagement filter
      if (selectedEngagement !== 'all' && record.engagement_id !== selectedEngagement) {
        return false;
      }
      
      // Rep filter
      if (selectedRep !== 'all') {
        const rep = record.call?.caller_name || 'Unknown';
        if (rep !== selectedRep) return false;
      }
      
      return true;
    });

    // Helper function to calculate average
    const avg = (values: (number | null | undefined)[]): number | null => {
      const valid = values.filter((v): v is number => v != null);
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    };

    // Recalculate scoreOverview for filtered records
    const scoreKeys = [
      { key: 'seller_interest_score', label: 'Seller Interest' },
      { key: 'objection_handling_score', label: 'Objection Handling' },
      { key: 'valuation_discussion_score', label: 'Valuation Discussion' },
      { key: 'rapport_building_score', label: 'Rapport Building' },
      { key: 'value_proposition_score', label: 'Value Proposition' },
      { key: 'conversation_quality_score', label: 'Conversation Quality' },
      { key: 'script_adherence_score', label: 'Script Adherence' },
      { key: 'overall_quality_score', label: 'Overall Quality' },
      { key: 'question_adherence_score', label: 'Question Adherence' },
      { key: 'personal_insights_score', label: 'Personal Insights' },
      { key: 'next_steps_clarity_score', label: 'Next Steps Clarity' },
      { key: 'discovery_score', label: 'Discovery' },
    ];

    const scoreOverview = scoreKeys.map(({ key, label }) => {
      const thisWeekAvg = avg(filteredRecords.map(r => r[key as keyof typeof r] as number | null));
      
      // For trend, compare to original data's last week avg if available
      const originalScore = data.scoreOverview.find(s => s.key === key);
      const lastWeekAvg = originalScore?.lastWeekAvg ?? null;
      
      let trend: 'up' | 'down' | 'flat' = 'flat';
      if (thisWeekAvg != null && lastWeekAvg != null) {
        if (thisWeekAvg > lastWeekAvg + 0.2) trend = 'up';
        else if (thisWeekAvg < lastWeekAvg - 0.2) trend = 'down';
      }

      // Find best rep for this score within filtered data
      const repScores = new Map<string, number[]>();
      filteredRecords.forEach(r => {
        const rep = r.call?.caller_name || 'Unknown';
        const score = r[key as keyof typeof r] as number | null;
        if (score != null) {
          if (!repScores.has(rep)) repScores.set(rep, []);
          repScores.get(rep)!.push(score);
        }
      });
      
      let bestRep: string | null = null;
      let bestAvg = 0;
      repScores.forEach((scores, rep) => {
        const repAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (repAvg > bestAvg) {
          bestAvg = repAvg;
          bestRep = rep;
        }
      });

      // Count needing coaching (score below 5)
      const needsCoachingCount = filteredRecords.filter(r => {
        const score = r[key as keyof typeof r] as number | null;
        return score != null && score < 5;
      }).length;

      return { key, label, thisWeekAvg, lastWeekAvg, trend, bestRep, needsCoachingCount };
    });

    // Recalculate aggregates for filtered data
    const totalObjectionsFaced = filteredRecords.reduce((sum, r) => sum + (r.number_of_objections || 0), 0);
    const totalObjectionsResolved = filteredRecords.reduce((sum, r) => sum + (r.objections_resolved_count || 0), 0);
    const overallResolutionRate = totalObjectionsFaced > 0 
      ? (totalObjectionsResolved / totalObjectionsFaced) * 100 
      : 0;
    const avgObjectionsPerCall = filteredRecords.length > 0 
      ? totalObjectionsFaced / filteredRecords.length 
      : 0;

    const interestBreakdown = {
      yes: filteredRecords.filter(r => r.interest_in_selling?.toLowerCase() === 'yes').length,
      maybe: filteredRecords.filter(r => r.interest_in_selling?.toLowerCase() === 'maybe').length,
      no: filteredRecords.filter(r => r.interest_in_selling?.toLowerCase() === 'no').length,
      notAsked: filteredRecords.filter(r => !r.interest_in_selling).length,
    };

    // Timeline breakdown
    const timelineMap = new Map<string, number>();
    filteredRecords.forEach(r => {
      if (r.timeline_to_sell) {
        timelineMap.set(r.timeline_to_sell, (timelineMap.get(r.timeline_to_sell) || 0) + 1);
      }
    });
    const timelineBreakdown = Array.from(timelineMap.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    // Buyer type breakdown
    const buyerTypeMap = new Map<string, number>();
    filteredRecords.forEach(r => {
      if (r.buyer_type_preference) {
        buyerTypeMap.set(r.buyer_type_preference, (buyerTypeMap.get(r.buyer_type_preference) || 0) + 1);
      }
    });
    const buyerTypeBreakdown = Array.from(buyerTypeMap.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    // Personal insights list
    const personalInsightsList = filteredRecords
      .filter(r => r.personal_insights)
      .map(r => ({
        insight: r.personal_insights!,
        score: r.personal_insights_score,
        callId: r.call_id,
      }));

    // Pain points aggregation
    const painPointMap = new Map<string, number>();
    filteredRecords.forEach(r => {
      (r.target_pain_points || []).forEach(pp => {
        painPointMap.set(pp, (painPointMap.get(pp) || 0) + 1);
      });
    });
    const painPointsList = Array.from(painPointMap.entries())
      .map(([painPoint, count]) => ({ painPoint, count }))
      .sort((a, b) => b.count - a.count);

    // Questions data
    const questionsData = filteredRecords.map(r => r.questions_covered_count || 0);
    const avgQuestionsCovered = questionsData.length > 0 
      ? questionsData.reduce((a, b) => a + b, 0) / questionsData.length 
      : 0;

    return {
      ...data,
      intelRecords: filteredRecords,
      scoreOverview,
      totalObjectionsFaced,
      totalObjectionsResolved,
      overallResolutionRate,
      avgObjectionsPerCall,
      interestBreakdown,
      timelineBreakdown,
      buyerTypeBreakdown,
      personalInsightsList,
      painPointsList,
      avgQuestionsCovered,
    };
  }, [data, dateRange, selectedEngagement, selectedRep]);

  const resetFilters = () => {
    setDateRange('last30');
    setSelectedEngagement('all');
    setSelectedRep('all');
  };

  const hasActiveFilters = dateRange !== 'last30' || selectedEngagement !== 'all' || selectedRep !== 'all';

  if (isLoading) {
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

  if (error) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Failed to load call insights: {String(error)}</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  const totalCalls = filteredData?.intelRecords.length || 0;
  const unfilteredTotal = data?.intelRecords.length || 0;

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
            {totalCalls} {totalCalls !== unfilteredTotal && `of ${unfilteredTotal}`} calls
          </Badge>
        </div>

        {/* Global Filter Bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Engagement Filter */}
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedEngagement} onValueChange={setSelectedEngagement}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Engagements" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Engagements</SelectItem>
                    {engagements.map((id) => (
                      <SelectItem key={id} value={id}>
                        {id.slice(0, 8)}...
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
              <DateRangeFilter value={dateRange} onChange={setDateRange} />

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
                  : 'Call intelligence data will appear here once calls are processed through the AI scoring pipeline.'}
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

        {/* Main Content - 4 Tabs per spec */}
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
              <ScoreOverviewSection data={filteredData} config={config} />
            </TabsContent>

            <TabsContent value="justifications">
              <ScoreJustificationBrowser data={filteredData} config={config} />
            </TabsContent>

            <TabsContent value="objections">
              <ObjectionIntelligence data={filteredData} config={config} />
            </TabsContent>

            <TabsContent value="intel">
              <ExtractedIntelSummary data={filteredData} config={config} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
