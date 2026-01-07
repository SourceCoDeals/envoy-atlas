import { useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useCallsWithScores } from '@/hooks/useCallIntelligence';
import { TrendingUp, TrendingDown, Lightbulb, Target, MessageSquare, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const OPENING_TYPES = [
  { value: 'trigger', label: 'Trigger-Based', description: 'References specific event or timing' },
  { value: 'permission', label: 'Permission-Based', description: 'Asks for time upfront' },
  { value: 'value_first', label: 'Value-First', description: 'Leads with benefit or result' },
  { value: 'generic', label: 'Generic', description: 'Standard introduction' },
];

const OBJECTION_TYPES = [
  'Not interested',
  'Already have someone',
  'Bad timing',
  'Just curious',
  'Price concerns',
  'Need to think about it',
  'Spouse/partner decision',
  'Not the decision maker',
];

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function InsightCard({ 
  icon: Icon, 
  title, 
  insight, 
  metric, 
  trend 
}: { 
  icon: React.ElementType;
  title: string;
  insight: string;
  metric: string;
  trend: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${
            trend === 'up' ? 'bg-green-100 text-green-600' :
            trend === 'down' ? 'bg-red-100 text-red-600' :
            'bg-blue-100 text-blue-600'
          }`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{title}</h4>
              <Badge variant={trend === 'up' ? 'default' : trend === 'down' ? 'destructive' : 'secondary'}>
                {metric}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{insight}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PatternAnalysis() {
  const { data: callsData = [], isLoading } = useCallsWithScores({ limit: 500 });
  const aiScores = callsData.filter(c => c.score).map(c => ({ ...c.score!, call_id: c.id }));
  const calls = callsData;

  const openingAnalysis = useMemo(() => {
    const byType = new Map<string, { count: number; avgScore: number; meetingRate: number }>();
    
    aiScores.forEach(score => {
      const type = score.opening_type || 'generic';
      const call = calls.find(c => c.id === score.call_id);
      const hasMeeting = call?.disposition?.toLowerCase().includes('meeting') || 
                         call?.disposition?.toLowerCase().includes('interested');
      
      if (!byType.has(type)) {
        byType.set(type, { count: 0, avgScore: 0, meetingRate: 0 });
      }
      
      const current = byType.get(type)!;
      const newCount = current.count + 1;
      current.avgScore = (current.avgScore * current.count + (score.composite_score || 0)) / newCount;
      current.meetingRate = (current.meetingRate * current.count + (hasMeeting ? 1 : 0)) / newCount;
      current.count = newCount;
    });

    return OPENING_TYPES.map(type => ({
      ...type,
      count: byType.get(type.value)?.count || 0,
      avgScore: byType.get(type.value)?.avgScore || 0,
      meetingRate: (byType.get(type.value)?.meetingRate || 0) * 100,
    })).sort((a, b) => b.avgScore - a.avgScore);
  }, [aiScores, calls]);

  const objectionAnalysis = useMemo(() => {
    const objectionCounts = new Map<string, { total: number; recovered: number }>();
    
    aiScores.forEach(score => {
      const objections = score.objections_list as Array<{ objection: string; recovered: boolean }> | null;
      if (objections) {
        objections.forEach(obj => {
          const key = obj.objection || 'Other';
          if (!objectionCounts.has(key)) {
            objectionCounts.set(key, { total: 0, recovered: 0 });
          }
          const current = objectionCounts.get(key)!;
          current.total++;
          if (obj.recovered) current.recovered++;
        });
      }
    });

    return Array.from(objectionCounts.entries())
      .map(([objection, data]) => ({
        objection,
        total: data.total,
        recovered: data.recovered,
        recoveryRate: data.total > 0 ? (data.recovered / data.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [aiScores]);

  const scoreCorrelations = useMemo(() => {
    const meetingCalls = aiScores.filter(score => {
      const call = calls.find(c => c.id === score.call_id);
      return call?.disposition?.toLowerCase().includes('meeting') || 
             call?.disposition?.toLowerCase().includes('interested');
    });

    const noMeetingCalls = aiScores.filter(score => {
      const call = calls.find(c => c.id === score.call_id);
      return !(call?.disposition?.toLowerCase().includes('meeting') || 
               call?.disposition?.toLowerCase().includes('interested'));
    });

    const avgForGroup = (group: typeof aiScores, key: keyof typeof aiScores[0]) => {
      const values = group.map(s => s[key]).filter((v): v is number => typeof v === 'number');
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    };

    return [
      { dimension: 'Next Step Clarity', meeting: avgForGroup(meetingCalls, 'next_step_clarity_score'), noMeeting: avgForGroup(noMeetingCalls, 'next_step_clarity_score') },
      { dimension: 'Seller Interest', meeting: avgForGroup(meetingCalls, 'seller_interest_score'), noMeeting: avgForGroup(noMeetingCalls, 'seller_interest_score') },
      { dimension: 'Rapport Building', meeting: avgForGroup(meetingCalls, 'rapport_building_score'), noMeeting: avgForGroup(noMeetingCalls, 'rapport_building_score') },
      { dimension: 'Objection Handling', meeting: avgForGroup(meetingCalls, 'objection_handling_score'), noMeeting: avgForGroup(noMeetingCalls, 'objection_handling_score') },
      { dimension: 'Value Proposition', meeting: avgForGroup(meetingCalls, 'value_proposition_score'), noMeeting: avgForGroup(noMeetingCalls, 'value_proposition_score') },
    ];
  }, [aiScores, calls]);

  const topInsights = useMemo(() => {
    const insights = [];

    // Best opening type
    const bestOpening = openingAnalysis[0];
    if (bestOpening && bestOpening.count >= 5) {
      insights.push({
        icon: MessageSquare,
        title: 'Best Opening Type',
        insight: `${bestOpening.label} openings have the highest avg score (${bestOpening.avgScore.toFixed(0)}) and ${bestOpening.meetingRate.toFixed(0)}% meeting rate`,
        metric: `+${((bestOpening.avgScore / (openingAnalysis[openingAnalysis.length - 1]?.avgScore || 1) - 1) * 100).toFixed(0)}%`,
        trend: 'up' as const,
      });
    }

    // Hardest objection
    const hardestObjection = objectionAnalysis.filter(o => o.total >= 3).sort((a, b) => a.recoveryRate - b.recoveryRate)[0];
    if (hardestObjection) {
      insights.push({
        icon: AlertTriangle,
        title: 'Toughest Objection',
        insight: `"${hardestObjection.objection}" has the lowest recovery rate at ${hardestObjection.recoveryRate.toFixed(0)}%`,
        metric: `${hardestObjection.total} occurrences`,
        trend: 'down' as const,
      });
    }

    // Most impactful score dimension
    const biggestGap = scoreCorrelations.sort((a, b) => 
      (b.meeting - b.noMeeting) - (a.meeting - a.noMeeting)
    )[0];
    if (biggestGap) {
      insights.push({
        icon: Target,
        title: 'Key Success Factor',
        insight: `${biggestGap.dimension} shows the biggest difference between meeting-setters (${biggestGap.meeting.toFixed(1)}) and others (${biggestGap.noMeeting.toFixed(1)})`,
        metric: `+${((biggestGap.meeting - biggestGap.noMeeting)).toFixed(1)} pts`,
        trend: 'up' as const,
      });
    }

    return insights;
  }, [openingAnalysis, objectionAnalysis, scoreCorrelations]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading pattern analysis...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pattern Analysis</h1>
          <p className="text-muted-foreground">
            Discover what works and what doesn't across {aiScores.length} analyzed calls
          </p>
        </div>

        {/* Top Insights */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Top Insights
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {topInsights.map((insight, i) => (
              <InsightCard key={i} {...insight} />
            ))}
            {topInsights.length === 0 && (
              <Card className="md:col-span-3">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Not enough data to generate insights</p>
                  <p className="text-sm mt-1">Patterns will emerge after more calls are analyzed</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Opening Type Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Opening Type Effectiveness</CardTitle>
            <CardDescription>
              How different opening approaches perform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                {openingAnalysis.map((type, i) => (
                  <div key={type.value} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="font-medium">{type.label}</span>
                        <span className="text-muted-foreground">({type.count} calls)</span>
                      </div>
                      <span className="font-semibold">{type.avgScore.toFixed(0)} avg</span>
                    </div>
                    <Progress value={type.avgScore} className="h-2" />
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                ))}
              </div>
              <div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={openingAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="avgScore" name="Avg Score" fill="hsl(var(--primary))" />
                    <Bar dataKey="meetingRate" name="Meeting Rate %" fill="hsl(var(--chart-2))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Objection Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Objection Recovery Rates</CardTitle>
            <CardDescription>
              How well the team handles common objections
            </CardDescription>
          </CardHeader>
          <CardContent>
            {objectionAnalysis.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No objection data available yet
              </div>
            ) : (
              <div className="space-y-4">
                {objectionAnalysis.map(obj => (
                  <div key={obj.objection} className="flex items-center gap-4">
                    <div className="w-48 truncate font-medium text-sm">
                      "{obj.objection}"
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Progress value={obj.recoveryRate} className="flex-1 h-3" />
                        <span className="text-sm font-medium w-12 text-right">
                          {obj.recoveryRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground w-24">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      {obj.recovered}
                      <XCircle className="h-4 w-4 text-red-500" />
                      {obj.total - obj.recovered}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score Correlations */}
        <Card>
          <CardHeader>
            <CardTitle>Meeting-Setter vs. Non-Meeting Scores</CardTitle>
            <CardDescription>
              Which dimensions correlate most with setting meetings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreCorrelations} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 10]} />
                <YAxis type="category" dataKey="dimension" width={120} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="meeting" name="Meeting Set" fill="hsl(var(--chart-1))" />
                <Bar dataKey="noMeeting" name="No Meeting" fill="hsl(var(--chart-4))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
