import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { useCallingConfig } from './useCallingConfig';
import {
  isTopCall,
  isWorstCall,
  isHotLead,
  needsCoachingReview,
  isPositiveInterest,
  getScoreStatus,
  formatScore,
  formatCallingDuration,
  CallingMetricsConfig,
} from '@/lib/callingConfig';
import { startOfDay, subDays, parseISO, getHours, format } from 'date-fns';

export type DateRange = '7d' | '14d' | '30d' | '90d' | 'all';

export interface CallActivity {
  id: string;
  contact_id: string;
  company_id: string;
  engagement_id: string;
  campaign_id: string | null;
  data_source_id: string | null;
  external_id: string | null;
  caller_user_id: string | null;
  caller_name: string | null;
  caller_phone: string | null;
  to_phone: string;
  to_name: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  ring_duration: number | null;
  talk_duration: number | null;
  disposition: string | null;
  conversation_outcome: string | null;
  notes: string | null;
  recording_url: string | null;
  recording_duration: number | null;
  transcription: string | null;
  callback_scheduled: boolean | null;
  callback_datetime: string | null;
  callback_notes: string | null;
  voicemail_left: boolean | null;
  voicemail_template: string | null;
  synced_at: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
  is_dm_conversation: boolean | null;
  
  // AI Scores
  seller_interest_score: number | null;
  quality_of_conversation_score: number | null;
  objection_handling_score: number | null;
  script_adherence_score: number | null;
  value_proposition_score: number | null;
  composite_score: number | null;
  call_summary: string | null;
  objections_list: string[] | null;
  source: string | null;
  
  // Extended fields from raw_data (if available)
  interest_in_selling?: string | null;
  questions_covered_count?: number | null;
  objections_resolved_count?: number | null;
  number_of_objections?: number | null;
}

interface HourlyData {
  hour: number;
  hourLabel: string;
  calls: number;
  connections: number;
  connectRate: number;
}

interface DailyTrend {
  date: string;
  dateLabel: string;
  calls: number;
  connections: number;
  meetings: number;
  connectRate: number;
  avgScore: number | null;
}

interface InterestBreakdown {
  yes: number;
  maybe: number;
  no: number;
  unknown: number;
}

interface RepPerformanceEnhanced {
  rep: string;
  totalCalls: number;
  avgDuration: number;
  avgOverallScore: number | null;
  avgQuestionsCovered: number | null;
  positiveInterestCount: number;
  needsCoachingCount: number;
  connections: number;
  meetings: number;
}

interface ScoreAverages {
  overallQuality: number | null;
  sellerInterest: number | null;
  scriptAdherence: number | null;
  objectionHandling: number | null;
  conversationQuality: number | null;
  valueProposition: number | null;
}

export interface EnhancedCallingAnalyticsData {
  // Raw data
  calls: CallActivity[];
  
  // Summary metrics
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  avgScores: ScoreAverages;
  
  // Interest breakdown (uses config values)
  interestBreakdown: InterestBreakdown;
  positiveInterestCount: number;
  positiveInterestRate: number;
  
  // Flagged calls (uses config thresholds)
  topCalls: CallActivity[];
  worstCalls: CallActivity[];
  hotLeads: CallActivity[];
  needsCoaching: CallActivity[];
  
  // Question coverage
  avgQuestionsCovered: number;
  questionCoverageRate: number;
  
  // Objections
  totalObjections: number;
  totalResolved: number;
  objectionResolutionRate: number;
  
  // Breakdowns
  repPerformance: RepPerformanceEnhanced[];
  dailyTrends: DailyTrend[];
  hourlyData: HourlyData[];
  
  // Connections and funnel
  connections: number;
  conversations: number;
  dmConversations: number;
  meetings: number;
  connectRate: number;
  conversationRate: number;
  meetingRate: number;
  
  // Config reference
  config: CallingMetricsConfig;
  
  // State
  isLoading: boolean;
  error: string | null;
}

function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && v !== undefined);
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function avgNumber(values: (number | null | undefined)[]): number {
  const result = avg(values);
  return result ?? 0;
}

function emptyData(config: CallingMetricsConfig): EnhancedCallingAnalyticsData {
  return {
    calls: [],
    totalCalls: 0,
    totalDuration: 0,
    avgDuration: 0,
    avgScores: {
      overallQuality: null,
      sellerInterest: null,
      scriptAdherence: null,
      objectionHandling: null,
      conversationQuality: null,
      valueProposition: null,
    },
    interestBreakdown: { yes: 0, maybe: 0, no: 0, unknown: 0 },
    positiveInterestCount: 0,
    positiveInterestRate: 0,
    topCalls: [],
    worstCalls: [],
    hotLeads: [],
    needsCoaching: [],
    avgQuestionsCovered: 0,
    questionCoverageRate: 0,
    totalObjections: 0,
    totalResolved: 0,
    objectionResolutionRate: 0,
    repPerformance: [],
    dailyTrends: [],
    hourlyData: [],
    connections: 0,
    conversations: 0,
    dmConversations: 0,
    meetings: 0,
    connectRate: 0,
    conversationRate: 0,
    meetingRate: 0,
    config,
    isLoading: false,
    error: null,
  };
}

export function useEnhancedCallingAnalytics(dateRange: DateRange = '30d') {
  const { currentWorkspace } = useWorkspace();
  const { config } = useCallingConfig();

  return useQuery({
    queryKey: ['enhanced-calling-analytics', currentWorkspace?.id, dateRange, config],
    queryFn: async (): Promise<EnhancedCallingAnalyticsData> => {
      if (!currentWorkspace?.id) {
        throw new Error('No workspace selected');
      }

      // Get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      if (!engagements?.length) {
        return emptyData(config);
      }

      const engagementIds = engagements.map(e => e.id);

      // Calculate date filter
      let dateFilter: Date | null = null;
      if (dateRange !== 'all') {
        const daysMap: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
        dateFilter = startOfDay(subDays(new Date(), daysMap[dateRange]));
      }

      // Fetch call activities
      let query = supabase
        .from('call_activities')
        .select('*')
        .in('engagement_id', engagementIds)
        .order('started_at', { ascending: false });

      if (dateFilter) {
        query = query.gte('started_at', dateFilter.toISOString());
      }

      const { data: calls, error } = await query.limit(2000);

      if (error) throw error;
      if (!calls?.length) return emptyData(config);

      // Extract extended data from raw_data where available
      const enrichedCalls: CallActivity[] = calls.map(call => {
        const rawData = call.raw_data as Record<string, unknown> | null;
        return {
          ...call,
          interest_in_selling: rawData?.interest_in_selling as string | null ?? null,
          questions_covered_count: rawData?.questions_covered_count as number | null ?? null,
          objections_resolved_count: rawData?.objections_resolved_count as number | null ?? null,
          number_of_objections: rawData?.number_of_objections as number | null ?? call.objections_list?.length ?? null,
          // Use composite_score as overall quality since that's what we have
          overall_quality_score: call.composite_score,
          question_adherence_score: rawData?.question_adherence_score as number | null ?? null,
        } as CallActivity;
      });

      const totalCalls = enrichedCalls.length;
      const totalDuration = enrichedCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
      const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

      // Score averages
      const avgScores: ScoreAverages = {
        overallQuality: avg(enrichedCalls.map(c => c.composite_score)),
        sellerInterest: avg(enrichedCalls.map(c => c.seller_interest_score)),
        scriptAdherence: avg(enrichedCalls.map(c => c.script_adherence_score)),
        objectionHandling: avg(enrichedCalls.map(c => c.objection_handling_score)),
        conversationQuality: avg(enrichedCalls.map(c => c.quality_of_conversation_score)),
        valueProposition: avg(enrichedCalls.map(c => c.value_proposition_score)),
      };

      // Interest breakdown - USE CONFIG VALUES
      const interestBreakdown: InterestBreakdown = {
        yes: enrichedCalls.filter(c => (c.interest_in_selling || '').toLowerCase() === 'yes').length,
        maybe: enrichedCalls.filter(c => (c.interest_in_selling || '').toLowerCase() === 'maybe').length,
        no: enrichedCalls.filter(c => (c.interest_in_selling || '').toLowerCase() === 'no').length,
        unknown: enrichedCalls.filter(c => !c.interest_in_selling).length,
      };

      // Positive interest count - USE CONFIG
      const positiveInterestCount = enrichedCalls.filter(c => 
        isPositiveInterest(c.interest_in_selling, config)
      ).length;

      // For top/worst/hot/coaching - create wrapper objects with expected fields
      const callsWithOverall = enrichedCalls.map(c => ({
        ...c,
        overall_quality_score: c.composite_score,
        question_adherence_score: c.script_adherence_score, // fallback
      }));

      // Top calls - USE CONFIG THRESHOLD
      const topCalls = callsWithOverall
        .filter(c => isTopCall(c.composite_score, config))
        .slice(0, 20);

      // Worst calls - USE CONFIG THRESHOLD
      const worstCalls = callsWithOverall
        .filter(c => isWorstCall(c.composite_score, config))
        .slice(0, 20);

      // Hot leads - USE CONFIG
      const hotLeads = callsWithOverall.filter(c => isHotLead({
        seller_interest_score: c.seller_interest_score,
        interest_in_selling: c.interest_in_selling,
      }, config));

      // Needs coaching - USE CONFIG THRESHOLDS
      const needsCoaching = callsWithOverall.filter(c => needsCoachingReview({
        overall_quality_score: c.composite_score,
        script_adherence_score: c.script_adherence_score,
        question_adherence_score: c.script_adherence_score, // fallback
        objection_handling_score: c.objection_handling_score,
      }, config));

      // Question coverage
      const avgQuestionsCovered = avgNumber(enrichedCalls.map(c => c.questions_covered_count));
      const questionCoverageRate = config.questionCoverageTotal > 0 
        ? (avgQuestionsCovered / config.questionCoverageTotal) * 100 
        : 0;

      // Objection stats
      const totalObjections = enrichedCalls.reduce((sum, c) => sum + (c.number_of_objections || c.objections_list?.length || 0), 0);
      const totalResolved = enrichedCalls.reduce((sum, c) => sum + (c.objections_resolved_count || 0), 0);
      const objectionResolutionRate = totalObjections > 0 
        ? (totalResolved / totalObjections) * 100 
        : 0;

      // Connection/conversation metrics
      const connections = enrichedCalls.filter(c => 
        c.disposition === 'connected' || (c.talk_duration && c.talk_duration > 30)
      ).length;
      const conversations = enrichedCalls.filter(c => 
        c.conversation_outcome && c.conversation_outcome !== 'no_answer'
      ).length;
      const dmConversations = enrichedCalls.filter(c => c.is_dm_conversation).length;
      const meetings = enrichedCalls.filter(c => 
        c.conversation_outcome === 'meeting_booked' || c.callback_scheduled
      ).length;

      const connectRate = totalCalls > 0 ? (connections / totalCalls) * 100 : 0;
      const conversationRate = totalCalls > 0 ? (conversations / totalCalls) * 100 : 0;
      const meetingRate = totalCalls > 0 ? (meetings / totalCalls) * 100 : 0;

      // By rep
      const repMap = new Map<string, CallActivity[]>();
      enrichedCalls.forEach(call => {
        const rep = call.caller_name || call.caller_phone || 'Unknown';
        if (!repMap.has(rep)) repMap.set(rep, []);
        repMap.get(rep)!.push(call);
      });

      const repPerformance: RepPerformanceEnhanced[] = Array.from(repMap.entries()).map(([rep, repCalls]) => {
        const repConnections = repCalls.filter(c => 
          c.disposition === 'connected' || (c.talk_duration && c.talk_duration > 30)
        ).length;
        const repMeetings = repCalls.filter(c => 
          c.conversation_outcome === 'meeting_booked' || c.callback_scheduled
        ).length;

        return {
          rep,
          totalCalls: repCalls.length,
          avgDuration: avgNumber(repCalls.map(c => c.duration_seconds)),
          avgOverallScore: avg(repCalls.map(c => c.composite_score)),
          avgQuestionsCovered: avg(repCalls.map(c => c.questions_covered_count)),
          positiveInterestCount: repCalls.filter(c => isPositiveInterest(c.interest_in_selling, config)).length,
          needsCoachingCount: repCalls.filter(c => needsCoachingReview({
            overall_quality_score: c.composite_score,
            script_adherence_score: c.script_adherence_score,
            question_adherence_score: c.script_adherence_score,
            objection_handling_score: c.objection_handling_score,
          }, config)).length,
          connections: repConnections,
          meetings: repMeetings,
        };
      }).sort((a, b) => (b.avgOverallScore || 0) - (a.avgOverallScore || 0));

      // Daily trends
      const dailyMap = new Map<string, CallActivity[]>();
      enrichedCalls.forEach(call => {
        if (call.started_at) {
          const dateKey = format(parseISO(call.started_at), 'yyyy-MM-dd');
          if (!dailyMap.has(dateKey)) dailyMap.set(dateKey, []);
          dailyMap.get(dateKey)!.push(call);
        }
      });

      const dailyTrends: DailyTrend[] = Array.from(dailyMap.entries())
        .map(([date, dayCalls]) => {
          const dayConnections = dayCalls.filter(c => 
            c.disposition === 'connected' || (c.talk_duration && c.talk_duration > 30)
          ).length;
          const dayMeetings = dayCalls.filter(c => 
            c.conversation_outcome === 'meeting_booked' || c.callback_scheduled
          ).length;
          
          return {
            date,
            dateLabel: format(parseISO(date), 'MMM d'),
            calls: dayCalls.length,
            connections: dayConnections,
            meetings: dayMeetings,
            connectRate: dayCalls.length > 0 ? (dayConnections / dayCalls.length) * 100 : 0,
            avgScore: avg(dayCalls.map(c => c.composite_score)),
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      // Hourly data
      const hourlyMap = new Map<number, { calls: number; connections: number }>();
      for (let h = 6; h <= 20; h++) {
        hourlyMap.set(h, { calls: 0, connections: 0 });
      }

      enrichedCalls.forEach(call => {
        if (call.started_at) {
          const hour = getHours(parseISO(call.started_at));
          if (hourlyMap.has(hour)) {
            const current = hourlyMap.get(hour)!;
            current.calls++;
            if (call.disposition === 'connected' || (call.talk_duration && call.talk_duration > 30)) {
              current.connections++;
            }
          }
        }
      });

      const hourlyData: HourlyData[] = Array.from(hourlyMap.entries())
        .map(([hour, data]) => ({
          hour,
          hourLabel: `${hour}:00`,
          calls: data.calls,
          connections: data.connections,
          connectRate: data.calls > 0 ? (data.connections / data.calls) * 100 : 0,
        }));

      return {
        calls: enrichedCalls,
        totalCalls,
        totalDuration,
        avgDuration,
        avgScores,
        interestBreakdown,
        positiveInterestCount,
        positiveInterestRate: totalCalls > 0 ? (positiveInterestCount / totalCalls) * 100 : 0,
        topCalls: topCalls as CallActivity[],
        worstCalls: worstCalls as CallActivity[],
        hotLeads: hotLeads as CallActivity[],
        needsCoaching: needsCoaching as CallActivity[],
        avgQuestionsCovered,
        questionCoverageRate,
        totalObjections,
        totalResolved,
        objectionResolutionRate,
        repPerformance,
        dailyTrends,
        hourlyData,
        connections,
        conversations,
        dmConversations,
        meetings,
        connectRate,
        conversationRate,
        meetingRate,
        config,
        isLoading: false,
        error: null,
      };
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000,
  });
}

// Re-export utilities for convenience
export { formatScore, formatCallingDuration, getScoreStatus };
