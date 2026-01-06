-- Fix security definer views by making them use SECURITY INVOKER (default)
-- Drop and recreate views with explicit SECURITY INVOKER

DROP VIEW IF EXISTS public.inbox_items;
DROP VIEW IF EXISTS public.audience_performance;
DROP VIEW IF EXISTS public.time_performance;

-- Recreate inbox_items with SECURITY INVOKER
CREATE VIEW public.inbox_items 
WITH (security_invoker = true) AS
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

-- Recreate audience_performance with SECURITY INVOKER
CREATE VIEW public.audience_performance 
WITH (security_invoker = true) AS
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

-- Recreate time_performance with SECURITY INVOKER
CREATE VIEW public.time_performance 
WITH (security_invoker = true) AS
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

-- Also fix the existing copy_performance view
DROP VIEW IF EXISTS public.copy_performance;

CREATE VIEW public.copy_performance 
WITH (security_invoker = true) AS
SELECT 
  cv.id as variant_id,
  cv.campaign_id,
  c.name as campaign_name,
  c.workspace_id,
  cv.name as variant_name,
  cv.variant_type,
  cv.subject_line,
  cv.body_preview,
  cv.email_body,
  cv.is_control,
  cv.personalization_vars,
  COALESCE(SUM(dm.sent_count), 0) as total_sent,
  COALESCE(SUM(dm.opened_count), 0) as total_opened,
  COALESCE(SUM(dm.clicked_count), 0) as total_clicked,
  COALESCE(SUM(dm.replied_count), 0) as total_replied,
  COALESCE(SUM(dm.positive_reply_count), 0) as total_positive_replies,
  ROUND(COALESCE(SUM(dm.opened_count), 0)::numeric / NULLIF(SUM(dm.sent_count), 0) * 100, 2) as open_rate,
  ROUND(COALESCE(SUM(dm.clicked_count), 0)::numeric / NULLIF(SUM(dm.sent_count), 0) * 100, 2) as click_rate,
  ROUND(COALESCE(SUM(dm.replied_count), 0)::numeric / NULLIF(SUM(dm.sent_count), 0) * 100, 2) as reply_rate,
  ROUND(COALESCE(SUM(dm.positive_reply_count), 0)::numeric / NULLIF(SUM(dm.sent_count), 0) * 100, 2) as positive_reply_rate
FROM public.campaign_variants cv
JOIN public.campaigns c ON c.id = cv.campaign_id
LEFT JOIN public.daily_metrics dm ON dm.variant_id = cv.id
GROUP BY cv.id, cv.campaign_id, c.name, c.workspace_id, cv.name, cv.variant_type, 
         cv.subject_line, cv.body_preview, cv.email_body, cv.is_control, cv.personalization_vars;