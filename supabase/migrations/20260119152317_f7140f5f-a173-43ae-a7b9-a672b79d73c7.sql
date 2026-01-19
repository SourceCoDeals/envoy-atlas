-- Add industry and auto_created columns to engagements table
ALTER TABLE public.engagements 
ADD COLUMN IF NOT EXISTS industry VARCHAR(255),
ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT FALSE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_engagements_industry ON public.engagements(industry);
CREATE INDEX IF NOT EXISTS idx_engagements_auto_created ON public.engagements(auto_created);