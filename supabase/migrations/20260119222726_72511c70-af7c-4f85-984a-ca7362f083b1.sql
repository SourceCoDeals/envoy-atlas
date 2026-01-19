-- =============================================
-- FIX 1: Create trigger for positive_replies auto-update
-- =============================================

-- Drop trigger if exists (to recreate cleanly)
DROP TRIGGER IF EXISTS trigger_update_positive_replies ON public.email_activities;

-- Create the trigger on email_activities
CREATE TRIGGER trigger_update_positive_replies
  AFTER UPDATE OF reply_category ON public.email_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_daily_positive_replies();

-- =============================================
-- FIX 2: Create sending_domains table
-- =============================================

CREATE TABLE IF NOT EXISTS public.sending_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engagement_id UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  domain TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  -- Authentication status
  spf_status TEXT DEFAULT 'unknown', -- 'pass', 'fail', 'unknown'
  dkim_status TEXT DEFAULT 'unknown',
  dmarc_status TEXT DEFAULT 'unknown',
  spf_record TEXT,
  dkim_record TEXT,
  dmarc_record TEXT,
  -- Health metrics
  health_score NUMERIC(5,2) DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  bounce_rate NUMERIC(5,4) DEFAULT 0,
  spam_complaint_rate NUMERIC(5,4) DEFAULT 0,
  -- Timestamps
  last_verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Unique constraint
  CONSTRAINT sending_domains_engagement_domain_key UNIQUE (engagement_id, domain)
);

-- Enable RLS
ALTER TABLE public.sending_domains ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view sending_domains for their engagements" 
ON public.sending_domains FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.engagements e
    JOIN public.client_members cm ON cm.client_id = e.client_id
    WHERE e.id = sending_domains.engagement_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert sending_domains for their engagements" 
ON public.sending_domains FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.engagements e
    JOIN public.client_members cm ON cm.client_id = e.client_id
    WHERE e.id = engagement_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update sending_domains for their engagements" 
ON public.sending_domains FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.engagements e
    JOIN public.client_members cm ON cm.client_id = e.client_id
    WHERE e.id = sending_domains.engagement_id AND cm.user_id = auth.uid()
  )
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sending_domains_engagement ON public.sending_domains(engagement_id);
CREATE INDEX IF NOT EXISTS idx_sending_domains_domain ON public.sending_domains(domain);

-- Add updated_at trigger
CREATE TRIGGER update_sending_domains_updated_at
  BEFORE UPDATE ON public.sending_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FIX 3: Backfill positive_replies from existing classified replies
-- =============================================

-- Update daily_metrics positive_replies from email_activities
WITH positive_counts AS (
  SELECT 
    engagement_id,
    campaign_id,
    DATE(COALESCE(replied_at, sent_at)) as date,
    COUNT(*) as positive_count
  FROM public.email_activities
  WHERE reply_category IN ('meeting_request', 'interested')
    AND campaign_id IS NOT NULL
    AND engagement_id IS NOT NULL
  GROUP BY engagement_id, campaign_id, DATE(COALESCE(replied_at, sent_at))
)
UPDATE public.daily_metrics dm
SET positive_replies = pc.positive_count,
    positive_rate = CASE WHEN dm.emails_replied > 0 
      THEN (pc.positive_count::numeric / dm.emails_replied) * 100 
      ELSE 0 END,
    updated_at = NOW()
FROM positive_counts pc
WHERE dm.engagement_id = pc.engagement_id
  AND dm.campaign_id = pc.campaign_id
  AND dm.date = pc.date;

-- Update campaigns positive_replies from email_activities
WITH campaign_positive AS (
  SELECT 
    campaign_id,
    COUNT(*) as positive_count
  FROM public.email_activities
  WHERE reply_category IN ('meeting_request', 'interested')
    AND campaign_id IS NOT NULL
  GROUP BY campaign_id
)
UPDATE public.campaigns c
SET positive_replies = cp.positive_count,
    positive_rate = CASE WHEN c.total_replied > 0 
      THEN (cp.positive_count::numeric / c.total_replied) * 100 
      ELSE 0 END,
    updated_at = NOW()
FROM campaign_positive cp
WHERE c.id = cp.campaign_id;

-- Update campaign_variants positive_replies from email_activities
WITH variant_positive AS (
  SELECT 
    variant_id,
    COUNT(*) as positive_count
  FROM public.email_activities
  WHERE reply_category IN ('meeting_request', 'interested')
    AND variant_id IS NOT NULL
  GROUP BY variant_id
)
UPDATE public.campaign_variants cv
SET positive_replies = vp.positive_count,
    positive_reply_rate = CASE WHEN cv.total_replied > 0 
      THEN (vp.positive_count::numeric / cv.total_replied)
      ELSE 0 END,
    updated_at = NOW()
FROM variant_positive vp
WHERE cv.id = vp.variant_id;