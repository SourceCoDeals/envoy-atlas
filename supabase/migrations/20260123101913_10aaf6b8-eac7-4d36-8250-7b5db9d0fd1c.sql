-- Create cold_calls table with ALL columns from NocoDB
-- This stores complete cold call data including AI scores and reasoning

CREATE TABLE public.cold_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  
  -- NocoDB system columns
  nocodb_id INTEGER UNIQUE,
  nocodb_created_at TIMESTAMP WITH TIME ZONE,
  nocodb_updated_at TIMESTAMP WITH TIME ZONE,
  
  -- Call metadata
  direction TEXT,
  from_number TEXT,
  from_name TEXT,
  to_number TEXT,
  to_name TEXT,
  to_company TEXT,
  to_email TEXT,
  salesforce_url TEXT,
  call_recording_url TEXT,
  
  -- Call timing
  call_duration_sec INTEGER,
  called_date DATE,
  called_date_time TIMESTAMP WITH TIME ZONE,
  
  -- Call content
  call_transcript TEXT,
  call_summary TEXT,
  category TEXT,
  analyst TEXT,
  primary_opportunity TEXT,
  
  -- AI Scores (1-10 scale)
  composite_score NUMERIC(4,2),
  seller_interest_score NUMERIC(4,2),
  objection_handling_score NUMERIC(4,2),
  quality_of_conversation_score NUMERIC(4,2),
  value_proposition_score NUMERIC(4,2),
  script_adherence_score NUMERIC(4,2),
  decision_maker_identified_score NUMERIC(4,2),
  referral_rate_score NUMERIC(4,2),
  
  -- Legacy score columns (for compatibility)
  rapport_building_score NUMERIC(4,2),
  engagement_score NUMERIC(4,2),
  next_step_clarity_score NUMERIC(4,2),
  gatekeeper_handling_score NUMERIC(4,2),
  
  -- Resolution rate (percentage 0-100)
  resolution_rate NUMERIC(5,2),
  
  -- AI Reasoning/Justification fields
  interest_rating_reasoning TEXT,
  objection_handling_reasoning TEXT,
  resolution_rate_reasoning TEXT,
  conversation_quality_reasoning TEXT,
  script_adherence_reasoning TEXT,
  decision_maker_reasoning TEXT,
  value_clarity_reasoning TEXT,
  referral_rate_reasoning TEXT,
  
  -- Objection tracking
  objections TEXT,
  key_concerns TEXT[],
  target_pain_points TEXT,
  not_interested_reason TEXT,
  
  -- Other fields
  opening_type TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cold_calls ENABLE ROW LEVEL SECURITY;

-- RLS policies for client members
CREATE POLICY "Client members can view cold_calls"
  ON public.cold_calls FOR SELECT
  USING (public.is_client_member(client_id, auth.uid()));

CREATE POLICY "Client admins can insert cold_calls"
  ON public.cold_calls FOR INSERT
  WITH CHECK (public.is_client_admin(client_id, auth.uid()));

CREATE POLICY "Client admins can update cold_calls"
  ON public.cold_calls FOR UPDATE
  USING (public.is_client_admin(client_id, auth.uid()));

CREATE POLICY "Client admins can delete cold_calls"
  ON public.cold_calls FOR DELETE
  USING (public.is_client_admin(client_id, auth.uid()));

-- Indexes for common query patterns
CREATE INDEX idx_cold_calls_client 
  ON public.cold_calls(client_id);

CREATE INDEX idx_cold_calls_called_date_time 
  ON public.cold_calls(called_date_time DESC NULLS LAST);

CREATE INDEX idx_cold_calls_analyst 
  ON public.cold_calls(analyst);

CREATE INDEX idx_cold_calls_category 
  ON public.cold_calls(category);

CREATE INDEX idx_cold_calls_composite_score 
  ON public.cold_calls(composite_score DESC NULLS LAST) 
  WHERE composite_score IS NOT NULL;

CREATE INDEX idx_cold_calls_nocodb_id 
  ON public.cold_calls(nocodb_id);

-- Trigger for updated_at
CREATE TRIGGER update_cold_calls_updated_at
  BEFORE UPDATE ON public.cold_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Documentation
COMMENT ON TABLE public.cold_calls IS 'Cold call data synced from NocoDB with complete AI scoring and reasoning fields. Synced daily via cron job.';