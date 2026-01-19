-- Add positive_replies and positive_rate to campaigns table
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS positive_replies integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS positive_rate numeric DEFAULT 0;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_positive_rate ON public.campaigns(positive_rate DESC NULLS LAST);