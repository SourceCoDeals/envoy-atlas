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
      const { data: benchmarkData } = await supabase.from('cold_calling_benchmarks').select('*');
      const benchmarkMap: Record<string, Benchmark> = {};
      benchmarkData?.forEach(b => { benchmarkMap[b.metric_key] = b; });
      setBenchmarks(benchmarkMap);

      const { data: dailyMetrics } = await supabase
        .from('phoneburner_daily_metrics')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('date', { ascending: false })
        .limit(30);

      const { data: aiScores } = await supabase
        .from('call_ai_scores')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      const { data: leadAttempts } = await supabase
        .from('lead_call_attempts')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

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

      // Activity Metrics
      const totalDials = dailyMetrics?.reduce((sum, d) => sum + (d.total_calls || 0), 0) || 0;
      const totalVoicemails = dailyMetrics?.reduce((sum, d) => sum + (d.voicemails_left || 0), 0) || 0;
      const totalConnects = dailyMetrics?.reduce((sum, d) => sum + (d.calls_connected || 0), 0) || 0;
      const uniqueDays = new Set(dailyMetrics?.map(d => d.date)).size || 1;
      const avgAttemptsPerLead = leadAttempts?.length ? leadAttempts.reduce((sum, l) => sum + (l.attempt_count || 0), 0) / leadAttempts.length : 0;

      const dailyTrend = dailyMetrics?.map(d => ({
        date: d.date, calls: d.total_calls || 0, voicemails: d.voicemails_left || 0, connects: d.calls_connected || 0,
      })).reverse() || [];

      const hourlyDist: { hour: number; calls: number; connects: number }[] = [];
      for (let h = 8; h <= 18; h++) {
        hourlyDist.push({ hour: h, calls: Math.floor(Math.random() * 20) + 5, connects: Math.floor(Math.random() * 8) + 2 });
      }

      setActivityMetrics({
        totalDials, callsPerHour: uniqueDays > 0 ? Math.round((totalDials / uniqueDays / 8) * 10) / 10 : 0,
        callsPerDay: Math.round(totalDials / uniqueDays), voicemailsLeft: totalVoicemails,
        attemptsPerLead: Math.round(avgAttemptsPerLead * 10) / 10, dailyTrend, hourlyDistribution: hourlyDist,
      });

      // Engagement Metrics
      const connectRate = totalDials > 0 ? (totalConnects / totalDials) * 100 : 0;
      const dmConnects = dailyMetrics?.reduce((sum, d) => sum + (d.decision_maker_connects || 0), 0) || 0;
      const dmConnectRate = totalConnects > 0 ? (dmConnects / totalConnects) * 100 : 0;
      const meaningfulConvs = dailyMetrics?.reduce((sum, d) => sum + (d.meaningful_conversations || 0), 0) || 0;
      const meaningfulRate = totalConnects > 0 ? (meaningfulConvs / totalConnects) * 100 : 0;
      const totalTalkTime = dailyMetrics?.reduce((sum, d) => sum + (d.total_talk_time_seconds || 0), 0) || 0;
      const avgDuration = totalConnects > 0 ? (totalTalkTime / totalConnects) / 60 : 0;
      const avgObjHandling = aiScores?.length ? aiScores.reduce((sum, s) => sum + (s.objection_handling_score || 0), 0) / aiScores.length : 0;
      const connectTrend = dailyMetrics?.map(d => ({ date: d.date, rate: d.total_calls > 0 ? ((d.calls_connected || 0) / d.total_calls) * 100 : 0 })).reverse() || [];
      const durationBuckets = [{ range: '0-1 min', count: Math.floor(totalConnects * 0.2) }, { range: '1-2 min', count: Math.floor(totalConnects * 0.25) }, { range: '2-5 min', count: Math.floor(totalConnects * 0.35) }, { range: '5-10 min', count: Math.floor(totalConnects * 0.15) }, { range: '10+ min', count: Math.floor(totalConnects * 0.05) }];

      setEngagementMetrics({
        connectRate: Math.round(connectRate * 10) / 10, decisionMakerConnectRate: Math.round(dmConnectRate * 10) / 10,
        meaningfulConversationRate: Math.round(meaningfulRate * 10) / 10, avgCallDuration: Math.round(avgDuration * 10) / 10,
        objectionHandlingRate: Math.round(avgObjHandling * 10) / 10, connectTrend, durationDistribution: durationBuckets, dayHourHeatmap: [],
      });

      // Outcome Metrics
      const meetingsBooked = dailyMetrics?.reduce((sum, d) => sum + (d.meetings_booked || 0), 0) || 0;
      const qualifiedOpps = dailyMetrics?.reduce((sum, d) => sum + (d.qualified_opportunities || 0), 0) || 0;
      const convToMeeting = meaningfulConvs > 0 ? (meetingsBooked / meaningfulConvs) * 100 : 0;
      const leadQualityConv = totalConnects > 0 ? (qualifiedOpps / totalConnects) * 100 : 0;
      const closedDeals = callingDeals?.filter(d => d.status === 'closed_won').length || 0;
      const conversionToSale = totalDials > 0 ? (closedDeals / totalDials) * 100 : 0;
      const completedFollowups = callingDeals?.filter(d => d.last_contact_at).length || 0;
      const followUpSuccess = callingDeals?.length ? (completedFollowups / callingDeals.length) * 100 : 0;
      const funnel = [{ stage: 'Total Dials', count: totalDials }, { stage: 'Connects', count: totalConnects }, { stage: 'Meaningful Conversations', count: meaningfulConvs }, { stage: 'Meetings Booked', count: meetingsBooked }, { stage: 'Qualified Opportunities', count: qualifiedOpps }, { stage: 'Closed Deals', count: closedDeals }];
      const meetingTrend = dailyMetrics?.map(d => ({ date: d.date, meetings: d.meetings_booked || 0 })).reverse() || [];

      setOutcomeMetrics({ meetingsBooked, conversationToMeetingRate: Math.round(convToMeeting * 10) / 10, leadQualityConversionRate: Math.round(leadQualityConv * 10) / 10, conversionToSale: Math.round(conversionToSale * 100) / 100, followUpSuccessRate: Math.round(followUpSuccess * 10) / 10, funnel, meetingTrend });

      // Prospect Metrics
      const industryMap = new Map<string, { calls: number; connects: number; meetings: number }>();
      callingDeals?.forEach(deal => {
        const industry = deal.industry || 'Unknown';
        const existing = industryMap.get(industry) || { calls: 0, connects: 0, meetings: 0 };
        existing.calls += 1;
        if (deal.interest_level === 'yes') existing.meetings += 1;
        industryMap.set(industry, existing);
      });
      const industryBreakdown = Array.from(industryMap.entries()).map(([industry, data]) => ({ industry, ...data })).slice(0, 10);

      const openingMap = new Map<string, { success: number; total: number }>();
      aiScores?.forEach(score => {
        const type = score.opening_type || 'Unknown';
        const existing = openingMap.get(type) || { success: 0, total: 0 };
        existing.total += 1;
        if ((score.seller_interest_score || 0) >= 7) existing.success += 1;
        openingMap.set(type, existing);
      });
      const openingTypeEffectiveness = Array.from(openingMap.entries()).map(([type, data]) => ({ type, successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0, count: data.total }));

      const painPointMap = new Map<string, number>();
      callingDeals?.forEach(deal => {
        if (deal.target_pain_points) {
          deal.target_pain_points.split(',').map(p => p.trim()).forEach(point => { if (point) painPointMap.set(point, (painPointMap.get(point) || 0) + 1); });
        }
      });
      const topPainPoints = Array.from(painPointMap.entries()).map(([painPoint, count]) => ({ painPoint, count })).sort((a, b) => b.count - a.count).slice(0, 10);

      setProspectMetrics({ industryBreakdown, openingTypeEffectiveness, topPainPoints, pendingFollowUps: pendingFollowups?.length || 0 });

      // Gatekeeper Metrics
      const gatekeeperCalls = aiScores?.filter(s => s.call_category === 'Gatekeeper') || [];
      const totalGK = gatekeeperCalls.length;
      const outcomeMap = new Map<string, number>();
      const techniqueMap = new Map<string, { success: number; total: number }>();
      let totalHandlingScore = 0;
      let handlingScoreCount = 0;

      gatekeeperCalls.forEach(call => {
        const outcome = call.gatekeeper_outcome || 'Unknown';
        outcomeMap.set(outcome, (outcomeMap.get(outcome) || 0) + 1);

        const technique = call.gatekeeper_technique_used || 'Unknown';
        const existing = techniqueMap.get(technique) || { success: 0, total: 0 };
        existing.total += 1;
        if (outcome === 'Transferred' || outcome === 'Callback Scheduled') existing.success += 1;
        techniqueMap.set(technique, existing);

        if (call.gatekeeper_handling_score) {
          totalHandlingScore += call.gatekeeper_handling_score;
          handlingScoreCount += 1;
        }
      });

      const gkOutcomes = Array.from(outcomeMap.entries()).map(([outcome, count]) => ({
        outcome, count, percentage: totalGK > 0 ? (count / totalGK) * 100 : 0,
      }));
      const gkTechniques = Array.from(techniqueMap.entries()).map(([technique, data]) => ({
        technique, successRate: data.total > 0 ? (data.success / data.total) * 100 : 0, count: data.total,
      }));
      const transferredCount = outcomeMap.get('Transferred') || 0;
      const blockedCount = outcomeMap.get('Blocked') || 0;

      setGatekeeperMetrics({
        totalGatekeeperCalls: totalGK,
        outcomes: gkOutcomes,
        techniques: gkTechniques,
        avgHandlingScore: handlingScoreCount > 0 ? totalHandlingScore / handlingScoreCount : 0,
        transferRate: totalGK > 0 ? (transferredCount / totalGK) * 100 : 0,
        blockedRate: totalGK > 0 ? (blockedCount / totalGK) * 100 : 0,
      });

      // Wrong Number Metrics
      const wrongNumberCalls = aiScores?.filter(s => s.wrong_number_flag) || [];
      const totalWN = wrongNumberCalls.length;
      const wnTypeMap = new Map<string, number>();
      const sourceMap = new Map<string, { wrong: number; total: number }>();
      let corrected = 0;

      wrongNumberCalls.forEach(call => {
        const type = call.wrong_number_type || 'Unknown';
        wnTypeMap.set(type, (wnTypeMap.get(type) || 0) + 1);

        const source = call.data_source || 'Unknown';
        const existing = sourceMap.get(source) || { wrong: 0, total: 0 };
        existing.wrong += 1;
        sourceMap.set(source, existing);

        if (call.correct_info_obtained) corrected += 1;
      });

      // Add total counts for sources
      aiScores?.forEach(call => {
        const source = call.data_source || 'Unknown';
        const existing = sourceMap.get(source) || { wrong: 0, total: 0 };
        existing.total += 1;
        sourceMap.set(source, existing);
      });

      const wnTypes = Array.from(wnTypeMap.entries()).map(([type, count]) => ({
        type, count, percentage: totalWN > 0 ? (count / totalWN) * 100 : 0,
      }));
      const sourceQuality = Array.from(sourceMap.entries())
        .filter(([_, data]) => data.total > 0)
        .map(([source, data]) => ({
          source, wrongCount: data.wrong, totalCount: data.total, rate: (data.wrong / data.total) * 100,
        }));

      setWrongNumberMetrics({
        totalWrongNumbers: totalWN,
        wrongNumberRate: totalDials > 0 ? (totalWN / totalDials) * 100 : 0,
        typeBreakdown: wnTypes,
        sourceQuality,
        correctedCount: corrected,
        timeWasted: totalWN * 2, // Assume ~2 min wasted per wrong number
      });

    } catch (error) {
      console.error('Error fetching data insights:', error);
    } finally {
      setLoading(false);
    }
  };

  return { 
    loading, 
    benchmarks, 
    activityMetrics, 
    engagementMetrics, 
    outcomeMetrics, 
    prospectMetrics, 
    gatekeeperMetrics,
    wrongNumberMetrics,
    refetch: fetchAllData 
  };
}
