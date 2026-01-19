import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';

// Stub implementation - these tables don't exist in new schema
// TODO: Migrate call scoring to call_activities table

export interface CallInformationData {
  totalCallsScored: number;
  callCategories: { voicemail: number; gatekeeper: number; connection: number; total: number };
  interestDistribution: { yes: number; no: number; maybe: number; unknown: number; total: number };
  timelineDistribution: { immediate: number; shortTerm: number; mediumTerm: number; longTerm: number; unknown: number };
  averageScores: Record<string, number>;
  mandatoryQuestions: any[];
  topObjections: any[];
  callRecords: any[];
  businessIntelligence: { totalPipelineRevenue: number; totalPipelineEbitda: number; interestedSellersCount: number; topExitReasons: any[]; topPainPoints: any[] };
  pendingFollowups: any[];
}

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
        // Get engagements for this client
        const { data: engagements } = await supabase
          .from('engagements')
          .select('id')
          .eq('client_id', currentWorkspace.id);

        if (!engagements || engagements.length === 0) {
          setData(null);
          setIsLoading(false);
          return;
        }

        const engagementIds = engagements.map(e => e.id);

        // Fetch call activities
        const { data: calls, error: callsError } = await supabase
          .from('call_activities')
          .select('*')
          .in('engagement_id', engagementIds);

        if (callsError) throw callsError;

        const totalCalls = calls?.length || 0;
        const connections = calls?.filter(c => c.disposition === 'connected' || c.disposition === 'conversation').length || 0;
        const voicemails = calls?.filter(c => c.voicemail_left).length || 0;

        setData({
          totalCallsScored: totalCalls,
          callCategories: {
            voicemail: voicemails,
            gatekeeper: Math.max(0, totalCalls - connections - voicemails),
            connection: connections,
            total: totalCalls,
          },
          interestDistribution: { yes: 0, no: 0, maybe: 0, unknown: totalCalls, total: totalCalls },
          timelineDistribution: { immediate: 0, shortTerm: 0, mediumTerm: 0, longTerm: 0, unknown: totalCalls },
          averageScores: {},
          mandatoryQuestions: [],
          topObjections: [],
          callRecords: (calls || []).map(c => ({
            id: c.id,
            callId: c.external_id || c.id,
            contactName: c.to_name || 'Unknown',
            companyName: '',
            callCategory: c.disposition || 'Unknown',
            interestLevel: 'Unknown',
            sellerInterestScore: 0,
            overallQualityScore: 0,
            timeline: 'Unknown',
            objections: [],
            summary: c.notes || '',
            followupTask: c.callback_scheduled ? 'Callback' : null,
            followupDueDate: c.callback_datetime,
            isFollowupCompleted: false,
            createdAt: c.started_at || c.created_at,
          })),
          businessIntelligence: { totalPipelineRevenue: 0, totalPipelineEbitda: 0, interestedSellersCount: 0, topExitReasons: [], topPainPoints: [] },
          pendingFollowups: (calls || []).filter(c => c.callback_scheduled && c.callback_datetime).map(c => ({
            id: c.id,
            callId: c.id,
            contactName: c.to_name || 'Unknown',
            companyName: '',
            taskName: 'Callback',
            dueDate: c.callback_datetime || '',
          })),
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
    return { error: null };
  };

  return { data, isLoading, error, markFollowupComplete };
}
