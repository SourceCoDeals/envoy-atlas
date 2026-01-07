import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

export interface CallWithScores {
  id: string;
  external_call_id: string;
  start_at: string | null;
  end_at: string | null;
  duration_seconds: number | null;
  disposition: string | null;
  is_connected: boolean | null;
  is_voicemail: boolean | null;
  recording_url: string | null;
  notes: string | null;
  phone_number: string | null;
  dial_session_id: string | null;
  workspace_id: string;
  transcript?: {
    id: string;
    transcript_text: string | null;
    transcription_status: string;
    word_count: number | null;
    speaker_segments: unknown;
  } | null;
  score?: {
    id: string;
    composite_score: number | null;
    seller_interest_score: number | null;
    objection_handling_score: number | null;
    rapport_building_score: number | null;
    next_step_clarity_score: number | null;
    opening_type: string | null;
    trigger_events: unknown;
    objections_list: unknown;
    personal_insights: string | null;
    timeline_to_sell: string | null;
  } | null;
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

      // Fetch calls
      let query = supabase
        .from('phoneburner_calls')
        .select('id, duration_seconds, is_connected, is_voicemail, recording_url')
        .eq('workspace_id', currentWorkspace.id);

      if (dateRange) {
        query = query
          .gte('start_at', dateRange.start.toISOString())
          .lte('start_at', dateRange.end.toISOString());
      }

      const { data: calls, error: callsError } = await query;
      if (callsError) throw callsError;

      // Fetch transcripts count
      const { count: transcribedCount } = await supabase
        .from('call_transcripts')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .eq('transcription_status', 'completed');

      // Fetch scores with avg composite
      const { data: scores } = await supabase
        .from('call_ai_scores')
        .select('composite_score')
        .eq('workspace_id', currentWorkspace.id)
        .not('composite_score', 'is', null);

      const totalCalls = calls?.length || 0;
      const totalConnected = calls?.filter(c => c.is_connected).length || 0;
      const totalVoicemails = calls?.filter(c => c.is_voicemail).length || 0;
      const totalTalkTimeSeconds = calls?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0;
      const callsWithRecording = calls?.filter(c => c.recording_url).length || 0;

      const avgAIScore = scores && scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + (s.composite_score || 0), 0) / scores.length)
        : null;

      return {
        totalCalls,
        totalConnected,
        totalVoicemails,
        totalTalkTimeSeconds,
        connectRate: totalCalls > 0 ? (totalConnected / totalCalls) * 100 : 0,
        avgDuration: totalConnected > 0 ? totalTalkTimeSeconds / totalConnected : 0,
        avgAIScore,
        transcribedCalls: transcribedCount || 0,
        scoredCalls: scores?.length || 0,
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
  disposition?: string;
  hasTranscript?: boolean;
  search?: string;
}) {
  const { currentWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ['calls-with-scores', currentWorkspace?.id, options],
    queryFn: async (): Promise<CallWithScores[]> => {
      if (!currentWorkspace?.id) return [];

      // Fetch calls
      let query = supabase
        .from('phoneburner_calls')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('start_at', { ascending: false });

      if (options?.disposition) {
        query = query.eq('disposition', options.disposition);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data: calls, error: callsError } = await query;
      if (callsError) throw callsError;

      if (!calls || calls.length === 0) return [];

      const callIds = calls.map(c => c.id);

      // Fetch transcripts
      const { data: transcripts } = await supabase
        .from('call_transcripts')
        .select('id, call_id, transcript_text, transcription_status, word_count, speaker_segments')
        .in('call_id', callIds);

      // Fetch scores
      const { data: scores } = await supabase
        .from('call_ai_scores')
        .select('id, call_id, composite_score, seller_interest_score, objection_handling_score, rapport_building_score, next_step_clarity_score, opening_type, trigger_events, objections_list, personal_insights, timeline_to_sell')
        .in('call_id', callIds);

      // Map transcripts and scores to calls
      const transcriptMap = new Map(transcripts?.map(t => [t.call_id, t]) || []);
      const scoreMap = new Map(scores?.map(s => [s.call_id, s]) || []);

      let results: CallWithScores[] = calls.map(call => ({
        ...call,
        transcript: transcriptMap.get(call.id) || null,
        score: scoreMap.get(call.id) || null,
      }));

      // Filter by score range
      if (options?.minScore !== undefined) {
        results = results.filter(r => r.score?.composite_score && r.score.composite_score >= options.minScore!);
      }
      if (options?.maxScore !== undefined) {
        results = results.filter(r => r.score?.composite_score && r.score.composite_score <= options.maxScore!);
      }

      // Filter by transcript
      if (options?.hasTranscript) {
        results = results.filter(r => r.transcript?.transcription_status === 'completed');
      }

      // Search in transcript text
      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        results = results.filter(r => 
          r.transcript?.transcript_text?.toLowerCase().includes(searchLower) ||
          r.notes?.toLowerCase().includes(searchLower)
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

      // Fetch all scores with call info
      const { data: scores, error } = await supabase
        .from('call_ai_scores')
        .select(`
          id,
          call_id,
          composite_score,
          seller_interest_score,
          next_step_clarity_score,
          opening_type,
          personal_insights
        `)
        .eq('workspace_id', currentWorkspace.id)
        .not('composite_score', 'is', null)
        .order('composite_score', { ascending: false });

      if (error) throw error;

      const topScores = scores?.slice(0, limit) || [];
      const bottomScores = scores?.slice(-limit).reverse() || [];

      // Fetch call details for these
      const allCallIds = [...topScores, ...bottomScores].map(s => s.call_id);
      
      const { data: calls } = await supabase
        .from('phoneburner_calls')
        .select('id, start_at, duration_seconds, disposition, phone_number')
        .in('id', allCallIds);

      const callMap = new Map(calls?.map(c => [c.id, c]) || []);

      const enrichScore = (score: typeof scores[0]) => ({
        ...score,
        call: callMap.get(score.call_id),
      });

      return {
        topCalls: topScores.map(enrichScore),
        bottomCalls: bottomScores.map(enrichScore),
      };
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
          workspace_id: currentWorkspace.id,
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
      
      toast.success(`Processed ${data.processed} calls: ${data.transcribed} transcribed, ${data.scored} scored`);
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
          workspace_id: currentWorkspace.id,
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
          workspace_id: currentWorkspace.id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calls-with-scores'] });
      queryClient.invalidateQueries({ queryKey: ['calling-metrics'] });
      toast.success(`Call scored: ${data.composite_score}/100`);
    },
    onError: (error) => {
      toast.error(`Scoring failed: ${error.message}`);
    },
  });
}
