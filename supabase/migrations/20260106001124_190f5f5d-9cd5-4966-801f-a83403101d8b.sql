-- Create leads table to track individual prospects
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  platform_lead_id TEXT,
  email TEXT NOT NULL,
  email_domain TEXT GENERATED ALWAYS AS (
    CASE WHEN email LIKE '%@%' THEN lower(split_part(email, '@', 2)) ELSE NULL END
  ) STORED,
  email_type TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN email LIKE '%@gmail.%' OR email LIKE '%@yahoo.%' OR email LIKE '%@hotmail.%' 
           OR email LIKE '%@outlook.%' OR email LIKE '%@aol.%' OR email LIKE '%@icloud.%'
           OR email LIKE '%@live.%' OR email LIKE '%@msn.%' OR email LIKE '%@protonmail.%'
           OR email LIKE '%@mail.%' OR email LIKE '%@ymail.%' OR email LIKE '%@googlemail.%'
      THEN 'personal'
      ELSE 'work'
    END
  ) STORED,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  title TEXT,
  industry TEXT,
  company_size TEXT,
  location TEXT,
  linkedin_url TEXT,
  status TEXT DEFAULT 'active',
  lead_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, platform, platform_lead_id)
);

-- Enable RLS on leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_leads" ON public.leads FOR ALL
USING (EXISTS (
  SELECT 1 FROM workspace_members 
  WHERE workspace_members.workspace_id = leads.workspace_id 
  AND workspace_members.user_id = auth.uid()
));

-- Create indexes for leads
CREATE INDEX idx_leads_workspace_campaign ON public.leads(workspace_id, campaign_id);
CREATE INDEX idx_leads_email_type ON public.leads(workspace_id, email_type);
CREATE INDEX idx_leads_email_domain ON public.leads(workspace_id, email_domain);
CREATE INDEX idx_leads_status ON public.leads(workspace_id, status);

-- Add lead_id to message_events for proper tracking
ALTER TABLE public.message_events ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;
ALTER TABLE public.message_events ADD COLUMN IF NOT EXISTS reply_content TEXT;
ALTER TABLE public.message_events ADD COLUMN IF NOT EXISTS reply_sentiment TEXT;
ALTER TABLE public.message_events ADD COLUMN IF NOT EXISTS sequence_step INTEGER;

CREATE INDEX idx_message_events_lead ON public.message_events(lead_id);
CREATE INDEX idx_message_events_occurred_at ON public.message_events(workspace_id, occurred_at DESC);
CREATE INDEX idx_message_events_event_type ON public.message_events(workspace_id, event_type);

-- Create hourly_metrics table for time-of-day analysis
CREATE TABLE public.hourly_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour < 24),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week < 7),
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  positive_reply_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, campaign_id, date, hour)
);

ALTER TABLE public.hourly_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_hourly_metrics" ON public.hourly_metrics FOR ALL
USING (EXISTS (
  SELECT 1 FROM workspace_members 
  WHERE workspace_members.workspace_id = hourly_metrics.workspace_id 
  AND workspace_members.user_id = auth.uid()
));

CREATE INDEX idx_hourly_metrics_lookup ON public.hourly_metrics(workspace_id, date DESC, hour);
CREATE INDEX idx_hourly_metrics_dow ON public.hourly_metrics(workspace_id, day_of_week, hour);

-- Create inbox_items view for easy querying of replies
CREATE OR REPLACE VIEW public.inbox_items AS
SELECT 
  me.id,
  me.workspace_id,
  me.campaign_id,
  c.name as campaign_name,
  me.lead_id,
  l.email as lead_email,
  l.email_type,
  l.email_domain,
  l.first_name,
  l.last_name,
  l.company,
  l.title,
  me.event_type,
  me.reply_content,
  me.reply_sentiment,
  me.sequence_step,
  me.occurred_at,
  me.created_at,
  cv.subject_line,
  cv.name as variant_name
FROM public.message_events me
LEFT JOIN public.leads l ON l.id = me.lead_id
LEFT JOIN public.campaigns c ON c.id = me.campaign_id
LEFT JOIN public.campaign_variants cv ON cv.id = me.variant_id
WHERE me.event_type IN ('reply', 'positive_reply', 'negative_reply', 'interested', 'not_interested', 'out_of_office', 'unsubscribe');

-- Create audience_performance view
CREATE OR REPLACE VIEW public.audience_performance AS
SELECT 
  l.workspace_id,
  l.email_type,
  l.email_domain,
  l.industry,
  l.company_size,
  l.title,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT CASE WHEN me.event_type = 'sent' THEN l.id END) as contacted,
  COUNT(DISTINCT CASE WHEN me.event_type = 'open' THEN l.id END) as opened,
  COUNT(DISTINCT CASE WHEN me.event_type IN ('reply', 'positive_reply', 'negative_reply', 'interested', 'not_interested') THEN l.id END) as replied,
  COUNT(DISTINCT CASE WHEN me.event_type IN ('positive_reply', 'interested') THEN l.id END) as positive_replies,
  ROUND(
    COUNT(DISTINCT CASE WHEN me.event_type IN ('reply', 'positive_reply', 'negative_reply', 'interested', 'not_interested') THEN l.id END)::numeric 
    / NULLIF(COUNT(DISTINCT CASE WHEN me.event_type = 'sent' THEN l.id END), 0) * 100, 
    2
  ) as reply_rate,
  ROUND(
    COUNT(DISTINCT CASE WHEN me.event_type IN ('positive_reply', 'interested') THEN l.id END)::numeric 
    / NULLIF(COUNT(DISTINCT CASE WHEN me.event_type = 'sent' THEN l.id END), 0) * 100, 
    2
  ) as positive_reply_rate
FROM public.leads l
LEFT JOIN public.message_events me ON me.lead_id = l.id
GROUP BY l.workspace_id, l.email_type, l.email_domain, l.industry, l.company_size, l.title;

-- Create time_performance view for hour/day analysis
CREATE OR REPLACE VIEW public.time_performance AS
SELECT 
  workspace_id,
  day_of_week,
  hour,
  SUM(sent_count) as total_sent,
  SUM(opened_count) as total_opened,
  SUM(replied_count) as total_replied,
  SUM(positive_reply_count) as total_positive,
  ROUND(SUM(opened_count)::numeric / NULLIF(SUM(sent_count), 0) * 100, 2) as open_rate,
  ROUND(SUM(replied_count)::numeric / NULLIF(SUM(sent_count), 0) * 100, 2) as reply_rate
FROM public.hourly_metrics
GROUP BY workspace_id, day_of_week, hour;

-- Add trigger for leads updated_at
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Add unique constraint on campaign_variants for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_variants_upsert 
  ON public.campaign_variants(campaign_id, platform_variant_id) 
  WHERE platform_variant_id IS NOT NULL;