import { useState, createContext, useContext, ReactNode } from 'react';
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

// TEMP: Mock workspace for dev mode (using first SourceCo workspace)
const MOCK_WORKSPACE: WorkspaceWithRole = {
  id: 'fd25e07d-984a-4bf2-b3fd-2401d173254e',
  name: 'SourceCo',
  slug: 'sourceco',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  role: 'admin' as AppRole,
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  // TEMP: Use mock workspace directly (auth disabled)
  const [workspaces] = useState<WorkspaceWithRole[]>([MOCK_WORKSPACE]);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceWithRole | null>(MOCK_WORKSPACE);
  const [loading] = useState(false);

  const handleSetCurrentWorkspace = (workspace: WorkspaceWithRole | null) => {
    setCurrentWorkspace(workspace);
  };

  const createWorkspace = async (): Promise<{ error: Error | null; workspace?: Workspace }> => {
    return { error: null, workspace: MOCK_WORKSPACE };
  };

  const refetch = async () => {};

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
        refetch,
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
