-- ============================================================================
-- DATA INTEGRITY TRIGGERS
-- ============================================================================

-- 1. CAMPAIGN TOTALS SYNC TRIGGER
-- Keeps campaigns table totals in sync with daily_metrics aggregations
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_campaign_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if we have a campaign_id
  IF NEW.campaign_id IS NOT NULL THEN
    UPDATE public.campaigns 
    SET 
      total_sent = COALESCE((
        SELECT SUM(COALESCE(emails_sent, 0)) 
        FROM public.daily_metrics 
        WHERE campaign_id = NEW.campaign_id
      ), 0),
      total_delivered = COALESCE((
        SELECT SUM(COALESCE(emails_delivered, 0)) 
        FROM public.daily_metrics 
        WHERE campaign_id = NEW.campaign_id
      ), 0),
      total_opened = COALESCE((
        SELECT SUM(COALESCE(emails_opened, 0)) 
        FROM public.daily_metrics 
        WHERE campaign_id = NEW.campaign_id
      ), 0),
      total_replied = COALESCE((
        SELECT SUM(COALESCE(emails_replied, 0)) 
        FROM public.daily_metrics 
        WHERE campaign_id = NEW.campaign_id
      ), 0),
      total_bounced = COALESCE((
        SELECT SUM(COALESCE(emails_bounced, 0)) 
        FROM public.daily_metrics 
        WHERE campaign_id = NEW.campaign_id
      ), 0),
      positive_replies = COALESCE((
        SELECT SUM(COALESCE(positive_replies, 0)) 
        FROM public.daily_metrics 
        WHERE campaign_id = NEW.campaign_id
      ), 0),
      updated_at = NOW()
    WHERE id = NEW.campaign_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_campaign_totals ON public.daily_metrics;
CREATE TRIGGER trg_sync_campaign_totals
AFTER INSERT OR UPDATE ON public.daily_metrics
FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_totals();


-- 2. RATE VALIDATION TRIGGER
-- Auto-corrects rates on campaigns table to match calculated values
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_campaign_rates()
RETURNS TRIGGER AS $$
BEGIN
  -- Only recalculate if totals changed
  IF NEW.total_sent IS DISTINCT FROM OLD.total_sent OR
     NEW.total_replied IS DISTINCT FROM OLD.total_replied OR
     NEW.total_bounced IS DISTINCT FROM OLD.total_bounced OR
     NEW.total_opened IS DISTINCT FROM OLD.total_opened OR
     NEW.positive_replies IS DISTINCT FROM OLD.positive_replies THEN
    
    -- Auto-correct rates if they drift
    NEW.reply_rate := CASE 
      WHEN COALESCE(NEW.total_sent, 0) > 0 
      THEN ROUND((COALESCE(NEW.total_replied, 0)::numeric / NEW.total_sent) * 100, 2) 
      ELSE 0 
    END;
    
    NEW.bounce_rate := CASE 
      WHEN COALESCE(NEW.total_sent, 0) > 0 
      THEN ROUND((COALESCE(NEW.total_bounced, 0)::numeric / NEW.total_sent) * 100, 2) 
      ELSE 0 
    END;
    
    NEW.open_rate := CASE 
      WHEN COALESCE(NEW.total_sent, 0) > 0 
      THEN ROUND((COALESCE(NEW.total_opened, 0)::numeric / NEW.total_sent) * 100, 2) 
      ELSE 0 
    END;
    
    NEW.positive_rate := CASE 
      WHEN COALESCE(NEW.total_sent, 0) > 0 
      THEN ROUND((COALESCE(NEW.positive_replies, 0)::numeric / NEW.total_sent) * 100, 2) 
      ELSE 0 
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_validate_campaign_rates ON public.campaigns;
CREATE TRIGGER trg_validate_campaign_rates
BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_rates();


-- 3. POSITIVE REPLY SYNC FROM EMAIL ACTIVITIES
-- When email_activities.reply_category changes, update daily_metrics
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_positive_replies_from_activities()
RETURNS TRIGGER AS $$
DECLARE
  activity_date DATE;
  old_is_positive BOOLEAN;
  new_is_positive BOOLEAN;
  delta INT;
BEGIN
  -- Determine the date for this activity
  activity_date := DATE(COALESCE(NEW.replied_at, NEW.sent_at, NOW()));
  
  -- Check if categories are positive
  old_is_positive := COALESCE(OLD.reply_category, '') IN ('meeting_request', 'interested');
  new_is_positive := COALESCE(NEW.reply_category, '') IN ('meeting_request', 'interested');
  
  -- Calculate delta
  delta := 0;
  IF new_is_positive AND NOT old_is_positive THEN
    delta := 1;
  ELSIF NOT new_is_positive AND old_is_positive THEN
    delta := -1;
  END IF;
  
  -- Update daily_metrics if there's a change
  IF delta != 0 AND NEW.campaign_id IS NOT NULL THEN
    UPDATE public.daily_metrics
    SET 
      positive_replies = GREATEST(0, COALESCE(positive_replies, 0) + delta),
      updated_at = NOW()
    WHERE campaign_id = NEW.campaign_id
      AND engagement_id = NEW.engagement_id
      AND date = activity_date;
    
    -- If no row was updated, we might need to handle this differently
    -- For now, the daily_metrics row should already exist from sync
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_positive_replies ON public.email_activities;
CREATE TRIGGER trg_sync_positive_replies
AFTER UPDATE OF reply_category ON public.email_activities
FOR EACH ROW EXECUTE FUNCTION public.sync_positive_replies_from_activities();


-- 4. VARIANT METRICS SYNC TRIGGER
-- Keeps campaign_variants totals in sync when daily_metrics updates
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_variant_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if we have a variant_id
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.campaign_variants 
    SET 
      total_sent = COALESCE((
        SELECT SUM(COALESCE(emails_sent, 0)) 
        FROM public.daily_metrics 
        WHERE variant_id = NEW.variant_id
      ), 0),
      total_delivered = COALESCE((
        SELECT SUM(COALESCE(emails_delivered, 0)) 
        FROM public.daily_metrics 
        WHERE variant_id = NEW.variant_id
      ), 0),
      total_opened = COALESCE((
        SELECT SUM(COALESCE(emails_opened, 0)) 
        FROM public.daily_metrics 
        WHERE variant_id = NEW.variant_id
      ), 0),
      total_replied = COALESCE((
        SELECT SUM(COALESCE(emails_replied, 0)) 
        FROM public.daily_metrics 
        WHERE variant_id = NEW.variant_id
      ), 0),
      total_bounced = COALESCE((
        SELECT SUM(COALESCE(emails_bounced, 0)) 
        FROM public.daily_metrics 
        WHERE variant_id = NEW.variant_id
      ), 0),
      positive_replies = COALESCE((
        SELECT SUM(COALESCE(positive_replies, 0)) 
        FROM public.daily_metrics 
        WHERE variant_id = NEW.variant_id
      ), 0),
      -- Also update rates
      reply_rate = CASE 
        WHEN COALESCE((SELECT SUM(COALESCE(emails_sent, 0)) FROM public.daily_metrics WHERE variant_id = NEW.variant_id), 0) > 0 
        THEN (
          COALESCE((SELECT SUM(COALESCE(emails_replied, 0)) FROM public.daily_metrics WHERE variant_id = NEW.variant_id), 0)::numeric /
          COALESCE((SELECT SUM(COALESCE(emails_sent, 0)) FROM public.daily_metrics WHERE variant_id = NEW.variant_id), 1)
        )
        ELSE 0 
      END,
      bounce_rate = CASE 
        WHEN COALESCE((SELECT SUM(COALESCE(emails_sent, 0)) FROM public.daily_metrics WHERE variant_id = NEW.variant_id), 0) > 0 
        THEN (
          COALESCE((SELECT SUM(COALESCE(emails_bounced, 0)) FROM public.daily_metrics WHERE variant_id = NEW.variant_id), 0)::numeric /
          COALESCE((SELECT SUM(COALESCE(emails_sent, 0)) FROM public.daily_metrics WHERE variant_id = NEW.variant_id), 1)
        )
        ELSE 0 
      END,
      updated_at = NOW()
    WHERE id = NEW.variant_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_variant_totals ON public.daily_metrics;
CREATE TRIGGER trg_sync_variant_totals
AFTER INSERT OR UPDATE ON public.daily_metrics
FOR EACH ROW EXECUTE FUNCTION public.sync_variant_totals();