import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface WorkspaceMember {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  profile: {
    email: string | null;
    full_name: string | null;
  } | null;
}

export function useWorkspaceSettings() {
  const { currentWorkspace, refetch: refetchWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  // Fetch workspace members with their profiles
  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['workspace-members', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      // Fetch members first
      const { data: membersData, error: membersError } = await supabase
        .from('workspace_members')
        .select('id, user_id, role, created_at')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;
      if (!membersData || membersData.length === 0) return [];

      // Fetch profiles separately (no FK relationship)
      const userIds = membersData.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return membersData.map(m => ({
        ...m,
        profile: profileMap.get(m.user_id) || null
      })) as WorkspaceMember[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Update workspace name
  const updateWorkspaceName = useMutation({
    mutationFn: async (newName: string) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      const { error } = await supabase
        .from('workspaces')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', currentWorkspace.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Workspace name updated');
      refetchWorkspace();
    },
    onError: (error) => {
      toast.error('Failed to update workspace name', {
        description: error.message,
      });
    },
  });

  // Invite team member by email
  const inviteTeamMember = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      if (!currentWorkspace?.id) throw new Error('No workspace selected');

      // First, find the user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        throw new Error('No user found with this email. They must sign up first.');
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existing) {
        throw new Error('This user is already a member of the workspace.');
      }

      // Add as workspace member
      const { error: insertError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: currentWorkspace.id,
          user_id: profile.id,
          role,
        });

      if (insertError) throw insertError;

      return { email, role };
    },
    onSuccess: ({ email, role }) => {
      toast.success(`Invited ${email} as ${role}`);
      queryClient.invalidateQueries({ queryKey: ['workspace-members', currentWorkspace?.id] });
    },
    onError: (error) => {
      toast.error('Failed to invite team member', {
        description: error.message,
      });
    },
  });

  // Update member role
  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: AppRole }) => {
      const { error } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Member role updated');
      queryClient.invalidateQueries({ queryKey: ['workspace-members', currentWorkspace?.id] });
    },
    onError: (error) => {
      toast.error('Failed to update role', {
        description: error.message,
      });
    },
  });

  // Remove member from workspace
  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Member removed from workspace');
      queryClient.invalidateQueries({ queryKey: ['workspace-members', currentWorkspace?.id] });
    },
    onError: (error) => {
      toast.error('Failed to remove member', {
        description: error.message,
      });
    },
  });

  return {
    members: members || [],
    loadingMembers,
    updateWorkspaceName,
    inviteTeamMember,
    updateMemberRole,
    removeMember,
  };
}
