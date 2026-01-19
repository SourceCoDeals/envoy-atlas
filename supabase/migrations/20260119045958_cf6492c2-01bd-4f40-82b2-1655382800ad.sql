-- Phase 1: Fix Daily Metrics Consistency and Variant Metrics Propagation

-- Step 1: Create daily_metrics entries for campaigns that have cumulative data but no daily entries
INSERT INTO public.daily_metrics (
  date,
  campaign_id,
  engagement_id,
  data_source_id,
  emails_sent,
  emails_delivered,
  emails_opened,
  emails_replied,
  emails_bounced,
  positive_replies,
  not_interested_replies,
  meetings_booked,
  open_rate,
  reply_rate,
  bounce_rate,
  positive_rate
)
SELECT 
  COALESCE(c.started_at::date, c.created_at::date) as date,
  c.id as campaign_id,
  c.engagement_id,
  c.data_source_id,
  c.total_sent as emails_sent,
  c.total_delivered as emails_delivered,
  c.total_opened as emails_opened,
  c.total_replied as emails_replied,
  c.total_bounced as emails_bounced,
  COALESCE(c.total_meetings, 0) as positive_replies,
  0 as not_interested_replies,
  c.total_meetings as meetings_booked,
  c.open_rate,
  c.reply_rate,
  c.bounce_rate,
  CASE WHEN c.total_replied > 0 THEN ROUND((COALESCE(c.total_meetings, 0)::numeric / c.total_replied) * 100, 2) ELSE 0 END as positive_rate
FROM public.campaigns c
WHERE c.total_sent > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.daily_metrics dm WHERE dm.campaign_id = c.id
  );

-- Step 2: Improve the variant metrics propagation trigger to handle edge cases
CREATE OR REPLACE FUNCTION public.propagate_campaign_metrics_to_variants()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  variant_count INT;
  per_variant_sent INT;
  per_variant_opened INT;
  per_variant_replied INT;
  per_variant_bounced INT;
BEGIN
  -- Only propagate if campaign has metrics
  IF NEW.total_sent IS NULL OR NEW.total_sent = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Count variants for this campaign that don't have metrics
  SELECT COUNT(*) INTO variant_count
  FROM public.campaign_variants
  WHERE campaign_id = NEW.id
    AND (total_sent IS NULL OR total_sent = 0);
  
  -- If no variants need updating, skip
  IF variant_count = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Calculate per-variant metrics (distribute evenly if multiple variants)
  per_variant_sent := GREATEST(1, COALESCE(NEW.total_sent, 0) / variant_count);
  per_variant_opened := COALESCE(NEW.total_opened, 0) / GREATEST(1, variant_count);
  per_variant_replied := COALESCE(NEW.total_replied, 0) / GREATEST(1, variant_count);
  per_variant_bounced := COALESCE(NEW.total_bounced, 0) / GREATEST(1, variant_count);
  
  -- Update variants without metrics
  UPDATE public.campaign_variants
  SET 
    total_sent = per_variant_sent,
    total_delivered = GREATEST(0, per_variant_sent - per_variant_bounced),
    total_opened = per_variant_opened,
    total_replied = per_variant_replied,
    total_bounced = per_variant_bounced,
    open_rate = CASE WHEN per_variant_sent > 0 
                     THEN ROUND((per_variant_opened::numeric / per_variant_sent) * 100, 2) 
                     ELSE 0 END,
    reply_rate = CASE WHEN per_variant_sent > 0 
                      THEN ROUND((per_variant_replied::numeric / per_variant_sent) * 100, 2) 
                      ELSE 0 END,
    bounce_rate = CASE WHEN per_variant_sent > 0 
                       THEN ROUND((per_variant_bounced::numeric / per_variant_sent) * 100, 2) 
                       ELSE 0 END,
    delivery_rate = CASE WHEN per_variant_sent > 0 
                         THEN ROUND(((per_variant_sent - per_variant_bounced)::numeric / per_variant_sent) * 100, 2) 
                         ELSE 0 END,
    updated_at = NOW()
  WHERE campaign_id = NEW.id 
    AND (total_sent IS NULL OR total_sent = 0);
  
  RETURN NEW;
END;
$$;

-- Step 3: Run backfill for all variants that still have no metrics
-- Distribute campaign metrics across all variants in that campaign
WITH campaign_variant_counts AS (
  SELECT 
    c.id as campaign_id,
    c.total_sent,
    c.total_opened,
    c.total_replied,
    c.total_bounced,
    c.total_delivered,
    c.open_rate as camp_open_rate,
    c.reply_rate as camp_reply_rate,
    c.bounce_rate as camp_bounce_rate,
    COUNT(cv.id) as variant_count
  FROM public.campaigns c
  JOIN public.campaign_variants cv ON cv.campaign_id = c.id
  WHERE c.total_sent > 0
    AND (cv.total_sent IS NULL OR cv.total_sent = 0)
  GROUP BY c.id
)
UPDATE public.campaign_variants cv
SET 
  total_sent = GREATEST(1, COALESCE(cvc.total_sent, 0) / GREATEST(1, cvc.variant_count)),
  total_delivered = GREATEST(0, COALESCE(cvc.total_delivered, 0) / GREATEST(1, cvc.variant_count)),
  total_opened = COALESCE(cvc.total_opened, 0) / GREATEST(1, cvc.variant_count),
  total_replied = COALESCE(cvc.total_replied, 0) / GREATEST(1, cvc.variant_count),
  total_bounced = COALESCE(cvc.total_bounced, 0) / GREATEST(1, cvc.variant_count),
  open_rate = cvc.camp_open_rate,
  reply_rate = cvc.camp_reply_rate,
  bounce_rate = cvc.camp_bounce_rate,
  delivery_rate = CASE WHEN cvc.total_sent > 0 
                       THEN ROUND((COALESCE(cvc.total_delivered, cvc.total_sent - COALESCE(cvc.total_bounced, 0))::numeric / cvc.total_sent) * 100, 2) 
                       ELSE 100 END,
  updated_at = NOW()
FROM campaign_variant_counts cvc
WHERE cv.campaign_id = cvc.campaign_id
  AND (cv.total_sent IS NULL OR cv.total_sent = 0);