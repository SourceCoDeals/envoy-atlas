-- Fix positive reply rate tracking
-- The classify-replies function stores 'meeting_request' and 'interested' for positive replies
-- But queries were checking for 'positive' which is never stored

-- 1. Drop the existing view first to recreate with new column order
DROP VIEW IF EXISTS public.copy_performance;

-- 2. Recreate the copy_performance view with correct positive reply counting
CREATE VIEW public.copy_performance AS
SELECT 
  cv.id AS variant_id,
  cv.campaign_id,
  c.engagement_id,
  cv.subject_line,
  cv.body_preview,
  cv.step_number,
  cv.variant_label,
  cv.total_sent,
  cv.total_opened,
  cv.total_replied,
  cv.total_bounced,
  cv.open_rate,
  cv.reply_rate,
  cv.bounce_rate,
  COALESCE(cv.positive_replies, 0) AS positive_replies,
  cv.positive_reply_rate,
  cv.first_sent_at,
  cv.last_sent_at,
  cv.confidence_level,
  cv.sample_size_sufficient
FROM public.campaign_variants cv
LEFT JOIN public.campaigns c ON c.id = cv.campaign_id;

-- 3. Backfill positive_replies in daily_metrics from existing classifications
WITH positive_counts AS (
  SELECT 
    engagement_id,
    campaign_id,
    DATE(COALESCE(replied_at, sent_at)) as metric_date,
    COUNT(*) as positive_count
  FROM public.email_activities
  WHERE replied = true
    AND reply_category IN ('meeting_request', 'interested')
  GROUP BY engagement_id, campaign_id, DATE(COALESCE(replied_at, sent_at))
)
UPDATE public.daily_metrics dm
SET positive_replies = COALESCE(pc.positive_count, 0),
    updated_at = NOW()
FROM positive_counts pc
WHERE dm.engagement_id = pc.engagement_id
  AND dm.campaign_id = pc.campaign_id
  AND dm.date = pc.metric_date;

-- 4. Backfill campaign positive_replies from email_activities
WITH campaign_positives AS (
  SELECT 
    campaign_id,
    COUNT(*) as positive_count
  FROM public.email_activities
  WHERE replied = true
    AND reply_category IN ('meeting_request', 'interested')
  GROUP BY campaign_id
)
UPDATE public.campaigns c
SET positive_replies = COALESCE(cp.positive_count, 0),
    positive_rate = CASE 
      WHEN COALESCE(c.total_replied, 0) > 0 
      THEN (COALESCE(cp.positive_count, 0)::numeric / c.total_replied) * 100 
      ELSE 0 
    END,
    updated_at = NOW()
FROM campaign_positives cp
WHERE c.id = cp.campaign_id;

-- 5. Backfill campaign_variants positive_replies
WITH variant_positives AS (
  SELECT 
    variant_id,
    COUNT(*) as positive_count
  FROM public.email_activities
  WHERE replied = true
    AND reply_category IN ('meeting_request', 'interested')
    AND variant_id IS NOT NULL
  GROUP BY variant_id
)
UPDATE public.campaign_variants cv
SET positive_replies = COALESCE(vp.positive_count, 0),
    positive_reply_rate = CASE 
      WHEN COALESCE(cv.total_replied, 0) > 0 
      THEN (COALESCE(vp.positive_count, 0)::numeric / cv.total_replied)
      ELSE 0 
    END,
    updated_at = NOW()
FROM variant_positives vp
WHERE cv.id = vp.variant_id;

-- 6. Create trigger function to update daily_metrics after reply classification
CREATE OR REPLACE FUNCTION public.update_daily_positive_replies()
RETURNS TRIGGER AS $$
BEGIN
  -- When reply_category is set to a positive category
  IF NEW.reply_category IN ('meeting_request', 'interested') THEN
    -- If this is a new positive classification (wasn't positive before)
    IF OLD.reply_category IS NULL OR OLD.reply_category NOT IN ('meeting_request', 'interested') THEN
      -- Update daily_metrics
      UPDATE public.daily_metrics
      SET positive_replies = COALESCE(positive_replies, 0) + 1,
          updated_at = NOW()
      WHERE engagement_id = NEW.engagement_id
        AND campaign_id = NEW.campaign_id
        AND date = DATE(COALESCE(NEW.replied_at, NEW.sent_at, NOW()));
      
      -- Update campaign totals
      UPDATE public.campaigns
      SET positive_replies = COALESCE(positive_replies, 0) + 1,
          positive_rate = CASE 
            WHEN COALESCE(total_replied, 0) > 0 
            THEN ((COALESCE(positive_replies, 0) + 1)::numeric / total_replied) * 100 
            ELSE 0 
          END,
          updated_at = NOW()
      WHERE id = NEW.campaign_id;
      
      -- Update variant totals if variant_id is set
      IF NEW.variant_id IS NOT NULL THEN
        UPDATE public.campaign_variants
        SET positive_replies = COALESCE(positive_replies, 0) + 1,
            positive_reply_rate = CASE 
              WHEN COALESCE(total_replied, 0) > 0 
              THEN ((COALESCE(positive_replies, 0) + 1)::numeric / total_replied)
              ELSE 0 
            END,
            updated_at = NOW()
        WHERE id = NEW.variant_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Create trigger on email_activities
DROP TRIGGER IF EXISTS trigger_update_positive_replies ON public.email_activities;
CREATE TRIGGER trigger_update_positive_replies
AFTER UPDATE OF reply_category ON public.email_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_daily_positive_replies();