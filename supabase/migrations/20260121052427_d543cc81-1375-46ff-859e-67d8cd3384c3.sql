-- =============================================
-- ATOMIC METRIC FUNCTIONS
-- Fix race conditions in concurrent webhook processing
-- =============================================

-- Function to atomically increment campaign metrics
CREATE OR REPLACE FUNCTION public.increment_campaign_metric(
  p_campaign_id UUID,
  p_metric_name TEXT,
  p_value INTEGER DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use a single UPDATE with CASE to handle any metric field
  UPDATE campaigns SET
    total_sent = CASE WHEN p_metric_name = 'total_sent' THEN COALESCE(total_sent, 0) + p_value ELSE total_sent END,
    total_opened = CASE WHEN p_metric_name = 'total_opened' THEN COALESCE(total_opened, 0) + p_value ELSE total_opened END,
    total_replied = CASE WHEN p_metric_name = 'total_replied' THEN COALESCE(total_replied, 0) + p_value ELSE total_replied END,
    total_bounced = CASE WHEN p_metric_name = 'total_bounced' THEN COALESCE(total_bounced, 0) + p_value ELSE total_bounced END,
    total_delivered = CASE WHEN p_metric_name = 'total_delivered' THEN COALESCE(total_delivered, 0) + p_value ELSE total_delivered END,
    positive_replies = CASE WHEN p_metric_name = 'positive_replies' THEN COALESCE(positive_replies, 0) + p_value ELSE positive_replies END,
    updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$;

-- Function to atomically increment variant metrics
CREATE OR REPLACE FUNCTION public.increment_variant_metric(
  p_variant_id UUID,
  p_metric_name TEXT,
  p_value INTEGER DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE campaign_variants SET
    total_sent = CASE WHEN p_metric_name = 'total_sent' THEN COALESCE(total_sent, 0) + p_value ELSE total_sent END,
    total_opened = CASE WHEN p_metric_name = 'total_opened' THEN COALESCE(total_opened, 0) + p_value ELSE total_opened END,
    total_replied = CASE WHEN p_metric_name = 'total_replied' THEN COALESCE(total_replied, 0) + p_value ELSE total_replied END,
    total_bounced = CASE WHEN p_metric_name = 'total_bounced' THEN COALESCE(total_bounced, 0) + p_value ELSE total_bounced END,
    total_delivered = CASE WHEN p_metric_name = 'total_delivered' THEN COALESCE(total_delivered, 0) + p_value ELSE total_delivered END,
    positive_replies = CASE WHEN p_metric_name = 'positive_replies' THEN COALESCE(positive_replies, 0) + p_value ELSE positive_replies END,
    updated_at = NOW()
  WHERE id = p_variant_id;
END;
$$;

-- Function to atomically upsert hourly metrics with proper conflict handling
CREATE OR REPLACE FUNCTION public.upsert_hourly_metric(
  p_engagement_id UUID,
  p_campaign_id UUID,
  p_hour_of_day INTEGER,
  p_day_of_week INTEGER,
  p_metric_date DATE,
  p_metric_name TEXT,
  p_value INTEGER DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  -- Try to find existing record
  SELECT id INTO v_existing_id
  FROM hourly_metrics
  WHERE engagement_id = p_engagement_id
    AND campaign_id = p_campaign_id
    AND hour_of_day = p_hour_of_day
    AND day_of_week = p_day_of_week
    AND metric_date = p_metric_date
  FOR UPDATE;  -- Lock the row to prevent concurrent updates
  
  IF v_existing_id IS NOT NULL THEN
    -- Update existing record atomically
    EXECUTE format('UPDATE hourly_metrics SET %I = COALESCE(%I, 0) + $1, updated_at = NOW() WHERE id = $2',
      p_metric_name, p_metric_name)
    USING p_value, v_existing_id;
  ELSE
    -- Insert new record
    INSERT INTO hourly_metrics (
      engagement_id, campaign_id, hour_of_day, day_of_week, metric_date,
      emails_sent, emails_opened, emails_clicked, emails_replied, emails_bounced
    )
    VALUES (
      p_engagement_id, p_campaign_id, p_hour_of_day, p_day_of_week, p_metric_date,
      CASE WHEN p_metric_name = 'emails_sent' THEN p_value ELSE 0 END,
      CASE WHEN p_metric_name = 'emails_opened' THEN p_value ELSE 0 END,
      CASE WHEN p_metric_name = 'emails_clicked' THEN p_value ELSE 0 END,
      CASE WHEN p_metric_name = 'emails_replied' THEN p_value ELSE 0 END,
      CASE WHEN p_metric_name = 'emails_bounced' THEN p_value ELSE 0 END
    );
  END IF;
END;
$$;

-- Function to atomically upsert daily metrics
CREATE OR REPLACE FUNCTION public.upsert_daily_metric(
  p_engagement_id UUID,
  p_campaign_id UUID,
  p_date DATE,
  p_metric_name TEXT,
  p_value INTEGER DEFAULT 1,
  p_variant_id UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  -- Try to find existing record
  SELECT id INTO v_existing_id
  FROM daily_metrics
  WHERE engagement_id = p_engagement_id
    AND campaign_id = p_campaign_id
    AND date = p_date
    AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL))
  FOR UPDATE;
  
  IF v_existing_id IS NOT NULL THEN
    EXECUTE format('UPDATE daily_metrics SET %I = COALESCE(%I, 0) + $1, updated_at = NOW() WHERE id = $2',
      p_metric_name, p_metric_name)
    USING p_value, v_existing_id;
  ELSE
    INSERT INTO daily_metrics (
      engagement_id, campaign_id, date, variant_id,
      emails_sent, emails_delivered, emails_opened, emails_replied, emails_bounced, positive_replies
    )
    VALUES (
      p_engagement_id, p_campaign_id, p_date, p_variant_id,
      CASE WHEN p_metric_name = 'emails_sent' THEN p_value ELSE 0 END,
      CASE WHEN p_metric_name = 'emails_delivered' THEN p_value ELSE 0 END,
      CASE WHEN p_metric_name = 'emails_opened' THEN p_value ELSE 0 END,
      CASE WHEN p_metric_name = 'emails_replied' THEN p_value ELSE 0 END,
      CASE WHEN p_metric_name = 'emails_bounced' THEN p_value ELSE 0 END,
      CASE WHEN p_metric_name = 'positive_replies' THEN p_value ELSE 0 END
    );
  END IF;
END;
$$;

-- Grant execute permissions to service role (edge functions run with service role)
GRANT EXECUTE ON FUNCTION public.increment_campaign_metric TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_variant_metric TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_hourly_metric TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_daily_metric TO service_role;