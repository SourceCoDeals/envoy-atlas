-- Add gatekeeper tracking fields to call_ai_scores
ALTER TABLE public.call_ai_scores
ADD COLUMN IF NOT EXISTS gatekeeper_outcome text,
ADD COLUMN IF NOT EXISTS gatekeeper_name text,
ADD COLUMN IF NOT EXISTS gatekeeper_title text,
ADD COLUMN IF NOT EXISTS gatekeeper_technique_used text,
ADD COLUMN IF NOT EXISTS gatekeeper_handling_score integer,
ADD COLUMN IF NOT EXISTS owner_name_confirmed text,
ADD COLUMN IF NOT EXISTS best_time_to_call text,
ADD COLUMN IF NOT EXISTS direct_line_obtained text,
ADD COLUMN IF NOT EXISTS gatekeeper_info_gathered jsonb;

-- Add wrong number tracking fields
ALTER TABLE public.call_ai_scores
ADD COLUMN IF NOT EXISTS wrong_number_flag boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS wrong_number_type text,
ADD COLUMN IF NOT EXISTS wrong_number_notes text,
ADD COLUMN IF NOT EXISTS data_source text,
ADD COLUMN IF NOT EXISTS correct_info_obtained boolean DEFAULT false;

-- Add enhanced AI scoring fields
ALTER TABLE public.call_ai_scores
ADD COLUMN IF NOT EXISTS clarity_of_value_proposition_score integer,
ADD COLUMN IF NOT EXISTS clarity_of_value_proposition_justification text,
ADD COLUMN IF NOT EXISTS quality_of_conversation_score integer,
ADD COLUMN IF NOT EXISTS quality_of_conversation_justification text,
ADD COLUMN IF NOT EXISTS script_adherence_justification text,
ADD COLUMN IF NOT EXISTS objection_to_resolution_rate integer,
ADD COLUMN IF NOT EXISTS timeline_months integer,
ADD COLUMN IF NOT EXISTS valuation_multiple numeric,
ADD COLUMN IF NOT EXISTS motivation_factors text[],
ADD COLUMN IF NOT EXISTS key_concerns text[],
ADD COLUMN IF NOT EXISTS key_topics_discussed text[];

-- Create gatekeeper_analytics view for easy querying
CREATE OR REPLACE VIEW public.gatekeeper_analytics AS
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

-- Create wrong_number_analytics view
CREATE OR REPLACE VIEW public.wrong_number_analytics AS
SELECT 
  workspace_id,
  wrong_number_type,
  data_source,
  COUNT(*) as count,
  COUNT(CASE WHEN correct_info_obtained THEN 1 END) as corrected_count
FROM public.call_ai_scores
WHERE wrong_number_flag = true
GROUP BY workspace_id, wrong_number_type, data_source;