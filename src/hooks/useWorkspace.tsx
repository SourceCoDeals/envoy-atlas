import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Database } from '@/integrations/supabase/types';

type Workspace = Database['public']['Tables']['workspaces']['Row'];
type AppRole = Database['public']['Enums']['app_role'];

interface WorkspaceWithRole extends Workspace {
  role: AppRole;
}

interface WorkspaceContextType {
  workspaces: WorkspaceWithRole[];
  currentWorkspace: WorkspaceWithRole | null;
  setCurrentWorkspace: (workspace: WorkspaceWithRole | null) => void;
  loading: boolean;
  userRole: AppRole | null;
  createWorkspace: (name: string) => Promise<{ error: Error | null; workspace?: Workspace }>;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceWithRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: members, error } = await supabase
        .from('workspace_members')
        .select(`
          role,
          workspace:workspaces(*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const workspacesWithRoles: WorkspaceWithRole[] = (members || [])
        .filter(m => m.workspace)
        .map(m => ({
          ...(m.workspace as Workspace),
          role: m.role,
        }));

      setWorkspaces(workspacesWithRoles);

      // Set current workspace from localStorage or find the main one (with slug 'sourceco'), or first available
      const storedWorkspaceId = localStorage.getItem('currentWorkspaceId');
      const storedWorkspace = workspacesWithRoles.find(w => w.id === storedWorkspaceId);
      
      if (storedWorkspace) {
        setCurrentWorkspace(storedWorkspace);
      } else {
        // Prioritize the main workspace (slug without random suffix) or first available
        const mainWorkspace = workspacesWithRoles.find(w => w.slug === 'sourceco') || workspacesWithRoles[0];
        if (mainWorkspace) {
          setCurrentWorkspace(mainWorkspace);
          localStorage.setItem('currentWorkspaceId', mainWorkspace.id);
        }
      }
    } catch (err) {
      console.error('Error fetching workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [user?.id]);

  const handleSetCurrentWorkspace = (workspace: WorkspaceWithRole | null) => {
    setCurrentWorkspace(workspace);
    if (workspace) {
      localStorage.setItem('currentWorkspaceId', workspace.id);
    } else {
      localStorage.removeItem('currentWorkspaceId');
    }
  };

  const createWorkspace = async (name: string): Promise<{ error: Error | null; workspace?: Workspace }> => {
    try {
      const { data, error } = await supabase.rpc('create_workspace', { _name: name });
      if (error) throw error;
      
      await fetchWorkspaces();
      return { error: null, workspace: data as Workspace };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const userRole = currentWorkspace?.role || null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspace: handleSetCurrentWorkspace,
        loading,
        userRole,
        createWorkspace,
        refetch: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
