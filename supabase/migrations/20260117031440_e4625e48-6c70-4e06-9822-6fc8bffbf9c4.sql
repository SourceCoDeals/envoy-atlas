-- Part 1: Create smartlead_campaign_cumulative table for parity with Reply.io
CREATE TABLE IF NOT EXISTS public.smartlead_campaign_cumulative (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.smartlead_campaigns(id) ON DELETE CASCADE,
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_interested INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, campaign_id)
);

-- Enable RLS
ALTER TABLE public.smartlead_campaign_cumulative ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their workspace cumulative data"
ON public.smartlead_campaign_cumulative FOR SELECT
USING (workspace_id IN (
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert their workspace cumulative data"
ON public.smartlead_campaign_cumulative FOR INSERT
WITH CHECK (workspace_id IN (
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update their workspace cumulative data"
ON public.smartlead_campaign_cumulative FOR UPDATE
USING (workspace_id IN (
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
));

-- Part 2: Add unique constraints for daily metrics upserts
-- First check if constraints exist and add if not
DO $$
BEGIN
  -- For smartlead_daily_metrics
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'smartlead_daily_metrics_campaign_date_unique'
  ) THEN
    ALTER TABLE public.smartlead_daily_metrics 
    ADD CONSTRAINT smartlead_daily_metrics_campaign_date_unique 
    UNIQUE (campaign_id, metric_date);
  END IF;
  
  -- For replyio_daily_metrics
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'replyio_daily_metrics_campaign_date_unique'
  ) THEN
    ALTER TABLE public.replyio_daily_metrics 
    ADD CONSTRAINT replyio_daily_metrics_campaign_date_unique 
    UNIQUE (campaign_id, metric_date);
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_smartlead_campaign_cumulative_workspace 
ON public.smartlead_campaign_cumulative(workspace_id);

CREATE INDEX IF NOT EXISTS idx_smartlead_campaign_cumulative_campaign 
ON public.smartlead_campaign_cumulative(campaign_id);