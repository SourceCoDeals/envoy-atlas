-- PhoneBurner dial sessions
CREATE TABLE public.phoneburner_dial_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  external_session_id TEXT NOT NULL,
  member_id TEXT,
  member_name TEXT,
  caller_id TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  call_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, external_session_id)
);

-- PhoneBurner individual calls
CREATE TABLE public.phoneburner_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  dial_session_id UUID REFERENCES public.phoneburner_dial_sessions(id) ON DELETE SET NULL,
  external_call_id TEXT NOT NULL,
  contact_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  phone_number TEXT,
  disposition TEXT,
  disposition_id TEXT,
  duration_seconds INTEGER DEFAULT 0,
  is_connected BOOLEAN DEFAULT false,
  is_voicemail BOOLEAN DEFAULT false,
  voicemail_sent TEXT,
  email_sent BOOLEAN DEFAULT false,
  notes TEXT,
  recording_url TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, external_call_id)
);

-- PhoneBurner daily metrics (aggregated)
CREATE TABLE public.phoneburner_daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  member_id TEXT,
  total_sessions INTEGER DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  calls_connected INTEGER DEFAULT 0,
  voicemails_left INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  total_talk_time_seconds INTEGER DEFAULT 0,
  interested_count INTEGER DEFAULT 0,
  not_interested_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, date, member_id)
);

-- Enable RLS
ALTER TABLE public.phoneburner_dial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phoneburner_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phoneburner_daily_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies for dial sessions
CREATE POLICY "Users can view dial sessions in their workspaces"
  ON public.phoneburner_dial_sessions FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert dial sessions in their workspaces"
  ON public.phoneburner_dial_sessions FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update dial sessions in their workspaces"
  ON public.phoneburner_dial_sessions FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- RLS policies for calls
CREATE POLICY "Users can view calls in their workspaces"
  ON public.phoneburner_calls FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert calls in their workspaces"
  ON public.phoneburner_calls FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update calls in their workspaces"
  ON public.phoneburner_calls FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- RLS policies for daily metrics
CREATE POLICY "Users can view daily metrics in their workspaces"
  ON public.phoneburner_daily_metrics FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert daily metrics in their workspaces"
  ON public.phoneburner_daily_metrics FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update daily metrics in their workspaces"
  ON public.phoneburner_daily_metrics FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_phoneburner_dial_sessions_updated_at
  BEFORE UPDATE ON public.phoneburner_dial_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_phoneburner_calls_updated_at
  BEFORE UPDATE ON public.phoneburner_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_phoneburner_daily_metrics_updated_at
  BEFORE UPDATE ON public.phoneburner_daily_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes for performance
CREATE INDEX idx_phoneburner_dial_sessions_workspace ON public.phoneburner_dial_sessions(workspace_id);
CREATE INDEX idx_phoneburner_dial_sessions_start_at ON public.phoneburner_dial_sessions(start_at);
CREATE INDEX idx_phoneburner_calls_workspace ON public.phoneburner_calls(workspace_id);
CREATE INDEX idx_phoneburner_calls_dial_session ON public.phoneburner_calls(dial_session_id);
CREATE INDEX idx_phoneburner_calls_start_at ON public.phoneburner_calls(start_at);
CREATE INDEX idx_phoneburner_calls_disposition ON public.phoneburner_calls(disposition);
CREATE INDEX idx_phoneburner_daily_metrics_workspace_date ON public.phoneburner_daily_metrics(workspace_id, date);