import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

export interface CallWithScores {
  id: string;
  call_title: string | null;
  date_time: string | null;
  recording_url: string | null;
  transcript_text: string | null;
  contact_name: string | null;
  company_name: string | null;
  caller_name: string | null;
  disposition: string | null;
  talk_duration: number | null;
  notes: string | null;
  conversation_outcome: string | null;
}

export interface CallingMetrics {
  totalCalls: number;
  totalConnected: number;
  totalVoicemails: number;
  totalTalkTimeSeconds: number;
  connectRate: number;
  avgDuration: number;
  avgAIScore: number | null;
  transcribedCalls: number;
  scoredCalls: number;
  callsWithRecording: number;
}

export function useCallingMetrics(dateRange?: { start: Date; end: Date }) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['calling-metrics', currentWorkspace?.id, dateRange],
    queryFn: async (): Promise<CallingMetrics> => {
      if (!currentWorkspace?.id) {
        return {
          totalCalls: 0,
          totalConnected: 0,
          totalVoicemails: 0,
          totalTalkTimeSeconds: 0,
          connectRate: 0,
          avgDuration: 0,
          avgAIScore: null,
          transcribedCalls: 0,
          scoredCalls: 0,
          callsWithRecording: 0,
        };
      }

      // First get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = engagements?.map(e => e.id) || [];
      if (engagementIds.length === 0) {
        return {
          totalCalls: 0,
          totalConnected: 0,
          totalVoicemails: 0,
          totalTalkTimeSeconds: 0,
          connectRate: 0,
          avgDuration: 0,
          avgAIScore: null,
          transcribedCalls: 0,
          scoredCalls: 0,
          callsWithRecording: 0,
        };
      }

      // Fetch calls from call_activities
      let query = supabase
        .from('call_activities')
        .select('id, recording_url, transcription, talk_duration, disposition, voicemail_left')
        .in('engagement_id', engagementIds);

      if (dateRange) {
        query = query
          .gte('started_at', dateRange.start.toISOString())
          .lte('started_at', dateRange.end.toISOString());
      }

      const { data: calls, error: callsError } = await query;
      if (callsError) throw callsError;

      const totalCalls = calls?.length || 0;
      const totalConnected = calls?.filter(c => c.talk_duration && c.talk_duration > 30).length || 0;
      const callsWithRecording = calls?.filter(c => c.recording_url).length || 0;
      const transcribedCalls = calls?.filter(c => c.transcription).length || 0;
      const totalVoicemails = calls?.filter(c => c.voicemail_left).length || 0;
      const totalTalkTimeSeconds = calls?.reduce((sum, c) => sum + (c.talk_duration || 0), 0) || 0;

      return {
        totalCalls,
        totalConnected,
        totalVoicemails,
        totalTalkTimeSeconds,
        connectRate: totalCalls > 0 ? (totalConnected / totalCalls) * 100 : 0,
        avgDuration: totalCalls > 0 ? totalTalkTimeSeconds / totalCalls : 0,
        avgAIScore: null, // AI scores stored separately if needed
        transcribedCalls,
        scoredCalls: 0,
        callsWithRecording,
      };
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useCallsWithScores(options?: {
  limit?: number;
  offset?: number;
  minScore?: number;
  maxScore?: number;
  hasTranscript?: boolean;
  search?: string;
}) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['calls-with-scores', currentWorkspace?.id, options],
    queryFn: async (): Promise<CallWithScores[]> => {
      if (!currentWorkspace?.id) return [];

      // First get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = engagements?.map(e => e.id) || [];
      if (engagementIds.length === 0) return [];

      let query = supabase
        .from('call_activities')
        .select('id, to_name, to_phone, caller_name, recording_url, transcription, talk_duration, disposition, notes, conversation_outcome, started_at')
        .in('engagement_id', engagementIds)
        .order('started_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      if (options?.hasTranscript) {
        query = query.not('transcription', 'is', null);
      }

      const { data: calls, error } = await query;
      if (error) throw error;

      let results: CallWithScores[] = (calls || []).map(c => ({
        id: c.id,
        call_title: c.to_name || c.to_phone,
        date_time: c.started_at,
        recording_url: c.recording_url,
        transcript_text: c.transcription,
        contact_name: c.to_name,
        company_name: null,
        caller_name: c.caller_name,
        disposition: c.disposition,
        talk_duration: c.talk_duration,
        notes: c.notes,
        conversation_outcome: c.conversation_outcome,
      }));

      // Search in transcript text
      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        results = results.filter(r => 
          r.transcript_text?.toLowerCase().includes(searchLower) ||
          r.call_title?.toLowerCase().includes(searchLower) ||
          r.contact_name?.toLowerCase().includes(searchLower)
        );
      }

      return results;
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useTopAndBottomCalls(limit: number = 5) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['top-bottom-calls', currentWorkspace?.id, limit],
    queryFn: async () => {
      if (!currentWorkspace?.id) return { topCalls: [], bottomCalls: [] };

      // First get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = engagements?.map(e => e.id) || [];
      if (engagementIds.length === 0) return { topCalls: [], bottomCalls: [] };

      // Fetch calls with transcriptions (proxy for quality)
      const { data: calls, error } = await supabase
        .from('call_activities')
        .select('id, to_name, to_phone, caller_name, talk_duration, disposition, notes, started_at, transcription')
        .in('engagement_id', engagementIds)
        .not('transcription', 'is', null)
        .order('talk_duration', { ascending: false });

      if (error) throw error;

      const topCalls = (calls?.slice(0, limit) || []).map(c => ({
        id: c.id,
        call_id: c.id,
        composite_score: null,
        seller_interest_score: null,
        next_step_clarity_score: null,
        opening_type: null,
        personal_insights: c.notes,
        call: {
          id: c.id,
          phone_number: c.to_name || c.to_phone,
          start_at: c.started_at,
          duration_seconds: c.talk_duration,
        }
      }));

      const bottomCalls = (calls?.slice(-limit).reverse() || []).map(c => ({
        id: c.id,
        call_id: c.id,
        composite_score: null,
        seller_interest_score: null,
        next_step_clarity_score: null,
        opening_type: null,
        personal_insights: c.notes,
        call: {
          id: c.id,
          phone_number: c.to_name || c.to_phone,
          start_at: c.started_at,
          duration_seconds: c.talk_duration,
        }
      }));

      return { topCalls, bottomCalls };
    },
    enabled: !!currentWorkspace?.id,
  });
}

export function useProcessCalls() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options?: { mode?: 'pending' | 'transcribe' | 'score'; limit?: number }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase.functions.invoke('process-calls-batch', {
        body: {
          client_id: currentWorkspace.id,
          mode: options?.mode || 'pending',
          limit: options?.limit || 10,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calling-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['calls-with-scores'] });
      queryClient.invalidateQueries({ queryKey: ['top-bottom-calls'] });
      
      toast.success(`Processed ${data?.processed || 0} calls`);
    },
    onError: (error) => {
      toast.error(`Processing failed: ${error.message}`);
    },
  });
}

export function useTranscribeCall() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callId: string) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase.functions.invoke('transcribe-call', {
        body: {
          call_id: callId,
          client_id: currentWorkspace.id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls-with-scores'] });
      toast.success('Transcription started');
    },
    onError: (error) => {
      toast.error(`Transcription failed: ${error.message}`);
    },
  });
}

export function useScoreCall() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callId: string) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { data, error } = await supabase.functions.invoke('score-call', {
        body: {
          call_id: callId,
          client_id: currentWorkspace.id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calls-with-scores'] });
      queryClient.invalidateQueries({ queryKey: ['calling-metrics'] });
      toast.success('Call scored successfully');
    },
    onError: (error) => {
      toast.error(`Scoring failed: ${error.message}`);
    },
  });
}

// ================== AGGREGATE METRICS ==================

export interface RepPerformance {
  memberId: string;
  memberName: string;
  totalCalls: number;
  callsConnected: number;
  connectRate: number;
  voicemailsLeft: number;
  totalTalkTimeSeconds: number;
  totalSessions: number;
}

export interface AggregateMetrics {
  totalCalls: number;
  totalConnected: number;
  totalVoicemails: number;
  totalTalkTimeSeconds: number;
  connectRate: number;
  repPerformance: RepPerformance[];
}

export function useAggregateCallingMetrics() {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['aggregate-calling-metrics', currentWorkspace?.id],
    queryFn: async (): Promise<AggregateMetrics> => {
      if (!currentWorkspace?.id) {
        return {
          totalCalls: 0,
          totalConnected: 0,
          totalVoicemails: 0,
          totalTalkTimeSeconds: 0,
          connectRate: 0,
          repPerformance: [],
        };
      }

      // First get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = engagements?.map(e => e.id) || [];
      if (engagementIds.length === 0) {
        return {
          totalCalls: 0,
          totalConnected: 0,
          totalVoicemails: 0,
          totalTalkTimeSeconds: 0,
          connectRate: 0,
          repPerformance: [],
        };
      }

      // Fetch from call_activities
      const { data: calls, error } = await supabase
        .from('call_activities')
        .select('caller_name, caller_user_id, transcription, talk_duration, disposition, voicemail_left')
        .in('engagement_id', engagementIds);

      if (error) throw error;

      // Aggregate by rep
      const repMap = new Map<string, RepPerformance>();

      for (const call of calls || []) {
        const repKey = call.caller_user_id || call.caller_name || 'unknown';
        const displayName = call.caller_name || 'Unknown';
        
        const existing = repMap.get(repKey);
        const isConnected = (call.talk_duration || 0) > 30;
        const duration = call.talk_duration || 0;
        const isVoicemail = call.voicemail_left || false;
        
        if (existing) {
          existing.totalCalls += 1;
          existing.callsConnected += isConnected ? 1 : 0;
          existing.totalTalkTimeSeconds += duration;
          existing.voicemailsLeft += isVoicemail ? 1 : 0;
        } else {
          repMap.set(repKey, {
            memberId: repKey,
            memberName: displayName,
            totalCalls: 1,
            callsConnected: isConnected ? 1 : 0,
            connectRate: 0,
            voicemailsLeft: isVoicemail ? 1 : 0,
            totalTalkTimeSeconds: duration,
            totalSessions: 1,
          });
        }
      }

      // Calculate connect rates
      const repPerformance = Array.from(repMap.values()).map(rep => ({
        ...rep,
        connectRate: rep.totalCalls > 0 ? (rep.callsConnected / rep.totalCalls) * 100 : 0,
      })).sort((a, b) => b.connectRate - a.connectRate);

      const totalCalls = repPerformance.reduce((sum, r) => sum + r.totalCalls, 0);
      const totalConnected = repPerformance.reduce((sum, r) => sum + r.callsConnected, 0);
      const totalVoicemails = repPerformance.reduce((sum, r) => sum + r.voicemailsLeft, 0);
      const totalTalkTimeSeconds = repPerformance.reduce((sum, r) => sum + r.totalTalkTimeSeconds, 0);

      return {
        totalCalls,
        totalConnected,
        totalVoicemails,
        totalTalkTimeSeconds,
        connectRate: totalCalls > 0 ? (totalConnected / totalCalls) * 100 : 0,
        repPerformance,
      };
    },
    enabled: !!currentWorkspace?.id,
  });
}
