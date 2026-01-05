-- Remove duplicate recursive policies that remained from original migration

DROP POLICY IF EXISTS "Admins can manage workspace members" ON public.workspace_members;