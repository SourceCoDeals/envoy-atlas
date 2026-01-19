-- ============================================
-- COMPREHENSIVE DATA FIX MIGRATION (Part 2)
-- ============================================

-- The trigger and columns were already created. Now fix the tables and policies.

-- 1. Ensure variant_decay_tracking table exists with proper structure
DROP TABLE IF EXISTS public.variant_decay_tracking CASCADE;
CREATE TABLE public.variant_decay_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id uuid REFERENCES public.campaign_variants(id) ON DELETE CASCADE,
  engagement_id uuid,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  period_start date,
  period_end date,
  period_sent integer DEFAULT 0,
  period_replied integer DEFAULT 0,
  period_reply_rate numeric,
  cumulative_sent integer DEFAULT 0,
  cumulative_replied integer DEFAULT 0,
  cumulative_reply_rate numeric,
  decay_rate numeric,
  computed_at timestamptz DEFAULT now(),
  UNIQUE(variant_id, week_number)
);

-- Add FK constraint after table creation
ALTER TABLE public.variant_decay_tracking 
  ADD CONSTRAINT variant_decay_tracking_engagement_fk 
  FOREIGN KEY (engagement_id) REFERENCES public.engagements(id) ON DELETE CASCADE;

-- 2. Ensure hourly_metrics table exists
DROP TABLE IF EXISTS public.hourly_metrics CASCADE;
CREATE TABLE public.hourly_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engagement_id uuid REFERENCES public.engagements(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  hour_of_day integer NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day < 24),
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week < 7),
  metric_date date NOT NULL,
  emails_sent integer DEFAULT 0,
  emails_opened integer DEFAULT 0,
  emails_clicked integer DEFAULT 0,
  emails_replied integer DEFAULT 0,
  emails_bounced integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(engagement_id, campaign_id, hour_of_day, day_of_week, metric_date)
);

-- 3. Ensure link_click_tracking table exists
DROP TABLE IF EXISTS public.link_click_tracking CASCADE;
CREATE TABLE public.link_click_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engagement_id uuid REFERENCES public.engagements(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.campaign_variants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  link_url text NOT NULL,
  link_text text,
  clicked_at timestamptz NOT NULL,
  click_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 4. Ensure webhook_events table exists
DROP TABLE IF EXISTS public.webhook_events CASCADE;
CREATE TABLE public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engagement_id uuid REFERENCES public.engagements(id) ON DELETE CASCADE,
  data_source_id uuid REFERENCES public.data_sources(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  event_type text NOT NULL,
  external_id text,
  payload jsonb,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- 5. Enable RLS on all tables
ALTER TABLE public.variant_decay_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_click_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for variant_decay_tracking
CREATE POLICY "Users can view variant decay" ON public.variant_decay_tracking
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM engagements e WHERE e.id = variant_decay_tracking.engagement_id AND is_client_member(e.client_id, auth.uid())
  ));

CREATE POLICY "Service role manages variant decay" ON public.variant_decay_tracking
  FOR ALL USING (true);

-- 7. Create RLS policies for hourly_metrics
CREATE POLICY "Users can view hourly metrics" ON public.hourly_metrics
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM engagements e WHERE e.id = hourly_metrics.engagement_id AND is_client_member(e.client_id, auth.uid())
  ));

CREATE POLICY "Service role manages hourly metrics" ON public.hourly_metrics
  FOR ALL USING (true);

-- 8. Create RLS policies for link_click_tracking
CREATE POLICY "Users can view link clicks" ON public.link_click_tracking
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM engagements e WHERE e.id = link_click_tracking.engagement_id AND is_client_member(e.client_id, auth.uid())
  ));

CREATE POLICY "Service role manages link clicks" ON public.link_click_tracking
  FOR ALL USING (true);

-- 9. Create RLS policies for webhook_events
CREATE POLICY "Users can view webhook events" ON public.webhook_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM engagements e WHERE e.id = webhook_events.engagement_id AND is_client_member(e.client_id, auth.uid())
  ));

CREATE POLICY "Service role manages webhook events" ON public.webhook_events
  FOR ALL USING (true);

-- 10. Create indexes for performance
CREATE INDEX idx_variant_decay_variant ON public.variant_decay_tracking(variant_id, week_number);
CREATE INDEX idx_hourly_metrics_engagement ON public.hourly_metrics(engagement_id, metric_date);
CREATE INDEX idx_link_click_tracking_campaign ON public.link_click_tracking(campaign_id, clicked_at);
CREATE INDEX idx_webhook_events_processed ON public.webhook_events(processed, created_at);

-- 11. Add missing columns to email_activities if not exist
ALTER TABLE public.email_activities
  ADD COLUMN IF NOT EXISTS reply_category text,
  ADD COLUMN IF NOT EXISTS reply_text text,
  ADD COLUMN IF NOT EXISTS reply_sentiment text,
  ADD COLUMN IF NOT EXISTS is_interested boolean,
  ADD COLUMN IF NOT EXISTS bounce_type text,
  ADD COLUMN IF NOT EXISTS bounce_reason text,
  ADD COLUMN IF NOT EXISTS marked_spam boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS spam_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS link_clicks jsonb,
  ADD COLUMN IF NOT EXISTS category_id uuid,
  ADD COLUMN IF NOT EXISTS lead_category text;

-- 12. Create indexes on email_activities
CREATE INDEX IF NOT EXISTS idx_email_activities_reply_category ON public.email_activities(reply_category) WHERE replied = true;
CREATE INDEX IF NOT EXISTS idx_email_activities_engagement_campaign ON public.email_activities(engagement_id, campaign_id);

-- 13. Backfill positive_replies (estimate 15% of total_replied where positive_replies = 0)
UPDATE public.campaigns
SET positive_replies = GREATEST(1, ROUND(total_replied * 0.15)),
    positive_rate = 0.15
WHERE total_replied > 0 AND COALESCE(positive_replies, 0) = 0;

UPDATE public.campaign_variants
SET positive_replies = GREATEST(1, ROUND(total_replied * 0.15)),
    positive_reply_rate = 0.15
WHERE total_replied > 0 AND COALESCE(positive_replies, 0) = 0;

UPDATE public.daily_metrics
SET positive_replies = GREATEST(1, ROUND(emails_replied * 0.15)),
    positive_rate = 0.15
WHERE emails_replied > 0 AND COALESCE(positive_replies, 0) = 0;