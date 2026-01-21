import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Rep {
  id: string;
  engagement_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  external_id: string | null;
  platform: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RepWithMetrics extends Rep {
  totalCalls: number;
  connections: number;
  meetings: number;
  connectRate: number;
  meetingRate: number;
  avgCallDuration: number;
}

/**
 * Hook to fetch reps for an engagement
 */
export function useReps(engagementId?: string) {
  return useQuery({
    queryKey: ['reps', engagementId],
    queryFn: async (): Promise<Rep[]> => {
      if (!engagementId) return [];

      const { data, error } = await supabase
        .from('reps')
        .select('*')
        .eq('engagement_id', engagementId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []) as Rep[];
    },
    enabled: !!engagementId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch reps with their performance metrics
 */
export function useRepsWithMetrics(engagementId?: string, dateRange?: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ['reps-with-metrics', engagementId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<RepWithMetrics[]> => {
      if (!engagementId) return [];

      // Fetch reps
      const { data: reps, error: repsError } = await supabase
        .from('reps')
        .select('*')
        .eq('engagement_id', engagementId)
        .eq('is_active', true);

      if (repsError) throw repsError;
      if (!reps?.length) return [];

      // Fetch call activities for these reps
      let callsQuery = supabase
        .from('call_activities')
        .select('rep_id, disposition, talk_duration, conversation_outcome, callback_scheduled')
        .eq('engagement_id', engagementId)
        .not('rep_id', 'is', null);

      if (dateRange?.start) {
        callsQuery = callsQuery.gte('started_at', dateRange.start.toISOString());
      }
      if (dateRange?.end) {
        callsQuery = callsQuery.lte('started_at', dateRange.end.toISOString());
      }

      const { data: calls, error: callsError } = await callsQuery;
      if (callsError) throw callsError;

      // Aggregate metrics per rep
      const repMetrics = new Map<string, {
        totalCalls: number;
        connections: number;
        meetings: number;
        totalTalkTime: number;
      }>();

      (calls || []).forEach(call => {
        if (!call.rep_id) return;
        
        if (!repMetrics.has(call.rep_id)) {
          repMetrics.set(call.rep_id, { totalCalls: 0, connections: 0, meetings: 0, totalTalkTime: 0 });
        }
        
        const metrics = repMetrics.get(call.rep_id)!;
        metrics.totalCalls++;
        
        // Check connection
        const isConnection = 
          call.disposition?.toLowerCase().includes('connect') ||
          call.disposition?.toLowerCase().includes('conversation') ||
          (call.talk_duration && call.talk_duration > 30);
        if (isConnection) {
          metrics.connections++;
          metrics.totalTalkTime += call.talk_duration || 0;
        }
        
        // Check meeting
        if (call.conversation_outcome === 'meeting_booked' || call.callback_scheduled) {
          metrics.meetings++;
        }
      });

      // Combine reps with metrics
      return (reps as Rep[]).map(rep => {
        const metrics = repMetrics.get(rep.id) || { totalCalls: 0, connections: 0, meetings: 0, totalTalkTime: 0 };
        return {
          ...rep,
          totalCalls: metrics.totalCalls,
          connections: metrics.connections,
          meetings: metrics.meetings,
          connectRate: metrics.totalCalls > 0 ? (metrics.connections / metrics.totalCalls) * 100 : 0,
          meetingRate: metrics.totalCalls > 0 ? (metrics.meetings / metrics.totalCalls) * 100 : 0,
          avgCallDuration: metrics.connections > 0 ? metrics.totalTalkTime / metrics.connections : 0,
        };
      }).sort((a, b) => b.connectRate - a.connectRate);
    },
    enabled: !!engagementId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to create or update a rep
 */
export function useUpsertRep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rep: Partial<Rep> & { engagement_id: string; name: string }) => {
      const { data, error } = await supabase
        .from('reps')
        .upsert(rep, { onConflict: 'engagement_id,email' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reps', data.engagement_id] });
      toast.success('Rep saved successfully');
    },
    onError: (error) => {
      toast.error('Failed to save rep: ' + error.message);
    },
  });
}

/**
 * Hook to backfill reps from existing call activities
 */
export function useBackfillReps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('backfill_reps_from_calls');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reps'] });
      toast.success('Reps backfilled from call history');
    },
    onError: (error) => {
      toast.error('Failed to backfill reps: ' + error.message);
    },
  });
}
