-- =====================================================
-- DATA IMPORT FIX - Add Service Role Policies
-- =====================================================

-- Add Service Role policies for tables that need edge function write access

-- Campaigns: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages campaigns" ON public.campaigns;
CREATE POLICY "Service role manages campaigns"
ON public.campaigns FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Campaign Variants: Allow service role to manage  
DROP POLICY IF EXISTS "Service role manages variants" ON public.campaign_variants;
CREATE POLICY "Service role manages variants"
ON public.campaign_variants FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Companies: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages companies" ON public.companies;
CREATE POLICY "Service role manages companies"
ON public.companies FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Contacts: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages contacts" ON public.contacts;
CREATE POLICY "Service role manages contacts"
ON public.contacts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Meetings: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages meetings" ON public.meetings;
CREATE POLICY "Service role manages meetings"
ON public.meetings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Engagements: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages engagements" ON public.engagements;
CREATE POLICY "Service role manages engagements"
ON public.engagements FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Deal Clients: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages deal clients" ON public.deal_clients;
CREATE POLICY "Service role manages deal clients"
ON public.deal_clients FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Deals: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages deals" ON public.deals;
CREATE POLICY "Service role manages deals"
ON public.deals FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Experiments: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages experiments" ON public.experiments;
CREATE POLICY "Service role manages experiments"
ON public.experiments FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Experiment Variants: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages experiment variants" ON public.experiment_variants;
CREATE POLICY "Service role manages experiment variants"
ON public.experiment_variants FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Copy Library: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages copy library" ON public.copy_library;
CREATE POLICY "Service role manages copy library"
ON public.copy_library FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Contact Notes: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages contact notes" ON public.contact_notes;
CREATE POLICY "Service role manages contact notes"
ON public.contact_notes FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Playbook Entries: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages playbook" ON public.playbook_entries;
CREATE POLICY "Service role manages playbook"
ON public.playbook_entries FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Sequences: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages sequences" ON public.sequences;
CREATE POLICY "Service role manages sequences"
ON public.sequences FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Responses: Allow service role to manage
DROP POLICY IF EXISTS "Service role manages responses" ON public.responses;
CREATE POLICY "Service role manages responses"
ON public.responses FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add user view policies for sequences and responses
DROP POLICY IF EXISTS "Users can view sequences" ON public.sequences;
CREATE POLICY "Users can view sequences"
ON public.sequences FOR SELECT
USING (EXISTS (
  SELECT 1 FROM campaigns c
  JOIN engagements e ON e.id = c.engagement_id
  WHERE c.id = sequences.campaign_id
  AND is_client_member(e.client_id, auth.uid())
));

DROP POLICY IF EXISTS "Users can view responses" ON public.responses;
CREATE POLICY "Users can view responses"
ON public.responses FOR SELECT
USING (EXISTS (
  SELECT 1 FROM engagements e
  WHERE e.id = responses.engagement_id
  AND is_client_member(e.client_id, auth.uid())
));

-- Add missing indexes for query performance
CREATE INDEX IF NOT EXISTS idx_campaigns_engagement_id ON public.campaigns(engagement_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_data_source_id ON public.campaigns(data_source_id);
CREATE INDEX IF NOT EXISTS idx_campaign_variants_campaign_id ON public.campaign_variants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_companies_engagement_id ON public.companies(engagement_id);
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_id ON public.contacts(engagement_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_email_activities_engagement_id ON public.email_activities(engagement_id);
CREATE INDEX IF NOT EXISTS idx_email_activities_contact_id ON public.email_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_activities_campaign_id ON public.email_activities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_call_activities_engagement_id ON public.call_activities(engagement_id);
CREATE INDEX IF NOT EXISTS idx_call_activities_contact_id ON public.call_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_engagement_id ON public.daily_metrics(engagement_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON public.daily_metrics(date);
CREATE INDEX IF NOT EXISTS idx_meetings_engagement_id ON public.meetings(engagement_id);
CREATE INDEX IF NOT EXISTS idx_responses_engagement_id ON public.responses(engagement_id);
CREATE INDEX IF NOT EXISTS idx_sequences_campaign_id ON public.sequences(campaign_id);