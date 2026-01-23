-- Add Total Bounces column to nocodb_smartlead_campaigns
ALTER TABLE public.nocodb_smartlead_campaigns
  ADD COLUMN IF NOT EXISTS total_bounces INTEGER DEFAULT 0;

-- Add index for bounce rate queries
CREATE INDEX IF NOT EXISTS idx_nocodb_smartlead_bounces 
  ON public.nocodb_smartlead_campaigns(total_bounces) 
  WHERE total_bounces > 0;