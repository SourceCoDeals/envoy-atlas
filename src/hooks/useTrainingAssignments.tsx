import { useState } from 'react';
import { useWorkspace } from './useWorkspace';
import { useAuth } from './useAuth';

export interface TrainingAssignment {
  id: string;
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
  call?: any;
  assigner?: any;
}

export function useTrainingAssignments() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  
  const [assignments] = useState<TrainingAssignment[]>([]);
  const [isLoading] = useState(false);
  const [error] = useState<Error | null>(null);

  const markComplete = { mutate: () => {}, mutateAsync: async () => {} };
  const markIncomplete = { mutate: () => {}, mutateAsync: async () => {} };

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
