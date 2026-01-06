-- Create copy_library table for saving and organizing top-performing variants
CREATE TABLE public.copy_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_variant_id UUID REFERENCES public.campaign_variants(id) ON DELETE SET NULL,
  subject_line TEXT NOT NULL,
  email_body TEXT,
  body_preview TEXT,
  personalization_vars JSONB DEFAULT '[]'::jsonb,
  performance_snapshot JSONB DEFAULT '{}'::jsonb,
  ai_tags TEXT[] DEFAULT '{}',
  manual_tags TEXT[] DEFAULT '{}',
  notes TEXT,
  category TEXT NOT NULL DEFAULT 'custom',
  status TEXT NOT NULL DEFAULT 'active',
  is_template BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.copy_library ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Workspace members can view library entries"
ON public.copy_library
FOR SELECT
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create library entries"
ON public.copy_library
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update library entries"
ON public.copy_library
FOR UPDATE
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins or creators can delete library entries"
ON public.copy_library
FOR DELETE
USING (
  public.is_workspace_admin(workspace_id, auth.uid()) 
  OR created_by = auth.uid()
);

-- Create indexes for performance
CREATE INDEX idx_copy_library_workspace_id ON public.copy_library(workspace_id);
CREATE INDEX idx_copy_library_category ON public.copy_library(category);
CREATE INDEX idx_copy_library_status ON public.copy_library(status);
CREATE INDEX idx_copy_library_ai_tags ON public.copy_library USING GIN(ai_tags);
CREATE INDEX idx_copy_library_manual_tags ON public.copy_library USING GIN(manual_tags);

-- Add trigger for updated_at
CREATE TRIGGER update_copy_library_updated_at
BEFORE UPDATE ON public.copy_library
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();