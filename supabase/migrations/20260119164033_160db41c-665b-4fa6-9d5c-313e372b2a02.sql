-- =============================================================
-- Data Reconciliation STEP 2: Backfill campaign totals from daily_metrics
-- Note: Rate columns use NUMERIC(5,4) so values must be decimals like 0.1234, not percentages
-- =============================================================

WITH aggregated AS (
  SELECT 
    campaign_id,
    SUM(COALESCE(emails_sent, 0))::bigint as total_sent,
    SUM(COALESCE(emails_opened, 0))::bigint as total_opened,
    SUM(COALESCE(emails_replied, 0))::bigint as total_replied,
    SUM(COALESCE(emails_bounced, 0))::bigint as total_bounced,
    SUM(COALESCE(positive_replies, 0))::bigint as positive_replies_sum
  FROM public.daily_metrics
  WHERE campaign_id IS NOT NULL
  GROUP BY campaign_id
  HAVING SUM(COALESCE(emails_sent, 0)) > 0
)
UPDATE public.campaigns c
SET 
  total_sent = a.total_sent::integer,
  total_opened = a.total_opened::integer,
  total_replied = a.total_replied::integer,
  total_bounced = a.total_bounced::integer,
  total_delivered = GREATEST(0, (a.total_sent - a.total_bounced)::integer),
  positive_replies = a.positive_replies_sum::integer,
  -- Use decimal format (0.0 to 1.0) to match NUMERIC(5,4) column precision
  open_rate = LEAST(0.9999, CASE WHEN a.total_sent > 0 THEN (a.total_opened::numeric / a.total_sent) ELSE 0 END),
  reply_rate = LEAST(0.9999, CASE WHEN a.total_sent > 0 THEN (a.total_replied::numeric / a.total_sent) ELSE 0 END),
  bounce_rate = LEAST(0.9999, CASE WHEN a.total_sent > 0 THEN (a.total_bounced::numeric / a.total_sent) ELSE 0 END),
  updated_at = NOW()
FROM aggregated a
WHERE c.id = a.campaign_id
  AND (c.total_sent IS NULL OR c.total_sent = 0);