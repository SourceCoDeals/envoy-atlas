import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export interface TeamMember {
  id: string;
  client_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  title: string | null;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberFormData {
  first_name: string;
  last_name?: string;
  email?: string;
  title?: string;
  is_active?: boolean;
  user_id?: string | null;
}

export function useTeamMembers() {
  const { currentWorkspace } = useWorkspace();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTeamMembers = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setTeamMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('team_members')
        .select('*')
        .eq('client_id', currentWorkspace.id)
        .order('first_name', { ascending: true });

      if (fetchError) throw fetchError;
      setTeamMembers(data || []);
    } catch (err) {
      logger.error('Error fetching team members', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch team members'));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  const createTeamMember = async (data: TeamMemberFormData) => {
    if (!currentWorkspace?.id) {
      toast.error('No workspace selected');
      return null;
    }

    try {
      const { data: newMember, error } = await supabase
        .from('team_members')
        .insert({
          client_id: currentWorkspace.id,
          first_name: data.first_name,
          last_name: data.last_name || null,
          email: data.email || null,
          title: data.title || null,
          is_active: data.is_active ?? true,
          user_id: data.user_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      setTeamMembers(prev => [...prev, newMember]);
      toast.success('Team member added');
      return newMember;
    } catch (err) {
      logger.error('Error creating team member', err);
      toast.error('Failed to add team member');
      return null;
    }
  };

  const updateTeamMember = async (id: string, data: Partial<TeamMemberFormData>) => {
    try {
      const { data: updated, error } = await supabase
        .from('team_members')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          title: data.title,
          is_active: data.is_active,
          user_id: data.user_id,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTeamMembers(prev => prev.map(m => m.id === id ? updated : m));
      toast.success('Team member updated');
      return updated;
    } catch (err) {
      logger.error('Error updating team member', err);
      toast.error('Failed to update team member');
      return null;
    }
  };

  const deleteTeamMember = async (id: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTeamMembers(prev => prev.filter(m => m.id !== id));
      toast.success('Team member removed');
      return true;
    } catch (err) {
      logger.error('Error deleting team member', err);
      toast.error('Failed to remove team member');
      return false;
    }
  };

  const activeTeamMembers = teamMembers.filter(m => m.is_active);

  const getTeamMemberName = (member: TeamMember | null | undefined) => {
    if (!member) return '';
    return [member.first_name, member.last_name].filter(Boolean).join(' ');
  };

  const getTeamMemberById = (id: string | null | undefined) => {
    if (!id) return null;
    return teamMembers.find(m => m.id === id) || null;
  };

  return {
    teamMembers,
    activeTeamMembers,
    loading,
    error,
    refetch: fetchTeamMembers,
    createTeamMember,
    updateTeamMember,
    deleteTeamMember,
    getTeamMemberName,
    getTeamMemberById,
  };
}
