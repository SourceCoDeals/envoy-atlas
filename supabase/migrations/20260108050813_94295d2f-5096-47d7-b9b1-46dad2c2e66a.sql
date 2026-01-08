-- Fix security definer views by recreating as security invoker
DROP VIEW IF EXISTS public.gatekeeper_analytics;
DROP VIEW IF EXISTS public.wrong_number_analytics;

-- Recreate gatekeeper_analytics view with SECURITY INVOKER
CREATE VIEW public.gatekeeper_analytics
WITH (security_invoker = true) AS
SELECT 
  workspace_id,
  gatekeeper_outcome,
  gatekeeper_technique_used,
  COUNT(*) as call_count,
  AVG(gatekeeper_handling_score) as avg_handling_score,
  COUNT(CASE WHEN gatekeeper_outcome = 'Transferred' THEN 1 END) as transferred_count,
  COUNT(CASE WHEN gatekeeper_outcome = 'Callback Scheduled' THEN 1 END) as callback_count,
  COUNT(CASE WHEN gatekeeper_outcome = 'Blocked' THEN 1 END) as blocked_count
FROM public.call_ai_scores
WHERE call_category = 'Gatekeeper'
GROUP BY workspace_id, gatekeeper_outcome, gatekeeper_technique_used;

-- Recreate wrong_number_analytics view with SECURITY INVOKER
CREATE VIEW public.wrong_number_analytics
WITH (security_invoker = true) AS
SELECT 
  workspace_id,
  wrong_number_type,
  data_source,
  COUNT(*) as count,
  COUNT(CASE WHEN correct_info_obtained THEN 1 END) as corrected_count
FROM public.call_ai_scores
WHERE wrong_number_flag = true
GROUP BY workspace_id, wrong_number_type, data_source;