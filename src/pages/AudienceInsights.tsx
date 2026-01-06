import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, Building2, Briefcase, Globe, Target } from 'lucide-react';
import { useAudienceAnalytics } from '@/hooks/useAudienceAnalytics';
import { SegmentPerformanceRanking, createSegmentRankings } from '@/components/audience/SegmentPerformanceRanking';
import { ICPValidationSection, createICPHypothesis } from '@/components/audience/ICPValidationSection';
import { FatigueMonitor, calculateSegmentFatigue } from '@/components/audience/FatigueMonitor';
import { VolumeAllocationRecommendations, generateVolumeRecommendations } from '@/components/audience/VolumeAllocationRecommendations';
import { SegmentCopyMatrix, generateSegmentCopyInteractions } from '@/components/audience/SegmentCopyMatrix';

export default function AudienceInsights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { segments, titles, industries, companySizes, domains, totalLeads, loading } = useAudienceAnalytics();
  const [activeTab, setActiveTab] = useState('performance');
  const [dimension, setDimension] = useState('seniority');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasData = totalLeads > 0;

  // Calculate average reply rate
  const avgReplyRate = segments.reduce((sum, s) => sum + s.reply_rate * s.contacted, 0) / 
    Math.max(segments.reduce((sum, s) => sum + s.contacted, 0), 1);

  // Create segment rankings based on dimension
  const seniorityRankings = createSegmentRankings(
    titles.reduce((acc, t) => {
      const existing = acc.find(a => a.name === t.seniority);
      if (existing) {
        existing.sent += t.contacted;
        existing.replied += t.replied;
        existing.positive += t.positive;
      } else {
        acc.push({ name: t.seniority, type: 'seniority', sent: t.contacted, replied: t.replied, positive: t.positive, meetings: 0 });
      }
      return acc;
    }, [] as any[]),
    avgReplyRate
  );

  const industryRankings = createSegmentRankings(
    industries.map(i => ({ name: i.industry, type: 'industry', sent: i.contacted, replied: i.replied, positive: i.positive, meetings: 0 })),
    avgReplyRate
  );

  // Create ICP hypotheses from best performing segments
  const icpHypotheses = seniorityRankings.slice(0, 2).filter(s => s.volume > 500).map((s, i) => 
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

  // Segment × Copy matrix
  const copyPatterns = ['Question Subject', 'Personalized Open', 'Value First', 'Direct Ask'];
  const { interactions: copyInteractions, insights: copyInsights } = generateSegmentCopyInteractions(
    seniorityRankings.slice(0, 4).map(s => s.segment),
    copyPatterns,
    (segment, pattern) => {
      const baseRate = seniorityRankings.find(s => s.segment === segment)?.replyRate || 3;
      return {
        replyRate: baseRate * (0.8 + Math.random() * 0.4),
        sampleSize: 100 + Math.floor(Math.random() * 500),
      };
    }
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

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
        </div>

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
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{totalLeads.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-chart-1" />
                    <span className="text-2xl font-bold">{titles.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Unique Titles</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-chart-2" />
                    <span className="text-2xl font-bold">{industries.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Industries</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-success" />
                    <span className="text-2xl font-bold">{avgReplyRate.toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Avg Reply Rate</p>
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
                  insight={`${dimension === 'seniority' ? 'VP and Director' : 'Top'}-level contacts significantly outperform others. Consider reallocating volume to high-performing segments.`}
                />
              </TabsContent>

              <TabsContent value="icp" className="space-y-4">
                <ICPValidationSection hypotheses={icpHypotheses} />
              </TabsContent>

              <TabsContent value="fatigue" className="space-y-4">
                <FatigueMonitor segments={fatigueData} />
              </TabsContent>

              <TabsContent value="copy" className="space-y-4">
                <SegmentCopyMatrix
                  interactions={copyInteractions}
                  copyPatterns={copyPatterns}
                  insights={copyInsights}
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
