import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';

export interface CallWithScores {
  id: string;
  call_title: string | null;
  date_time: string | null;
  phoneburner_recording_url: string | null;
  fireflies_url: string | null;
  transcript_text: string | null;
  contact_name: string | null;
  company_name: string | null;
  host_email: string | null;
  composite_score: number | null;
  seller_interest_score: number | null;
  objection_handling_score: number | null;
  rapport_building_score: number | null;
  value_proposition_score: number | null;
  engagement_score: number | null;
  next_step_clarity_score: number | null;
  opening_type: string | null;
  call_summary: string | null;
  call_category: string | null;
  timeline_to_sell: string | null;
  import_status: string | null;
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

      // Fetch calls from external_calls
      let query = supabase
        .from('external_calls')
        .select('id, phoneburner_recording_url, transcript_text, composite_score, import_status')
        .eq('workspace_id', currentWorkspace.id);

      if (dateRange) {
        query = query
          .gte('date_time', dateRange.start.toISOString())
          .lte('date_time', dateRange.end.toISOString());
      }

      const { data: calls, error: callsError } = await query;
      if (callsError) throw callsError;

      const totalCalls = calls?.length || 0;
      const totalConnected = calls?.filter(c => c.transcript_text && c.transcript_text.length > 100).length || 0;
      const callsWithRecording = calls?.filter(c => c.phoneburner_recording_url).length || 0;
      const transcribedCalls = calls?.filter(c => c.transcript_text).length || 0;
      const scoredCalls = calls?.filter(c => c.composite_score !== null).length || 0;

      const scoresWithValue = calls?.filter(c => c.composite_score !== null) || [];
      const avgAIScore = scoresWithValue.length > 0
        ? Math.round(scoresWithValue.reduce((sum, c) => sum + (c.composite_score || 0), 0) / scoresWithValue.length)
        : null;

      return {
        totalCalls,
        totalConnected,
        totalVoicemails: 0,
        totalTalkTimeSeconds: 0,
        connectRate: totalCalls > 0 ? (totalConnected / totalCalls) * 100 : 0,
        avgDuration: 0,
        avgAIScore,
        transcribedCalls,
        scoredCalls,
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

      let query = supabase
        .from('external_calls')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('date_time', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data: calls, error } = await query;
      if (error) throw error;

      let results = calls as CallWithScores[];

      // Filter by score range
      if (options?.minScore !== undefined) {
        results = results.filter(r => r.composite_score && r.composite_score >= options.minScore!);
      }
      if (options?.maxScore !== undefined) {
        results = results.filter(r => r.composite_score && r.composite_score <= options.maxScore!);
      }

      // Filter by transcript
      if (options?.hasTranscript) {
        results = results.filter(r => r.transcript_text && r.transcript_text.length > 0);
      }

      // Search in transcript text
      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        results = results.filter(r => 
          r.transcript_text?.toLowerCase().includes(searchLower) ||
          r.call_title?.toLowerCase().includes(searchLower) ||
          r.contact_name?.toLowerCase().includes(searchLower) ||
          r.company_name?.toLowerCase().includes(searchLower)
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

      // Fetch all scored calls
      const { data: calls, error } = await supabase
        .from('external_calls')
        .select(`
          id,
          call_title,
          date_time,
          contact_name,
          company_name,
          composite_score,
          seller_interest_score,
          next_step_clarity_score,
          opening_type,
          call_summary
        `)
        .eq('workspace_id', currentWorkspace.id)
        .not('composite_score', 'is', null)
        .order('composite_score', { ascending: false });

      if (error) throw error;

      const topCalls = (calls?.slice(0, limit) || []).map(c => ({
        id: c.id,
        call_id: c.id,
        composite_score: c.composite_score,
        seller_interest_score: c.seller_interest_score,
        next_step_clarity_score: c.next_step_clarity_score,
        opening_type: c.opening_type,
        personal_insights: c.call_summary,
        call: {
          id: c.id,
          phone_number: c.contact_name || c.company_name,
          start_at: c.date_time,
          duration_seconds: null,
        }
      }));

      const bottomCalls = (calls?.slice(-limit).reverse() || []).map(c => ({
        id: c.id,
        call_id: c.id,
        composite_score: c.composite_score,
        seller_interest_score: c.seller_interest_score,
        next_step_clarity_score: c.next_step_clarity_score,
        opening_type: c.opening_type,
        personal_insights: c.call_summary,
        call: {
          id: c.id,
          phone_number: c.contact_name || c.company_name,
          start_at: c.date_time,
          duration_seconds: null,
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

      // Fetch from external_calls and group by rep_name (preferred) or host_email
      const { data: calls, error } = await supabase
        .from('external_calls')
        .select('host_email, rep_name, transcript_text, composite_score, call_category, seller_interest_score, duration')
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      // Aggregate by rep - prioritize rep_name from NocoDB
      const repMap = new Map<string, RepPerformance>();

      for (const call of calls || []) {
        // Use rep_name (Analyst from NocoDB) if available, otherwise fall back to host_email
        const repKey = call.rep_name || call.host_email || 'unknown';
        const displayName = call.rep_name || (call.host_email ? call.host_email.split('@')[0] : 'Unknown');
        
        const existing = repMap.get(repKey);
        // Use call_category if available, otherwise infer from seller_interest_score or transcript
        const isConnected = call.call_category?.toLowerCase() === 'connection' ||
                           (call.seller_interest_score || 0) >= 3 ||
                           (call.transcript_text && call.transcript_text.length > 100);
        const duration = call.duration || 0;
        
        if (existing) {
          existing.totalCalls += 1;
          existing.callsConnected += isConnected ? 1 : 0;
          existing.totalTalkTimeSeconds += duration;
        } else {
          repMap.set(repKey, {
            memberId: repKey,
            memberName: displayName,
            totalCalls: 1,
            callsConnected: isConnected ? 1 : 0,
            connectRate: 0,
            voicemailsLeft: 0,
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

      return {
        totalCalls,
        totalConnected,
        totalVoicemails: 0,
        totalTalkTimeSeconds: 0,
        connectRate: totalCalls > 0 ? (totalConnected / totalCalls) * 100 : 0,
        repPerformance,
      };
    },
    enabled: !!currentWorkspace?.id,
  });
}
