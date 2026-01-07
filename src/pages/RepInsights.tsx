import { useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCallsWithScores, useCallingMetrics } from '@/hooks/useCallIntelligence';
import { Users, TrendingUp, TrendingDown, Target, Award, AlertTriangle, Phone, Clock } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface RepStats {
  name: string;
  totalCalls: number;
  avgCompositeScore: number;
  avgSellerInterest: number;
  avgObjectionHandling: number;
  avgRapportBuilding: number;
  avgValueProposition: number;
  avgEngagement: number;
  avgScriptAdherence: number;
  avgNextStepClarity: number;
  avgValuationDiscussion: number;
  avgMandatoryQuestions: number;
  totalTalkTime: number;
  connectRate: number;
  meetingsSet: number;
}

const SCORE_DIMENSIONS = [
  { key: 'seller_interest', label: 'Seller Interest', short: 'SI' },
  { key: 'objection_handling', label: 'Objection Handling', short: 'OH' },
  { key: 'rapport_building', label: 'Rapport Building', short: 'RB' },
  { key: 'value_proposition', label: 'Value Proposition', short: 'VP' },
  { key: 'engagement', label: 'Engagement', short: 'EN' },
  { key: 'script_adherence', label: 'Script Adherence', short: 'SA' },
  { key: 'next_step_clarity', label: 'Next Step Clarity', short: 'NS' },
  { key: 'valuation_discussion', label: 'Valuation Discussion', short: 'VD' },
];

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function RepRadarChart({ rep }: { rep: RepStats }) {
  const data = [
    { dimension: 'Seller Interest', value: rep.avgSellerInterest * 10, fullMark: 100 },
    { dimension: 'Objection Handling', value: rep.avgObjectionHandling * 10, fullMark: 100 },
    { dimension: 'Rapport Building', value: rep.avgRapportBuilding * 10, fullMark: 100 },
    { dimension: 'Value Proposition', value: rep.avgValueProposition * 10, fullMark: 100 },
    { dimension: 'Engagement', value: rep.avgEngagement * 10, fullMark: 100 },
    { dimension: 'Script Adherence', value: rep.avgScriptAdherence * 10, fullMark: 100 },
    { dimension: 'Next Step Clarity', value: rep.avgNextStepClarity * 10, fullMark: 100 },
    { dimension: 'Valuation Discussion', value: rep.avgValuationDiscussion * 10, fullMark: 100 },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid strokeDasharray="3 3" />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Radar
          name={rep.name}
          dataKey="value"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.3}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function RepCard({ rep, rank }: { rep: RepStats; rank: number }) {
  const strengths = useMemo(() => {
    const scores = [
      { name: 'Seller Interest', score: rep.avgSellerInterest },
      { name: 'Objection Handling', score: rep.avgObjectionHandling },
      { name: 'Rapport Building', score: rep.avgRapportBuilding },
      { name: 'Value Proposition', score: rep.avgValueProposition },
      { name: 'Engagement', score: rep.avgEngagement },
      { name: 'Script Adherence', score: rep.avgScriptAdherence },
      { name: 'Next Step Clarity', score: rep.avgNextStepClarity },
      { name: 'Valuation Discussion', score: rep.avgValuationDiscussion },
    ].sort((a, b) => b.score - a.score);

    return {
      top: scores.slice(0, 2),
      bottom: scores.slice(-2).reverse(),
    };
  }, [rep]);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm ${
              rank === 1 ? 'bg-yellow-500 text-yellow-950' :
              rank === 2 ? 'bg-gray-300 text-gray-700' :
              rank === 3 ? 'bg-amber-600 text-amber-950' :
              'bg-muted text-muted-foreground'
            }`}>
              {rank}
            </div>
            <div>
              <CardTitle className="text-lg">{rep.name}</CardTitle>
              <CardDescription>{rep.totalCalls} calls scored</CardDescription>
            </div>
          </div>
          <Badge variant={rep.avgCompositeScore >= 70 ? 'default' : rep.avgCompositeScore >= 50 ? 'secondary' : 'destructive'}>
            {Math.round(rep.avgCompositeScore)} avg
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <RepRadarChart rep={rep} />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" /> Strengths
            </p>
            {strengths.top.map(s => (
              <div key={s.name} className="flex justify-between">
                <span className="truncate">{s.name}</span>
                <span className="font-medium text-green-600">{s.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-muted-foreground mb-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" /> Focus Areas
            </p>
            {strengths.bottom.map(s => (
              <div key={s.name} className="flex justify-between">
                <span className="truncate">{s.name}</span>
                <span className="font-medium text-amber-600">{s.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center text-sm">
          <div>
            <p className="font-semibold">{formatDuration(rep.totalTalkTime)}</p>
            <p className="text-xs text-muted-foreground">Talk Time</p>
          </div>
          <div>
            <p className="font-semibold">{(rep.connectRate * 100).toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Connect Rate</p>
          </div>
          <div>
            <p className="font-semibold">{rep.meetingsSet}</p>
            <p className="text-xs text-muted-foreground">Meetings</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamComparison({ reps }: { reps: RepStats[] }) {
  const data = reps.slice(0, 10).map(rep => ({
    name: rep.name.split(' ')[0],
    'Composite Score': Math.round(rep.avgCompositeScore),
    'Seller Interest': Math.round(rep.avgSellerInterest * 10),
    'Next Step Clarity': Math.round(rep.avgNextStepClarity * 10),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} />
        <YAxis type="category" dataKey="name" width={80} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Composite Score" fill="hsl(var(--primary))" />
        <Bar dataKey="Seller Interest" fill="hsl(var(--chart-2))" />
        <Bar dataKey="Next Step Clarity" fill="hsl(var(--chart-3))" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function RepInsights() {
  const { data: callsData = [], isLoading } = useCallsWithScores({ limit: 500 });

  const repStats = useMemo(() => {
    const repMap = new Map<string, {
      scores: Array<NonNullable<typeof callsData[0]['score']>>;
      calls: typeof callsData;
    }>();

    // Group calls by rep (via dial session)
    calls.forEach(call => {
      const repName = call.dial_session?.member_name || 'Unknown';
      if (!repMap.has(repName)) {
        repMap.set(repName, { scores: [], calls: [] });
      }
      repMap.get(repName)!.calls.push(call);
    });

    // Add AI scores to corresponding reps
    aiScores.forEach(score => {
      const call = calls.find(c => c.id === score.call_id);
      if (call) {
        const repName = call.dial_session?.member_name || 'Unknown';
        repMap.get(repName)?.scores.push(score);
      }
    });

    // Calculate stats per rep
    const stats: RepStats[] = [];
    repMap.forEach((data, name) => {
      if (data.scores.length === 0) return;

      const avgScore = (key: keyof typeof data.scores[0]) => {
        const values = data.scores.map(s => s[key]).filter((v): v is number => typeof v === 'number');
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      };

      const connectedCalls = data.calls.filter(c => c.is_connected);
      const meetingsSet = data.calls.filter(c => 
        c.disposition?.toLowerCase().includes('meeting') || 
        c.disposition?.toLowerCase().includes('interested')
      ).length;

      stats.push({
        name,
        totalCalls: data.scores.length,
        avgCompositeScore: avgScore('composite_score'),
        avgSellerInterest: avgScore('seller_interest_score'),
        avgObjectionHandling: avgScore('objection_handling_score'),
        avgRapportBuilding: avgScore('rapport_building_score'),
        avgValueProposition: avgScore('value_proposition_score'),
        avgEngagement: avgScore('engagement_score'),
        avgScriptAdherence: avgScore('script_adherence_score'),
        avgNextStepClarity: avgScore('next_step_clarity_score'),
        avgValuationDiscussion: avgScore('valuation_discussion_score'),
        avgMandatoryQuestions: avgScore('mandatory_questions_adherence'),
        totalTalkTime: data.calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0),
        connectRate: data.calls.length > 0 ? connectedCalls.length / data.calls.length : 0,
        meetingsSet,
      });
    });

    return stats.sort((a, b) => b.avgCompositeScore - a.avgCompositeScore);
  }, [aiScores, calls]);

  const teamAvg = useMemo(() => {
    if (repStats.length === 0) return null;
    const avg = (key: keyof RepStats) => {
      const values = repStats.map(r => r[key]).filter((v): v is number => typeof v === 'number');
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    };
    return {
      avgCompositeScore: avg('avgCompositeScore'),
      avgSellerInterest: avg('avgSellerInterest'),
      avgNextStepClarity: avg('avgNextStepClarity'),
    };
  }, [repStats]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading rep insights...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rep Insights</h1>
            <p className="text-muted-foreground">
              AI-powered performance analysis across 10 scoring dimensions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-lg px-3 py-1">
              <Users className="h-4 w-4 mr-2" />
              {repStats.length} Reps
            </Badge>
          </div>
        </div>

        {/* Team Summary */}
        {teamAvg && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Team Avg Score</CardDescription>
                <CardTitle className="text-2xl">{Math.round(teamAvg.avgCompositeScore)}</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={teamAvg.avgCompositeScore} className="h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg Seller Interest</CardDescription>
                <CardTitle className="text-2xl">{teamAvg.avgSellerInterest.toFixed(1)}/10</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={teamAvg.avgSellerInterest * 10} className="h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg Next Step Clarity</CardDescription>
                <CardTitle className="text-2xl">{teamAvg.avgNextStepClarity.toFixed(1)}/10</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={teamAvg.avgNextStepClarity * 10} className="h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Scored Calls</CardDescription>
                <CardTitle className="text-2xl">{aiScores.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Across {repStats.length} reps</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Team Comparison Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Team Comparison</CardTitle>
            <CardDescription>Key metrics across all reps</CardDescription>
          </CardHeader>
          <CardContent>
            <TeamComparison reps={repStats} />
          </CardContent>
        </Card>

        {/* Individual Rep Cards */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Individual Performance</h2>
          {repStats.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No scored calls yet</p>
                <p className="text-sm mt-1">AI scores will appear after calls are transcribed and analyzed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {repStats.map((rep, index) => (
                <RepCard key={rep.name} rep={rep} rank={index + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
