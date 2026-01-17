-- Add engagement_id to both campaign tables
ALTER TABLE public.smartlead_campaigns 
ADD COLUMN IF NOT EXISTS engagement_id UUID REFERENCES public.engagements(id) ON DELETE SET NULL;

ALTER TABLE public.replyio_campaigns 
ADD COLUMN IF NOT EXISTS engagement_id UUID REFERENCES public.engagements(id) ON DELETE SET NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_smartlead_campaigns_engagement_id ON public.smartlead_campaigns(engagement_id);
CREATE INDEX IF NOT EXISTS idx_replyio_campaigns_engagement_id ON public.replyio_campaigns(engagement_id);