-- Create update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Extend call_ai_scores with additional scoring fields
ALTER TABLE public.call_ai_scores
ADD COLUMN IF NOT EXISTS call_category text,
ADD COLUMN IF NOT EXISTS objections_text text,
ADD COLUMN IF NOT EXISTS objection_resolution_rate integer,
ADD COLUMN IF NOT EXISTS decision_maker_identification integer,
ADD COLUMN IF NOT EXISTS referral_generation_rate integer,
ADD COLUMN IF NOT EXISTS not_interested_reason text,
ADD COLUMN IF NOT EXISTS overall_quality_score integer,
ADD COLUMN IF NOT EXISTS initial_valuation_discussion integer,
ADD COLUMN IF NOT EXISTS mandatory_question_details jsonb DEFAULT '[]'::jsonb;

-- Create call_summaries table for Part 2 data
CREATE TABLE IF NOT EXISTS public.call_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id uuid NOT NULL REFERENCES public.phoneburner_calls(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  summary text,
  followup_task_name text,
  followup_due_date date,
  is_followup_completed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on call_summaries
ALTER TABLE public.call_summaries ENABLE ROW LEVEL SECURITY;

-- RLS policies for call_summaries
CREATE POLICY "Users can view summaries in their workspaces"
  ON public.call_summaries FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert summaries in their workspaces"
  ON public.call_summaries FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update summaries in their workspaces"
  ON public.call_summaries FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- Index for call_summaries
CREATE INDEX IF NOT EXISTS idx_call_summaries_workspace ON public.call_summaries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_call_summaries_call ON public.call_summaries(call_id);
CREATE INDEX IF NOT EXISTS idx_call_summaries_followup ON public.call_summaries(followup_due_date) WHERE is_followup_completed = false;

-- Trigger for updated_at on call_summaries
CREATE TRIGGER update_call_summaries_updated_at
  BEFORE UPDATE ON public.call_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Extend calling_deals with business intelligence fields
ALTER TABLE public.calling_deals
ADD COLUMN IF NOT EXISTS key_points text,
ADD COLUMN IF NOT EXISTS annual_revenue_raw numeric,
ADD COLUMN IF NOT EXISTS ebitda_raw numeric,
ADD COLUMN IF NOT EXISTS ownership_details text,
ADD COLUMN IF NOT EXISTS business_history text,
ADD COLUMN IF NOT EXISTS transaction_goals text,
ADD COLUMN IF NOT EXISTS ownership_information text,
ADD COLUMN IF NOT EXISTS business_description text,
ADD COLUMN IF NOT EXISTS growth_information text,
ADD COLUMN IF NOT EXISTS ma_discussions text,
ADD COLUMN IF NOT EXISTS financial_data text,
ADD COLUMN IF NOT EXISTS exit_reason text,
ADD COLUMN IF NOT EXISTS revenue_ebitda_history text,
ADD COLUMN IF NOT EXISTS target_pain_points text,
ADD COLUMN IF NOT EXISTS future_growth_plans text,
ADD COLUMN IF NOT EXISTS mobile_number text,
ADD COLUMN IF NOT EXISTS interest_level text;