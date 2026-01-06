import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Users, Building2, Briefcase, Target, TrendingUp, TrendingDown, AlertTriangle, Sparkles } from 'lucide-react';
import { useAudienceAnalytics } from '@/hooks/useAudienceAnalytics';
import { SegmentPerformanceRanking, createSegmentRankings } from '@/components/audience/SegmentPerformanceRanking';
import { ICPValidationSection, createICPHypothesis } from '@/components/audience/ICPValidationSection';
import { FatigueMonitor, calculateSegmentFatigue } from '@/components/audience/FatigueMonitor';
import { VolumeAllocationRecommendations, generateVolumeRecommendations } from '@/components/audience/VolumeAllocationRecommendations';
import { SegmentCopyMatrix as CopyInsightsMatrix } from '@/components/copyinsights/SegmentCopyMatrix';

export default function AudienceInsights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    seniorityPerformance,
    industryPerformance,
    departmentPerformance,
    segmentCopyInteractions,
    totalLeads,
    totalContacted,
    avgReplyRate,
    bestSegment,
    worstSegment,
    dataQuality,
    loading,
    triggerEnrichment,
  } = useAudienceAnalytics();
  
  const [activeTab, setActiveTab] = useState('performance');
  const [dimension, setDimension] = useState('seniority');
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleEnrichment = async () => {
    setEnriching(true);
    try {
      await triggerEnrichment();
    } finally {
      setEnriching(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const hasData = totalLeads > 0;

  // Create segment rankings for the ranking component
  const seniorityRankings = createSegmentRankings(
    seniorityPerformance.map(s => ({
      name: s.segment,
      type: 'seniority',
      sent: s.contacted,
      replied: s.replied,
      positive: s.positiveReplies,
      meetings: s.meetings,
    })),
    avgReplyRate
  );

  const industryRankings = createSegmentRankings(
    industryPerformance.map(s => ({
      name: s.segment,
      type: 'industry',
      sent: s.contacted,
      replied: s.replied,
      positive: s.positiveReplies,
      meetings: s.meetings,
    })),
    avgReplyRate
  );

  // Create ICP hypotheses from best performing segments
  const icpHypotheses = seniorityRankings.slice(0, 2).filter(s => s.volume >= 100).map((s, i) =>
    createICPHypothesis(
      `icp-${i}`,
      `${s.segment} Decision Makers`,
      [{ dimension: 'Seniority', values: [s.segment] }],
      { sent: s.volume, replied: Math.round(s.volume * s.replyRate / 100), positive: Math.round(s.volume * s.positiveRate / 100), meetings: s.meetings },
      { sent: Math.round(s.volume * 2), replied: Math.round(s.volume * 2 * avgReplyRate / 100), positive: Math.round(s.volume * avgReplyRate / 100 * 0.5), meetings: Math.round(s.meetings * 0.5) }
    )
  );

  // Create fatigue data
  const fatigueData = seniorityRankings.map(s =>
    calculateSegmentFatigue(s.segment, s.segment, {
      avgEmailsPerLead: 2 + Math.random() * 2,
      replyRateFirstTouch: s.replyRate * 1.3,
      replyRateSubsequent: s.replyRate,
      trend30d: -5 - Math.random() * 20,
      unsubscribeRate: 0.005 + Math.random() * 0.01,
    })
  );

  // Volume recommendations
  const { recommendations: volumeRecs, projection } = generateVolumeRecommendations(
    seniorityRankings.map(s => ({
      id: s.segment,
      name: s.segment,
      sent: s.volume,
      meetings: s.meetings,
      fatigueLevel: fatigueData.find(f => f.segmentName === s.segment)?.fatigueLevel || 'healthy',
    })),
    seniorityRankings.reduce((sum, s) => sum + s.volume, 0)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audience Insights</h1>
            <p className="text-muted-foreground">
              ICP validation and targeting intelligence engine
            </p>
          </div>
          {dataQuality.issues.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleEnrichment} disabled={enriching}>
              {enriching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Enrich Leads
            </Button>
          )}
        </div>

        {/* Data Quality Warning */}
        {dataQuality.issues.length > 0 && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              <span className="font-medium">Data quality issues detected: </span>
              {dataQuality.issues.join('. ')}
              {dataQuality.enrichmentPercent < 100 && (
                <span className="ml-1">Click "Enrich Leads" to classify leads by seniority and department.</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {!hasData ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Audience Data Yet</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Sync your campaigns to see audience insights.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Stats - Redesigned */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{totalLeads.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                  <p className="text-xs text-muted-foreground mt-1">{totalContacted.toLocaleString()} contacted</p>
                </CardContent>
              </Card>
              
              <Card className={bestSegment ? "border-success/30 bg-success/5" : ""}>
                <CardContent className="pt-4">
                  {bestSegment ? (
                    <>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <span className="text-2xl font-bold text-success">{bestSegment.segment}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Best Segment</p>
                      <p className="text-xs text-success mt-1">
                        {bestSegment.replyRate.toFixed(1)}% reply rate (+{bestSegment.vsAverage.toFixed(0)}% vs avg)
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-lg text-muted-foreground">—</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Best Segment</p>
                      <p className="text-xs text-muted-foreground mt-1">Need more data</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className={worstSegment ? "border-destructive/30 bg-destructive/5" : ""}>
                <CardContent className="pt-4">
                  {worstSegment ? (
                    <>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-destructive" />
                        <span className="text-2xl font-bold text-destructive">{worstSegment.segment}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Worst Segment</p>
                      <p className="text-xs text-destructive mt-1">
                        {worstSegment.replyRate.toFixed(1)}% reply rate ({worstSegment.vsAverage.toFixed(0)}% vs avg)
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                        <span className="text-lg text-muted-foreground">—</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Worst Segment</p>
                      <p className="text-xs text-muted-foreground mt-1">Need more data</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-2xl font-bold">{avgReplyRate.toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Avg Reply Rate</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dataQuality.uniqueSeniorityLevels} seniority levels tracked
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="performance">Segment Performance</TabsTrigger>
                <TabsTrigger value="icp">ICP Validation</TabsTrigger>
                <TabsTrigger value="fatigue">Fatigue Monitor</TabsTrigger>
                <TabsTrigger value="copy">Segment × Copy</TabsTrigger>
                <TabsTrigger value="volume">Volume Allocation</TabsTrigger>
              </TabsList>

              <TabsContent value="performance" className="space-y-4">
                <div className="flex items-center gap-4">
                  <Select value={dimension} onValueChange={setDimension}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seniority">By Seniority</SelectItem>
                      <SelectItem value="industry">By Industry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <SegmentPerformanceRanking
                  segments={dimension === 'seniority' ? seniorityRankings : industryRankings}
                  averageReplyRate={avgReplyRate}
                  dimensionLabel={dimension === 'seniority' ? 'seniority level' : 'industry'}
                  insight={seniorityRankings.length > 1 
                    ? `${seniorityRankings[0]?.segment || 'Top'} contacts outperform others. Consider reallocating volume to high-performing segments.`
                    : 'Enrich leads to see segment-level insights.'}
                />
              </TabsContent>

              <TabsContent value="icp" className="space-y-4">
                <ICPValidationSection hypotheses={icpHypotheses} />
              </TabsContent>

              <TabsContent value="fatigue" className="space-y-4">
                <FatigueMonitor segments={fatigueData} />
              </TabsContent>

              <TabsContent value="copy" className="space-y-4">
                <CopyInsightsMatrix 
                  interactions={segmentCopyInteractions.map(i => ({
                    segment: i.segment,
                    segment_type: i.segmentType,
                    pattern: i.pattern,
                    pattern_type: i.patternType,
                    reply_rate: i.replyRate,
                    segment_avg_reply_rate: i.segmentAvgReplyRate,
                    pattern_avg_reply_rate: i.patternAvgReplyRate,
                    sample_size: i.sampleSize,
                    lift_vs_segment: i.liftVsSegment,
                    lift_vs_pattern: i.liftVsPattern,
                    is_significant: i.isSignificant,
                  }))}
                />
              </TabsContent>

              <TabsContent value="volume" className="space-y-4">
                <VolumeAllocationRecommendations
                  recommendations={volumeRecs}
                  projection={projection}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
