-- =============================================================
-- Data Reconciliation STEP 3: Fix orphaned email_activities engagement_id
-- =============================================================

UPDATE public.email_activities ea
SET engagement_id = c.engagement_id
FROM public.campaigns c
WHERE ea.campaign_id = c.id
  AND ea.engagement_id != c.engagement_id;