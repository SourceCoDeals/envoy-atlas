import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";
import { toast } from "sonner";

export interface RepProfile {
  id: string;
  user_id: string | null;
  workspace_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  hire_date: string | null;
  is_active: boolean;
  role: string | null;
  created_at: string;
}

export interface RepEngagementAssignment {
  id: string;
  rep_profile_id: string;
  engagement_id: string;
  assigned_at: string;
  is_primary: boolean;
  engagement?: {
    id: string;
    engagement_name: string;
    client_name: string;
    status: string | null;
  };
}

export interface UserRole {
  id: string;
  user_id: string;
  workspace_id: string;
  role: string;
  created_at: string;
}

type AppRole = "admin" | "manager" | "rep" | "analyst" | "viewer";

export function useTeam() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  // Fetch all rep profiles for the workspace
  const {
    data: repProfiles = [],
    isLoading: isLoadingReps,
    error: repsError,
  } = useQuery({
    queryKey: ["rep-profiles", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from("rep_profiles")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("first_name");
      if (error) throw error;
      return data as RepProfile[];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Fetch engagement assignments for all reps
  const { data: engagementAssignments = [] } = useQuery({
    queryKey: ["rep-engagement-assignments", currentWorkspace?.id, repProfiles.length],
    queryFn: async () => {
      if (!currentWorkspace?.id || repProfiles.length === 0) return [];
      const { data, error } = await supabase
        .rpc("get_rep_assignments" as any, {})
        .select("*");
      
      // Fallback to direct query if RPC doesn't exist
      if (error) {
        // Query engagement_reps table instead (existing table)
        const { data: assignData, error: assignError } = await supabase
          .from("engagement_reps")
          .select(`
            id,
            rep_profile_id,
            engagement_id,
            assigned_at,
            engagement:engagements(id, engagement_name, client_name, status)
          `)
          .in("rep_profile_id", repProfiles.map((r) => r.id));
        
        if (assignError) {
          console.error("Error fetching assignments:", assignError);
          return [];
        }
        return (assignData || []).map((a: any) => ({
          ...a,
          is_primary: false,
        })) as RepEngagementAssignment[];
      }
      return (data || []) as RepEngagementAssignment[];
    },
    enabled: !!currentWorkspace?.id && repProfiles.length > 0,
  });

  // Fetch all engagements for assignment dropdown
  const { data: engagements = [] } = useQuery({
    queryKey: ["engagements-list", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from("engagements")
        .select("id, engagement_name, client_name, status")
        .eq("workspace_id", currentWorkspace.id)
        .order("client_name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Create rep profile
  const createRep = useMutation({
    mutationFn: async (rep: Partial<RepProfile>) => {
      if (!currentWorkspace?.id) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("rep_profiles")
        .insert({
          first_name: rep.first_name || "",
          last_name: rep.last_name || "",
          email: rep.email,
          phone: rep.phone,
          hire_date: rep.hire_date,
          is_active: rep.is_active ?? true,
          role: (rep.role as AppRole) || "rep",
          workspace_id: currentWorkspace.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rep-profiles"] });
      toast.success("Team member added");
    },
    onError: (e) => toast.error(e.message),
  });

  // Update rep profile
  const updateRep = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RepProfile> & { id: string }) => {
      const updateData = {
        ...updates,
        role: updates.role as AppRole | undefined,
      };
      const { data, error } = await supabase
        .from("rep_profiles")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rep-profiles"] });
      toast.success("Team member updated");
    },
    onError: (e) => toast.error(e.message),
  });

  // Delete rep profile
  const deleteRep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rep_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rep-profiles"] });
      toast.success("Team member removed");
    },
    onError: (e) => toast.error(e.message),
  });

  // Assign rep to engagement
  const assignToEngagement = useMutation({
    mutationFn: async ({
      repProfileId,
      engagementId,
      isPrimary = false,
    }: {
      repProfileId: string;
      engagementId: string;
      isPrimary?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("rep_engagement_assignments" as any)
        .insert({
          rep_profile_id: repProfileId,
          engagement_id: engagementId,
          is_primary: isPrimary,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rep-engagement-assignments"] });
      toast.success("Assignment added");
    },
    onError: (e) => toast.error(e.message),
  });

  // Remove assignment
  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rep_engagement_assignments" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rep-engagement-assignments"] });
      toast.success("Assignment removed");
    },
    onError: (e) => toast.error(e.message),
  });

  // Get assignments for a specific rep
  const getRepAssignments = (repId: string) =>
    engagementAssignments.filter((a) => a.rep_profile_id === repId);

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
