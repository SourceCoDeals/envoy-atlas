-- Create phoneburner_members table to store team member info
CREATE TABLE public.phoneburner_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  external_member_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, external_member_id)
);

-- Enable RLS
ALTER TABLE public.phoneburner_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can view members in their workspaces"
  ON public.phoneburner_members
  FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can manage members in their workspaces"
  ON public.phoneburner_members
  FOR ALL
  USING (is_workspace_member(workspace_id, auth.uid()));

-- Add member_name column to phoneburner_daily_metrics for denormalization
ALTER TABLE public.phoneburner_daily_metrics 
  ADD COLUMN IF NOT EXISTS member_name TEXT;