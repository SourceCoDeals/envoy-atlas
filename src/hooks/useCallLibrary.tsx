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
  // Joined data from external_calls
  call?: {
    id: string;
    call_title: string | null;
    contact_name: string | null;
    company_name: string | null;
    phoneburner_recording_url: string | null;
    date_time: string | null;
    host_email: string | null;
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

      // Fetch library entries
      const { data: libraryEntries, error: entriesError } = await supabase
        .from('call_library_entries')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });

      if (entriesError) throw entriesError;
      if (!libraryEntries || libraryEntries.length === 0) return [];

      // Get call IDs to fetch from external_calls
      const callIds = libraryEntries.map(e => e.call_id).filter(Boolean);
      
      if (callIds.length === 0) return libraryEntries as CallLibraryEntry[];

      // Fetch call details from external_calls
      const { data: externalCalls } = await supabase
        .from('external_calls')
        .select('id, call_title, contact_name, company_name, phoneburner_recording_url, date_time, host_email, composite_score, seller_interest_score, objection_handling_score, rapport_building_score')
        .in('id', callIds);

      const callMap = new Map(externalCalls?.map(c => [c.id, c]) || []);

      return libraryEntries.map(entry => {
        const callData = callMap.get(entry.call_id);
        return {
          ...entry,
          call: callData ? {
            id: callData.id,
            call_title: callData.call_title,
            contact_name: callData.contact_name,
            company_name: callData.company_name,
            phoneburner_recording_url: callData.phoneburner_recording_url,
            date_time: callData.date_time,
            host_email: callData.host_email,
          } : undefined,
          ai_score: callData ? {
            composite_score: callData.composite_score,
            seller_interest_score: callData.seller_interest_score,
            objection_handling_score: callData.objection_handling_score,
            rapport_building_score: callData.rapport_building_score,
          } : undefined,
        };
      }) as CallLibraryEntry[];
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
