
-- =====================================================
-- PHASE 1: Comprehensive Data Schema for Full Ingestion
-- =====================================================

-- 1. Email Accounts Table (Sending Mailbox Details)
CREATE TABLE IF NOT EXISTS public.email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID REFERENCES public.engagements(id) ON DELETE CASCADE,
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  external_id TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  is_smtp_success BOOLEAN,
  smtp_failure_error TEXT,
  imap_host TEXT,
  imap_port INTEGER,
  is_imap_success BOOLEAN,
  imap_failure_error TEXT,
  message_per_day INTEGER,
  daily_sent_count INTEGER DEFAULT 0,
  warmup_status TEXT,
  warmup_reputation NUMERIC(5,2),
  warmup_spam_count INTEGER DEFAULT 0,
  warmup_sent_count INTEGER DEFAULT 0,
  warmup_enabled BOOLEAN DEFAULT false,
  custom_tracking_domain TEXT,
  account_type TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(engagement_id, from_email)
);

-- 2. Campaign Email Accounts Junction Table
CREATE TABLE IF NOT EXISTS public.campaign_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(campaign_id, email_account_id)
);

-- 3. Lead Categories Table
CREATE TABLE IF NOT EXISTS public.lead_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID REFERENCES public.engagements(id) ON DELETE CASCADE,
  data_source_id UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  external_id TEXT,
  name TEXT NOT NULL,
  color TEXT,
  is_positive BOOLEAN DEFAULT false,
  is_meeting BOOLEAN DEFAULT false,
  is_ooo BOOLEAN DEFAULT false,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(engagement_id, external_id)
);

-- 4. Message Threads Table (Full Conversation History)
CREATE TABLE IF NOT EXISTS public.message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  engagement_id UUID REFERENCES public.engagements(id) ON DELETE CASCADE,
  email_activity_id UUID REFERENCES public.email_activities(id) ON DELETE SET NULL,
  external_stats_id TEXT,
  message_type TEXT NOT NULL, -- 'sent', 'reply', 'forward'
  message_id TEXT,
  in_reply_to TEXT,
  subject TEXT,
  body_html TEXT,
  body_plain TEXT,
  body_preview TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  from_email TEXT,
  from_name TEXT,
  to_email TEXT,
  to_name TEXT,
  sequence_number INTEGER,
  is_automated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(engagement_id, external_stats_id, message_type)
);

-- 5. Add new columns to contacts table
ALTER TABLE public.contacts 
  ADD COLUMN IF NOT EXISTS sequence_status TEXT,
  ADD COLUMN IF NOT EXISTS current_step INTEGER,
  ADD COLUMN IF NOT EXISTS finish_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_interested BOOLEAN,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.lead_categories(id),
  ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS external_lead_id TEXT,
  ADD COLUMN IF NOT EXISTS campaign_lead_map_id TEXT,
  ADD COLUMN IF NOT EXISTS is_unsubscribed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS bounce_type TEXT,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMP WITH TIME ZONE;

-- 6. Add new columns to campaigns table
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS owner_id TEXT,
  ADD COLUMN IF NOT EXISTS team_id TEXT,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_config JSONB,
  ADD COLUMN IF NOT EXISTS sending_limits JSONB,
  ADD COLUMN IF NOT EXISTS track_settings JSONB,
  ADD COLUMN IF NOT EXISTS stop_lead_settings JSONB,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS min_time_between_emails INTEGER,
  ADD COLUMN IF NOT EXISTS max_leads_per_day INTEGER;

-- 7. Add new columns to campaign_variants table
ALTER TABLE public.campaign_variants
  ADD COLUMN IF NOT EXISTS variant_label TEXT,
  ADD COLUMN IF NOT EXISTS delay_days INTEGER,
  ADD COLUMN IF NOT EXISTS delay_config JSONB,
  ADD COLUMN IF NOT EXISTS send_as_reply BOOLEAN DEFAULT false;

-- 8. Add new columns to email_activities for enhanced tracking
ALTER TABLE public.email_activities
  ADD COLUMN IF NOT EXISTS email_account_id UUID REFERENCES public.email_accounts(id),
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.lead_categories(id),
  ADD COLUMN IF NOT EXISTS lead_category TEXT,
  ADD COLUMN IF NOT EXISTS is_interested BOOLEAN,
  ADD COLUMN IF NOT EXISTS link_clicks JSONB,
  ADD COLUMN IF NOT EXISTS open_timestamps JSONB,
  ADD COLUMN IF NOT EXISTS spam_reported_at TIMESTAMP WITH TIME ZONE;

-- 9. Enable RLS on new tables
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for email_accounts
CREATE POLICY "Users can view email accounts for their engagements"
  ON public.email_accounts FOR SELECT
  USING (
    engagement_id IN (
      SELECT e.id FROM public.engagements e
      JOIN public.clients c ON e.client_id = c.id
      JOIN public.client_members cm ON cm.client_id = c.id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage email accounts for their engagements"
  ON public.email_accounts FOR ALL
  USING (
    engagement_id IN (
      SELECT e.id FROM public.engagements e
      JOIN public.clients c ON e.client_id = c.id
      JOIN public.client_members cm ON cm.client_id = c.id
      WHERE cm.user_id = auth.uid()
    )
  );

-- 11. RLS Policies for campaign_email_accounts
CREATE POLICY "Users can view campaign email accounts"
  ON public.campaign_email_accounts FOR SELECT
  USING (
    campaign_id IN (
      SELECT camp.id FROM public.campaigns camp
      JOIN public.engagements e ON camp.engagement_id = e.id
      JOIN public.clients c ON e.client_id = c.id
      JOIN public.client_members cm ON cm.client_id = c.id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage campaign email accounts"
  ON public.campaign_email_accounts FOR ALL
  USING (
    campaign_id IN (
      SELECT camp.id FROM public.campaigns camp
      JOIN public.engagements e ON camp.engagement_id = e.id
      JOIN public.clients c ON e.client_id = c.id
      JOIN public.client_members cm ON cm.client_id = c.id
      WHERE cm.user_id = auth.uid()
    )
  );

-- 12. RLS Policies for lead_categories
CREATE POLICY "Users can view lead categories for their engagements"
  ON public.lead_categories FOR SELECT
  USING (
    engagement_id IN (
      SELECT e.id FROM public.engagements e
      JOIN public.clients c ON e.client_id = c.id
      JOIN public.client_members cm ON cm.client_id = c.id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage lead categories for their engagements"
  ON public.lead_categories FOR ALL
  USING (
    engagement_id IN (
      SELECT e.id FROM public.engagements e
      JOIN public.clients c ON e.client_id = c.id
      JOIN public.client_members cm ON cm.client_id = c.id
      WHERE cm.user_id = auth.uid()
    )
  );

-- 13. RLS Policies for message_threads
CREATE POLICY "Users can view message threads for their engagements"
  ON public.message_threads FOR SELECT
  USING (
    engagement_id IN (
      SELECT e.id FROM public.engagements e
      JOIN public.clients c ON e.client_id = c.id
      JOIN public.client_members cm ON cm.client_id = c.id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage message threads for their engagements"
  ON public.message_threads FOR ALL
  USING (
    engagement_id IN (
      SELECT e.id FROM public.engagements e
      JOIN public.clients c ON e.client_id = c.id
      JOIN public.client_members cm ON cm.client_id = c.id
      WHERE cm.user_id = auth.uid()
    )
  );

-- 14. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_accounts_engagement ON public.email_accounts(engagement_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_from_email ON public.email_accounts(from_email);
CREATE INDEX IF NOT EXISTS idx_campaign_email_accounts_campaign ON public.campaign_email_accounts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_lead_categories_engagement ON public.lead_categories(engagement_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_contact ON public.message_threads(contact_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_campaign ON public.message_threads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_engagement ON public.message_threads(engagement_id);
CREATE INDEX IF NOT EXISTS idx_contacts_sequence_status ON public.contacts(sequence_status);
CREATE INDEX IF NOT EXISTS idx_contacts_external_lead_id ON public.contacts(external_lead_id);
CREATE INDEX IF NOT EXISTS idx_contacts_category_id ON public.contacts(category_id);

-- 15. Update triggers
CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_categories_updated_at
  BEFORE UPDATE ON public.lead_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
