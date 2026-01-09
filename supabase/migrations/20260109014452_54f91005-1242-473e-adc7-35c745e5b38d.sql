-- Add new columns to external_calls for NocoDB sync
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS nocodb_row_id text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS duration integer;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS objection_handling_justification text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS objection_resolution_rate numeric;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS resolution_rate_justification text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS valuation_discussion_score numeric;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS valuation_discussion_justification text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS rapport_building_justification text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS value_proposition_justification text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS conversation_quality_justification text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS script_adherence_score numeric;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS script_adherence_justification text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS overall_quality_score numeric;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS overall_quality_justification text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS question_adherence_score numeric;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS question_adherence_justification text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS next_step_clarity_justification text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS personal_insights_score numeric;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS personal_insights_justification text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS annual_revenue text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS ownership_details text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS ebitda text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS business_history text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS transaction_goals text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS ownership_information text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS business_description text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS growth_information text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS valuation_expectations text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS ma_discussions text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS financial_data text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS employee_count integer;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS interest_in_selling text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS exit_reason text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS historical_financials text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS target_pain_points text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS future_growth_plans text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS mobile_number text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS personal_insights text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS objections_list_text text;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS objections_count integer;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS objections_resolved_count integer;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS questions_covered_count integer;
ALTER TABLE public.external_calls ADD COLUMN IF NOT EXISTS buyer_type_preference text;

-- Add unique constraint on nocodb_row_id for upsert
CREATE UNIQUE INDEX IF NOT EXISTS external_calls_nocodb_row_id_workspace_idx 
ON public.external_calls (nocodb_row_id, workspace_id) 
WHERE nocodb_row_id IS NOT NULL;

-- Delete existing external_calls data (will be re-synced from NocoDB)
DELETE FROM public.external_calls;

-- Delete leads that came from external_calls platform (keep Smartlead leads intact)
DELETE FROM public.leads WHERE platform = 'external_calls';