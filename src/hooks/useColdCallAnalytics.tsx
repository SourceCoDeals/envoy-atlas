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
import { startOfDay, subDays, parseISO, format } from 'date-fns';

export type DateRange = '7d' | '14d' | '30d' | '90d' | 'all';

// Map cold_calls schema to CallActivity interface for component compatibility
export interface ColdCall {
  id: string;
  client_id: string;
  nocodb_id: number | null;
  
  // Call info
  analyst: string | null;
  from_number: string | null;
  from_name: string | null;
  to_number: string | null;
  to_name: string | null;
  to_company: string | null;
  to_email: string | null;
  direction: string | null;
  called_date: string | null;
  called_date_time: string | null;
  call_duration_sec: number | null;
  call_recording_url: string | null;
  call_transcript: string | null;
  
  // Disposition flags (pre-computed)
  category: string | null;
  normalized_category: string | null;
  is_connection: boolean;
  is_meeting: boolean;
  is_voicemail: boolean;
  is_bad_data: boolean;
  
  // AI Scores
  composite_score: number | null;
  seller_interest_score: number | null;
  objection_handling_score: number | null;
  script_adherence_score: number | null;
  question_adherence_score?: number | null;
  quality_of_conversation_score: number | null;
  value_proposition_score: number | null;
  decision_maker_identified_score: number | null;
  referral_rate_score: number | null;
  rapport_building_score: number | null;
  engagement_score: number | null;
  next_step_clarity_score: number | null;
  gatekeeper_handling_score: number | null;
  resolution_rate: number | null;
  
  // AI Reasoning
  interest_rating_reasoning: string | null;
  objection_handling_reasoning: string | null;
  resolution_rate_reasoning: string | null;
  conversation_quality_reasoning: string | null;
  script_adherence_reasoning: string | null;
  decision_maker_reasoning: string | null;
  value_clarity_reasoning: string | null;
  referral_rate_reasoning: string | null;
  
  // AI Outputs
  call_summary: string | null;
  objections: string | null;
  key_concerns: string[] | null;
  target_pain_points: string | null;
  not_interested_reason: string | null;
  opening_type: string | null;
  
  // For compatibility with interest breakdown
  interest_in_selling?: string | null;
  
  // Timestamps
  created_at: string | null;
  updated_at: string | null;
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
  avgScriptAdherence: number | null;
  avgQuestionAdherence: number | null;
  avgObjectionHandling: number | null;
  avgSellerInterest: number | null;
  avgConversationQuality: number | null;
  avgValueProposition: number | null;
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
  questionAdherence: number | null;
}

export interface ColdCallAnalyticsData {
  // Raw data
  calls: ColdCall[];
  
  // Summary metrics
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  avgScores: ScoreAverages;
  
  // Interest breakdown (uses seller_interest_score thresholds)
  interestBreakdown: InterestBreakdown;
  positiveInterestCount: number;
  positiveInterestRate: number;
  
  // Flagged calls (uses config thresholds)
  topCalls: ColdCall[];
  worstCalls: ColdCall[];
  hotLeads: ColdCall[];
  needsCoaching: ColdCall[];
  
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
  
  // Connections and funnel (from pre-computed flags)
  connections: number;
  conversations: number;
  dmConversations: number;
  meetings: number;
  voicemails: number;
  badData: number;
  connectRate: number;
  meetingRate: number;
  voicemailRate: number;
  
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

/**
 * Classify interest based on seller_interest_score thresholds
 * Yes (Hot): >= 7
 * Maybe (Warm): 4-6.9
 * No (Cold): < 4
 */
function classifyInterest(score: number | null): 'yes' | 'maybe' | 'no' | 'unknown' {
  if (score === null || score === undefined) return 'unknown';
  if (score >= 7) return 'yes';
  if (score >= 4) return 'maybe';
  return 'no';
}

function emptyData(config: CallingMetricsConfig): ColdCallAnalyticsData {
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
      questionAdherence: null,
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
    voicemails: 0,
    badData: 0,
    connectRate: 0,
    meetingRate: 0,
    voicemailRate: 0,
    config,
    isLoading: false,
    error: null,
  };
}

export function useColdCallAnalytics(dateRange: DateRange = '30d') {
  const { currentWorkspace } = useWorkspace();
  const { config } = useCallingConfig();

  return useQuery({
    queryKey: ['cold-call-analytics', currentWorkspace?.id, dateRange, config],
    queryFn: async (): Promise<ColdCallAnalyticsData> => {
      if (!currentWorkspace?.id) {
        throw new Error('No workspace selected');
      }

      // Calculate date filter using called_date (YYYY-MM-DD format)
      let dateFilterStr: string | null = null;
      if (dateRange !== 'all') {
        const daysMap: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
        const filterDate = startOfDay(subDays(new Date(), daysMap[dateRange]));
        dateFilterStr = format(filterDate, 'yyyy-MM-dd');
      }

      // Fetch cold calls - no limit to get accurate counts
      // Filter by called_date column which stores dates as YYYY-MM-DD
      let query = supabase
        .from('cold_calls')
        .select('*')
        .eq('client_id', currentWorkspace.id)
        .order('called_date', { ascending: false, nullsFirst: false });

      if (dateFilterStr) {
        query = query.gte('called_date', dateFilterStr);
      }

      const { data: rawCalls, error } = await query;

      if (error) throw error;
      if (!rawCalls?.length) return emptyData(config);

      // Map to ColdCall with computed interest_in_selling from score
      const coldCalls: ColdCall[] = rawCalls.map(call => ({
        ...call,
        interest_in_selling: classifyInterest(call.seller_interest_score),
      }));

      const totalCalls = coldCalls.length;
      const totalDuration = coldCalls.reduce((sum, c) => sum + (c.call_duration_sec || 0), 0);
      const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

      // Score averages
      const avgScores: ScoreAverages = {
        overallQuality: avg(coldCalls.map(c => c.composite_score)),
        sellerInterest: avg(coldCalls.map(c => c.seller_interest_score)),
        scriptAdherence: avg(coldCalls.map(c => c.script_adherence_score)),
        objectionHandling: avg(coldCalls.map(c => c.objection_handling_score)),
        conversationQuality: avg(coldCalls.map(c => c.quality_of_conversation_score)),
        valueProposition: avg(coldCalls.map(c => c.value_proposition_score)),
        questionAdherence: null, // Not available in cold_calls
      };

      // Interest breakdown from seller_interest_score thresholds
      const interestBreakdown: InterestBreakdown = {
        yes: coldCalls.filter(c => classifyInterest(c.seller_interest_score) === 'yes').length,
        maybe: coldCalls.filter(c => classifyInterest(c.seller_interest_score) === 'maybe').length,
        no: coldCalls.filter(c => classifyInterest(c.seller_interest_score) === 'no').length,
        unknown: coldCalls.filter(c => classifyInterest(c.seller_interest_score) === 'unknown').length,
      };

      // Positive interest count (yes + maybe based on config)
      const positiveInterestCount = coldCalls.filter(c => {
        const interest = classifyInterest(c.seller_interest_score);
        return interest === 'yes' || interest === 'maybe';
      }).length;

      // Top calls - USE CONFIG THRESHOLD
      const topCalls = coldCalls
        .filter(c => isTopCall(c.composite_score, config))
        .sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0))
        .slice(0, 20);

      // Worst calls - USE CONFIG THRESHOLD
      const worstCalls = coldCalls
        .filter(c => isWorstCall(c.composite_score, config))
        .sort((a, b) => (a.composite_score || 10) - (b.composite_score || 10))
        .slice(0, 20);

      // Hot leads - seller_interest_score >= 7
      const hotLeads = coldCalls.filter(c => 
        c.seller_interest_score !== null && c.seller_interest_score >= 7
      );

      // Needs coaching - USE CONFIG THRESHOLDS
      const needsCoaching = coldCalls.filter(c => needsCoachingReview({
        overall_quality_score: c.composite_score,
        script_adherence_score: c.script_adherence_score,
        question_adherence_score: c.question_adherence_score,
        objection_handling_score: c.objection_handling_score,
      }, config));

      // Question coverage - not available in cold_calls schema
      const avgQuestionsCovered = 0;
      const questionCoverageRate = 0;

      // Objection stats - parse from objections field if needed
      const totalObjections = coldCalls.reduce((sum, c) => {
        // Count objections from key_concerns array if available
        return sum + (c.key_concerns?.length || 0);
      }, 0);
      const totalResolved = 0; // Not tracked in cold_calls
      const objectionResolutionRate = 0;

      // Connection/meeting metrics FROM PRE-COMPUTED FLAGS
      const connections = coldCalls.filter(c => c.is_connection).length;
      const meetings = coldCalls.filter(c => c.is_meeting).length;
      const voicemails = coldCalls.filter(c => c.is_voicemail).length;
      const badData = coldCalls.filter(c => c.is_bad_data).length;
      
      // DM conversations - connections with seller interest response
      const dmConversations = coldCalls.filter(c => 
        c.is_connection && c.seller_interest_score !== null
      ).length;

      const connectRate = totalCalls > 0 ? (connections / totalCalls) * 100 : 0;
      const meetingRate = totalCalls > 0 ? (meetings / totalCalls) * 100 : 0;
      const voicemailRate = totalCalls > 0 ? (voicemails / totalCalls) * 100 : 0;

      // By rep (analyst)
      const repMap = new Map<string, ColdCall[]>();
      coldCalls.forEach(call => {
        const rep = call.analyst || 'Unknown';
        if (!repMap.has(rep)) repMap.set(rep, []);
        repMap.get(rep)!.push(call);
      });

      const repPerformance: RepPerformanceEnhanced[] = Array.from(repMap.entries()).map(([rep, repCalls]) => {
        const repConnections = repCalls.filter(c => c.is_connection).length;
        const repMeetings = repCalls.filter(c => c.is_meeting).length;

        return {
          rep,
          totalCalls: repCalls.length,
          avgDuration: avgNumber(repCalls.map(c => c.call_duration_sec)),
          avgOverallScore: avg(repCalls.map(c => c.composite_score)),
          avgQuestionsCovered: null,
          avgScriptAdherence: avg(repCalls.map(c => c.script_adherence_score)),
          avgQuestionAdherence: null,
          avgObjectionHandling: avg(repCalls.map(c => c.objection_handling_score)),
          avgSellerInterest: avg(repCalls.map(c => c.seller_interest_score)),
          avgConversationQuality: avg(repCalls.map(c => c.quality_of_conversation_score)),
          avgValueProposition: avg(repCalls.map(c => c.value_proposition_score)),
          positiveInterestCount: repCalls.filter(c => {
            const interest = classifyInterest(c.seller_interest_score);
            return interest === 'yes' || interest === 'maybe';
          }).length,
          needsCoachingCount: repCalls.filter(c => needsCoachingReview({
            overall_quality_score: c.composite_score,
            script_adherence_score: c.script_adherence_score,
            question_adherence_score: c.question_adherence_score,
            objection_handling_score: c.objection_handling_score,
          }, config)).length,
          connections: repConnections,
          meetings: repMeetings,
        };
      }).sort((a, b) => (b.avgOverallScore || 0) - (a.avgOverallScore || 0));

      // Daily trends
      const dailyMap = new Map<string, ColdCall[]>();
      coldCalls.forEach(call => {
        if (call.called_date) {
          const dateKey = call.called_date.split('T')[0];
          if (!dailyMap.has(dateKey)) dailyMap.set(dateKey, []);
          dailyMap.get(dateKey)!.push(call);
        }
      });

      const dailyTrends: DailyTrend[] = Array.from(dailyMap.entries())
        .map(([date, dayCalls]) => {
          const dayConnections = dayCalls.filter(c => c.is_connection).length;
          const dayMeetings = dayCalls.filter(c => c.is_meeting).length;
          
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

      // Hourly data - parse from called_date_time
      const hourlyMap = new Map<number, { calls: number; connections: number }>();
      for (let h = 6; h <= 20; h++) {
        hourlyMap.set(h, { calls: 0, connections: 0 });
      }

      coldCalls.forEach(call => {
        if (call.called_date_time) {
          try {
            const dt = parseISO(call.called_date_time);
            const hour = dt.getHours();
            
            if (hourlyMap.has(hour)) {
              const current = hourlyMap.get(hour)!;
              current.calls++;
              if (call.is_connection) {
                current.connections++;
              }
            }
          } catch {
            // Skip invalid dates
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
        calls: coldCalls,
        totalCalls,
        totalDuration,
        avgDuration,
        avgScores,
        interestBreakdown,
        positiveInterestCount,
        positiveInterestRate: totalCalls > 0 ? (positiveInterestCount / totalCalls) * 100 : 0,
        topCalls,
        worstCalls,
        hotLeads,
        needsCoaching,
        avgQuestionsCovered,
        questionCoverageRate,
        totalObjections,
        totalResolved,
        objectionResolutionRate,
        repPerformance,
        dailyTrends,
        hourlyData,
        connections,
        conversations: connections, // For cold calls, connections are conversations
        dmConversations,
        meetings,
        voicemails,
        badData,
        connectRate,
        meetingRate,
        voicemailRate,
        config,
        isLoading: false,
        error: null,
      };
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000,
  });
}

// Re-export utility functions
export { formatScore, formatCallingDuration, getScoreStatus };
