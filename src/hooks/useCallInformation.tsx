import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';

interface ScoreDistribution {
  label: string;
  count: number;
  percentage: number;
}

interface CallCategoryDistribution {
  voicemail: number;
  gatekeeper: number;
  connection: number;
  total: number;
}

interface InterestDistribution {
  yes: number;
  no: number;
  maybe: number;
  unknown: number;
  total: number;
}

interface TimelineDistribution {
  immediate: number;
  shortTerm: number;
  mediumTerm: number;
  longTerm: number;
  unknown: number;
}

interface AverageScores {
  sellerInterest: number;
  objectionHandling: number;
  rapportBuilding: number;
  valueProposition: number;
  engagement: number;
  scriptAdherence: number;
  nextStepClarity: number;
  valuationDiscussion: number;
  overallQuality: number;
  decisionMakerIdentification: number;
}

interface MandatoryQuestionStats {
  questionId: string;
  questionText: string;
  timesAsked: number;
  totalCalls: number;
  percentage: number;
}

interface ObjectionStats {
  objection: string;
  count: number;
}

interface CallRecord {
  id: string;
  callId: string;
  contactName: string;
  companyName: string;
  callCategory: string;
  interestLevel: string;
  sellerInterestScore: number;
  overallQualityScore: number;
  timeline: string;
  objections: string[];
  summary: string;
  followupTask: string | null;
  followupDueDate: string | null;
  isFollowupCompleted: boolean;
  createdAt: string;
}

interface BusinessIntelligence {
  totalPipelineRevenue: number;
  totalPipelineEbitda: number;
  interestedSellersCount: number;
  topExitReasons: { reason: string; count: number }[];
  topPainPoints: { point: string; count: number }[];
}

interface PendingFollowup {
  id: string;
  callId: string;
  contactName: string;
  companyName: string;
  taskName: string;
  dueDate: string;
}

export interface CallInformationData {
  totalCallsScored: number;
  callCategories: CallCategoryDistribution;
  interestDistribution: InterestDistribution;
  timelineDistribution: TimelineDistribution;
  averageScores: AverageScores;
  mandatoryQuestions: MandatoryQuestionStats[];
  topObjections: ObjectionStats[];
  callRecords: CallRecord[];
  businessIntelligence: BusinessIntelligence;
  pendingFollowups: PendingFollowup[];
}

const defaultMandatoryQuestions = [
  { id: 'q1', text: 'What is the revenue of the company?' },
  { id: 'q2', text: 'What is the EBITDA?' },
  { id: 'q3', text: 'How long have you owned the business?' },
  { id: 'q4', text: 'What is your timeline to sell?' },
  { id: 'q5', text: 'What are your valuation expectations?' },
  { id: 'q6', text: 'Why are you looking to sell?' },
  { id: 'q7', text: 'Have you had any M&A discussions?' },
  { id: 'q8', text: 'What does your ownership structure look like?' },
  { id: 'q9', text: 'What is your role in the business?' },
  { id: 'q10', text: 'What are the key growth opportunities?' },
  { id: 'q11', text: 'What are the main challenges?' },
  { id: 'q12', text: 'Who are your main competitors?' },
  { id: 'q13', text: 'What is your customer concentration?' },
  { id: 'q14', text: 'What is the management team structure?' },
  { id: 'q15', text: 'Are there any real estate assets?' },
  { id: 'q16', text: 'What is the employee count?' },
  { id: 'q17', text: 'What type of buyer are you looking for?' },
];

export function useCallInformation() {
  const { currentWorkspace } = useWorkspace();
  const [data, setData] = useState<CallInformationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace?.id) return;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch call AI scores
        const { data: aiScores, error: scoresError } = await supabase
          .from('call_ai_scores')
          .select('*')
          .eq('workspace_id', currentWorkspace.id);

        if (scoresError) throw scoresError;

        // Fetch calling deals
        const { data: deals, error: dealsError } = await supabase
          .from('calling_deals')
          .select('*')
          .eq('workspace_id', currentWorkspace.id);

        if (dealsError) throw dealsError;

        // Fetch call summaries
        const { data: summaries, error: summariesError } = await supabase
          .from('call_summaries')
          .select('*')
          .eq('workspace_id', currentWorkspace.id);

        if (summariesError) throw summariesError;

        // Fetch phoneburner calls for contact info
        const { data: calls, error: callsError } = await supabase
          .from('phoneburner_calls')
          .select('id, phone_number, created_at, contact_id')
          .eq('workspace_id', currentWorkspace.id);

        if (callsError) throw callsError;

        // Fetch leads for contact names
        const { data: leads } = await supabase
          .from('leads')
          .select('id, first_name, last_name, company')
          .eq('workspace_id', currentWorkspace.id);

        const leadsMap = new Map(leads?.map((l) => [l.id, l]));

        // Process data
        const totalCallsScored = aiScores?.length || 0;

        // Call category distribution
        const callCategories: CallCategoryDistribution = {
          voicemail: 0,
          gatekeeper: 0,
          connection: 0,
          total: totalCallsScored,
        };
        aiScores?.forEach((score) => {
          const category = (score.call_category || '').toLowerCase();
          if (category.includes('voicemail')) callCategories.voicemail++;
          else if (category.includes('gatekeeper')) callCategories.gatekeeper++;
          else if (category.includes('connection')) callCategories.connection++;
        });

        // Interest distribution from deals
        const interestDistribution: InterestDistribution = {
          yes: 0,
          no: 0,
          maybe: 0,
          unknown: 0,
          total: deals?.length || 0,
        };
        deals?.forEach((deal) => {
          const interest = (deal.interest_level || '').toLowerCase();
          if (interest === 'yes') interestDistribution.yes++;
          else if (interest === 'no') interestDistribution.no++;
          else if (interest === 'maybe') interestDistribution.maybe++;
          else interestDistribution.unknown++;
        });

        // Timeline distribution
        const timelineDistribution: TimelineDistribution = {
          immediate: 0,
          shortTerm: 0,
          mediumTerm: 0,
          longTerm: 0,
          unknown: 0,
        };
        aiScores?.forEach((score) => {
          const timeline = (score.timeline_to_sell || '').toLowerCase();
          if (timeline.includes('immediate') || timeline.includes('now')) {
            timelineDistribution.immediate++;
          } else if (timeline.includes('6 month') || timeline.includes('short')) {
            timelineDistribution.shortTerm++;
          } else if (timeline.includes('1 year') || timeline.includes('12 month')) {
            timelineDistribution.mediumTerm++;
          } else if (timeline.includes('2 year') || timeline.includes('long')) {
            timelineDistribution.longTerm++;
          } else {
            timelineDistribution.unknown++;
          }
        });

        // Calculate average scores
        const calculateAvg = (arr: (number | null | undefined)[]) => {
          const valid = arr.filter((n): n is number => n !== null && n !== undefined);
          return valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 0;
        };

        const averageScores: AverageScores = {
          sellerInterest: calculateAvg(aiScores?.map((s) => s.seller_interest_score)),
          objectionHandling: calculateAvg(aiScores?.map((s) => s.objection_handling_score)),
          rapportBuilding: calculateAvg(aiScores?.map((s) => s.rapport_building_score)),
          valueProposition: calculateAvg(aiScores?.map((s) => s.value_proposition_score)),
          engagement: calculateAvg(aiScores?.map((s) => s.engagement_score)),
          scriptAdherence: calculateAvg(aiScores?.map((s) => s.script_adherence_score)),
          nextStepClarity: calculateAvg(aiScores?.map((s) => s.next_step_clarity_score)),
          valuationDiscussion: calculateAvg(aiScores?.map((s) => s.valuation_discussion_score)),
          overallQuality: calculateAvg(aiScores?.map((s) => s.overall_quality_score)),
          decisionMakerIdentification: calculateAvg(aiScores?.map((s) => s.decision_maker_identification)),
        };

        // Mandatory questions stats
        const questionCounts: Record<string, number> = {};
        aiScores?.forEach((score) => {
          const questions = score.mandatory_questions_asked as string[] || [];
          questions.forEach((q) => {
            questionCounts[q] = (questionCounts[q] || 0) + 1;
          });
        });

        const mandatoryQuestions: MandatoryQuestionStats[] = defaultMandatoryQuestions.map((q) => ({
          questionId: q.id,
          questionText: q.text,
          timesAsked: questionCounts[q.id] || 0,
          totalCalls: totalCallsScored,
          percentage: totalCallsScored > 0 ? Math.round((questionCounts[q.id] || 0) / totalCallsScored * 100) : 0,
        }));

        // Top objections
        const objectionCounts: Record<string, number> = {};
        aiScores?.forEach((score) => {
          const objections = score.objections_text?.split(',') || [];
          objections.forEach((obj) => {
            const cleaned = obj.trim().toLowerCase();
            if (cleaned) {
              objectionCounts[cleaned] = (objectionCounts[cleaned] || 0) + 1;
            }
          });
        });

        const topObjections: ObjectionStats[] = Object.entries(objectionCounts)
          .map(([objection, count]) => ({ objection, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        // Build call records
        const callsMap = new Map(calls?.map((c) => [c.id, c]));
        const summariesMap = new Map(summaries?.map((s) => [s.call_id, s]));

        const callRecords: CallRecord[] = (aiScores || []).map((score) => {
          const call = callsMap.get(score.call_id);
          const summary = summariesMap.get(score.call_id);
          const lead = call?.contact_id ? leadsMap.get(call.contact_id) : null;
          const contactName = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : 'Unknown';
          
          return {
            id: score.id,
            callId: score.call_id,
            contactName: contactName || 'Unknown',
            companyName: lead?.company || '',
            callCategory: score.call_category || 'Unknown',
            interestLevel: '',
            sellerInterestScore: score.seller_interest_score || 0,
            overallQualityScore: score.overall_quality_score || score.composite_score || 0,
            timeline: score.timeline_to_sell || 'Unknown',
            objections: score.objections_text?.split(',').map((o) => o.trim()) || [],
            summary: summary?.summary || '',
            followupTask: summary?.followup_task_name || null,
            followupDueDate: summary?.followup_due_date || null,
            isFollowupCompleted: summary?.is_followup_completed || false,
            createdAt: score.created_at,
          };
        });

        // Business intelligence
        const interestedDeals = deals?.filter((d) => d.interest_level?.toLowerCase() === 'yes') || [];
        const totalPipelineRevenue = interestedDeals.reduce((sum, d) => sum + (d.annual_revenue_raw || d.revenue || 0), 0);
        const totalPipelineEbitda = interestedDeals.reduce((sum, d) => sum + (d.ebitda_raw || 0), 0);

        const exitReasonCounts: Record<string, number> = {};
        deals?.forEach((d) => {
          if (d.exit_reason) {
            exitReasonCounts[d.exit_reason] = (exitReasonCounts[d.exit_reason] || 0) + 1;
          }
        });

        const painPointCounts: Record<string, number> = {};
        deals?.forEach((d) => {
          if (d.target_pain_points) {
            painPointCounts[d.target_pain_points] = (painPointCounts[d.target_pain_points] || 0) + 1;
          }
        });

        const businessIntelligence: BusinessIntelligence = {
          totalPipelineRevenue,
          totalPipelineEbitda,
          interestedSellersCount: interestedDeals.length,
          topExitReasons: Object.entries(exitReasonCounts)
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
          topPainPoints: Object.entries(painPointCounts)
            .map(([point, count]) => ({ point, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
        };

        // Pending followups
        const pendingFollowups: PendingFollowup[] = (summaries || [])
          .filter((s) => !s.is_followup_completed && s.followup_due_date)
          .map((s) => {
            const call = callsMap.get(s.call_id);
            const lead = call?.contact_id ? leadsMap.get(call.contact_id) : null;
            const contactName = lead ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : 'Unknown';
            return {
              id: s.id,
              callId: s.call_id,
              contactName: contactName || 'Unknown',
              companyName: lead?.company || '',
              taskName: s.followup_task_name || '',
              dueDate: s.followup_due_date || '',
            };
          })
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        setData({
          totalCallsScored,
          callCategories,
          interestDistribution,
          timelineDistribution,
          averageScores,
          mandatoryQuestions,
          topObjections,
          callRecords,
          businessIntelligence,
          pendingFollowups,
        });
      } catch (err) {
        console.error('Error fetching call information:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [currentWorkspace?.id]);

  const markFollowupComplete = async (summaryId: string) => {
    const { error } = await supabase
      .from('call_summaries')
      .update({ is_followup_completed: true })
      .eq('id', summaryId);

    if (!error && data) {
      setData({
        ...data,
        pendingFollowups: data.pendingFollowups.filter((f) => f.id !== summaryId),
      });
    }

    return { error };
  };

  return { data, isLoading, error, markFollowupComplete };
}
