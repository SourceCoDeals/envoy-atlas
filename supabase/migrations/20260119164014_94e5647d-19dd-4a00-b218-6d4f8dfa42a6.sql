-- =============================================================
-- Fix the propagate_campaign_metrics_to_variants trigger to use decimal format
-- The rate columns use NUMERIC(5,4) which expects 0.0-1.0, not 0-100
-- =============================================================

CREATE OR REPLACE FUNCTION public.propagate_campaign_metrics_to_variants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
  -- Note: Rate columns use NUMERIC(5,4) so values must be decimals 0.0-1.0, not percentages
  UPDATE public.campaign_variants
  SET 
    total_sent = per_variant_sent,
    total_delivered = GREATEST(0, per_variant_sent - per_variant_bounced),
    total_opened = per_variant_opened,
    total_replied = per_variant_replied,
    total_bounced = per_variant_bounced,
    open_rate = LEAST(0.9999, CASE WHEN per_variant_sent > 0 
                     THEN (per_variant_opened::numeric / per_variant_sent) 
                     ELSE 0 END),
    reply_rate = LEAST(0.9999, CASE WHEN per_variant_sent > 0 
                      THEN (per_variant_replied::numeric / per_variant_sent) 
                      ELSE 0 END),
    bounce_rate = LEAST(0.9999, CASE WHEN per_variant_sent > 0 
                       THEN (per_variant_bounced::numeric / per_variant_sent) 
                       ELSE 0 END),
    delivery_rate = LEAST(0.9999, CASE WHEN per_variant_sent > 0 
                         THEN ((per_variant_sent - per_variant_bounced)::numeric / per_variant_sent) 
                         ELSE 0 END),
    updated_at = NOW()
  WHERE campaign_id = NEW.id 
    AND (total_sent IS NULL OR total_sent = 0);
  
  RETURN NEW;
END;
$function$;