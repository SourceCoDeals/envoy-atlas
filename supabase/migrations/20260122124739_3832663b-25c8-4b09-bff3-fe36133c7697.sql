-- Add missing analytics columns to nocodb_smartlead_campaigns
ALTER TABLE public.nocodb_smartlead_campaigns
  ADD COLUMN IF NOT EXISTS total_emails_sent INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_leads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_replies INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_emails_sent INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS step5_subject TEXT,
  ADD COLUMN IF NOT EXISTS step5_body TEXT,
  ADD COLUMN IF NOT EXISTS step6_subject TEXT,
  ADD COLUMN IF NOT EXISTS step6_body TEXT,
  ADD COLUMN IF NOT EXISTS step7_subject TEXT,
  ADD COLUMN IF NOT EXISTS step7_body TEXT,
  ADD COLUMN IF NOT EXISTS step8_subject TEXT,
  ADD COLUMN IF NOT EXISTS step8_body TEXT,
  ADD COLUMN IF NOT EXISTS step9_subject TEXT,
  ADD COLUMN IF NOT EXISTS step9_body TEXT;

-- Add comment to document the new columns
COMMENT ON COLUMN public.nocodb_smartlead_campaigns.total_emails_sent IS 'Total number of emails sent across all steps';
COMMENT ON COLUMN public.nocodb_smartlead_campaigns.unique_emails_sent IS 'Number of unique leads who received at least one email';
COMMENT ON COLUMN public.nocodb_smartlead_campaigns.total_leads IS 'Total number of leads in the campaign';
COMMENT ON COLUMN public.nocodb_smartlead_campaigns.total_replies IS 'Total number of replies received';