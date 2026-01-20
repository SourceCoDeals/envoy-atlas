-- Create calling_metrics_config table for centralized metrics configuration
CREATE TABLE IF NOT EXISTS public.calling_metrics_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  
  -- Score Thresholds (what's considered good/bad for each AI score)
  seller_interest_thresholds JSONB DEFAULT '{"excellent": 8, "good": 6, "average": 4, "poor": 2}',
  objection_handling_thresholds JSONB DEFAULT '{"excellent": 8, "good": 6, "average": 4, "poor": 2}',
  valuation_discussion_thresholds JSONB DEFAULT '{"excellent": 8, "good": 6, "average": 4, "poor": 2}',
  rapport_building_thresholds JSONB DEFAULT '{"excellent": 8, "good": 6, "average": 4, "poor": 2}',
  value_proposition_thresholds JSONB DEFAULT '{"excellent": 8, "good": 6, "average": 4, "poor": 2}',
  conversation_quality_thresholds JSONB DEFAULT '{"excellent": 8, "good": 6, "average": 4, "poor": 2}',
  script_adherence_thresholds JSONB DEFAULT '{"excellent": 8, "good": 6, "average": 4, "poor": 2}',
  overall_quality_thresholds JSONB DEFAULT '{"excellent": 8, "good": 6, "average": 4, "poor": 2}',
  question_adherence_thresholds JSONB DEFAULT '{"excellent": 8, "good": 6, "average": 4, "poor": 2}',
  personal_insights_thresholds JSONB DEFAULT '{"excellent": 8, "good": 6, "average": 4, "poor": 2}',
  next_steps_clarity_thresholds JSONB DEFAULT '{"excellent": 8, "good": 6, "average": 4, "poor": 2}',
  
  -- Objection Resolution Threshold
  objection_resolution_good_threshold INTEGER DEFAULT 80,
  objection_resolution_warning_threshold INTEGER DEFAULT 50,
  
  -- Question Coverage
  question_coverage_total INTEGER DEFAULT 17,
  question_coverage_good_threshold INTEGER DEFAULT 12,
  question_coverage_warning_threshold INTEGER DEFAULT 6,
  
  -- Call Duration Benchmarks (in seconds)
  call_duration_min_optimal INTEGER DEFAULT 180,
  call_duration_max_optimal INTEGER DEFAULT 300,
  call_duration_too_short INTEGER DEFAULT 60,
  call_duration_too_long INTEGER DEFAULT 600,
  
  -- Interest Classification
  interest_values_positive JSONB DEFAULT '["yes", "maybe"]',
  interest_values_negative JSONB DEFAULT '["no"]',
  
  -- Top/Worst Calls Thresholds
  top_calls_min_score INTEGER DEFAULT 7,
  worst_calls_max_score INTEGER DEFAULT 3,
  
  -- Coaching Alert Thresholds
  coaching_alert_overall_quality INTEGER DEFAULT 4,
  coaching_alert_script_adherence INTEGER DEFAULT 4,
  coaching_alert_question_adherence INTEGER DEFAULT 4,
  coaching_alert_objection_handling INTEGER DEFAULT 4,
  
  -- Hot Lead Thresholds
  hot_lead_interest_score INTEGER DEFAULT 8,
  hot_lead_requires_interest_yes BOOLEAN DEFAULT true,
  
  -- Display Settings
  scores_decimal_places INTEGER DEFAULT 1,
  show_score_justifications BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(client_id)
);

-- Enable RLS
ALTER TABLE public.calling_metrics_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their client config"
  ON public.calling_metrics_config FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM public.client_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update client config"
  ON public.calling_metrics_config FOR UPDATE
  USING (
    client_id IN (
      SELECT client_id FROM public.client_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert client config"
  ON public.calling_metrics_config FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT client_id FROM public.client_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Service role full access on calling_metrics_config"
  ON public.calling_metrics_config FOR ALL
  TO service_role
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_calling_metrics_config_updated_at
  BEFORE UPDATE ON public.calling_metrics_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create default config for existing clients
INSERT INTO public.calling_metrics_config (client_id)
SELECT id FROM public.clients
ON CONFLICT (client_id) DO NOTHING;