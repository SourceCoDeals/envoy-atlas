-- Create external_call_intel table to store AI-extracted call intelligence
CREATE TABLE public.external_call_intel (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.call_activities(id) ON DELETE CASCADE,
  engagement_id UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
  
  -- 12 AI Scores (1-10 scale)
  seller_interest_score NUMERIC(3,1),
  objection_handling_score NUMERIC(3,1),
  valuation_discussion_score NUMERIC(3,1),
  rapport_building_score NUMERIC(3,1),
  value_proposition_score NUMERIC(3,1),
  conversation_quality_score NUMERIC(3,1),
  script_adherence_score NUMERIC(3,1),
  overall_quality_score NUMERIC(3,1),
  question_adherence_score NUMERIC(3,1),
  personal_insights_score NUMERIC(3,1),
  next_steps_clarity_score NUMERIC(3,1),
  discovery_score NUMERIC(3,1),
  
  -- Score justifications (AI explanation for each score)
  seller_interest_justification TEXT,
  objection_handling_justification TEXT,
  valuation_discussion_justification TEXT,
  rapport_building_justification TEXT,
  value_proposition_justification TEXT,
  conversation_quality_justification TEXT,
  script_adherence_justification TEXT,
  overall_quality_justification TEXT,
  question_adherence_justification TEXT,
  personal_insights_justification TEXT,
  next_steps_clarity_justification TEXT,
  discovery_justification TEXT,
  
  -- Question Adherence data
  questions_covered_count INTEGER DEFAULT 0,
  questions_covered_list TEXT[],
  
  -- Objection Intelligence
  number_of_objections INTEGER DEFAULT 0,
  objections_resolved_count INTEGER DEFAULT 0,
  objections_list TEXT[],
  objection_details JSONB,
  
  -- Extracted Intel
  interest_in_selling TEXT,
  timeline_to_sell TEXT,
  buyer_type_preference TEXT,
  personal_insights TEXT,
  target_pain_points TEXT[],
  next_steps TEXT,
  
  -- Metadata
  transcription_used TEXT,
  ai_model_used TEXT,
  processed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure one intel record per call
  UNIQUE(call_id)
);

-- Create indexes for performance
CREATE INDEX idx_external_call_intel_engagement ON public.external_call_intel(engagement_id);
CREATE INDEX idx_external_call_intel_call ON public.external_call_intel(call_id);
CREATE INDEX idx_external_call_intel_interest ON public.external_call_intel(interest_in_selling);
CREATE INDEX idx_external_call_intel_overall_score ON public.external_call_intel(overall_quality_score);

-- Enable RLS
ALTER TABLE public.external_call_intel ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Access through engagement membership
CREATE POLICY "Users can view call intel for their engagements"
ON public.external_call_intel
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.engagements e
    JOIN public.client_members cm ON cm.client_id = e.client_id
    WHERE e.id = external_call_intel.engagement_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert call intel for their engagements"
ON public.external_call_intel
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.engagements e
    JOIN public.client_members cm ON cm.client_id = e.client_id
    WHERE e.id = external_call_intel.engagement_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update call intel for their engagements"
ON public.external_call_intel
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.engagements e
    JOIN public.client_members cm ON cm.client_id = e.client_id
    WHERE e.id = external_call_intel.engagement_id
    AND cm.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_external_call_intel_updated_at
BEFORE UPDATE ON public.external_call_intel
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();