-- Drop and recreate view with SECURITY INVOKER (default, but explicit)
DROP VIEW IF EXISTS public.copy_performance;

CREATE VIEW public.copy_performance 
WITH (security_invoker = true)
AS
SELECT 
  cv.id as variant_id,
  cv.campaign_id,
  c.name as campaign_name,
  cv.name as variant_name,
  cv.subject_line,
  cv.email_body,
  cv.body_preview,
  cv.personalization_vars,
  cv.variant_type,
  cv.is_control,
  COALESCE(SUM(dm.sent_count), 0) as total_sent,
  COALESCE(SUM(dm.opened_count), 0) as total_opened,
  COALESCE(SUM(dm.clicked_count), 0) as total_clicked,
  COALESCE(SUM(dm.replied_count), 0) as total_replied,
  COALESCE(SUM(dm.positive_reply_count), 0) as total_positive_replies,
  CASE WHEN SUM(dm.sent_count) > 0 
    THEN ROUND((SUM(dm.opened_count)::numeric / SUM(dm.sent_count)) * 100, 2) 
    ELSE 0 END as open_rate,
  CASE WHEN SUM(dm.sent_count) > 0 
    THEN ROUND((SUM(dm.clicked_count)::numeric / SUM(dm.sent_count)) * 100, 2) 
    ELSE 0 END as click_rate,
  CASE WHEN SUM(dm.sent_count) > 0 
    THEN ROUND((SUM(dm.replied_count)::numeric / SUM(dm.sent_count)) * 100, 2) 
    ELSE 0 END as reply_rate,
  CASE WHEN SUM(dm.sent_count) > 0 
    THEN ROUND((SUM(dm.positive_reply_count)::numeric / SUM(dm.sent_count)) * 100, 2) 
    ELSE 0 END as positive_reply_rate,
  c.workspace_id
FROM campaign_variants cv
JOIN campaigns c ON c.id = cv.campaign_id
LEFT JOIN daily_metrics dm ON dm.variant_id = cv.id
GROUP BY cv.id, cv.campaign_id, c.name, cv.name, cv.subject_line, cv.email_body, 
         cv.body_preview, cv.personalization_vars, cv.variant_type, cv.is_control, c.workspace_id;