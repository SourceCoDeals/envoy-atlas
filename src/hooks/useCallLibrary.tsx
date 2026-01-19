import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { toast } from 'sonner';

export interface CallLibraryEntry {
  id: string;
  category: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  created_at: string;
  call?: {
    id: string;
    call_title: string | null;
    contact_name: string | null;
    company_name: string | null;
    recording_url: string | null;
    date_time: string | null;
    caller_name: string | null;
  };
}

export interface SuggestedCall {
  id: string;
  call_title: string | null;
  contact_name: string | null;
  company_name: string | null;
  caller_name: string | null;
  date_time: string | null;
  recording_url: string | null;
  talk_duration: number | null;
}

export const LIBRARY_CATEGORIES = [
  { value: 'best_openings', label: 'Best Openings', description: 'Strong call openers that set the right tone' },
  { value: 'discovery_excellence', label: 'Discovery Excellence', description: 'Masterful discovery question sequences' },
  { value: 'objection_handling', label: 'Objection Handling', description: 'Effective objection recovery examples' },
  { value: 'strong_closes', label: 'Strong Closes', description: 'Successful meeting-setting techniques' },
  { value: 'rapport_building', label: 'Rapport Building', description: 'Natural rapport-building moments' },
  { value: 'value_proposition', label: 'Value Proposition', description: 'Clear value articulation examples' },
  { value: 'training_examples', label: 'Training Examples', description: 'Calls useful for new rep training' },
  { value: 'avoid_examples', label: 'What to Avoid', description: 'Examples of what not to do' },
];

export function useCallLibrary() {
  const { currentWorkspace: workspace } = useWorkspace();
  const queryClient = useQueryClient();

  // For now, return empty arrays since call_library_entries table may not exist
  // This hook can be expanded when the library feature is implemented
  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['call-library', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      
      // Return empty for now - library entries table may not be in new schema
      return [] as CallLibraryEntry[];
    },
    enabled: !!workspace?.id,
  });

  // Fetch ALL calls to categorize best/worst examples
  const { data: allScoredCalls = [], isLoading: isLoadingSuggested } = useQuery({
    queryKey: ['call-library-all-scored', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];

      // Get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', workspace.id);

      const engagementIds = engagements?.map(e => e.id) || [];
      if (engagementIds.length === 0) return [];

      const { data, error: callsError } = await supabase
        .from('call_activities')
        .select('id, to_name, to_phone, caller_name, recording_url, talk_duration, started_at, transcription')
        .in('engagement_id', engagementIds)
        .not('transcription', 'is', null)
        .order('talk_duration', { ascending: false });

      if (callsError) throw callsError;
      
      return (data || []).map(c => ({
        id: c.id,
        call_title: c.to_name || c.to_phone,
        contact_name: c.to_name,
        company_name: null,
        caller_name: c.caller_name,
        date_time: c.started_at,
        recording_url: c.recording_url,
        talk_duration: c.talk_duration,
      })) as SuggestedCall[];
    },
    enabled: !!workspace?.id,
  });

  // Categorize calls by talk duration (proxy for quality)
  const categorizedSuggestions = useMemo(() => {
    const validCalls = allScoredCalls.filter(c => c.talk_duration != null);
    
    const getTopBottom = (count = 5) => {
      const sorted = [...validCalls].sort((a, b) => (b.talk_duration || 0) - (a.talk_duration || 0));
      return {
        best: sorted.slice(0, count),
        worst: sorted.slice(-count).reverse(),
      };
    };

    const defaultTopBottom = getTopBottom();

    return {
      best_openings: defaultTopBottom,
      discovery_excellence: defaultTopBottom,
      objection_handling: defaultTopBottom,
      strong_closes: defaultTopBottom,
      rapport_building: defaultTopBottom,
      value_proposition: defaultTopBottom,
      training_examples: defaultTopBottom,
      avoid_examples: {
        best: [...validCalls].sort((a, b) => (a.talk_duration || 0) - (b.talk_duration || 0)).slice(0, 5),
        worst: [],
      },
    };
  }, [allScoredCalls]);

  // Flatten for backward compatibility
  const suggestedCalls = useMemo(() => {
    return allScoredCalls.slice(0, 24);
  }, [allScoredCalls]);

  const addToLibrary = useMutation({
    mutationFn: async (params: {
      call_id: string;
      category: string;
      title: string;
      description?: string;
      tags?: string[];
    }) => {
      // Library feature not implemented in new schema
      toast.info('Library feature coming soon');
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-library'] });
    },
  });

  const removeFromLibrary = useMutation({
    mutationFn: async (entryId: string) => {
      // Library feature not implemented in new schema
      toast.info('Library feature coming soon');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-library'] });
    },
  });

  const entriesByCategory = LIBRARY_CATEGORIES.map(cat => ({
    ...cat,
    entries: entries.filter(e => e.category === cat.value),
  }));

  return {
    entries,
    entriesByCategory,
    suggestedCalls,
    categorizedSuggestions,
    isLoading,
    isLoadingSuggested,
    error,
    addToLibrary,
    removeFromLibrary,
  };
}
