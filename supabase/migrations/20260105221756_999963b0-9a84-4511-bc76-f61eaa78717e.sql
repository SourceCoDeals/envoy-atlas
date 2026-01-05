-- Fix infinite recursion in workspace_members RLS by using SECURITY DEFINER helpers

-- 1) Helper functions (bypass RLS safely)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_first_workspace_member(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = _workspace_id
  );
$$;

-- 2) Drop the recursive policies
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can manage workspace members" ON public.workspace_members;

-- 3) Recreate policies without self-referencing workspace_members
CREATE POLICY "Members can view workspace members"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Allow the creator to insert the first membership row for a new workspace.
-- After that, only workspace admins can add members.
CREATE POLICY "Members can insert workspace members"
ON public.workspace_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.is_first_workspace_member(workspace_id)
    OR public.is_workspace_admin(workspace_id, auth.uid())
  )
);

CREATE POLICY "Admins can update workspace members"
ON public.workspace_members
FOR UPDATE
TO authenticated
USING (public.is_workspace_admin(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Admins can delete workspace members"
ON public.workspace_members
FOR DELETE
TO authenticated
USING (public.is_workspace_admin(workspace_id, auth.uid()));
