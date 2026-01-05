-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'analyst', 'viewer');

-- Create user_roles table (security-first approach)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'analyst' THEN 2 
      WHEN 'viewer' THEN 3 
    END
  LIMIT 1
$$;

-- Profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Workspaces table
CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Workspace members junction table
CREATE TABLE public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Smartlead API connections
CREATE TABLE public.api_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('smartlead', 'replyio')),
    api_key_encrypted TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pending',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, platform)
);

ALTER TABLE public.api_connections ENABLE ROW LEVEL SECURITY;

-- Email accounts / Mailboxes
CREATE TABLE public.email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_id TEXT NOT NULL,
    email_address TEXT NOT NULL,
    sender_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    warmup_enabled BOOLEAN DEFAULT false,
    daily_limit INTEGER,
    health_score NUMERIC(3,2) DEFAULT 1.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, platform, platform_id)
);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- Sending domains
CREATE TABLE public.sending_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    spf_valid BOOLEAN,
    dkim_valid BOOLEAN,
    dmarc_valid BOOLEAN,
    is_bulk_sender BOOLEAN DEFAULT false,
    health_score NUMERIC(3,2) DEFAULT 1.00,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, domain)
);

ALTER TABLE public.sending_domains ENABLE ROW LEVEL SECURITY;

-- Campaigns
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, platform, platform_id)
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Campaign variants (A/B testing)
CREATE TABLE public.campaign_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    variant_type TEXT NOT NULL,
    subject_line TEXT,
    body_preview TEXT,
    is_control BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_variants ENABLE ROW LEVEL SECURITY;

-- Sequence steps
CREATE TABLE public.sequence_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.campaign_variants(id) ON DELETE SET NULL,
    step_number INTEGER NOT NULL,
    subject_line TEXT,
    body_preview TEXT,
    delay_days INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;

-- Audience segments
CREATE TABLE public.audience_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    list_source TEXT,
    industry TEXT,
    job_titles TEXT[],
    company_size TEXT,
    geo TEXT,
    lead_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audience_segments ENABLE ROW LEVEL SECURITY;

-- Message events (unified event log)
CREATE TABLE public.message_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_event_id TEXT,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.campaign_variants(id) ON DELETE SET NULL,
    step_id UUID REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
    email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
    segment_id UUID REFERENCES public.audience_segments(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed', 'spam_complaint')),
    lead_email TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.message_events ENABLE ROW LEVEL SECURITY;

-- Create index for fast event queries
CREATE INDEX idx_message_events_workspace_date ON public.message_events(workspace_id, occurred_at DESC);
CREATE INDEX idx_message_events_campaign ON public.message_events(campaign_id, event_type);
CREATE INDEX idx_message_events_type ON public.message_events(event_type, occurred_at DESC);

-- Reply classifications (AI-powered)
CREATE TABLE public.reply_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_event_id UUID NOT NULL REFERENCES public.message_events(id) ON DELETE CASCADE,
    classification TEXT NOT NULL CHECK (classification IN ('positive', 'neutral', 'objection', 'out_of_office', 'unsubscribe', 'wrong_person', 'spam_complaint')),
    confidence_score NUMERIC(3,2) NOT NULL,
    reply_content TEXT,
    is_human_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reply_classifications ENABLE ROW LEVEL SECURITY;

-- Experiments (A/B testing framework)
CREATE TABLE public.experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    hypothesis TEXT,
    test_type TEXT NOT NULL CHECK (test_type IN ('subject_line', 'first_line', 'cta', 'offer', 'sequence_structure', 'sending_window', 'audience')),
    primary_metric TEXT NOT NULL DEFAULT 'positive_reply_rate',
    guardrail_max_bounce_rate NUMERIC(4,3) DEFAULT 0.05,
    guardrail_max_unsub_rate NUMERIC(4,3) DEFAULT 0.02,
    sample_size_target INTEGER,
    min_runtime_days INTEGER DEFAULT 7,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
    winner_variant_id UUID REFERENCES public.campaign_variants(id),
    winner_confidence NUMERIC(4,3),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;

-- Experiment variants (links experiments to campaign variants)
CREATE TABLE public.experiment_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES public.experiments(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.campaign_variants(id) ON DELETE CASCADE,
    is_control BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (experiment_id, variant_id)
);

ALTER TABLE public.experiment_variants ENABLE ROW LEVEL SECURITY;

-- Playbook (winning patterns library)
CREATE TABLE public.playbook_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    experiment_id UUID REFERENCES public.experiments(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    test_type TEXT NOT NULL,
    winning_pattern TEXT NOT NULL,
    context TEXT,
    metrics JSONB,
    tags TEXT[],
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.playbook_entries ENABLE ROW LEVEL SECURITY;

-- Audit log
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_logs_workspace ON public.audit_logs(workspace_id, created_at DESC);

-- Alerts configuration
CREATE TABLE public.alert_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    threshold_value NUMERIC,
    is_enabled BOOLEAN DEFAULT true,
    notify_slack BOOLEAN DEFAULT false,
    notify_email BOOLEAN DEFAULT true,
    slack_webhook_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_configs ENABLE ROW LEVEL SECURITY;

-- Triggered alerts
CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    alert_config_id UUID REFERENCES public.alert_configs(id) ON DELETE SET NULL,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    is_read BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Daily metrics aggregates (for fast dashboard loading)
CREATE TABLE public.daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.campaign_variants(id) ON DELETE SET NULL,
    email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
    segment_id UUID REFERENCES public.audience_segments(id) ON DELETE SET NULL,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    positive_reply_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    unsubscribed_count INTEGER DEFAULT 0,
    spam_complaint_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, date, campaign_id, variant_id, email_account_id, segment_id)
);

ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_daily_metrics_lookup ON public.daily_metrics(workspace_id, date DESC, campaign_id);

-- RLS Policies

-- User roles: users can view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Admins can manage user roles (using workspace membership)
CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- Workspaces: members can view their workspaces
CREATE POLICY "Members can view workspaces" ON public.workspaces
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = workspaces.id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage workspaces" ON public.workspaces
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = workspaces.id 
            AND user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Workspace members
CREATE POLICY "Members can view workspace members" ON public.workspace_members
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage workspace members" ON public.workspace_members
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id 
            AND wm.user_id = auth.uid() 
            AND wm.role = 'admin'
        )
    );

-- Generic workspace-scoped policies (applied to most tables)
CREATE POLICY "workspace_api_connections_select" ON public.api_connections
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = api_connections.workspace_id AND user_id = auth.uid()));

CREATE POLICY "workspace_api_connections_admin" ON public.api_connections
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = api_connections.workspace_id AND user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "workspace_email_accounts" ON public.email_accounts
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = email_accounts.workspace_id AND user_id = auth.uid()));

CREATE POLICY "workspace_sending_domains" ON public.sending_domains
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = sending_domains.workspace_id AND user_id = auth.uid()));

CREATE POLICY "workspace_campaigns" ON public.campaigns
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = campaigns.workspace_id AND user_id = auth.uid()));

CREATE POLICY "workspace_campaign_variants" ON public.campaign_variants
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.campaigns c JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id WHERE c.id = campaign_variants.campaign_id AND wm.user_id = auth.uid()));

CREATE POLICY "workspace_sequence_steps" ON public.sequence_steps
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.campaigns c JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id WHERE c.id = sequence_steps.campaign_id AND wm.user_id = auth.uid()));

CREATE POLICY "workspace_audience_segments" ON public.audience_segments
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = audience_segments.workspace_id AND user_id = auth.uid()));

CREATE POLICY "workspace_message_events" ON public.message_events
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = message_events.workspace_id AND user_id = auth.uid()));

CREATE POLICY "workspace_reply_classifications" ON public.reply_classifications
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.message_events me JOIN public.workspace_members wm ON wm.workspace_id = me.workspace_id WHERE me.id = reply_classifications.message_event_id AND wm.user_id = auth.uid()));

CREATE POLICY "workspace_experiments" ON public.experiments
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = experiments.workspace_id AND user_id = auth.uid()));

CREATE POLICY "workspace_experiment_variants" ON public.experiment_variants
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.experiments e JOIN public.workspace_members wm ON wm.workspace_id = e.workspace_id WHERE e.id = experiment_variants.experiment_id AND wm.user_id = auth.uid()));

CREATE POLICY "workspace_playbook" ON public.playbook_entries
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = playbook_entries.workspace_id AND user_id = auth.uid()));

CREATE POLICY "workspace_audit_logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = audit_logs.workspace_id AND user_id = auth.uid()));

CREATE POLICY "workspace_audit_logs_insert" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = audit_logs.workspace_id AND user_id = auth.uid()));

CREATE POLICY "workspace_alert_configs" ON public.alert_configs
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = alert_configs.workspace_id AND user_id = auth.uid()));

CREATE POLICY "workspace_alerts" ON public.alerts
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = alerts.workspace_id AND user_id = auth.uid()));

CREATE POLICY "workspace_daily_metrics" ON public.daily_metrics
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = daily_metrics.workspace_id AND user_id = auth.uid()));

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id, 
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
    );
    
    -- Assign default viewer role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'viewer');
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_api_connections_updated_at BEFORE UPDATE ON public.api_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON public.email_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_sending_domains_updated_at BEFORE UPDATE ON public.sending_domains FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_audience_segments_updated_at BEFORE UPDATE ON public.audience_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_reply_classifications_updated_at BEFORE UPDATE ON public.reply_classifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_experiments_updated_at BEFORE UPDATE ON public.experiments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_alert_configs_updated_at BEFORE UPDATE ON public.alert_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_daily_metrics_updated_at BEFORE UPDATE ON public.daily_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();