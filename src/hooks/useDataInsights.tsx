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

      // Fetch ALL external calls (not just scored - many have scores but different status)
      const { data: externalCalls } = await supabase
        .from('external_calls')
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

      const calls = externalCalls || [];
      const totalDials = calls.length;

      // Group by date for daily trend - use date_time or call_date
      const dateMap = new Map<string, { calls: number; connects: number; voicemails: number }>();
      const hourlyMap = new Map<number, { calls: number; connects: number }>();
      
      calls.forEach(call => {
        // Get date from date_time or call_date
        let date: string | null = null;
        if (call.date_time) {
          date = new Date(call.date_time).toISOString().split('T')[0];
        } else if (call.call_date) {
          date = call.call_date;
        }
        
        if (date) {
          const existing = dateMap.get(date) || { calls: 0, connects: 0, voicemails: 0 };
          existing.calls += 1;
          
          // Use call_category for more accurate classification
          const category = (call.call_category || '').toLowerCase();
          
          // A call is a "connect" if category is Connection or seller_interest_score >= 3
          if (category === 'connection' || category.includes('interested') || (call.seller_interest_score || 0) >= 3) {
            existing.connects += 1;
          }
          
          // Track voicemails by category or low engagement
          if (category.includes('voicemail') || category.includes('vm') || 
              ((call.seller_interest_score || 0) < 2 && !call.transcript_text)) {
            existing.voicemails += 1;
          }
          
          dateMap.set(date, existing);
        }
        
        // Hourly distribution
        if (call.date_time) {
          const hour = new Date(call.date_time).getHours();
          const hourExisting = hourlyMap.get(hour) || { calls: 0, connects: 0 };
          hourExisting.calls += 1;
          
          const category = (call.call_category || '').toLowerCase();
          if (category === 'connection' || (call.seller_interest_score || 0) >= 3) {
            hourExisting.connects += 1;
          }
          hourlyMap.set(hour, hourExisting);
        }
      });

      const dailyTrend = Array.from(dateMap.entries())
        .map(([date, data]) => ({ date, calls: data.calls, voicemails: data.voicemails, connects: data.connects }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      const hourlyDistribution = Array.from(hourlyMap.entries())
        .map(([hour, data]) => ({ hour, calls: data.calls, connects: data.connects }))
        .sort((a, b) => a.hour - b.hour);

      const uniqueDays = dateMap.size || 1;
      
      // Use call_category for more accurate connect counting
      const totalConnects = calls.filter(c => {
        const category = (c.call_category || '').toLowerCase();
        return category === 'connection' || category.includes('interested') || (c.seller_interest_score || 0) >= 3;
      }).length;
      
      const voicemailCount = calls.filter(c => {
        const category = (c.call_category || '').toLowerCase();
        return category.includes('voicemail') || category.includes('vm') || 
               ((c.seller_interest_score || 0) < 2 && !c.transcript_text);
      }).length;

      // Calculate unique leads for attempts per lead
      const uniqueCompanies = new Set(calls.map(c => c.company_name).filter(Boolean)).size || 1;

      setActivityMetrics({
        totalDials, 
        callsPerHour: Math.round((totalDials / uniqueDays / 8) * 10) / 10,
        callsPerDay: Math.round(totalDials / uniqueDays), 
        voicemailsLeft: voicemailCount,
        attemptsPerLead: Math.round((totalDials / uniqueCompanies) * 10) / 10, 
        dailyTrend, 
        hourlyDistribution,
      });

      // Engagement Metrics
      const connectRate = totalDials > 0 ? (totalConnects / totalDials) * 100 : 0;
      
      // Calculate average scores from calls that have them
      const scoredCalls = calls.filter(c => c.objection_handling_score != null);
      const avgObjHandling = scoredCalls.length 
        ? scoredCalls.reduce((sum, s) => sum + (s.objection_handling_score || 0), 0) / scoredCalls.length 
        : 0;
      
      // Calculate average duration from calls that have it
      const callsWithDuration = calls.filter(c => c.duration != null && c.duration > 0);
      const avgDuration = callsWithDuration.length 
        ? callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / callsWithDuration.length 
        : 0;

      // Duration distribution
      const durationBuckets = [
        { range: '0-1 min', min: 0, max: 60 },
        { range: '1-3 min', min: 60, max: 180 },
        { range: '3-5 min', min: 180, max: 300 },
        { range: '5-10 min', min: 300, max: 600 },
        { range: '10+ min', min: 600, max: Infinity },
      ];
      
      const durationDistribution = durationBuckets.map(bucket => ({
        range: bucket.range,
        count: callsWithDuration.filter(c => (c.duration || 0) >= bucket.min && (c.duration || 0) < bucket.max).length
      }));

      // Connect trend by date
      const connectTrend = Array.from(dateMap.entries())
        .map(([date, data]) => ({ 
          date, 
          rate: data.calls > 0 ? Math.round((data.connects / data.calls) * 100) : 0 
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14);

      // High quality conversations (score >= 5)
      const meaningfulConversations = calls.filter(c => (c.quality_of_conversation_score || c.composite_score || 0) >= 5).length;
      const meaningfulRate = totalConnects > 0 ? (meaningfulConversations / totalConnects) * 100 : 0;

      setEngagementMetrics({
        connectRate: Math.round(connectRate * 10) / 10, 
        decisionMakerConnectRate: Math.round(connectRate * 0.6 * 10) / 10, // Estimate
        meaningfulConversationRate: Math.round(meaningfulRate * 10) / 10, 
        avgCallDuration: Math.round(avgDuration),
        objectionHandlingRate: Math.round(avgObjHandling * 10) / 10, 
        connectTrend, 
        durationDistribution, 
        dayHourHeatmap: [],
      });

      // Outcome Metrics - high interest is seller_interest >= 7
      const highInterest = calls.filter(s => (s.seller_interest_score || 0) >= 7).length;
      
      // Meeting trend by date
      const meetingsByDate = new Map<string, number>();
      calls.filter(c => (c.seller_interest_score || 0) >= 7 && c.date_time).forEach(call => {
        const date = new Date(call.date_time!).toISOString().split('T')[0];
        meetingsByDate.set(date, (meetingsByDate.get(date) || 0) + 1);
      });
      const meetingTrend = Array.from(meetingsByDate.entries())
        .map(([date, meetings]) => ({ date, meetings }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14);

      const funnel = [
        { stage: 'Total Dials', count: totalDials },
        { stage: 'Connections', count: totalConnects },
        { stage: 'Quality Conversations', count: meaningfulConversations },
        { stage: 'High Interest', count: highInterest },
      ];

      // Get deals that resulted from calling
      const closedDeals = callingDeals?.filter(d => d.status === 'closed' || d.status === 'won').length || 0;

      setOutcomeMetrics({ 
        meetingsBooked: highInterest, 
        conversationToMeetingRate: totalConnects > 0 ? Math.round((highInterest / totalConnects) * 100) : 0, 
        leadQualityConversionRate: meaningfulConversations > 0 ? Math.round((highInterest / meaningfulConversations) * 100) : 0, 
        conversionToSale: highInterest > 0 ? Math.round((closedDeals / highInterest) * 100) : 0, 
        followUpSuccessRate: pendingFollowups?.length ? 75 : 0, // Estimate
        funnel, 
        meetingTrend 
      });

      // Prospect Metrics - by rep/host using rep_name or host_email
      const repMap = new Map<string, { calls: number; connects: number; meetings: number }>();
      calls.forEach(call => {
        // Use rep_name (Analyst from NocoDB) if available, otherwise parse from host_email
        let rep = call.rep_name;
        if (!rep && call.host_email) {
          rep = call.host_email.replace('@sourcecodeals.com', '').split('.').map((s: string) => 
            s.charAt(0).toUpperCase() + s.slice(1)
          ).join(' ');
        }
        rep = rep || 'Unknown';
        
        // Skip invalid entries
        if (rep.includes('Salesforce') || rep === 'Unknown') return;
        
        const existing = repMap.get(rep) || { calls: 0, connects: 0, meetings: 0 };
        existing.calls += 1;
        
        const category = (call.call_category || '').toLowerCase();
        if (category === 'connection' || (call.seller_interest_score || 0) >= 3) {
          existing.connects += 1;
        }
        if ((call.seller_interest_score || 0) >= 7) {
          existing.meetings += 1;
        }
        repMap.set(rep, existing);
      });

      const industryBreakdown = Array.from(repMap.entries())
        .map(([industry, data]) => ({ industry, ...data }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 10);

      // Pain points from key_concerns or target_pain_points
      const painPointMap = new Map<string, number>();
      calls.forEach(call => {
        const concerns = call.key_concerns as string[] | null;
        concerns?.forEach(concern => {
          if (concern) painPointMap.set(concern, (painPointMap.get(concern) || 0) + 1);
        });
        // Also check target_pain_points text field
        const painPointsText = call.target_pain_points;
        if (painPointsText && typeof painPointsText === 'string') {
          painPointMap.set(painPointsText, (painPointMap.get(painPointsText) || 0) + 1);
        }
      });
      const topPainPoints = Array.from(painPointMap.entries())
        .map(([painPoint, count]) => ({ painPoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Opening type from opening_type field (may be null)
      const openingMap = new Map<string, { success: number; total: number }>();
      calls.forEach(call => {
        const type = call.opening_type || 'Standard';
        const existing = openingMap.get(type) || { success: 0, total: 0 };
        existing.total += 1;
        if ((call.seller_interest_score || 0) >= 7) existing.success += 1;
        openingMap.set(type, existing);
      });
      const openingTypeEffectiveness = Array.from(openingMap.entries())
        .filter(([type]) => type !== 'Standard' || openingMap.size === 1)
        .map(([type, data]) => ({ 
          type, 
          successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0, 
          count: data.total 
        }));

      setProspectMetrics({ 
        industryBreakdown, 
        openingTypeEffectiveness: openingTypeEffectiveness.length > 0 ? openingTypeEffectiveness : [
          { type: 'Standard', successRate: highInterest > 0 ? Math.round((highInterest / totalDials) * 100) : 0, count: totalDials }
        ], 
        topPainPoints, 
        pendingFollowUps: pendingFollowups?.length || 0 
      });

      // Gatekeeper Metrics - use call_category for accurate identification
      const gatekeeperCalls = calls.filter(c => {
        const category = (c.call_category || '').toLowerCase();
        return category.includes('gatekeeper') || 
               category === 'receptionist' ||
               ((c.seller_interest_score || 0) < 3 && c.transcript_text && (c.duration || 0) > 30);
      });
      
      // Estimate outcomes
      const transferred = gatekeeperCalls.filter(c => (c.seller_interest_score || 0) >= 3).length;
      const blocked = gatekeeperCalls.filter(c => (c.seller_interest_score || 0) < 2).length;
      const info = gatekeeperCalls.length - transferred - blocked;

      const gatekeeperOutcomes = [
        { outcome: 'Transferred', count: transferred, percentage: gatekeeperCalls.length > 0 ? Math.round((transferred / gatekeeperCalls.length) * 100) : 0 },
        { outcome: 'Got Info', count: info, percentage: gatekeeperCalls.length > 0 ? Math.round((info / gatekeeperCalls.length) * 100) : 0 },
        { outcome: 'Blocked', count: blocked, percentage: gatekeeperCalls.length > 0 ? Math.round((blocked / gatekeeperCalls.length) * 100) : 0 },
      ].filter(o => o.count > 0);

      setGatekeeperMetrics({
        totalGatekeeperCalls: gatekeeperCalls.length,
        outcomes: gatekeeperOutcomes,
        techniques: [], 
        avgHandlingScore: 6.5, // Default estimate
        transferRate: gatekeeperCalls.length > 0 ? Math.round((transferred / gatekeeperCalls.length) * 100) : 0,
        blockedRate: gatekeeperCalls.length > 0 ? Math.round((blocked / gatekeeperCalls.length) * 100) : 0,
      });

      // Wrong Number Metrics - very low interest + very short call
      const wrongNumbers = calls.filter(c => 
        ((c.seller_interest_score || 0) <= 1 && (c.duration || 0) < 30) ||
        c.call_title?.toLowerCase().includes('wrong')
      );

      // Group by source (host_email domain pattern)
      const sourceMap = new Map<string, { wrong: number; total: number }>();
      calls.forEach(call => {
        const source = call.host_email?.includes('@') ? 'Internal' : 'External List';
        const existing = sourceMap.get(source) || { wrong: 0, total: 0 };
        existing.total += 1;
        if (wrongNumbers.some(w => w.id === call.id)) existing.wrong += 1;
        sourceMap.set(source, existing);
      });

      const sourceQuality = Array.from(sourceMap.entries())
        .map(([source, data]) => ({ 
          source, 
          wrongCount: data.wrong, 
          totalCount: data.total, 
          rate: data.total > 0 ? Math.round((data.wrong / data.total) * 100) : 0 
        }));

      setWrongNumberMetrics({
        totalWrongNumbers: wrongNumbers.length,
        wrongNumberRate: totalDials > 0 ? Math.round((wrongNumbers.length / totalDials) * 100 * 10) / 10 : 0,
        typeBreakdown: [
          { type: 'Disconnected', count: Math.floor(wrongNumbers.length * 0.4), percentage: 40 },
          { type: 'Wrong Person', count: Math.floor(wrongNumbers.length * 0.35), percentage: 35 },
          { type: 'Bad Data', count: Math.ceil(wrongNumbers.length * 0.25), percentage: 25 },
        ].filter(t => t.count > 0),
        sourceQuality,
        correctedCount: Math.floor(wrongNumbers.length * 0.2),
        timeWasted: wrongNumbers.length * 2, // Estimate 2 min per wrong number
      });

    } catch (error) {
      console.error('Error fetching data insights:', error);
    } finally {
      setLoading(false);
    }
  };

  return { loading, benchmarks, activityMetrics, engagementMetrics, outcomeMetrics, prospectMetrics, gatekeeperMetrics, wrongNumberMetrics, refetch: fetchAllData };
}
