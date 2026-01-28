import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { COLD_CALLING_BENCHMARKS } from '@/lib/coldCallingBenchmarks';
import { toEasternHour, BUSINESS_HOURS_ARRAY, isBusinessHour } from '@/lib/timezone';
import { calculateRate } from '@/lib/metrics';
import { logger } from '@/lib/logger';

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
      // Use local benchmarks - COLD_CALLING_BENCHMARKS is an object, not an array
      const benchmarkMap: Record<string, Benchmark> = {};
      // Populate from the SDR metrics as example benchmarks
      Object.entries(COLD_CALLING_BENCHMARKS.sdrMetrics).forEach(([key, value]) => {
        const numValue = typeof value === 'object' ? (value as any).min ?? 0 : (value as number);
        benchmarkMap[key] = {
          metric_name: key,
          metric_key: key,
          benchmark_value: numValue,
          benchmark_unit: '%',
          benchmark_range_low: null,
          benchmark_range_high: null,
          description: null,
        };
      });
      setBenchmarks(benchmarkMap);

      // Get engagements for this client
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);

      if (engagementIds.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch call activities
      const { data: callActivities } = await supabase
        .from('call_activities')
        .select('*')
        .in('engagement_id', engagementIds);

      // Fetch deals
      const { data: deals } = await supabase
        .from('deals')
        .select('*')
        .in('engagement_id', engagementIds);

      const calls = callActivities || [];
      const totalDials = calls.length;

      // Group by date for daily trend
      const dateMap = new Map<string, { calls: number; connects: number; voicemails: number }>();
      const hourlyMap = new Map<number, { calls: number; connects: number }>();
      
      calls.forEach(call => {
        const date = call.started_at ? new Date(call.started_at).toISOString().split('T')[0] : null;
        
        if (date) {
          const existing = dateMap.get(date) || { calls: 0, connects: 0, voicemails: 0 };
          existing.calls += 1;
          
          const disposition = (call.disposition || '').toLowerCase();
          if (disposition.includes('connect') || disposition.includes('conversation') || (call.talk_duration || 0) > 60) {
            existing.connects += 1;
          }
          if (call.voicemail_left) {
            existing.voicemails += 1;
          }
          
          dateMap.set(date, existing);
        }
        
        if (call.started_at) {
          // Use DST-aware Eastern Time conversion
          const dt = new Date(call.started_at);
          const hour = toEasternHour(dt);
          
          // Only track business hours (8 AM - 7 PM ET)
          if (isBusinessHour(hour)) {
            const hourExisting = hourlyMap.get(hour) || { calls: 0, connects: 0 };
            hourExisting.calls += 1;
            if ((call.talk_duration || 0) > 60) {
              hourExisting.connects += 1;
            }
            hourlyMap.set(hour, hourExisting);
          }
        }
      });

      const dailyTrend = Array.from(dateMap.entries())
        .map(([date, data]) => ({ date, calls: data.calls, voicemails: data.voicemails, connects: data.connects }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      // Ensure all business hours are represented
      const hourlyDistribution = BUSINESS_HOURS_ARRAY.map(hour => {
        const data = hourlyMap.get(hour) || { calls: 0, connects: 0 };
        return { hour, calls: data.calls, connects: data.connects };
      });
      const uniqueDays = dateMap.size || 1;
      const totalConnects = calls.filter(c => (c.talk_duration || 0) > 60).length;
      const voicemailCount = calls.filter(c => c.voicemail_left).length;
      const uniqueContacts = new Set(calls.map(c => c.contact_id)).size || 1;

      setActivityMetrics({
        totalDials, 
        callsPerHour: Math.round((totalDials / uniqueDays / 8) * 10) / 10,
        callsPerDay: Math.round(totalDials / uniqueDays), 
        voicemailsLeft: voicemailCount,
        attemptsPerLead: Math.round((totalDials / uniqueContacts) * 10) / 10, 
        dailyTrend, 
        hourlyDistribution,
      });

      // Engagement Metrics
      const connectRate = calculateRate(totalConnects, totalDials);
      const callsWithDuration = calls.filter(c => (c.talk_duration || 0) > 0);
      const avgDuration = callsWithDuration.length 
        ? callsWithDuration.reduce((sum, c) => sum + (c.talk_duration || 0), 0) / callsWithDuration.length 
        : 0;

      const durationBuckets = [
        { range: '0-1 min', min: 0, max: 60 },
        { range: '1-3 min', min: 60, max: 180 },
        { range: '3-5 min', min: 180, max: 300 },
        { range: '5-10 min', min: 300, max: 600 },
        { range: '10+ min', min: 600, max: Infinity },
      ];
      
      const durationDistribution = durationBuckets.map(bucket => ({
        range: bucket.range,
        count: callsWithDuration.filter(c => (c.talk_duration || 0) >= bucket.min && (c.talk_duration || 0) < bucket.max).length
      }));

      const connectTrend = Array.from(dateMap.entries())
        .map(([date, data]) => ({ 
          date, 
          rate: Math.round(calculateRate(data.connects, data.calls)) 
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14);

      const meaningfulConversations = calls.filter(c => (c.talk_duration || 0) >= 180).length;
      const meaningfulRate = calculateRate(meaningfulConversations, totalConnects);

      setEngagementMetrics({
        connectRate: Math.round(connectRate * 10) / 10, 
        decisionMakerConnectRate: 0,
        meaningfulConversationRate: Math.round(meaningfulRate * 10) / 10, 
        avgCallDuration: Math.round(avgDuration),
        objectionHandlingRate: 0, 
        connectTrend, 
        durationDistribution, 
        dayHourHeatmap: [],
      });

      // Outcome Metrics
      const meetingsOutcome = calls.filter(c => 
        c.conversation_outcome?.toLowerCase().includes('meeting') || 
        c.conversation_outcome?.toLowerCase().includes('scheduled')
      ).length;

      const funnel = [
        { stage: 'Total Dials', count: totalDials },
        { stage: 'Connections', count: totalConnects },
        { stage: 'Quality Conversations', count: meaningfulConversations },
        { stage: 'Meetings Booked', count: meetingsOutcome },
      ];

      const closedDeals = deals?.filter(d => d.stage === 'closed' || d.stage === 'won').length || 0;

      setOutcomeMetrics({ 
        meetingsBooked: meetingsOutcome, 
        conversationToMeetingRate: Math.round(calculateRate(meetingsOutcome, totalConnects)), 
        leadQualityConversionRate: Math.round(calculateRate(meetingsOutcome, meaningfulConversations)), 
        conversionToSale: Math.round(calculateRate(closedDeals, meetingsOutcome)),
        followUpSuccessRate: 0,
        funnel, 
        meetingTrend: []
      });

      // Prospect Metrics by caller
      const repMap = new Map<string, { calls: number; connects: number; meetings: number }>();
      calls.forEach(call => {
        const rep = call.caller_name || 'Unknown';
        if (rep === 'Unknown') return;
        
        const existing = repMap.get(rep) || { calls: 0, connects: 0, meetings: 0 };
        existing.calls += 1;
        if ((call.talk_duration || 0) > 60) existing.connects += 1;
        if (call.conversation_outcome?.toLowerCase().includes('meeting')) existing.meetings += 1;
        repMap.set(rep, existing);
      });

      const industryBreakdown = Array.from(repMap.entries())
        .map(([industry, data]) => ({ industry, ...data }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 10);

      const pendingFollowUps = calls.filter(c => c.callback_scheduled && !c.callback_datetime).length;

      setProspectMetrics({ 
        industryBreakdown, 
        openingTypeEffectiveness: [], 
        topPainPoints: [], 
        pendingFollowUps
      });

      // Gatekeeper & Wrong Number - simplified
      setGatekeeperMetrics({
        totalGatekeeperCalls: 0,
        outcomes: [],
        techniques: [], 
        avgHandlingScore: 0,
        transferRate: 0,
        blockedRate: 0,
      });

      setWrongNumberMetrics({
        totalWrongNumbers: 0,
        wrongNumberRate: 0,
        typeBreakdown: [],
        sourceQuality: [],
        correctedCount: 0,
        timeWasted: 0,
      });

    } catch (error) {
      logger.error('Error fetching data insights', error);
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
    refetch: fetchAllData,
  };
}
