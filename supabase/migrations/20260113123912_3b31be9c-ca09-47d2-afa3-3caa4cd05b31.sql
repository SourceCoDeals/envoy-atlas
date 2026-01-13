-- Create SmartLead Campaigns table
CREATE TABLE public.smartlead_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, platform_id)
);

-- Create Reply.io Campaigns table
CREATE TABLE public.replyio_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, platform_id)
);

-- Create SmartLead Variants table
CREATE TABLE public.smartlead_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.smartlead_campaigns(id) ON DELETE CASCADE,
  platform_variant_id TEXT,
  name TEXT NOT NULL,
  variant_type TEXT NOT NULL DEFAULT 'email',
  subject_line TEXT,
  email_body TEXT,
  body_preview TEXT,
  word_count INTEGER,
  is_control BOOLEAN DEFAULT false,
  personalization_vars JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Create Reply.io Variants table
CREATE TABLE public.replyio_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.replyio_campaigns(id) ON DELETE CASCADE,
  platform_variant_id TEXT,
  name TEXT NOT NULL,
  variant_type TEXT NOT NULL DEFAULT 'email',
  subject_line TEXT,
  email_body TEXT,
  body_preview TEXT,
  word_count INTEGER,
  is_control BOOLEAN DEFAULT false,
  personalization_vars JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Create SmartLead Sequence Steps table
CREATE TABLE public.smartlead_sequence_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.smartlead_campaigns(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_type TEXT DEFAULT 'email',
  delay_days INTEGER DEFAULT 0,
  variant_id UUID REFERENCES public.smartlead_variants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create Reply.io Sequence Steps table
CREATE TABLE public.replyio_sequence_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.replyio_campaigns(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_type TEXT DEFAULT 'email',
  delay_days INTEGER DEFAULT 0,
  variant_id UUID REFERENCES public.replyio_variants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create SmartLead Daily Metrics table
CREATE TABLE public.smartlead_daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.smartlead_campaigns(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  positive_reply_count INTEGER DEFAULT 0,
  negative_reply_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, metric_date)
);

-- Create Reply.io Daily Metrics table
CREATE TABLE public.replyio_daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.replyio_campaigns(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  positive_reply_count INTEGER DEFAULT 0,
  negative_reply_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, metric_date)
);

-- Create SmartLead Message Events table
CREATE TABLE public.smartlead_message_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.smartlead_campaigns(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.smartlead_variants(id) ON DELETE SET NULL,
  lead_id UUID,
  event_type TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ,
  message_id TEXT,
  reply_text TEXT,
  reply_sentiment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create Reply.io Message Events table
CREATE TABLE public.replyio_message_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.replyio_campaigns(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.replyio_variants(id) ON DELETE SET NULL,
  lead_id UUID,
  event_type TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ,
  message_id TEXT,
  reply_text TEXT,
  reply_sentiment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create SmartLead Variant Features table
CREATE TABLE public.smartlead_variant_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID NOT NULL REFERENCES public.smartlead_variants(id) ON DELETE CASCADE UNIQUE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subject_word_count INTEGER,
  subject_char_count INTEGER,
  subject_has_emoji BOOLEAN,
  subject_has_number BOOLEAN,
  subject_is_question BOOLEAN,
  subject_personalization_count INTEGER,
  subject_personalization_position INTEGER,
  subject_first_word_type TEXT,
  subject_capitalization_style TEXT,
  subject_spam_score INTEGER,
  subject_urgency_score INTEGER,
  body_word_count INTEGER,
  body_sentence_count INTEGER,
  body_paragraph_count INTEGER,
  body_avg_sentence_length REAL,
  body_reading_grade REAL,
  body_question_count INTEGER,
  body_bullet_point_count INTEGER,
  body_has_link BOOLEAN,
  body_link_count INTEGER,
  body_has_calendar_link BOOLEAN,
  body_cta_type TEXT,
  body_cta_position TEXT,
  body_cta_strength TEXT,
  body_tone TEXT,
  body_personalization_types TEXT[],
  body_personalization_density REAL,
  body_value_proposition_count INTEGER,
  body_has_proof BOOLEAN,
  extracted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Create Reply.io Variant Features table
CREATE TABLE public.replyio_variant_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID NOT NULL REFERENCES public.replyio_variants(id) ON DELETE CASCADE UNIQUE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subject_word_count INTEGER,
  subject_char_count INTEGER,
  subject_has_emoji BOOLEAN,
  subject_has_number BOOLEAN,
  subject_is_question BOOLEAN,
  subject_personalization_count INTEGER,
  subject_personalization_position INTEGER,
  subject_first_word_type TEXT,
  subject_capitalization_style TEXT,
  subject_spam_score INTEGER,
  subject_urgency_score INTEGER,
  body_word_count INTEGER,
  body_sentence_count INTEGER,
  body_paragraph_count INTEGER,
  body_avg_sentence_length REAL,
  body_reading_grade REAL,
  body_question_count INTEGER,
  body_bullet_point_count INTEGER,
  body_has_link BOOLEAN,
  body_link_count INTEGER,
  body_has_calendar_link BOOLEAN,
  body_cta_type TEXT,
  body_cta_position TEXT,
  body_cta_strength TEXT,
  body_tone TEXT,
  body_personalization_types TEXT[],
  body_personalization_density REAL,
  body_value_proposition_count INTEGER,
  body_has_proof BOOLEAN,
  extracted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Enable RLS on all new tables
ALTER TABLE public.smartlead_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replyio_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smartlead_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replyio_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smartlead_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replyio_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smartlead_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replyio_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smartlead_message_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replyio_message_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smartlead_variant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replyio_variant_features ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for SmartLead tables
CREATE POLICY "Users can view smartlead_campaigns in their workspace" ON public.smartlead_campaigns
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can manage smartlead_campaigns in their workspace" ON public.smartlead_campaigns
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can view smartlead_variants via campaign" ON public.smartlead_variants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.smartlead_campaigns c WHERE c.id = campaign_id AND public.is_workspace_member(c.workspace_id, auth.uid()))
  );

CREATE POLICY "Users can manage smartlead_variants via campaign" ON public.smartlead_variants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.smartlead_campaigns c WHERE c.id = campaign_id AND public.is_workspace_member(c.workspace_id, auth.uid()))
  );

CREATE POLICY "Users can view smartlead_sequence_steps via campaign" ON public.smartlead_sequence_steps
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.smartlead_campaigns c WHERE c.id = campaign_id AND public.is_workspace_member(c.workspace_id, auth.uid()))
  );

CREATE POLICY "Users can manage smartlead_sequence_steps via campaign" ON public.smartlead_sequence_steps
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.smartlead_campaigns c WHERE c.id = campaign_id AND public.is_workspace_member(c.workspace_id, auth.uid()))
  );

CREATE POLICY "Users can view smartlead_daily_metrics in their workspace" ON public.smartlead_daily_metrics
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can manage smartlead_daily_metrics in their workspace" ON public.smartlead_daily_metrics
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can view smartlead_message_events in their workspace" ON public.smartlead_message_events
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can manage smartlead_message_events in their workspace" ON public.smartlead_message_events
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can view smartlead_variant_features in their workspace" ON public.smartlead_variant_features
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can manage smartlead_variant_features in their workspace" ON public.smartlead_variant_features
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Create RLS policies for Reply.io tables
CREATE POLICY "Users can view replyio_campaigns in their workspace" ON public.replyio_campaigns
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can manage replyio_campaigns in their workspace" ON public.replyio_campaigns
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can view replyio_variants via campaign" ON public.replyio_variants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.replyio_campaigns c WHERE c.id = campaign_id AND public.is_workspace_member(c.workspace_id, auth.uid()))
  );

CREATE POLICY "Users can manage replyio_variants via campaign" ON public.replyio_variants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.replyio_campaigns c WHERE c.id = campaign_id AND public.is_workspace_member(c.workspace_id, auth.uid()))
  );

CREATE POLICY "Users can view replyio_sequence_steps via campaign" ON public.replyio_sequence_steps
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.replyio_campaigns c WHERE c.id = campaign_id AND public.is_workspace_member(c.workspace_id, auth.uid()))
  );

CREATE POLICY "Users can manage replyio_sequence_steps via campaign" ON public.replyio_sequence_steps
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.replyio_campaigns c WHERE c.id = campaign_id AND public.is_workspace_member(c.workspace_id, auth.uid()))
  );

CREATE POLICY "Users can view replyio_daily_metrics in their workspace" ON public.replyio_daily_metrics
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can manage replyio_daily_metrics in their workspace" ON public.replyio_daily_metrics
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can view replyio_message_events in their workspace" ON public.replyio_message_events
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can manage replyio_message_events in their workspace" ON public.replyio_message_events
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can view replyio_variant_features in their workspace" ON public.replyio_variant_features
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can manage replyio_variant_features in their workspace" ON public.replyio_variant_features
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_smartlead_campaigns_workspace ON public.smartlead_campaigns(workspace_id);
CREATE INDEX idx_smartlead_variants_campaign ON public.smartlead_variants(campaign_id);
CREATE INDEX idx_smartlead_daily_metrics_campaign_date ON public.smartlead_daily_metrics(campaign_id, metric_date);
CREATE INDEX idx_smartlead_message_events_campaign ON public.smartlead_message_events(campaign_id);
CREATE INDEX idx_smartlead_message_events_workspace ON public.smartlead_message_events(workspace_id);

CREATE INDEX idx_replyio_campaigns_workspace ON public.replyio_campaigns(workspace_id);
CREATE INDEX idx_replyio_variants_campaign ON public.replyio_variants(campaign_id);
CREATE INDEX idx_replyio_daily_metrics_campaign_date ON public.replyio_daily_metrics(campaign_id, metric_date);
CREATE INDEX idx_replyio_message_events_campaign ON public.replyio_message_events(campaign_id);
CREATE INDEX idx_replyio_message_events_workspace ON public.replyio_message_events(workspace_id);

-- Add triggers for updated_at
CREATE TRIGGER update_smartlead_campaigns_updated_at
  BEFORE UPDATE ON public.smartlead_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_replyio_campaigns_updated_at
  BEFORE UPDATE ON public.replyio_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_smartlead_daily_metrics_updated_at
  BEFORE UPDATE ON public.smartlead_daily_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();