-- Add public read access to all main tables for anonymous visitors
-- This allows anyone to view the data without signing in

-- Create public read policies for core tables
-- These use anon role which is the default for unauthenticated requests

-- Clients (workspaces)
CREATE POLICY "Public read access for clients" ON public.clients
FOR SELECT TO anon USING (true);

-- Engagements
CREATE POLICY "Public read access for engagements" ON public.engagements
FOR SELECT TO anon USING (true);

-- Campaigns
CREATE POLICY "Public read access for campaigns" ON public.campaigns
FOR SELECT TO anon USING (true);

-- Campaign variants
CREATE POLICY "Public read access for campaign_variants" ON public.campaign_variants
FOR SELECT TO anon USING (true);

-- Campaign variant features
CREATE POLICY "Public read access for campaign_variant_features" ON public.campaign_variant_features
FOR SELECT TO anon USING (true);

-- Daily metrics
CREATE POLICY "Public read access for daily_metrics" ON public.daily_metrics
FOR SELECT TO anon USING (true);

-- Companies
CREATE POLICY "Public read access for companies" ON public.companies
FOR SELECT TO anon USING (true);

-- Contacts
CREATE POLICY "Public read access for contacts" ON public.contacts
FOR SELECT TO anon USING (true);

-- Contact notes
CREATE POLICY "Public read access for contact_notes" ON public.contact_notes
FOR SELECT TO anon USING (true);

-- Email activities
CREATE POLICY "Public read access for email_activities" ON public.email_activities
FOR SELECT TO anon USING (true);

-- Email accounts
CREATE POLICY "Public read access for email_accounts" ON public.email_accounts
FOR SELECT TO anon USING (true);

-- Campaign email accounts
CREATE POLICY "Public read access for campaign_email_accounts" ON public.campaign_email_accounts
FOR SELECT TO anon USING (true);

-- Data sources
CREATE POLICY "Public read access for data_sources" ON public.data_sources
FOR SELECT TO anon USING (true);

-- Copy library
CREATE POLICY "Public read access for copy_library" ON public.copy_library
FOR SELECT TO anon USING (true);

-- Copy patterns
CREATE POLICY "Public read access for copy_patterns" ON public.copy_patterns
FOR SELECT TO anon USING (true);

-- Sequences
CREATE POLICY "Public read access for sequences" ON public.sequences
FOR SELECT TO anon USING (true);

-- Deals
CREATE POLICY "Public read access for deals" ON public.deals
FOR SELECT TO anon USING (true);

-- Deal clients
CREATE POLICY "Public read access for deal_clients" ON public.deal_clients
FOR SELECT TO anon USING (true);

-- Meetings
CREATE POLICY "Public read access for meetings" ON public.meetings
FOR SELECT TO anon USING (true);

-- Lead categories
CREATE POLICY "Public read access for lead_categories" ON public.lead_categories
FOR SELECT TO anon USING (true);

-- Message threads
CREATE POLICY "Public read access for message_threads" ON public.message_threads
FOR SELECT TO anon USING (true);

-- Profiles (for viewing team members)
CREATE POLICY "Public read access for profiles" ON public.profiles
FOR SELECT TO anon USING (true);

-- Call activities
CREATE POLICY "Public read access for call_activities" ON public.call_activities
FOR SELECT TO anon USING (true);

-- Create a function to get the default workspace for anonymous users
CREATE OR REPLACE FUNCTION public.get_default_workspace()
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  client_type text,
  status text,
  settings jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, slug, client_type, status, settings, created_at, updated_at
  FROM public.clients
  WHERE slug = 'sourceco'
  LIMIT 1;
$$;