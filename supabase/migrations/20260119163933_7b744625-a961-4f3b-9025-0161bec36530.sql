-- =============================================================
-- Data Reconciliation STEP 1: Fix orphaned daily_metrics engagement_id
-- =============================================================

-- Update daily_metrics to use the campaign's actual engagement_id
-- This fixes orphaned metrics that were incorrectly assigned to "Default Engagement"
UPDATE public.daily_metrics dm
SET engagement_id = c.engagement_id
FROM public.campaigns c
WHERE dm.campaign_id = c.id
  AND dm.engagement_id != c.engagement_id;