-- Fix security definer view by recreating with security_invoker
DROP VIEW IF EXISTS public.contact_engagement_summary;

CREATE VIEW public.contact_engagement_summary 
WITH (security_invoker = true) AS
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