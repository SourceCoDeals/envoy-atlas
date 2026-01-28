import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Database } from '@/integrations/supabase/types';
import { logger } from '@/lib/logger';

type Client = Database['public']['Tables']['clients']['Row'];

interface ClientWithRole extends Client {
  role: string;
}

// Alias for backward compatibility with existing components
export type WorkspaceWithRole = ClientWithRole;

interface WorkspaceContextType {
  workspaces: ClientWithRole[];
  currentWorkspace: ClientWithRole | null;
  setCurrentWorkspace: (workspace: ClientWithRole | null) => void;
  loading: boolean;
  userRole: string | null;
  createWorkspace: (name: string) => Promise<{ error: Error | null; workspace?: Client }>;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

// Auto-join the default "SourceCo" client for new users
async function ensureSourceCoWorkspace(userId: string): Promise<void> {
  // Check if user already has any workspace membership
  const { data: existingMemberships } = await supabase
    .from('client_members')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (existingMemberships && existingMemberships.length > 0) {
    return; // User already has workspace access
  }

  // Use a SECURITY DEFINER RPC so we don't need broad client-side insert permissions.
  const { error } = await supabase.rpc('join_default_client');
  if (error) {
    logger.error('Error joining default workspace', error);
  }
}

// Fetch default workspace for anonymous users
async function fetchDefaultWorkspace(): Promise<ClientWithRole | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('slug', 'sourceco')
    .single();

  if (error || !data) {
    logger.error('Error fetching default workspace', error);
    return null;
  }

  return {
    ...data,
    role: 'viewer',
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<ClientWithRole[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<ClientWithRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = async () => {
    setLoading(true);
    try {
      // If user is authenticated, fetch their workspaces
      if (user) {
        // Ensure user has SourceCo workspace
        await ensureSourceCoWorkspace(user.id);

        const { data: members, error } = await supabase
          .from('client_members')
          .select(`
            role,
            client:clients(*)
          `)
          .eq('user_id', user.id);

        if (error) throw error;

        const clientsWithRoles: ClientWithRole[] = (members || [])
          .filter(m => m.client)
          .map(m => ({
            ...(m.client as Client),
            role: m.role || 'viewer',
          }));

        setWorkspaces(clientsWithRoles);

        // Set current workspace from localStorage or first available
        const storedWorkspaceId = localStorage.getItem('currentWorkspaceId');
        const storedWorkspace = clientsWithRoles.find(w => w.id === storedWorkspaceId);
        
        if (storedWorkspace) {
          setCurrentWorkspace(storedWorkspace);
        } else {
          const firstWorkspace = clientsWithRoles[0];
          if (firstWorkspace) {
            setCurrentWorkspace(firstWorkspace);
            localStorage.setItem('currentWorkspaceId', firstWorkspace.id);
          }
        }
      } else {
        // For anonymous users, fetch the default SourceCo workspace
        const defaultWorkspace = await fetchDefaultWorkspace();
        if (defaultWorkspace) {
          setWorkspaces([defaultWorkspace]);
          setCurrentWorkspace(defaultWorkspace);
        }
      }
    } catch (err) {
      logger.error('Error fetching clients', err);
      // Fallback for anonymous users on error
      if (!user) {
        const defaultWorkspace = await fetchDefaultWorkspace();
        if (defaultWorkspace) {
          setWorkspaces([defaultWorkspace]);
          setCurrentWorkspace(defaultWorkspace);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [user?.id]);

  const handleSetCurrentWorkspace = (workspace: ClientWithRole | null) => {
    setCurrentWorkspace(workspace);
    if (workspace) {
      localStorage.setItem('currentWorkspaceId', workspace.id);
    } else {
      localStorage.removeItem('currentWorkspaceId');
    }
  };

  const createWorkspace = async (name: string): Promise<{ error: Error | null; workspace?: Client }> => {
    if (!user) {
      return { error: new Error('Must be logged in to create a workspace') };
    }
    
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      const { data, error } = await supabase
        .from('clients')
        .insert({ name, slug })
        .select()
        .single();
        
      if (error) throw error;
      
      if (data && user) {
        await supabase
          .from('client_members')
          .insert({ client_id: data.id, user_id: user.id, role: 'admin' });
      }
      
      await fetchWorkspaces();
      return { error: null, workspace: data };
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
