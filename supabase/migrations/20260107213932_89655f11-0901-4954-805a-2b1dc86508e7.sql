-- Phase 1: Extend leads table with contact intelligence fields
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS phoneburner_contact_id text,
ADD COLUMN IF NOT EXISTS contact_status text DEFAULT 'new',
ADD COLUMN IF NOT EXISTS assigned_to uuid,
ADD COLUMN IF NOT EXISTS seller_interest_score integer,
ADD COLUMN IF NOT EXISTS seller_interest_summary text,
ADD COLUMN IF NOT EXISTS last_email_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_call_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_contact_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS next_action_date date,
ADD COLUMN IF NOT EXISTS next_action_type text,
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS do_not_call boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS do_not_email boolean DEFAULT false;

-- Add constraint for contact_status
ALTER TABLE public.leads 
ADD CONSTRAINT leads_contact_status_check 
CHECK (contact_status IN ('new', 'contacted', 'interested', 'meeting_set', 'disqualified', 'do_not_contact'));

-- Create contact_notes table
CREATE TABLE public.contact_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  note_text text NOT NULL,
  note_type text NOT NULL DEFAULT 'manual',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contact_notes_type_check CHECK (note_type IN ('manual', 'system', 'ai_generated'))
);

-- Enable RLS on contact_notes
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for contact_notes
CREATE POLICY "Workspace members can view notes"
ON public.contact_notes FOR SELECT
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create notes"
ON public.contact_notes FOR INSERT
WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update notes"
ON public.contact_notes FOR UPDATE
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins or creators can delete notes"
ON public.contact_notes FOR DELETE
USING (is_workspace_admin(workspace_id, auth.uid()) OR created_by = auth.uid());

-- Create contact_engagement_summary view
CREATE OR REPLACE VIEW public.contact_engagement_summary AS
SELECT 
  l.id as lead_id,
  l.workspace_id,
  l.email,
  l.first_name,
  l.last_name,
  l.company,
  l.title,
  l.industry,
  l.contact_status,
  l.seller_interest_score,
  l.assigned_to,
  l.tags,
  l.last_contact_at,
  -- Email metrics
  COALESCE(email_stats.total_sent, 0) as emails_sent,
  COALESCE(email_stats.total_opened, 0) as emails_opened,
  COALESCE(email_stats.total_clicked, 0) as emails_clicked,
  COALESCE(email_stats.total_replied, 0) as emails_replied,
  COALESCE(email_stats.total_bounced, 0) as emails_bounced,
  -- Call metrics  
  COALESCE(call_stats.total_calls, 0) as total_calls,
  COALESCE(call_stats.calls_connected, 0) as calls_connected,
  COALESCE(call_stats.voicemails_left, 0) as voicemails_left,
  COALESCE(call_stats.total_talk_time, 0) as total_talk_time_seconds,
  COALESCE(call_stats.avg_ai_score, 0) as avg_ai_score,
  -- First and last contact dates
  LEAST(email_stats.first_email_at, call_stats.first_call_at) as first_contact_date,
  GREATEST(email_stats.last_email_at, call_stats.last_call_at) as last_contact_date
FROM public.leads l
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) FILTER (WHERE event_type = 'sent') as total_sent,
    COUNT(*) FILTER (WHERE event_type = 'opened') as total_opened,
    COUNT(*) FILTER (WHERE event_type = 'clicked') as total_clicked,
    COUNT(*) FILTER (WHERE event_type = 'replied') as total_replied,
    COUNT(*) FILTER (WHERE event_type = 'bounced') as total_bounced,
    MIN(occurred_at) as first_email_at,
    MAX(occurred_at) as last_email_at
  FROM public.message_events me
  WHERE me.lead_id = l.id
) email_stats ON true
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE is_connected = true) as calls_connected,
    COUNT(*) FILTER (WHERE is_voicemail = true) as voicemails_left,
    COALESCE(SUM(duration_seconds), 0) as total_talk_time,
    MIN(start_at) as first_call_at,
    MAX(start_at) as last_call_at,
    AVG(cas.composite_score) as avg_ai_score
  FROM public.phoneburner_calls pc
  LEFT JOIN public.call_ai_scores cas ON cas.call_id = pc.id
  WHERE pc.contact_id = l.id
) call_stats ON true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_contact_status ON public.leads(contact_status);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_contact ON public.leads(workspace_id, contact_status);
CREATE INDEX IF NOT EXISTS idx_leads_phoneburner_contact ON public.leads(phoneburner_contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_last_contact ON public.leads(last_contact_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_message_events_lead ON public.message_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_phoneburner_calls_contact ON public.phoneburner_calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_lead ON public.contact_notes(lead_id);