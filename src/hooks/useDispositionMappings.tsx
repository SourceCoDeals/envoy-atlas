import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';

export interface DispositionMapping {
  id: string;
  engagement_id: string;
  platform: string;
  external_disposition: string;
  internal_disposition: string;
  is_connection: boolean;
  is_conversation: boolean;
  is_voicemail: boolean;
  is_meeting: boolean;
  is_dm: boolean;
  min_talk_duration_seconds: number;
  description: string | null;
}

/**
 * Hook to fetch disposition mappings for an engagement
 * Used to determine if a call disposition counts as a connection
 */
export function useDispositionMappings(engagementId?: string) {
  return useQuery({
    queryKey: ['disposition-mappings', engagementId],
    queryFn: async (): Promise<DispositionMapping[]> => {
      if (!engagementId) return [];

      const { data, error } = await supabase
        .from('disposition_mappings')
        .select('*')
        .eq('engagement_id', engagementId);

      if (error) throw error;
      return (data || []) as DispositionMapping[];
    },
    enabled: !!engagementId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Helper to check if a disposition is a connection based on mappings
 */
export function isConnectionFromMappings(
  disposition: string | null | undefined,
  talkDuration: number | null | undefined,
  mappings: DispositionMapping[]
): boolean {
  if (!disposition) {
    // No disposition - check if talk duration indicates connection
    return (talkDuration ?? 0) >= 30;
  }

  const lower = disposition.toLowerCase();
  const mapping = mappings.find(
    m => m.external_disposition.toLowerCase() === lower
  );

  if (mapping) {
    if (mapping.is_connection) return true;
    // Check talk duration threshold
    const threshold = mapping.min_talk_duration_seconds || 30;
    return (talkDuration ?? 0) >= threshold;
  }

  // Fallback: default connected dispositions or talk duration > 30s
  const defaultConnected = ['connected', 'conversation', 'dm_conversation', 'answered', 'completed_call'];
  if (defaultConnected.some(d => lower.includes(d))) return true;
  
  return (talkDuration ?? 0) >= 30;
}

/**
 * Helper to check if a disposition is a DM conversation
 */
export function isDMFromMappings(
  disposition: string | null | undefined,
  mappings: DispositionMapping[]
): boolean {
  if (!disposition) return false;

  const lower = disposition.toLowerCase();
  const mapping = mappings.find(
    m => m.external_disposition.toLowerCase() === lower
  );

  return mapping?.is_dm ?? false;
}

/**
 * Helper to check if a disposition is voicemail
 */
export function isVoicemailFromMappings(
  disposition: string | null | undefined,
  mappings: DispositionMapping[]
): boolean {
  if (!disposition) return false;

  const lower = disposition.toLowerCase();
  const mapping = mappings.find(
    m => m.external_disposition.toLowerCase() === lower
  );

  if (mapping) return mapping.is_voicemail;

  // Fallback
  return lower.includes('voicemail') || lower.includes('vm') || lower.includes('left_message');
}
