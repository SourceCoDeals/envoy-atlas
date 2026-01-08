-- Create table for external call data imported from NocoDB
CREATE TABLE public.external_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  nocodb_row_id TEXT,
  call_title TEXT,
  fireflies_url TEXT,
  phoneburner_recording_url TEXT,
  date_time TIMESTAMPTZ,
  host_email TEXT,
  all_participants TEXT,
  call_type TEXT, -- 'sales', 'remarketing', 'external'
  transcript_text TEXT,
  import_status TEXT DEFAULT 'pending', -- 'pending', 'transcript_fetched', 'scored', 'error'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, nocodb_row_id)
);

-- Enable RLS
ALTER TABLE public.external_calls ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view external calls in their workspace"
ON public.external_calls
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = external_calls.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert external calls in their workspace"
ON public.external_calls
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = external_calls.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update external calls in their workspace"
ON public.external_calls
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = external_calls.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete external calls in their workspace"
ON public.external_calls
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = external_calls.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_external_calls_updated_at
  BEFORE UPDATE ON public.external_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for common queries
CREATE INDEX idx_external_calls_workspace_id ON public.external_calls(workspace_id);
CREATE INDEX idx_external_calls_date_time ON public.external_calls(date_time);
CREATE INDEX idx_external_calls_import_status ON public.external_calls(import_status);