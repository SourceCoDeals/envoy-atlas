import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Database } from '@/integrations/supabase/types';

type Workspace = Database['public']['Tables']['workspaces']['Row'];
type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row'];
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

    try {
      // Fetch workspace memberships for current user
      const { data: memberships, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      if (!memberships || memberships.length === 0) {
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setLoading(false);
        return;
      }

      // Fetch workspaces
      const workspaceIds = memberships.map(m => m.workspace_id);
      const { data: workspaceData, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds);

      if (wsError) throw wsError;

      // Combine workspace data with roles
      const workspacesWithRoles: WorkspaceWithRole[] = (workspaceData || []).map(ws => {
        const membership = memberships.find(m => m.workspace_id === ws.id);
        return {
          ...ws,
          role: membership?.role || 'viewer',
        };
      });

      setWorkspaces(workspacesWithRoles);

      // Set current workspace from localStorage or first available
      const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
      const savedWorkspace = workspacesWithRoles.find(ws => ws.id === savedWorkspaceId);
      
      if (savedWorkspace) {
        setCurrentWorkspace(savedWorkspace);
      } else if (workspacesWithRoles.length > 0) {
        setCurrentWorkspace(workspacesWithRoles[0]);
        localStorage.setItem('currentWorkspaceId', workspacesWithRoles[0].id);
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [user]);

  const handleSetCurrentWorkspace = (workspace: WorkspaceWithRole | null) => {
    setCurrentWorkspace(workspace);
    if (workspace) {
      localStorage.setItem('currentWorkspaceId', workspace.id);
    } else {
      localStorage.removeItem('currentWorkspaceId');
    }
  };

  const createWorkspace = async (name: string): Promise<{ error: Error | null; workspace?: Workspace }> => {
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    try {
      // Use the atomic create_workspace function to avoid RLS bootstrapping issues
      const { data: workspace, error: rpcError } = await supabase
        .rpc('create_workspace', { _name: name });

      if (rpcError) throw rpcError;

      // Refresh workspaces
      await fetchWorkspaces();

      return { error: null, workspace };
    } catch (error) {
      return { error: error as Error };
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