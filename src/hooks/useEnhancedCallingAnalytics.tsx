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
  CallingMetricsConfig,
} from '@/lib/callingConfig';
import { startOfDay, subDays, format } from 'date-fns';

export type DateRange = '7d' | '14d' | '30d' | '90d' | 'all';

// cold_calls schema-aligned interface
export interface ColdCall {
  id: string;
  client_id: string;
  nocodb_row_id: string | null;
  
  // Core call info
  prospect_name: string | null;
  prospect_company: string | null;
  prospect_phone: string | null;
  analyst: string | null;
  engagement_name: string | null;
  
  // Timing
  called_date: string | null;
  called_date_time: string | null;
  call_duration_sec: number | null;
  
  // Category and outcomes
  category: string | null;
  normalized_category: string | null;
  interest: string | null;
  
  // Pre-computed flags
  is_connection: boolean | null;
  is_meeting: boolean | null;
  is_voicemail: boolean | null;
  is_bad_data: boolean | null;
  
  // AI Scores
  composite_score: number | null;
  seller_interest_score: number | null;
  quality_of_conversation_score: number | null;
  objection_handling_score: number | null;
  script_adherence_score: number | null;
  question_adherence_score: number | null;
  value_proposition_score: number | null;
  rapport_building_score: number | null;
  
  // Reasoning fields
  seller_interest_reasoning: string | null;
  quality_of_conversation_reasoning: string | null;
  objection_handling_reasoning: string | null;
  script_adherence_reasoning: string | null;
  question_adherence_reasoning: string | null;
  
  // Extracted intel
  number_of_objections: number | null;
  objections_resolved: number | null;
  questions_covered: number | null;
  
  // Media
  recording_url: string | null;
  call_transcript: string | null;
  call_summary: string | null;
  
  // Timestamps
  synced_at: string | null;
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
}

export interface EnhancedCallingAnalyticsData {
  calls: ColdCall[];
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  avgScores: ScoreAverages;
  interestBreakdown: InterestBreakdown;
  positiveInterestCount: number;
  positiveInterestRate: number;
  topCalls: ColdCall[];
  worstCalls: ColdCall[];
  hotLeads: ColdCall[];
  needsCoaching: ColdCall[];
  avgQuestionsCovered: number;
  questionCoverageRate: number;
  totalObjections: number;
  totalResolved: number;
  objectionResolutionRate: number;
  repPerformance: RepPerformanceEnhanced[];
  dailyTrends: DailyTrend[];
  hourlyData: HourlyData[];
  connections: number;
  conversations: number;
  dmConversations: number;
  meetings: number;
  connectRate: number;
  conversationRate: number;
  meetingRate: number;
  config: CallingMetricsConfig;
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

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

export function useEnhancedCallingAnalytics(dateRange: DateRange = '30d') {
  const { currentWorkspace } = useWorkspace();
  const { config } = useCallingConfig();

  return useQuery({
    queryKey: ['enhanced-calling-analytics', currentWorkspace?.id, dateRange, config],
    queryFn: async (): Promise<EnhancedCallingAnalyticsData> => {
      if (!currentWorkspace?.id) {
        throw new Error('No workspace selected');
      }

      // Calculate date filter
      let dateFilterStr: string | null = null;
      if (dateRange !== 'all') {
        const daysMap: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
        const startDate = startOfDay(subDays(new Date(), daysMap[dateRange]));
        dateFilterStr = format(startDate, 'yyyy-MM-dd');
      }

      // Paginated fetch from cold_calls
      let allCalls: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore && page < MAX_PAGES) {
        let query = supabase
          .from('cold_calls')
          .select('*')
          .eq('client_id', currentWorkspace.id)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
          .order('called_date', { ascending: false });

        if (dateFilterStr) {
          query = query.gte('called_date', dateFilterStr);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allCalls = [...allCalls, ...data];
          hasMore = data.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      if (!allCalls.length) return emptyData(config);

      const totalCalls = allCalls.length;
      const totalDuration = allCalls.reduce((sum, c) => sum + (c.call_duration_sec || 0), 0);
      const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

      // Score averages
      const avgScores: ScoreAverages = {
        overallQuality: avg(allCalls.map(c => c.composite_score)),
        sellerInterest: avg(allCalls.map(c => c.seller_interest_score)),
        scriptAdherence: avg(allCalls.map(c => c.script_adherence_score)),
        objectionHandling: avg(allCalls.map(c => c.objection_handling_score)),
        conversationQuality: avg(allCalls.map(c => c.quality_of_conversation_score)),
        valueProposition: avg(allCalls.map(c => c.value_proposition_score)),
      };

      // Interest breakdown
      const interestBreakdown: InterestBreakdown = {
        yes: allCalls.filter(c => (c.interest || '').toLowerCase() === 'yes').length,
        maybe: allCalls.filter(c => (c.interest || '').toLowerCase() === 'maybe').length,
        no: allCalls.filter(c => (c.interest || '').toLowerCase() === 'no').length,
        unknown: allCalls.filter(c => !c.interest).length,
      };

      // Positive interest count
      const positiveInterestCount = allCalls.filter(c => 
        isPositiveInterest(c.interest, config)
      ).length;

      // Top calls
      const topCalls = allCalls
        .filter(c => isTopCall(c.composite_score, config))
        .slice(0, 20);

      // Worst calls
      const worstCalls = allCalls
        .filter(c => isWorstCall(c.composite_score, config))
        .slice(0, 20);

      // Hot leads
      const hotLeads = allCalls.filter(c => isHotLead({
        seller_interest_score: c.seller_interest_score,
        interest_in_selling: c.interest,
      }, config));

      // Needs coaching
      const needsCoaching = allCalls.filter(c => needsCoachingReview({
        overall_quality_score: c.composite_score,
        script_adherence_score: c.script_adherence_score,
        question_adherence_score: c.question_adherence_score,
        objection_handling_score: c.objection_handling_score,
      }, config));

      // Question coverage
      const avgQuestionsCovered = avgNumber(allCalls.map(c => c.questions_covered));
      const questionCoverageRate = config.questionCoverageTotal > 0 
        ? (avgQuestionsCovered / config.questionCoverageTotal) * 100 
        : 0;

      // Objection stats
      const totalObjections = allCalls.reduce((sum, c) => sum + (c.number_of_objections || 0), 0);
      const totalResolved = allCalls.reduce((sum, c) => sum + (c.objections_resolved || 0), 0);
      const objectionResolutionRate = totalObjections > 0 
        ? (totalResolved / totalObjections) * 100 
        : 0;

      // Connection/meeting metrics using pre-computed flags
      const connections = allCalls.filter(c => c.is_connection).length;
      const conversations = connections; // conversations = connections in this context
      const dmConversations = allCalls.filter(c => 
        c.is_connection && (c.interest === 'yes' || c.interest === 'maybe')
      ).length;
      const meetings = allCalls.filter(c => c.is_meeting).length;

      const connectRate = totalCalls > 0 ? (connections / totalCalls) * 100 : 0;
      const conversationRate = totalCalls > 0 ? (conversations / totalCalls) * 100 : 0;
      const meetingRate = totalCalls > 0 ? (meetings / totalCalls) * 100 : 0;

      // By rep (analyst)
      const repMap = new Map<string, ColdCall[]>();
      allCalls.forEach(call => {
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
          avgQuestionsCovered: avg(repCalls.map(c => c.questions_covered)),
          avgScriptAdherence: avg(repCalls.map(c => c.script_adherence_score)),
          avgQuestionAdherence: avg(repCalls.map(c => c.question_adherence_score)),
          avgObjectionHandling: avg(repCalls.map(c => c.objection_handling_score)),
          avgSellerInterest: avg(repCalls.map(c => c.seller_interest_score)),
          avgConversationQuality: avg(repCalls.map(c => c.quality_of_conversation_score)),
          avgValueProposition: avg(repCalls.map(c => c.value_proposition_score)),
          positiveInterestCount: repCalls.filter(c => isPositiveInterest(c.interest, config)).length,
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

      // Daily trends using called_date
      const dailyMap = new Map<string, ColdCall[]>();
      allCalls.forEach(call => {
        if (call.called_date) {
          const dateKey = call.called_date;
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
            dateLabel: format(new Date(date), 'MMM d'),
            calls: dayCalls.length,
            connections: dayConnections,
            meetings: dayMeetings,
            connectRate: dayCalls.length > 0 ? (dayConnections / dayCalls.length) * 100 : 0,
            avgScore: avg(dayCalls.map(c => c.composite_score)),
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      // Hourly data (extract from called_date_time)
      const hourlyMap = new Map<number, { calls: number; connections: number }>();
      for (let h = 6; h <= 20; h++) {
        hourlyMap.set(h, { calls: 0, connections: 0 });
      }

      allCalls.forEach(call => {
        if (call.called_date_time) {
          const hour = new Date(call.called_date_time).getHours();
          if (hourlyMap.has(hour)) {
            const current = hourlyMap.get(hour)!;
            current.calls++;
            if (call.is_connection) {
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
        calls: allCalls,
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