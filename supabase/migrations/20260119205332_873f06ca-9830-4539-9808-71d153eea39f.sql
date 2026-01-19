-- Create hourly_metrics table for time-of-day analysis
CREATE TABLE IF NOT EXISTS public.hourly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID REFERENCES public.engagements(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  metric_date DATE NOT NULL,
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(engagement_id, campaign_id, hour_of_day, day_of_week, metric_date)
);

-- Create link_click_tracking table for click analytics
CREATE TABLE IF NOT EXISTS public.link_click_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID REFERENCES public.engagements(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  email_activity_id UUID REFERENCES public.email_activities(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  clicked_url TEXT NOT NULL,
  link_text TEXT,
  click_timestamp TIMESTAMPTZ DEFAULT now(),
  device_type TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create webhook_events table if not exists
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID REFERENCES public.engagements(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- 'smartlead', 'replyio'
  event_type TEXT NOT NULL,
  event_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.hourly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_click_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read hourly_metrics" ON public.hourly_metrics FOR SELECT TO anon USING (true);
CREATE POLICY "Service write hourly_metrics" ON public.hourly_metrics FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read link_click_tracking" ON public.link_click_tracking FOR SELECT TO anon USING (true);
CREATE POLICY "Service write link_click_tracking" ON public.link_click_tracking FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read webhook_events" ON public.webhook_events FOR SELECT TO anon USING (true);
CREATE POLICY "Service write webhook_events" ON public.webhook_events FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_hourly_metrics_engagement ON public.hourly_metrics(engagement_id);
CREATE INDEX idx_hourly_metrics_hour ON public.hourly_metrics(hour_of_day, day_of_week);
CREATE INDEX idx_link_clicks_engagement ON public.link_click_tracking(engagement_id);
CREATE INDEX idx_link_clicks_url ON public.link_click_tracking(clicked_url);
CREATE INDEX idx_webhook_events_source ON public.webhook_events(source_type, event_type);
CREATE INDEX idx_webhook_events_processed ON public.webhook_events(processed) WHERE NOT processed;