-- =====================================================
-- FIX SECURITY ISSUES - CORRECTED
-- =====================================================

-- 1. Drop legacy tables that are no longer needed
DROP TABLE IF EXISTS public.replyio_sequence_steps CASCADE;
DROP TABLE IF EXISTS public.smartlead_sequence_steps CASCADE;

-- 2. Add policies to sequence_steps table (linked via campaign_id)
DROP POLICY IF EXISTS "Service role manages sequence steps" ON public.sequence_steps;
CREATE POLICY "Service role manages sequence steps"
ON public.sequence_steps FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view sequence steps" ON public.sequence_steps;
CREATE POLICY "Users can view sequence steps"
ON public.sequence_steps FOR SELECT
USING (EXISTS (
  SELECT 1 FROM campaigns c
  JOIN engagements e ON e.id = c.engagement_id
  WHERE c.id = sequence_steps.campaign_id
  AND is_client_member(e.client_id, auth.uid())
));

-- 3. Recreate views with security_invoker to fix SECURITY DEFINER issue
DROP VIEW IF EXISTS public.copy_performance;
CREATE VIEW public.copy_performance
WITH (security_invoker=on) AS
SELECT 
  cv.id AS variant_id,
  cv.campaign_id,
  cv.subject_line,
  cv.body_preview,
  cv.step_number,
  cv.total_sent,
  cv.total_replied,
  cv.reply_rate,
  cv.positive_replies,
  cv.confidence_level,
  cv.margin_of_error,
  cvf.subject_format,
  cvf.subject_length,
  cvf.body_cta_type,
  cvf.body_word_count,
  cvf.body_bullet_count,
  cvf.tone,
  cvf.opening_line_type,
  c.engagement_id,
  c.name AS campaign_name
FROM campaign_variants cv
LEFT JOIN campaign_variant_features cvf ON cvf.variant_id = cv.id
JOIN campaigns c ON c.id = cv.campaign_id
WHERE cv.total_sent > 0;

DROP VIEW IF EXISTS public.segment_performance;
CREATE VIEW public.segment_performance
WITH (security_invoker=on) AS
SELECT 
  con.engagement_id,
  con.seniority_level,
  con.department,
  con.company_size_category,
  count(DISTINCT con.id) AS contact_count,
  count(DISTINCT ea.id) AS emails_sent,
  count(DISTINCT CASE WHEN ea.replied THEN ea.id ELSE NULL END) AS emails_replied,
  count(DISTINCT CASE WHEN ea.reply_category = 'positive' THEN ea.id ELSE NULL END) AS positive_replies,
  CASE 
    WHEN count(DISTINCT ea.id) > 0 
    THEN count(DISTINCT CASE WHEN ea.replied THEN ea.id ELSE NULL END)::numeric / count(DISTINCT ea.id)::numeric
    ELSE 0
  END AS reply_rate
FROM contacts con
LEFT JOIN email_activities ea ON ea.contact_id = con.id
WHERE con.seniority_level IS NOT NULL
GROUP BY con.engagement_id, con.seniority_level, con.department, con.company_size_category;

-- Recreate activity_timeline view with security_invoker
DROP VIEW IF EXISTS public.activity_timeline;
CREATE VIEW public.activity_timeline
WITH (security_invoker=on) AS
SELECT 
  'email'::text AS activity_type,
  ea.id AS activity_id,
  ea.engagement_id,
  ea.company_id,
  ea.contact_id,
  ea.sent_at AS activity_datetime,
  CASE
    WHEN ea.replied THEN 'email_reply'
    WHEN ea.bounced THEN 'email_bounced'
    WHEN ea.opened THEN 'email_opened'
    WHEN ea.sent THEN 'email_sent'
    ELSE 'email_scheduled'
  END AS activity_subtype,
  ea.subject AS activity_summary
FROM email_activities ea
WHERE ea.sent_at IS NOT NULL
UNION ALL
SELECT 
  'call'::text AS activity_type,
  ca.id AS activity_id,
  ca.engagement_id,
  ca.company_id,
  ca.contact_id,
  ca.started_at AS activity_datetime,
  ca.disposition AS activity_subtype,
  ca.notes AS activity_summary
FROM call_activities ca
WHERE ca.started_at IS NOT NULL
UNION ALL
SELECT 
  'meeting'::text AS activity_type,
  m.id AS activity_id,
  m.engagement_id,
  m.company_id,
  m.contact_id,
  m.scheduled_datetime AS activity_datetime,
  m.status AS activity_subtype,
  m.title AS activity_summary
FROM meetings m;