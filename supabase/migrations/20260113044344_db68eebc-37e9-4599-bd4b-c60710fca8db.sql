-- Create cold_calls table with all NocoDB fields including system columns
CREATE TABLE public.cold_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  nocodb_id INTEGER UNIQUE,
  nocodb_created_at TIMESTAMP WITH TIME ZONE,
  nocodb_updated_at TIMESTAMP WITH TIME ZONE,
  direction TEXT,
  from_number TEXT,
  from_name TEXT,
  to_number TEXT,
  to_name TEXT,
  to_company TEXT,
  to_email TEXT,
  salesforce_url TEXT,
  call_duration_sec INTEGER,
  called_date TIMESTAMP WITH TIME ZONE,
  call_transcript TEXT,
  category TEXT,
  analyst TEXT,
  composite_score NUMERIC(4,2),
  seller_interest_score NUMERIC(4,2),
  objection_handling_score NUMERIC(4,2),
  rapport_building_score NUMERIC(4,2),
  value_proposition_score NUMERIC(4,2),
  engagement_score NUMERIC(4,2),
  next_step_clarity_score NUMERIC(4,2),
  gatekeeper_handling_score NUMERIC(4,2),
  quality_of_conversation_score NUMERIC(4,2),
  opening_type TEXT,
  primary_opportunity TEXT,
  call_summary TEXT,
  key_concerns TEXT[],
  target_pain_points TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cold_calls ENABLE ROW LEVEL SECURITY;

-- RLS policies for workspace members
CREATE POLICY "Workspace members can view cold_calls"
  ON public.cold_calls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = cold_calls.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can insert cold_calls"
  ON public.cold_calls FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = cold_calls.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

CREATE POLICY "Workspace admins can update cold_calls"
  ON public.cold_calls FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = cold_calls.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

CREATE POLICY "Workspace admins can delete cold_calls"
  ON public.cold_calls FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = cold_calls.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX idx_cold_calls_workspace_id ON public.cold_calls(workspace_id);
CREATE INDEX idx_cold_calls_analyst ON public.cold_calls(analyst);
CREATE INDEX idx_cold_calls_called_date ON public.cold_calls(called_date);
CREATE INDEX idx_cold_calls_category ON public.cold_calls(category);
CREATE INDEX idx_cold_calls_nocodb_id ON public.cold_calls(nocodb_id);

-- Trigger for updated_at
CREATE TRIGGER update_cold_calls_updated_at
  BEFORE UPDATE ON public.cold_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();