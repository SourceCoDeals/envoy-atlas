import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';

interface Benchmark {
  metric_name: string;
  metric_key: string;
  benchmark_value: number;
  benchmark_unit: string;
  benchmark_range_low: number | null;
  benchmark_range_high: number | null;
  description: string | null;
}

interface ActivityMetrics {
  totalDials: number;
  callsPerHour: number;
  callsPerDay: number;
  voicemailsLeft: number;
  attemptsPerLead: number;
  dailyTrend: { date: string; calls: number; voicemails: number; connects: number }[];
  hourlyDistribution: { hour: number; calls: number; connects: number }[];
}

interface EngagementMetrics {
  connectRate: number;
  decisionMakerConnectRate: number;
  meaningfulConversationRate: number;
  avgCallDuration: number;
  objectionHandlingRate: number;
  connectTrend: { date: string; rate: number }[];
  durationDistribution: { range: string; count: number }[];
  dayHourHeatmap: { day: number; hour: number; connects: number }[];
}

interface OutcomeMetrics {
  meetingsBooked: number;
  conversationToMeetingRate: number;
  leadQualityConversionRate: number;
  conversionToSale: number;
  followUpSuccessRate: number;
  funnel: { stage: string; count: number }[];
  meetingTrend: { date: string; meetings: number }[];
}

interface ProspectMetrics {
  industryBreakdown: { industry: string; calls: number; connects: number; meetings: number }[];
  openingTypeEffectiveness: { type: string; successRate: number; count: number }[];
  topPainPoints: { painPoint: string; count: number }[];
  pendingFollowUps: number;
}

interface GatekeeperMetrics {
  totalGatekeeperCalls: number;
  outcomes: { outcome: string; count: number; percentage: number }[];
  techniques: { technique: string; successRate: number; count: number }[];
  avgHandlingScore: number;
  transferRate: number;
  blockedRate: number;
}

interface WrongNumberMetrics {
  totalWrongNumbers: number;
  wrongNumberRate: number;
  typeBreakdown: { type: string; count: number; percentage: number }[];
  sourceQuality: { source: string; wrongCount: number; totalCount: number; rate: number }[];
  correctedCount: number;
  timeWasted: number;
}

export function useDataInsights() {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [benchmarks, setBenchmarks] = useState<Record<string, Benchmark>>({});
  const [activityMetrics, setActivityMetrics] = useState<ActivityMetrics>({
    totalDials: 0, callsPerHour: 0, callsPerDay: 0, voicemailsLeft: 0, attemptsPerLead: 0,
    dailyTrend: [], hourlyDistribution: [],
  });
  const [engagementMetrics, setEngagementMetrics] = useState<EngagementMetrics>({
    connectRate: 0, decisionMakerConnectRate: 0, meaningfulConversationRate: 0,
    avgCallDuration: 0, objectionHandlingRate: 0, connectTrend: [], durationDistribution: [], dayHourHeatmap: [],
  });
  const [outcomeMetrics, setOutcomeMetrics] = useState<OutcomeMetrics>({
    meetingsBooked: 0, conversationToMeetingRate: 0, leadQualityConversionRate: 0,
    conversionToSale: 0, followUpSuccessRate: 0, funnel: [], meetingTrend: [],
  });
  const [prospectMetrics, setProspectMetrics] = useState<ProspectMetrics>({
    industryBreakdown: [], openingTypeEffectiveness: [], topPainPoints: [], pendingFollowUps: 0,
  });
  const [gatekeeperMetrics, setGatekeeperMetrics] = useState<GatekeeperMetrics>({
    totalGatekeeperCalls: 0, outcomes: [], techniques: [], avgHandlingScore: 0, transferRate: 0, blockedRate: 0,
  });
  const [wrongNumberMetrics, setWrongNumberMetrics] = useState<WrongNumberMetrics>({
    totalWrongNumbers: 0, wrongNumberRate: 0, typeBreakdown: [], sourceQuality: [], correctedCount: 0, timeWasted: 0,
  });

  useEffect(() => {
    if (currentWorkspace?.id) fetchAllData();
  }, [currentWorkspace?.id]);

  const fetchAllData = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Fetch benchmarks
      const { data: benchmarkData } = await supabase.from('cold_calling_benchmarks').select('*');
      const benchmarkMap: Record<string, Benchmark> = {};
      benchmarkData?.forEach(b => { benchmarkMap[b.metric_key] = b; });
      setBenchmarks(benchmarkMap);

      // Fetch scored external calls as the main data source
      const { data: externalCalls } = await supabase
        .from('external_calls')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('import_status', 'scored');

      const { data: callingDeals } = await supabase
        .from('calling_deals')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      const { data: pendingFollowups } = await supabase
        .from('call_summaries')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_followup_completed', false)
        .not('followup_task_name', 'is', null);

      const aiScores = externalCalls || [];
      const totalDials = aiScores.length;

      // Group by date for daily trend
      const dateMap = new Map<string, { calls: number; connects: number }>();
      aiScores.forEach(call => {
        const date = call.date_time ? new Date(call.date_time).toISOString().split('T')[0] : 'unknown';
        const existing = dateMap.get(date) || { calls: 0, connects: 0 };
        existing.calls += 1;
        if ((call.seller_interest_score || 0) >= 5) existing.connects += 1;
        dateMap.set(date, existing);
      });
      const dailyTrend = Array.from(dateMap.entries())
        .map(([date, data]) => ({ date, calls: data.calls, voicemails: 0, connects: data.connects }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      const uniqueDays = dateMap.size || 1;
      const totalConnects = aiScores.filter(s => (s.seller_interest_score || 0) >= 5).length;

      setActivityMetrics({
        totalDials, callsPerHour: Math.round((totalDials / uniqueDays / 8) * 10) / 10,
        callsPerDay: Math.round(totalDials / uniqueDays), voicemailsLeft: 0,
        attemptsPerLead: 1, dailyTrend, hourlyDistribution: [],
      });

      // Engagement Metrics
      const connectRate = totalDials > 0 ? (totalConnects / totalDials) * 100 : 0;
      const avgObjHandling = aiScores.length ? aiScores.reduce((sum, s) => sum + (s.objection_handling_score || 0), 0) / aiScores.length : 0;

      setEngagementMetrics({
        connectRate: Math.round(connectRate * 10) / 10, decisionMakerConnectRate: 0,
        meaningfulConversationRate: Math.round(connectRate * 10) / 10, avgCallDuration: 0,
        objectionHandlingRate: Math.round(avgObjHandling * 10) / 10, connectTrend: [], durationDistribution: [], dayHourHeatmap: [],
      });

      // Outcome Metrics
      const highInterest = aiScores.filter(s => (s.seller_interest_score || 0) >= 7).length;
      const funnel = [
        { stage: 'Total Calls', count: totalDials },
        { stage: 'Connections', count: totalConnects },
        { stage: 'High Interest', count: highInterest },
      ];

      setOutcomeMetrics({ 
        meetingsBooked: highInterest, 
        conversationToMeetingRate: totalConnects > 0 ? Math.round((highInterest / totalConnects) * 100) : 0, 
        leadQualityConversionRate: 0, 
        conversionToSale: 0, 
        followUpSuccessRate: 0, 
        funnel, 
        meetingTrend: [] 
      });

      // Prospect Metrics
      const openingMap = new Map<string, { success: number; total: number }>();
      aiScores.forEach(score => {
        const type = score.opening_type || 'Unknown';
        const existing = openingMap.get(type) || { success: 0, total: 0 };
        existing.total += 1;
        if ((score.seller_interest_score || 0) >= 7) existing.success += 1;
        openingMap.set(type, existing);
      });
      const openingTypeEffectiveness = Array.from(openingMap.entries()).map(([type, data]) => ({ 
        type, successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0, count: data.total 
      }));

      setProspectMetrics({ industryBreakdown: [], openingTypeEffectiveness, topPainPoints: [], pendingFollowUps: pendingFollowups?.length || 0 });

      // Gatekeeper Metrics
      const gatekeeperCalls = aiScores.filter(s => s.call_category?.toLowerCase().includes('gatekeeper'));
      setGatekeeperMetrics({
        totalGatekeeperCalls: gatekeeperCalls.length,
        outcomes: [], techniques: [], avgHandlingScore: 0, transferRate: 0, blockedRate: 0,
      });

      // Wrong Number Metrics
      setWrongNumberMetrics({
        totalWrongNumbers: 0, wrongNumberRate: 0, typeBreakdown: [], sourceQuality: [], correctedCount: 0, timeWasted: 0,
      });

    } catch (error) {
      console.error('Error fetching data insights:', error);
    } finally {
      setLoading(false);
    }
  };

  return { loading, benchmarks, activityMetrics, engagementMetrics, outcomeMetrics, prospectMetrics, gatekeeperMetrics, wrongNumberMetrics, refetch: fetchAllData };
}
