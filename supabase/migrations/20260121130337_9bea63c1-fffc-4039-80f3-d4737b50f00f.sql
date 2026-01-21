-- SmartLead Campaigns table (from NocoDB)
CREATE TABLE public.nocodb_smartlead_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nocodb_id INTEGER UNIQUE NOT NULL,
  campaign_id TEXT UNIQUE NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT,
  campaign_created_date DATE,
  
  -- Sequence info
  steps_count INTEGER,
  step1_subject TEXT,
  step1_body TEXT,
  step2_subject TEXT,
  step2_body TEXT,
  step3_subject TEXT,
  step3_body TEXT,
  step4_subject TEXT,
  step4_body TEXT,
  
  -- Lead metrics
  leads_in_progress INTEGER DEFAULT 0,
  leads_completed INTEGER DEFAULT 0,
  leads_interested INTEGER DEFAULT 0,
  leads_not_started INTEGER DEFAULT 0,
  leads_paused INTEGER DEFAULT 0,
  leads_stopped INTEGER DEFAULT 0,
  leads_blocked INTEGER DEFAULT 0,
  
  -- Links
  link_to_campaign TEXT,
  
  -- Timestamps
  nocodb_created_at TIMESTAMPTZ,
  nocodb_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reply.io Campaigns table (from NocoDB)
CREATE TABLE public.nocodb_replyio_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nocodb_id INTEGER UNIQUE NOT NULL,
  campaign_id TEXT UNIQUE NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT,
  campaign_created_date DATE,
  
  -- People metrics
  people_count INTEGER DEFAULT 0,
  people_active INTEGER DEFAULT 0,
  people_finished INTEGER DEFAULT 0,
  people_paused INTEGER DEFAULT 0,
  
  -- Email metrics
  deliveries INTEGER DEFAULT 0,
  bounces INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  ooos INTEGER DEFAULT 0,
  optouts INTEGER DEFAULT 0,
  
  -- Sequence steps (up to 9)
  step1_subject TEXT,
  step1_body TEXT,
  step2_subject TEXT,
  step2_body TEXT,
  step3_subject TEXT,
  step3_body TEXT,
  step4_subject TEXT,
  step4_body TEXT,
  step5_subject TEXT,
  step5_body TEXT,
  step6_subject TEXT,
  step6_body TEXT,
  step7_subject TEXT,
  step7_body TEXT,
  step8_subject TEXT,
  step8_body TEXT,
  step9_subject TEXT,
  step9_body TEXT,
  
  -- Timestamps
  nocodb_created_at TIMESTAMPTZ,
  nocodb_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nocodb_smartlead_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nocodb_replyio_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users (read-only for now)
CREATE POLICY "Authenticated users can view SmartLead campaigns"
  ON public.nocodb_smartlead_campaigns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view Reply.io campaigns"
  ON public.nocodb_replyio_campaigns FOR SELECT
  TO authenticated
  USING (true);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to SmartLead campaigns"
  ON public.nocodb_smartlead_campaigns FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to Reply.io campaigns"
  ON public.nocodb_replyio_campaigns FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX idx_nocodb_smartlead_campaign_id ON public.nocodb_smartlead_campaigns(campaign_id);
CREATE INDEX idx_nocodb_smartlead_status ON public.nocodb_smartlead_campaigns(status);
CREATE INDEX idx_nocodb_replyio_campaign_id ON public.nocodb_replyio_campaigns(campaign_id);
CREATE INDEX idx_nocodb_replyio_status ON public.nocodb_replyio_campaigns(status);

-- Updated_at trigger
CREATE TRIGGER update_nocodb_smartlead_updated_at
  BEFORE UPDATE ON public.nocodb_smartlead_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nocodb_replyio_updated_at
  BEFORE UPDATE ON public.nocodb_replyio_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();