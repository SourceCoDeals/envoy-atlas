import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { toast } from 'sonner';

export interface CallLibraryEntry {
  id: string;
  workspace_id: string;
  call_id: string;
  category: string;
  title: string;
  description: string | null;
  highlight_start_time: number | null;
  highlight_end_time: number | null;
  tags: string[] | null;
  added_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  call?: {
    id: string;
    phone_number: string | null;
    duration_seconds: number | null;
    disposition: string | null;
    recording_url: string | null;
    start_at: string | null;
    dial_session?: {
      member_name: string | null;
    };
  };
  ai_score?: {
    composite_score: number | null;
    seller_interest_score: number | null;
    objection_handling_score: number | null;
    rapport_building_score: number | null;
  };
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

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['call-library', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];

      const { data, error } = await supabase
        .from('call_library_entries')
        .select(`
          *,
          call:phoneburner_calls(
            id,
            phone_number,
            duration_seconds,
            disposition,
            recording_url,
            start_at,
            dial_session:phoneburner_dial_sessions(member_name)
          )
        `)
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch AI scores separately
      const callIds = data?.map(e => e.call_id).filter(Boolean) || [];
      if (callIds.length > 0) {
        const { data: scores } = await supabase
          .from('call_ai_scores')
          .select('call_id, composite_score, seller_interest_score, objection_handling_score, rapport_building_score')
          .in('call_id', callIds);

        const scoreMap = new Map(scores?.map(s => [s.call_id, s]) || []);
        return data?.map(entry => ({
          ...entry,
          ai_score: scoreMap.get(entry.call_id) || null,
        })) as CallLibraryEntry[];
      }

      return data as CallLibraryEntry[];
    },
    enabled: !!workspace?.id,
  });

  const addToLibrary = useMutation({
    mutationFn: async (params: {
      call_id: string;
      category: string;
      title: string;
      description?: string;
      highlight_start_time?: number;
      highlight_end_time?: number;
      tags?: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !workspace?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('call_library_entries')
        .insert({
          workspace_id: workspace.id,
          call_id: params.call_id,
          category: params.category,
          title: params.title,
          description: params.description || null,
          highlight_start_time: params.highlight_start_time || null,
          highlight_end_time: params.highlight_end_time || null,
          tags: params.tags || null,
          added_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-library'] });
      toast.success('Call added to library');
    },
    onError: (error) => {
      toast.error('Failed to add call to library');
      console.error(error);
    },
  });

  const removeFromLibrary = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('call_library_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-library'] });
      toast.success('Removed from library');
    },
    onError: (error) => {
      toast.error('Failed to remove from library');
      console.error(error);
    },
  });

  const entriesByCategory = LIBRARY_CATEGORIES.map(cat => ({
    ...cat,
    entries: entries.filter(e => e.category === cat.value),
  }));

  return {
    entries,
    entriesByCategory,
    isLoading,
    error,
    addToLibrary,
    removeFromLibrary,
  };
}
