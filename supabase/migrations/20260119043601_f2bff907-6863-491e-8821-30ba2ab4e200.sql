-- Add unique constraint for campaigns upsert if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'campaigns_engagement_datasource_external_unique'
  ) THEN
    ALTER TABLE public.campaigns 
    ADD CONSTRAINT campaigns_engagement_datasource_external_unique 
    UNIQUE (engagement_id, data_source_id, external_id);
  END IF;
END $$;

-- Add unique constraint for campaign_variants upsert if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'campaign_variants_campaign_external_unique'
  ) THEN
    ALTER TABLE public.campaign_variants 
    ADD CONSTRAINT campaign_variants_campaign_external_unique 
    UNIQUE (campaign_id, external_id);
  END IF;
END $$;

-- Add unique constraint for daily_metrics upsert if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'daily_metrics_engagement_campaign_date_unique'
  ) THEN
    ALTER TABLE public.daily_metrics 
    ADD CONSTRAINT daily_metrics_engagement_campaign_date_unique 
    UNIQUE (engagement_id, campaign_id, date);
  END IF;
END $$;

-- Create auto-classification trigger for contacts
CREATE OR REPLACE FUNCTION public.classify_contact_title()
RETURNS TRIGGER AS $$
DECLARE
  title_lower TEXT;
BEGIN
  IF NEW.title IS NULL OR NEW.title = '' THEN
    RETURN NEW;
  END IF;
  
  title_lower := lower(NEW.title);
  
  -- Classify seniority_level
  IF title_lower ~ '(ceo|cfo|coo|cto|cmo|cio|cpo|founder|owner|president|chairman)' THEN
    NEW.seniority_level := 'C-Level';
  ELSIF title_lower ~ '(vp|vice president|svp|evp)' THEN
    NEW.seniority_level := 'VP';
  ELSIF title_lower ~ '(director|head of)' THEN
    NEW.seniority_level := 'Director';
  ELSIF title_lower ~ '(manager|lead|supervisor|team lead)' THEN
    NEW.seniority_level := 'Manager';
  ELSIF title_lower ~ '(senior|sr\.|principal)' THEN
    NEW.seniority_level := 'Senior';
  ELSIF title_lower ~ '(associate|assistant|coordinator|analyst|specialist)' THEN
    NEW.seniority_level := 'Individual Contributor';
  ELSIF title_lower ~ '(intern|trainee|entry)' THEN
    NEW.seniority_level := 'Entry Level';
  END IF;
  
  -- Classify department
  IF title_lower ~ '(sales|business development|account executive|sdr|bdr)' THEN
    NEW.department := 'Sales';
  ELSIF title_lower ~ '(marketing|brand|content|digital|growth|demand gen)' THEN
    NEW.department := 'Marketing';
  ELSIF title_lower ~ '(engineer|developer|software|tech|data|devops|qa|architect)' THEN
    NEW.department := 'Engineering';
  ELSIF title_lower ~ '(finance|accounting|controller|treasury|revenue)' THEN
    NEW.department := 'Finance';
  ELSIF title_lower ~ '(hr|human resources|people|talent|recruiting)' THEN
    NEW.department := 'HR';
  ELSIF title_lower ~ '(operations|ops|supply chain|logistics)' THEN
    NEW.department := 'Operations';
  ELSIF title_lower ~ '(product|pm|product manager)' THEN
    NEW.department := 'Product';
  ELSIF title_lower ~ '(legal|counsel|compliance)' THEN
    NEW.department := 'Legal';
  ELSIF title_lower ~ '(it|information technology|systems|infrastructure)' THEN
    NEW.department := 'IT';
  ELSIF title_lower ~ '(customer|support|success|service)' THEN
    NEW.department := 'Customer Success';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS classify_contact_on_upsert ON public.contacts;
CREATE TRIGGER classify_contact_on_upsert
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  WHEN (NEW.title IS NOT NULL AND (NEW.seniority_level IS NULL OR NEW.department IS NULL))
  EXECUTE FUNCTION public.classify_contact_title();
