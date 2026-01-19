-- ISP Deliverability Tracking Table
CREATE TABLE IF NOT EXISTS public.isp_deliverability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  isp_name TEXT NOT NULL,
  metric_date DATE NOT NULL,
  
  -- Volume metrics
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  
  -- Engagement metrics
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  
  -- Bounce breakdown
  hard_bounce_count INTEGER DEFAULT 0,
  soft_bounce_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(engagement_id, campaign_id, isp_name, metric_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_isp_deliverability_engagement ON isp_deliverability(engagement_id);
CREATE INDEX IF NOT EXISTS idx_isp_deliverability_date ON isp_deliverability(metric_date);
CREATE INDEX IF NOT EXISTS idx_isp_deliverability_isp ON isp_deliverability(isp_name);

-- RLS
ALTER TABLE isp_deliverability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read isp_deliverability" ON isp_deliverability FOR SELECT USING (true);
CREATE POLICY "Service write isp_deliverability" ON isp_deliverability FOR ALL USING (true);

-- ISP Classification Function
CREATE OR REPLACE FUNCTION public.classify_email_isp(email_address TEXT)
RETURNS TEXT AS $$
DECLARE
  domain TEXT;
BEGIN
  IF email_address IS NULL THEN RETURN 'other'; END IF;
  domain := LOWER(SPLIT_PART(email_address, '@', 2));
  
  RETURN CASE
    WHEN domain IN ('gmail.com', 'googlemail.com') OR domain LIKE '%.google.com' THEN 'gmail'
    WHEN domain IN ('outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'microsoft.com') 
      OR domain LIKE '%.outlook.com' 
      OR domain LIKE '%.onmicrosoft.com' THEN 'outlook'
    WHEN domain IN ('yahoo.com', 'yahoo.co.uk', 'aol.com', 'verizon.net', 'ymail.com') THEN 'yahoo'
    WHEN domain IN ('icloud.com', 'me.com', 'mac.com') THEN 'apple'
    ELSE 'corporate'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Variant Decay: Add proper DB function for weekly stats
CREATE OR REPLACE FUNCTION public.get_variant_weekly_stats(p_variant_id UUID)
RETURNS TABLE (
  week_start DATE,
  sent BIGINT,
  opened BIGINT,
  replied BIGINT,
  positive BIGINT,
  bounced BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('week', ea.sent_at)::DATE as week_start,
    COUNT(*) as sent,
    COUNT(*) FILTER (WHERE ea.opened) as opened,
    COUNT(*) FILTER (WHERE ea.replied) as replied,
    COUNT(*) FILTER (WHERE ea.reply_category = 'positive' OR ea.is_interested = true) as positive,
    COUNT(*) FILTER (WHERE ea.bounced) as bounced
  FROM email_activities ea
  WHERE ea.variant_id = p_variant_id
    AND ea.sent_at IS NOT NULL
  GROUP BY DATE_TRUNC('week', ea.sent_at)
  ORDER BY week_start;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Ensure variant_decay_tracking has correct structure
DO $$
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'variant_decay_tracking' AND column_name = 'week_start') THEN
    ALTER TABLE variant_decay_tracking ADD COLUMN week_start DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'variant_decay_tracking' AND column_name = 'week_number') THEN
    ALTER TABLE variant_decay_tracking ADD COLUMN week_number INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'variant_decay_tracking' AND column_name = 'is_declining') THEN
    ALTER TABLE variant_decay_tracking ADD COLUMN is_declining BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'variant_decay_tracking' AND column_name = 'decline_severity') THEN
    ALTER TABLE variant_decay_tracking ADD COLUMN decline_severity TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'variant_decay_tracking' AND column_name = 'open_rate') THEN
    ALTER TABLE variant_decay_tracking ADD COLUMN open_rate NUMERIC(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'variant_decay_tracking' AND column_name = 'positive_rate') THEN
    ALTER TABLE variant_decay_tracking ADD COLUMN positive_rate NUMERIC(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'variant_decay_tracking' AND column_name = 'bounce_rate') THEN
    ALTER TABLE variant_decay_tracking ADD COLUMN bounce_rate NUMERIC(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'variant_decay_tracking' AND column_name = 'open_rate_change') THEN
    ALTER TABLE variant_decay_tracking ADD COLUMN open_rate_change NUMERIC(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'variant_decay_tracking' AND column_name = 'reply_rate_change') THEN
    ALTER TABLE variant_decay_tracking ADD COLUMN reply_rate_change NUMERIC(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'variant_decay_tracking' AND column_name = 'positive_rate_change') THEN
    ALTER TABLE variant_decay_tracking ADD COLUMN positive_rate_change NUMERIC(5,2);
  END IF;
END $$;

-- Add unique constraint for week-based tracking if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'variant_decay_tracking_variant_week_unique'
  ) THEN
    ALTER TABLE variant_decay_tracking 
    ADD CONSTRAINT variant_decay_tracking_variant_week_unique 
    UNIQUE (variant_id, week_start);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;