import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { useCallingConfig } from './useCallingConfig';
import { getScoreStatus, formatScore } from '@/lib/callingConfig';
import { startOfWeek, subWeeks, parseISO } from 'date-fns';

export interface ExternalCallIntel {
  id: string;
  call_id: string;
  engagement_id: string;
  
  // 12 AI Scores
  seller_interest_score: number | null;
  objection_handling_score: number | null;
  valuation_discussion_score: number | null;
  rapport_building_score: number | null;
  value_proposition_score: number | null;
  conversation_quality_score: number | null;
  script_adherence_score: number | null;
  overall_quality_score: number | null;
  question_adherence_score: number | null;
  personal_insights_score: number | null;
  next_steps_clarity_score: number | null;
  discovery_score: number | null;
  
  // Justifications
  seller_interest_justification: string | null;
  objection_handling_justification: string | null;
  valuation_discussion_justification: string | null;
  rapport_building_justification: string | null;
  value_proposition_justification: string | null;
  conversation_quality_justification: string | null;
  script_adherence_justification: string | null;
  overall_quality_justification: string | null;
  question_adherence_justification: string | null;
  personal_insights_justification: string | null;
  next_steps_clarity_justification: string | null;
  discovery_justification: string | null;
  
  // Question data
  questions_covered_count: number | null;
  questions_covered_list: string[] | null;
  
  // Objection data
  number_of_objections: number | null;
  objections_resolved_count: number | null;
  objections_list: string[] | null;
  objection_details: Record<string, unknown> | null;
  
  // Extracted intel
  interest_in_selling: string | null;
  timeline_to_sell: string | null;
  buyer_type_preference: string | null;
  personal_insights: string | null;
  target_pain_points: string[] | null;
  next_steps: string | null;
  
  // Metadata
  processed_at: string | null;
  created_at: string;
  
  // Joined call data
  call?: {
    id: string;
    to_name: string | null;
    to_phone: string;
    caller_name: string | null;
    started_at: string | null;
    talk_duration: number | null;
    recording_url: string | null;
    disposition: string | null;
  };
}

interface ScoreOverviewItem {
  key: string;
  label: string;
  thisWeekAvg: number | null;
  lastWeekAvg: number | null;
  trend: 'up' | 'down' | 'flat';
  bestRep: string | null;
  needsCoachingCount: number;
}

interface InterestBreakdown {
  yes: number;
  maybe: number;
  no: number;
  notAsked: number;
}

interface TimelineBreakdown {
  value: string;
  count: number;
}

interface BuyerTypeBreakdown {
  value: string;
  count: number;
}

interface RepObjectionStats {
  rep: string;
  objectionsFaced: number;
  resolved: number;
  resolutionRate: number;
}

export interface CallInsightsData {
  // Raw data
  intelRecords: ExternalCallIntel[];
  
  // Score overview (12 scores with trends)
  scoreOverview: ScoreOverviewItem[];
  
  // Question adherence
  avgQuestionsCovered: number;
  questionDistribution: { count: number; calls: number }[];
  callsWithZeroQuestions: number;
  questionsByRep: { rep: string; avgQuestions: number; zeroCount: number }[];
  
  // Objection intelligence
  totalObjectionsFaced: number;
  totalObjectionsResolved: number;
  overallResolutionRate: number;
  avgObjectionsPerCall: number;
  repObjectionStats: RepObjectionStats[];
  
  // Extracted intel
  interestBreakdown: InterestBreakdown;
  timelineBreakdown: TimelineBreakdown[];
  buyerTypeBreakdown: BuyerTypeBreakdown[];
  personalInsightsList: { insight: string; score: number | null; callId: string }[];
  painPointsList: { painPoint: string; count: number }[];
  
  // Loading state
  isLoading: boolean;
  error: string | null;
}

function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

export function useExternalCallIntel() {
  const { currentWorkspace } = useWorkspace();
  const { config } = useCallingConfig();

  return useQuery({
    queryKey: ['external-call-intel', currentWorkspace?.id],
    queryFn: async (): Promise<CallInsightsData> => {
      if (!currentWorkspace?.id) {
        throw new Error('No workspace selected');
      }

      // Get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      if (!engagements?.length) {
        return emptyData();
      }

      const engagementIds = engagements.map(e => e.id);

      // Fetch external call intel with call data
      const { data: intelData, error } = await supabase
        .from('external_call_intel')
        .select(`
          *,
          call:call_activities(
            id, to_name, to_phone, caller_name, started_at, talk_duration, recording_url, disposition
          )
        `)
        .in('engagement_id', engagementIds)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) throw error;

      const intelRecords = (intelData || []) as ExternalCallIntel[];

      if (!intelRecords.length) {
        // Fallback to raw_data from call_activities if no external_call_intel records
        return buildFromCallActivities(engagementIds);
      }

      // Calculate date ranges for trends
      const now = new Date();
      const thisWeekStart = startOfWeek(now);
      const lastWeekStart = startOfWeek(subWeeks(now, 1));

      const thisWeekRecords = intelRecords.filter(r => {
        const dt = r.call?.started_at ? parseISO(r.call.started_at) : null;
        return dt && dt >= thisWeekStart;
      });

      const lastWeekRecords = intelRecords.filter(r => {
        const dt = r.call?.started_at ? parseISO(r.call.started_at) : null;
        return dt && dt >= lastWeekStart && dt < thisWeekStart;
      });

      // Build score overview for all 12 scores
      const scoreKeys = [
        { key: 'seller_interest_score', label: 'Seller Interest' },
        { key: 'objection_handling_score', label: 'Objection Handling' },
        { key: 'valuation_discussion_score', label: 'Valuation Discussion' },
        { key: 'rapport_building_score', label: 'Rapport Building' },
        { key: 'value_proposition_score', label: 'Value Proposition' },
        { key: 'conversation_quality_score', label: 'Conversation Quality' },
        { key: 'script_adherence_score', label: 'Script Adherence' },
        { key: 'overall_quality_score', label: 'Overall Quality' },
        { key: 'question_adherence_score', label: 'Question Adherence' },
        { key: 'personal_insights_score', label: 'Personal Insights' },
        { key: 'next_steps_clarity_score', label: 'Next Steps Clarity' },
        { key: 'discovery_score', label: 'Discovery' },
      ];

      const scoreOverview: ScoreOverviewItem[] = scoreKeys.map(({ key, label }) => {
        const thisWeekAvg = avg(thisWeekRecords.map(r => r[key as keyof ExternalCallIntel] as number | null));
        const lastWeekAvg = avg(lastWeekRecords.map(r => r[key as keyof ExternalCallIntel] as number | null));
        
        let trend: 'up' | 'down' | 'flat' = 'flat';
        if (thisWeekAvg != null && lastWeekAvg != null) {
          if (thisWeekAvg > lastWeekAvg + 0.2) trend = 'up';
          else if (thisWeekAvg < lastWeekAvg - 0.2) trend = 'down';
        }

        // Find best rep for this score
        const repScores = new Map<string, number[]>();
        intelRecords.forEach(r => {
          const rep = r.call?.caller_name || 'Unknown';
          const score = r[key as keyof ExternalCallIntel] as number | null;
          if (score != null) {
            if (!repScores.has(rep)) repScores.set(rep, []);
            repScores.get(rep)!.push(score);
          }
        });
        
        let bestRep: string | null = null;
        let bestAvg = 0;
        repScores.forEach((scores, rep) => {
          const repAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
          if (repAvg > bestAvg) {
            bestAvg = repAvg;
            bestRep = rep;
          }
        });

        // Count needing coaching (score below 5)
        const needsCoachingCount = intelRecords.filter(r => {
          const score = r[key as keyof ExternalCallIntel] as number | null;
          return score != null && score < 5;
        }).length;

        return { key, label, thisWeekAvg, lastWeekAvg, trend, bestRep, needsCoachingCount };
      });

      // Question adherence deep dive
      const questionsData = intelRecords.map(r => r.questions_covered_count || 0);
      const avgQuestionsCovered = questionsData.length > 0 
        ? questionsData.reduce((a, b) => a + b, 0) / questionsData.length 
        : 0;

      const questionDistribution: { count: number; calls: number }[] = [];
      for (let i = 0; i <= 10; i++) {
        questionDistribution.push({
          count: i,
          calls: questionsData.filter(q => q === i).length,
        });
      }

      const callsWithZeroQuestions = questionsData.filter(q => q === 0).length;

      // By rep question breakdown
      const repQuestionMap = new Map<string, number[]>();
      intelRecords.forEach(r => {
        const rep = r.call?.caller_name || 'Unknown';
        if (!repQuestionMap.has(rep)) repQuestionMap.set(rep, []);
        repQuestionMap.get(rep)!.push(r.questions_covered_count || 0);
      });

      const questionsByRep = Array.from(repQuestionMap.entries()).map(([rep, questions]) => ({
        rep,
        avgQuestions: questions.reduce((a, b) => a + b, 0) / questions.length,
        zeroCount: questions.filter(q => q === 0).length,
      }));

      // Objection intelligence
      const totalObjectionsFaced = intelRecords.reduce((sum, r) => sum + (r.number_of_objections || 0), 0);
      const totalObjectionsResolved = intelRecords.reduce((sum, r) => sum + (r.objections_resolved_count || 0), 0);
      const overallResolutionRate = totalObjectionsFaced > 0 
        ? (totalObjectionsResolved / totalObjectionsFaced) * 100 
        : 0;
      const avgObjectionsPerCall = intelRecords.length > 0 
        ? totalObjectionsFaced / intelRecords.length 
        : 0;

      // By rep objection stats
      const repObjectionMap = new Map<string, { faced: number; resolved: number }>();
      intelRecords.forEach(r => {
        const rep = r.call?.caller_name || 'Unknown';
        const current = repObjectionMap.get(rep) || { faced: 0, resolved: 0 };
        current.faced += r.number_of_objections || 0;
        current.resolved += r.objections_resolved_count || 0;
        repObjectionMap.set(rep, current);
      });

      const repObjectionStats: RepObjectionStats[] = Array.from(repObjectionMap.entries()).map(([rep, stats]) => ({
        rep,
        objectionsFaced: stats.faced,
        resolved: stats.resolved,
        resolutionRate: stats.faced > 0 ? (stats.resolved / stats.faced) * 100 : 0,
      }));

      // Interest breakdown
      const interestBreakdown: InterestBreakdown = {
        yes: intelRecords.filter(r => r.interest_in_selling?.toLowerCase() === 'yes').length,
        maybe: intelRecords.filter(r => r.interest_in_selling?.toLowerCase() === 'maybe').length,
        no: intelRecords.filter(r => r.interest_in_selling?.toLowerCase() === 'no').length,
        notAsked: intelRecords.filter(r => !r.interest_in_selling).length,
      };

      // Timeline breakdown
      const timelineMap = new Map<string, number>();
      intelRecords.forEach(r => {
        if (r.timeline_to_sell) {
          const val = r.timeline_to_sell;
          timelineMap.set(val, (timelineMap.get(val) || 0) + 1);
        }
      });
      const timelineBreakdown = Array.from(timelineMap.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);

      // Buyer type breakdown
      const buyerTypeMap = new Map<string, number>();
      intelRecords.forEach(r => {
        if (r.buyer_type_preference) {
          const val = r.buyer_type_preference;
          buyerTypeMap.set(val, (buyerTypeMap.get(val) || 0) + 1);
        }
      });
      const buyerTypeBreakdown = Array.from(buyerTypeMap.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);

      // Personal insights list
      const personalInsightsList = intelRecords
        .filter(r => r.personal_insights)
        .map(r => ({
          insight: r.personal_insights!,
          score: r.personal_insights_score,
          callId: r.call_id,
        }));

      // Pain points aggregation
      const painPointMap = new Map<string, number>();
      intelRecords.forEach(r => {
        (r.target_pain_points || []).forEach(pp => {
          painPointMap.set(pp, (painPointMap.get(pp) || 0) + 1);
        });
      });
      const painPointsList = Array.from(painPointMap.entries())
        .map(([painPoint, count]) => ({ painPoint, count }))
        .sort((a, b) => b.count - a.count);

      return {
        intelRecords,
        scoreOverview,
        avgQuestionsCovered,
        questionDistribution,
        callsWithZeroQuestions,
        questionsByRep,
        totalObjectionsFaced,
        totalObjectionsResolved,
        overallResolutionRate,
        avgObjectionsPerCall,
        repObjectionStats,
        interestBreakdown,
        timelineBreakdown,
        buyerTypeBreakdown,
        personalInsightsList,
        painPointsList,
        isLoading: false,
        error: null,
      };
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000,
  });
}

function emptyData(): CallInsightsData {
  return {
    intelRecords: [],
    scoreOverview: [],
    avgQuestionsCovered: 0,
    questionDistribution: [],
    callsWithZeroQuestions: 0,
    questionsByRep: [],
    totalObjectionsFaced: 0,
    totalObjectionsResolved: 0,
    overallResolutionRate: 0,
    avgObjectionsPerCall: 0,
    repObjectionStats: [],
    interestBreakdown: { yes: 0, maybe: 0, no: 0, notAsked: 0 },
    timelineBreakdown: [],
    buyerTypeBreakdown: [],
    personalInsightsList: [],
    painPointsList: [],
    isLoading: false,
    error: null,
  };
}

// Fallback: Build insights from call_activities.raw_data when no external_call_intel records exist
async function buildFromCallActivities(engagementIds: string[]): Promise<CallInsightsData> {
  const { data: calls } = await supabase
    .from('call_activities')
    .select('*')
    .in('engagement_id', engagementIds)
    .not('raw_data', 'is', null)
    .order('started_at', { ascending: false })
    .limit(2000);

  if (!calls?.length) return emptyData();

  // Extract data from raw_data JSON
  const intelRecords: ExternalCallIntel[] = calls.map(call => {
    const raw = (call.raw_data || {}) as Record<string, unknown>;
    
    return {
      id: call.id,
      call_id: call.id,
      engagement_id: call.engagement_id,
      
      seller_interest_score: call.seller_interest_score,
      objection_handling_score: call.objection_handling_score,
      valuation_discussion_score: raw.valuation_discussion_score as number | null ?? null,
      rapport_building_score: raw.rapport_building_score as number | null ?? null,
      value_proposition_score: call.value_proposition_score,
      conversation_quality_score: call.quality_of_conversation_score,
      script_adherence_score: call.script_adherence_score,
      overall_quality_score: call.composite_score,
      question_adherence_score: raw.question_adherence_score as number | null ?? null,
      personal_insights_score: raw.personal_insights_score as number | null ?? null,
      next_steps_clarity_score: raw.next_steps_clarity_score as number | null ?? null,
      discovery_score: raw.discovery_score as number | null ?? null,
      
      // Justifications from raw_data
      seller_interest_justification: raw.seller_interest_justification as string | null ?? null,
      objection_handling_justification: raw.objection_handling_justification as string | null ?? null,
      valuation_discussion_justification: raw.valuation_discussion_justification as string | null ?? null,
      rapport_building_justification: raw.rapport_building_justification as string | null ?? null,
      value_proposition_justification: raw.value_proposition_justification as string | null ?? null,
      conversation_quality_justification: raw.conversation_quality_justification as string | null ?? null,
      script_adherence_justification: raw.script_adherence_justification as string | null ?? null,
      overall_quality_justification: raw.overall_quality_justification as string | null ?? null,
      question_adherence_justification: raw.question_adherence_justification as string | null ?? null,
      personal_insights_justification: raw.personal_insights_justification as string | null ?? null,
      next_steps_clarity_justification: raw.next_steps_clarity_justification as string | null ?? null,
      discovery_justification: raw.discovery_justification as string | null ?? null,
      
      questions_covered_count: raw.questions_covered_count as number | null ?? null,
      questions_covered_list: raw.questions_covered_list as string[] | null ?? null,
      number_of_objections: raw.number_of_objections as number | null ?? call.objections_list?.length ?? null,
      objections_resolved_count: raw.objections_resolved_count as number | null ?? null,
      objections_list: call.objections_list,
      objection_details: null,
      
      interest_in_selling: raw.interest_in_selling as string | null ?? null,
      timeline_to_sell: raw.timeline_to_sell as string | null ?? null,
      buyer_type_preference: raw.buyer_type_preference as string | null ?? null,
      personal_insights: raw.personal_insights as string | null ?? call.notes,
      target_pain_points: raw.target_pain_points as string[] | null ?? null,
      next_steps: raw.next_steps as string | null ?? null,
      
      processed_at: null,
      created_at: call.created_at || '',
      
      call: {
        id: call.id,
        to_name: call.to_name,
        to_phone: call.to_phone,
        caller_name: call.caller_name,
        started_at: call.started_at,
        talk_duration: call.talk_duration,
        recording_url: call.recording_url,
        disposition: call.disposition,
      },
    };
  });

  // Reuse the same aggregation logic
  const scoreKeys = [
    { key: 'seller_interest_score', label: 'Seller Interest' },
    { key: 'objection_handling_score', label: 'Objection Handling' },
    { key: 'valuation_discussion_score', label: 'Valuation Discussion' },
    { key: 'rapport_building_score', label: 'Rapport Building' },
    { key: 'value_proposition_score', label: 'Value Proposition' },
    { key: 'conversation_quality_score', label: 'Conversation Quality' },
    { key: 'script_adherence_score', label: 'Script Adherence' },
    { key: 'overall_quality_score', label: 'Overall Quality' },
    { key: 'question_adherence_score', label: 'Question Adherence' },
    { key: 'personal_insights_score', label: 'Personal Insights' },
    { key: 'next_steps_clarity_score', label: 'Next Steps Clarity' },
    { key: 'discovery_score', label: 'Discovery' },
  ];

  const scoreOverview: ScoreOverviewItem[] = scoreKeys.map(({ key, label }) => {
    const values = intelRecords.map(r => r[key as keyof ExternalCallIntel] as number | null);
    const thisWeekAvg = avg(values);
    
    return {
      key,
      label,
      thisWeekAvg,
      lastWeekAvg: null,
      trend: 'flat' as const,
      bestRep: null,
      needsCoachingCount: values.filter(v => v != null && v < 5).length,
    };
  });

  // Question stats
  const questionsData = intelRecords.map(r => r.questions_covered_count || 0);
  const avgQuestionsCovered = questionsData.length > 0 
    ? questionsData.reduce((a, b) => a + b, 0) / questionsData.length 
    : 0;
  const callsWithZeroQuestions = questionsData.filter(q => q === 0).length;

  // Objection stats
  const totalObjectionsFaced = intelRecords.reduce((sum, r) => sum + (r.number_of_objections || 0), 0);
  const totalObjectionsResolved = intelRecords.reduce((sum, r) => sum + (r.objections_resolved_count || 0), 0);
  const overallResolutionRate = totalObjectionsFaced > 0 
    ? (totalObjectionsResolved / totalObjectionsFaced) * 100 
    : 0;

  // Interest breakdown
  const interestBreakdown: InterestBreakdown = {
    yes: intelRecords.filter(r => r.interest_in_selling?.toLowerCase() === 'yes').length,
    maybe: intelRecords.filter(r => r.interest_in_selling?.toLowerCase() === 'maybe').length,
    no: intelRecords.filter(r => r.interest_in_selling?.toLowerCase() === 'no').length,
    notAsked: intelRecords.filter(r => !r.interest_in_selling).length,
  };

  // Personal insights
  const personalInsightsList = intelRecords
    .filter(r => r.personal_insights)
    .map(r => ({
      insight: r.personal_insights!,
      score: r.personal_insights_score,
      callId: r.call_id,
    }));

  // Pain points
  const painPointMap = new Map<string, number>();
  intelRecords.forEach(r => {
    (r.target_pain_points || []).forEach(pp => {
      painPointMap.set(pp, (painPointMap.get(pp) || 0) + 1);
    });
  });
  const painPointsList = Array.from(painPointMap.entries())
    .map(([painPoint, count]) => ({ painPoint, count }))
    .sort((a, b) => b.count - a.count);

  return {
    intelRecords,
    scoreOverview,
    avgQuestionsCovered,
    questionDistribution: [],
    callsWithZeroQuestions,
    questionsByRep: [],
    totalObjectionsFaced,
    totalObjectionsResolved,
    overallResolutionRate,
    avgObjectionsPerCall: intelRecords.length > 0 ? totalObjectionsFaced / intelRecords.length : 0,
    repObjectionStats: [],
    interestBreakdown,
    timelineBreakdown: [],
    buyerTypeBreakdown: [],
    personalInsightsList,
    painPointsList,
    isLoading: false,
    error: null,
  };
}
