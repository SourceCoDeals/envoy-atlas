-- Fix the validate_campaign_rates trigger to store rates as decimals (0.0-1.0) not percentages
-- This resolves the "numeric field overflow" error when rates exceed 0.9999

CREATE OR REPLACE FUNCTION public.validate_campaign_rates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  delivered numeric;
BEGIN
  -- Calculate delivered = sent - bounced
  delivered := GREATEST(0, COALESCE(NEW.total_sent, 0) - COALESCE(NEW.total_bounced, 0));
  
  IF NEW.total_sent IS DISTINCT FROM OLD.total_sent OR
     NEW.total_replied IS DISTINCT FROM OLD.total_replied OR
     NEW.total_bounced IS DISTINCT FROM OLD.total_bounced OR
     NEW.total_opened IS DISTINCT FROM OLD.total_opened OR
     NEW.positive_replies IS DISTINCT FROM OLD.positive_replies THEN
    
    -- Store rates as decimals (0.0-1.0) not percentages to fit NUMERIC(5,4) columns
    NEW.reply_rate := CASE 
      WHEN delivered > 0 
      THEN LEAST(0.9999, ROUND((COALESCE(NEW.total_replied, 0)::numeric / delivered), 4))
      ELSE 0 
    END;
    
    NEW.open_rate := CASE 
      WHEN delivered > 0 
      THEN LEAST(0.9999, ROUND((COALESCE(NEW.total_opened, 0)::numeric / delivered), 4))
      ELSE 0 
    END;
    
    NEW.positive_rate := CASE 
      WHEN delivered > 0 
      THEN LEAST(0.9999, ROUND((COALESCE(NEW.positive_replies, 0)::numeric / delivered), 4))
      ELSE 0 
    END;
    
    -- Bounce rate uses sent as denominator
    NEW.bounce_rate := CASE 
      WHEN COALESCE(NEW.total_sent, 0) > 0 
      THEN LEAST(0.9999, ROUND((COALESCE(NEW.total_bounced, 0)::numeric / NEW.total_sent), 4))
      ELSE 0 
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;