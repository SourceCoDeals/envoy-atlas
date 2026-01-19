import { useState } from 'react';
import { useWorkspace } from './useWorkspace';

export interface RepProfile {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean;
}

export interface RepEngagementAssignment {
  id: string;
  rep_profile_id: string;
  engagement_id: string;
  assigned_at: string;
  is_primary: boolean;
}

export function useTeam() {
  const { currentWorkspace } = useWorkspace();
  const [repProfiles] = useState<RepProfile[]>([]);
  const [isLoadingReps] = useState(false);
  const [repsError] = useState<Error | null>(null);
  const [engagementAssignments] = useState<RepEngagementAssignment[]>([]);
  const [engagements] = useState<any[]>([]);

  // Stub mutations
  const createRep = { mutate: () => {}, mutateAsync: async () => ({}) };
  const updateRep = { mutate: () => {}, mutateAsync: async () => ({}) };
  const deleteRep = { mutate: () => {}, mutateAsync: async () => {} };
  const assignToEngagement = { mutate: () => {}, mutateAsync: async () => ({}) };
  const removeAssignment = { mutate: () => {}, mutateAsync: async () => {} };

  const getRepAssignments = (repId: string) => 
    engagementAssignments.filter(a => a.rep_profile_id === repId);

  return {
    repProfiles,
    isLoadingReps,
    repsError,
    engagementAssignments,
    engagements,
    createRep,
    updateRep,
    deleteRep,
    assignToEngagement,
    removeAssignment,
    getRepAssignments,
  };
}
