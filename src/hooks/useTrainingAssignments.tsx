import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface TrainingAssignment {
  id: string;
  workspace_id: string;
  assignee_id: string;
  assigned_by: string;
  call_id: string;
  assignment_type: string;
  focus_area: string | null;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  rep_feedback: string | null;
  created_at: string;
  // Joined data
  call?: {
    id: string;
    contact_name: string | null;
    company_name: string | null;
    call_duration_sec: number | null;
    called_date: string | null;
  };
  assigner?: {
    full_name: string | null;
    email: string | null;
  };
}

export function useTrainingAssignments() {
  const { currentWorkspace: workspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading, error } = useQuery({
    queryKey: ['training-assignments', workspace?.id, user?.id],
    queryFn: async () => {
      if (!workspace?.id || !user?.id) return [];

      // Fetch assignments for the current user
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('training_assignments')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('assignee_id', user.id)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (assignmentError) throw assignmentError;
      if (!assignmentData || assignmentData.length === 0) return [];

      // Fetch call details
      const callIds = assignmentData.map(a => a.call_id).filter(Boolean);
      const assignerIds = [...new Set(assignmentData.map(a => a.assigned_by).filter(Boolean))];

      const [callsResult, profilesResult] = await Promise.all([
        callIds.length > 0 
          ? supabase
              .from('phoneburner_calls')
              .select('id, contact_name, company_name, call_duration_sec, called_date')
              .in('id', callIds)
          : Promise.resolve({ data: [] }),
        assignerIds.length > 0
          ? supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', assignerIds)
          : Promise.resolve({ data: [] })
      ]);

      const callMap = new Map((callsResult.data || []).map(c => [c.id, c]));
      const profileMap = new Map((profilesResult.data || []).map(p => [p.id, p]));

      return assignmentData.map(assignment => ({
        ...assignment,
        call: callMap.get(assignment.call_id),
        assigner: profileMap.get(assignment.assigned_by),
      })) as TrainingAssignment[];
    },
    enabled: !!workspace?.id && !!user?.id,
  });

  const markComplete = useMutation({
    mutationFn: async ({ assignmentId, feedback }: { assignmentId: string; feedback?: string }) => {
      const { error } = await supabase
        .from('training_assignments')
        .update({
          completed_at: new Date().toISOString(),
          rep_feedback: feedback || null,
        })
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-assignments'] });
      toast.success('Training marked as complete');
    },
    onError: (error) => {
      toast.error('Failed to update assignment');
      console.error(error);
    },
  });

  const markIncomplete = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('training_assignments')
        .update({
          completed_at: null,
        })
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-assignments'] });
      toast.success('Assignment reopened');
    },
    onError: (error) => {
      toast.error('Failed to update assignment');
      console.error(error);
    },
  });

  const pendingAssignments = assignments.filter(a => !a.completed_at);
  const completedAssignments = assignments.filter(a => a.completed_at);

  return {
    assignments,
    pendingAssignments,
    completedAssignments,
    isLoading,
    error,
    markComplete,
    markIncomplete,
  };
}
