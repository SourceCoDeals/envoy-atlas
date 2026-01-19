-- ============================================
-- DATA BRIDGE: Contact enrichment + Variant metric aggregation
-- ============================================

-- 1. Auto-classify contacts on insert/update
CREATE OR REPLACE FUNCTION public.auto_classify_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.title IS NOT NULL AND NEW.seniority_level IS NULL THEN
    -- Classify seniority
    NEW.seniority_level := CASE
      WHEN NEW.title ~* '\m(ceo|cfo|cto|coo|cmo|cio|chief|founder|owner|president)\M' THEN 'c_level'
      WHEN NEW.title ~* '\m(vp|vice.?president|svp|evp)\M' THEN 'vp'
      WHEN NEW.title ~* '\m(director|head.of)\M' THEN 'director'
      WHEN NEW.title ~* '\m(manager|lead|supervisor)\M' THEN 'manager'
      WHEN NEW.title ~* '\m(senior|sr\.|principal|staff)\M' THEN 'senior_ic'
      ELSE 'ic'
    END;
    
    -- Classify department
    NEW.department := CASE
      WHEN NEW.title ~* '\m(ceo|coo|founder|owner|president)\M' THEN 'executive'
      WHEN NEW.title ~* '\m(sales|account.executive|sdr|bdr|revenue)\M' THEN 'sales'
      WHEN NEW.title ~* '\m(marketing|growth|brand|content)\M' THEN 'marketing'
      WHEN NEW.title ~* '\m(engineer|developer|software|cto)\M' THEN 'engineering'
      WHEN NEW.title ~* '\m(product|pm|ux|design)\M' THEN 'product'
      WHEN NEW.title ~* '\m(operations|ops|logistics)\M' THEN 'operations'
      WHEN NEW.title ~* '\m(finance|cfo|accounting)\M' THEN 'finance'
      WHEN NEW.title ~* '\m(hr|human.resources|people|talent)\M' THEN 'hr'
      ELSE 'other'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS auto_classify_contact_trigger ON public.contacts;
CREATE TRIGGER auto_classify_contact_trigger
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_classify_contact();

-- 2. Backfill existing contacts with classifications
UPDATE public.contacts
SET 
  seniority_level = CASE
    WHEN title ~* '\m(ceo|cfo|cto|coo|cmo|cio|chief|founder|owner|president)\M' THEN 'c_level'
    WHEN title ~* '\m(vp|vice.?president|svp|evp)\M' THEN 'vp'
    WHEN title ~* '\m(director|head.of)\M' THEN 'director'
    WHEN title ~* '\m(manager|lead|supervisor)\M' THEN 'manager'
    WHEN title ~* '\m(senior|sr\.|principal|staff)\M' THEN 'senior_ic'
    ELSE 'ic'
  END,
  department = CASE
    WHEN title ~* '\m(ceo|coo|founder|owner|president)\M' THEN 'executive'
    WHEN title ~* '\m(sales|account.executive|sdr|bdr|revenue)\M' THEN 'sales'
    WHEN title ~* '\m(marketing|growth|brand|content)\M' THEN 'marketing'
    WHEN title ~* '\m(engineer|developer|software|cto)\M' THEN 'engineering'
    WHEN title ~* '\m(product|pm|ux|design)\M' THEN 'product'
    WHEN title ~* '\m(operations|ops|logistics)\M' THEN 'operations'
    WHEN title ~* '\m(finance|cfo|accounting)\M' THEN 'finance'
    WHEN title ~* '\m(hr|human.resources|people|talent)\M' THEN 'hr'
    ELSE 'other'
  END
WHERE title IS NOT NULL AND seniority_level IS NULL;

-- 3. Function to propagate campaign metrics to variants
CREATE OR REPLACE FUNCTION public.propagate_campaign_metrics_to_variants()
RETURNS TRIGGER AS $$
BEGIN
  -- When campaign metrics are updated, propagate to step 1 variant if it has no metrics
  IF NEW.total_sent > 0 THEN
    UPDATE public.campaign_variants
    SET 
      total_sent = COALESCE(total_sent, NEW.total_sent),
      total_opened = COALESCE(total_opened, NEW.total_opened),
      total_replied = COALESCE(total_replied, NEW.total_replied),
      total_bounced = COALESCE(total_bounced, NEW.total_bounced),
      open_rate = CASE WHEN total_sent IS NULL AND NEW.total_sent > 0 
                       THEN ROUND((NEW.total_opened::numeric / NEW.total_sent) * 100, 2) 
                       ELSE open_rate END,
      reply_rate = CASE WHEN total_sent IS NULL AND NEW.total_sent > 0 
                        THEN ROUND((NEW.total_replied::numeric / NEW.total_sent) * 100, 2) 
                        ELSE reply_rate END,
      bounce_rate = CASE WHEN total_sent IS NULL AND NEW.total_sent > 0 
                         THEN ROUND((NEW.total_bounced::numeric / NEW.total_sent) * 100, 2) 
                         ELSE bounce_rate END,
      updated_at = NOW()
    WHERE campaign_id = NEW.id 
      AND step_number = 1 
      AND (total_sent IS NULL OR total_sent = 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS propagate_metrics_trigger ON public.campaigns;
CREATE TRIGGER propagate_metrics_trigger
  AFTER UPDATE ON public.campaigns
  FOR EACH ROW
  WHEN (NEW.total_sent IS DISTINCT FROM OLD.total_sent)
  EXECUTE FUNCTION public.propagate_campaign_metrics_to_variants();

-- 4. Backfill variant metrics from campaigns
UPDATE public.campaign_variants cv
SET 
  total_sent = c.total_sent,
  total_opened = c.total_opened,
  total_replied = c.total_replied,
  total_bounced = c.total_bounced,
  open_rate = CASE WHEN c.total_sent > 0 THEN ROUND((c.total_opened::numeric / c.total_sent) * 100, 2) ELSE NULL END,
  reply_rate = CASE WHEN c.total_sent > 0 THEN ROUND((c.total_replied::numeric / c.total_sent) * 100, 2) ELSE NULL END,
  bounce_rate = CASE WHEN c.total_sent > 0 THEN ROUND((c.total_bounced::numeric / c.total_sent) * 100, 2) ELSE NULL END,
  updated_at = NOW()
FROM public.campaigns c
WHERE cv.campaign_id = c.id
  AND cv.step_number = 1
  AND (cv.total_sent IS NULL OR cv.total_sent = 0)
  AND c.total_sent > 0;