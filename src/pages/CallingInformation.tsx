import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCallInformation } from '@/hooks/useCallInformation';
import { ScoreRadarChart } from '@/components/callinformation/ScoreRadarChart';
import { MandatoryQuestionsBreakdown } from '@/components/callinformation/MandatoryQuestionsBreakdown';
import { ObjectionAnalysis } from '@/components/callinformation/ObjectionAnalysis';
import { BusinessIntelligenceCards } from '@/components/callinformation/BusinessIntelligenceCards';
import { CallRecordExpanded } from '@/components/callinformation/CallRecordExpanded';
import { PendingFollowups } from '@/components/callinformation/PendingFollowups';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Phone,
  Loader2,
  Users,
  ThumbsUp,
  Clock,
  Target,
} from 'lucide-react';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--muted))'];

export default function CallingInformation() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading, markFollowupComplete } = useCallInformation();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // Prepare chart data
  const categoryChartData = data ? [
    { name: 'Connection', value: data.callCategories.connection },
    { name: 'Gatekeeper', value: data.callCategories.gatekeeper },
    { name: 'Voicemail', value: data.callCategories.voicemail },
  ].filter(d => d.value > 0) : [];

  const interestChartData = data ? [
    { name: 'Yes', value: data.interestDistribution.yes },
    { name: 'Maybe', value: data.interestDistribution.maybe },
    { name: 'No', value: data.interestDistribution.no },
    { name: 'Unknown', value: data.interestDistribution.unknown },
  ].filter(d => d.value > 0) : [];

  const timelineChartData = data ? [
    { name: 'Immediate', value: data.timelineDistribution.immediate },
    { name: 'Short-term', value: data.timelineDistribution.shortTerm },
    { name: 'Medium-term', value: data.timelineDistribution.mediumTerm },
    { name: 'Long-term', value: data.timelineDistribution.longTerm },
    { name: 'Unknown', value: data.timelineDistribution.unknown },
  ].filter(d => d.value > 0) : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Call Information</h1>
          <p className="text-muted-foreground">AI-extracted insights from all scored conversations</p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Total Calls Scored
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data?.totalCallsScored || 0}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4" />
                    Avg Interest Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    {data?.averageScores.sellerInterest || 0}
                    <span className="text-lg text-muted-foreground">/10</span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Avg Quality Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    {data?.averageScores.overallQuality || 0}
                    <span className="text-lg text-muted-foreground">/10</span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Pending Follow-ups
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data?.pendingFollowups.length || 0}</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="flex-wrap">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="scoring">Scoring Deep Dive</TabsTrigger>
                <TabsTrigger value="objections">Objection Analysis</TabsTrigger>
                <TabsTrigger value="intelligence">Business Intelligence</TabsTrigger>
                <TabsTrigger value="records">Individual Records</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Call Category Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Call Category Distribution</CardTitle>
                      <CardDescription>Breakdown of call outcomes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {categoryChartData.length > 0 ? (
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={categoryChartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {categoryChartData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                          No data yet
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Interest Level Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Interest Level Distribution</CardTitle>
                      <CardDescription>Seller interest breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {interestChartData.length > 0 ? (
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={interestChartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {interestChartData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                          No data yet
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Timeline Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Timeline Distribution</CardTitle>
                      <CardDescription>When sellers plan to sell</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {timelineChartData.length > 0 ? (
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={timelineChartData}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--background))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '6px',
                                }}
                              />
                              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                          No data yet
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Pending Followups */}
                  {data && (
                    <PendingFollowups
                      followups={data.pendingFollowups}
                      onMarkComplete={markFollowupComplete}
                    />
                  )}
                </div>
              </TabsContent>

              {/* Scoring Deep Dive Tab */}
              <TabsContent value="scoring" className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-2">
                  {data && <ScoreRadarChart scores={{
                    sellerInterest: data.averageScores.sellerInterest || 0,
                    objectionHandling: data.averageScores.objectionHandling || 0,
                    rapportBuilding: data.averageScores.rapportBuilding || 0,
                    valueProposition: data.averageScores.valueProposition || 0,
                    engagement: data.averageScores.engagement || 0,
                    scriptAdherence: data.averageScores.scriptAdherence || 0,
                    nextStepClarity: data.averageScores.nextStepClarity || 0,
                    valuationDiscussion: data.averageScores.valuationDiscussion || 0,
                    overallQuality: data.averageScores.overallQuality || 0,
                    decisionMakerIdentification: data.averageScores.decisionMakerIdentification || 0,
                  }} />}
                  {data && <MandatoryQuestionsBreakdown questions={data.mandatoryQuestions} />}
                </div>
              </TabsContent>

              {/* Objection Analysis Tab */}
              <TabsContent value="objections" className="space-y-6">
                {data && <ObjectionAnalysis objections={data.topObjections} />}
              </TabsContent>

              {/* Business Intelligence Tab */}
              <TabsContent value="intelligence" className="space-y-6">
                {data && <BusinessIntelligenceCards data={data.businessIntelligence} />}
              </TabsContent>

              {/* Individual Records Tab */}
              <TabsContent value="records" className="space-y-6">
                {data && (
                  <CallRecordExpanded
                    records={data.callRecords}
                    onMarkFollowupComplete={(recordId) => {
                      // Find the summary ID from the record
                      const record = data.callRecords.find(r => r.id === recordId);
                      if (record) {
                        markFollowupComplete(record.id);
                      }
                    }}
                  />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
