-- Create workspace-level daily metrics for overall trends (historical data)
CREATE TABLE IF NOT EXISTS public.smartlead_workspace_daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT smartlead_workspace_daily_unique UNIQUE (workspace_id, metric_date)
);

-- Create index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_smartlead_workspace_daily_date 
  ON public.smartlead_workspace_daily_metrics(workspace_id, metric_date DESC);

-- Enable RLS
ALTER TABLE public.smartlead_workspace_daily_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for workspace member access
CREATE POLICY "Users can view workspace daily metrics" 
  ON public.smartlead_workspace_daily_metrics
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert workspace daily metrics" 
  ON public.smartlead_workspace_daily_metrics
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update workspace daily metrics" 
  ON public.smartlead_workspace_daily_metrics
  FOR UPDATE USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can delete workspace daily metrics" 
  ON public.smartlead_workspace_daily_metrics
  FOR DELETE USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_smartlead_workspace_daily_metrics_updated_at
  BEFORE UPDATE ON public.smartlead_workspace_daily_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();