-- Create replyio_campaign_cumulative table for storing lifetime totals
-- This enables calculating daily deltas from Reply.io's lifetime-only API

CREATE TABLE IF NOT EXISTS public.replyio_campaign_cumulative (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.replyio_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_interested INTEGER DEFAULT 0,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT unique_campaign_cumulative UNIQUE (campaign_id)
);

-- Enable RLS
ALTER TABLE public.replyio_campaign_cumulative ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view cumulative metrics for their workspace"
ON public.replyio_campaign_cumulative
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage cumulative metrics"
ON public.replyio_campaign_cumulative
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_replyio_cumulative_campaign ON public.replyio_campaign_cumulative(campaign_id);
CREATE INDEX IF NOT EXISTS idx_replyio_cumulative_workspace ON public.replyio_campaign_cumulative(workspace_id);