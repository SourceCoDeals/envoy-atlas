-- Add workspace_id to user_roles table
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Add unique constraint for user per workspace
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_workspace_unique UNIQUE (user_id, workspace_id);