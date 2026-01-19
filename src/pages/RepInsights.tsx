import { useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useCallsWithScores } from '@/hooks/useCallIntelligence';
import { Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface RepStats {
  name: string;
  totalCalls: number;
  avgTalkDuration: number;
  avgQualityScore: number;
  connectRate: number;
  meetingsSet: number;
}

function RepRadarChart({ rep }: { rep: RepStats }) {
  const data = [
    { dimension: 'Talk Duration', value: Math.min(100, rep.avgTalkDuration / 3), fullMark: 100 },
    { dimension: 'Connect Rate', value: rep.connectRate, fullMark: 100 },
    { dimension: 'Quality Score', value: rep.avgQualityScore, fullMark: 100 },
    { dimension: 'Meetings', value: Math.min(100, rep.meetingsSet * 20), fullMark: 100 },
    { dimension: 'Call Volume', value: Math.min(100, rep.totalCalls * 5), fullMark: 100 },
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
      { name: 'Talk Duration', score: Math.min(10, rep.avgTalkDuration / 30) },
      { name: 'Connect Rate', score: rep.connectRate / 10 },
      { name: 'Quality', score: rep.avgQualityScore / 10 },
      { name: 'Meetings', score: Math.min(10, rep.meetingsSet) },
      { name: 'Volume', score: Math.min(10, rep.totalCalls / 5) },
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
          <Badge variant={rep.avgQualityScore >= 70 ? 'default' : rep.avgQualityScore >= 50 ? 'secondary' : 'destructive'}>
            {Math.round(rep.avgQualityScore)} avg
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

        <div className="grid grid-cols-2 gap-2 pt-2 border-t text-center text-sm">
          <div>
            <p className="font-semibold">{(rep.connectRate).toFixed(0)}%</p>
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
    'Quality Score': Math.round(rep.avgQualityScore),
    'Connect Rate': Math.round(rep.connectRate),
    'Avg Duration (min)': Math.round(rep.avgTalkDuration / 60),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} />
        <YAxis type="category" dataKey="name" width={80} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Quality Score" fill="hsl(var(--primary))" />
        <Bar dataKey="Connect Rate" fill="hsl(var(--chart-2))" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function RepInsights() {
  const { data: callsData = [], isLoading } = useCallsWithScores({ limit: 500 });

  const repStats = useMemo(() => {
    const repMap = new Map<string, typeof callsData>();

    // Group calls by caller_name
    callsData.forEach(call => {
      const repName = call.caller_name || 'Unknown Rep';
      if (!repMap.has(repName)) {
        repMap.set(repName, []);
      }
      repMap.get(repName)!.push(call);
    });

    // Calculate stats per rep
    const stats: RepStats[] = [];
    repMap.forEach((calls, name) => {
      if (calls.length === 0) return;

      const connectedCalls = calls.filter(c => c.transcript_text && c.transcript_text.length > 100);
      const meetingsSet = calls.filter(c => 
        c.conversation_outcome?.toLowerCase().includes('meeting') || 
        c.conversation_outcome?.toLowerCase().includes('interested')
      ).length;

      const totalDuration = calls.reduce((sum, c) => sum + (c.talk_duration || 0), 0);
      const avgDuration = calls.length > 0 ? totalDuration / calls.length : 0;
      
      // Calculate quality score based on duration and outcomes
      const qualityScore = Math.min(100, (avgDuration / 3) + (meetingsSet * 10) + (connectedCalls.length / calls.length * 30));

      stats.push({
        name,
        totalCalls: calls.length,
        avgTalkDuration: avgDuration,
        avgQualityScore: qualityScore,
        connectRate: calls.length > 0 ? (connectedCalls.length / calls.length) * 100 : 0,
        meetingsSet,
      });
    });

    return stats.sort((a, b) => b.avgQualityScore - a.avgQualityScore);
  }, [callsData]);

  const teamAvg = useMemo(() => {
    if (repStats.length === 0) return null;
    const avg = (key: keyof RepStats) => {
      const values = repStats.map(r => r[key]).filter((v): v is number => typeof v === 'number');
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    };
    return {
      avgQualityScore: avg('avgQualityScore'),
      avgTalkDuration: avg('avgTalkDuration'),
      connectRate: avg('connectRate'),
    };
  }, [repStats]);

  const totalCalls = callsData.length;

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
              Performance analysis across scoring dimensions
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
                <CardTitle className="text-2xl">{Math.round(teamAvg.avgQualityScore)}</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={teamAvg.avgQualityScore} className="h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg Connect Rate</CardDescription>
                <CardTitle className="text-2xl">{teamAvg.connectRate.toFixed(1)}%</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={teamAvg.connectRate} className="h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg Talk Duration</CardDescription>
                <CardTitle className="text-2xl">{(teamAvg.avgTalkDuration / 60).toFixed(1)} min</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={Math.min(100, teamAvg.avgTalkDuration / 3)} className="h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Calls</CardDescription>
                <CardTitle className="text-2xl">{totalCalls}</CardTitle>
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
                <p>No calls yet</p>
                <p className="text-sm mt-1">Performance data will appear after calls are made</p>
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
