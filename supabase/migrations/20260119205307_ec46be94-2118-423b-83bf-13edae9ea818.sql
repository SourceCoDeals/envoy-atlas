-- Fix unique constraints for contacts, companies, email_activities, message_threads
-- These are needed for upsert operations in sync functions

-- Drop existing partial unique indexes
DROP INDEX IF EXISTS idx_contacts_engagement_email;
DROP INDEX IF EXISTS idx_companies_engagement_domain;
DROP INDEX IF EXISTS idx_email_activities_external;

-- Create proper unique constraints for upserts
CREATE UNIQUE INDEX idx_contacts_engagement_email 
ON public.contacts (engagement_id, email);

CREATE UNIQUE INDEX idx_companies_engagement_domain 
ON public.companies (engagement_id, domain);

-- Add unique constraint for email_activities upserts
CREATE UNIQUE INDEX idx_email_activities_engagement_campaign_contact_step 
ON public.email_activities (engagement_id, campaign_id, contact_id, step_number)
WHERE (contact_id IS NOT NULL AND step_number IS NOT NULL);

-- Add unique constraint for companies by name (for unknown company upserts)
CREATE UNIQUE INDEX idx_companies_engagement_name 
ON public.companies (engagement_id, name) 
WHERE (domain IS NULL);