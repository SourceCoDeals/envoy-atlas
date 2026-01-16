-- Create the missing replyio_workspace_daily_metrics table
CREATE TABLE IF NOT EXISTS public.replyio_workspace_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  positive_reply_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add unique constraint
ALTER TABLE public.replyio_workspace_daily_metrics 
ADD CONSTRAINT replyio_workspace_daily_metrics_ws_date_unique UNIQUE(workspace_id, metric_date);

-- Add index for efficient date-based queries
CREATE INDEX idx_replyio_ws_daily_metrics_date 
ON public.replyio_workspace_daily_metrics(workspace_id, metric_date DESC);

-- Enable RLS
ALTER TABLE public.replyio_workspace_daily_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their workspace replyio metrics" 
ON public.replyio_workspace_daily_metrics FOR SELECT 
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert their workspace replyio metrics" 
ON public.replyio_workspace_daily_metrics FOR INSERT 
WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update their workspace replyio metrics" 
ON public.replyio_workspace_daily_metrics FOR UPDATE 
USING (is_workspace_member(workspace_id, auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_replyio_ws_daily_metrics_updated_at
BEFORE UPDATE ON public.replyio_workspace_daily_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();