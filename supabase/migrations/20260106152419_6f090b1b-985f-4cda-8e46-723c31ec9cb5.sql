-- Table 1: Store extracted features for each variant
CREATE TABLE public.campaign_variant_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.campaign_variants(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Subject line features
  subject_char_count INTEGER,
  subject_word_count INTEGER,
  subject_is_question BOOLEAN DEFAULT FALSE,
  subject_has_number BOOLEAN DEFAULT FALSE,
  subject_has_emoji BOOLEAN DEFAULT FALSE,
  subject_personalization_position INTEGER,
  subject_personalization_count INTEGER DEFAULT 0,
  subject_first_word_type TEXT, -- 'name', 'company', 'question', 'verb', 'adjective', 'other'
  subject_capitalization_style TEXT, -- 'title_case', 'sentence_case', 'lowercase', 'mixed'
  subject_spam_score DECIMAL(5,2) DEFAULT 0,
  
  -- Body features
  body_word_count INTEGER,
  body_sentence_count INTEGER,
  body_avg_sentence_length DECIMAL(5,2),
  body_reading_grade DECIMAL(5,2),
  body_personalization_density DECIMAL(5,4),
  body_personalization_types TEXT[], -- array of token types used
  body_has_link BOOLEAN DEFAULT FALSE,
  body_link_count INTEGER DEFAULT 0,
  body_has_calendar_link BOOLEAN DEFAULT FALSE,
  body_cta_type TEXT, -- 'soft_ask', 'direct_ask', 'choice_ask', 'value_ask', 'referral_ask', 'question_only', 'no_cta'
  body_cta_position TEXT, -- 'beginning', 'middle', 'end'
  body_question_count INTEGER DEFAULT 0,
  body_has_proof BOOLEAN DEFAULT FALSE,
  body_tone TEXT, -- 'formal', 'casual', 'direct', 'consultative'
  body_paragraph_count INTEGER DEFAULT 1,
  body_bullet_point_count INTEGER DEFAULT 0,
  
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(variant_id)
);

-- Table 2: Store pattern analysis results
CREATE TABLE public.copy_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  pattern_name TEXT NOT NULL,
  pattern_description TEXT,
  pattern_type TEXT NOT NULL, -- 'subject', 'body', 'cta', 'combined'
  pattern_criteria JSONB NOT NULL, -- e.g., {"subject_is_question": true, "body_cta_type": "choice_ask"}
  
  -- Performance metrics
  reply_rate DECIMAL(7,4),
  reply_rate_lift DECIMAL(7,4),
  positive_rate DECIMAL(7,4),
  positive_rate_lift DECIMAL(7,4),
  meeting_rate DECIMAL(7,4),
  meeting_rate_lift DECIMAL(7,4),
  open_rate DECIMAL(7,4),
  open_rate_lift DECIMAL(7,4),
  
  -- Statistical measures
  sample_size INTEGER NOT NULL DEFAULT 0,
  confidence_level TEXT, -- 'high', 'medium', 'low', 'insufficient'
  p_value DECIMAL(10,8),
  confidence_interval_lower DECIMAL(7,4),
  confidence_interval_upper DECIMAL(7,4),
  
  -- Segment/context effects
  segment_effects JSONB, -- how pattern varies by audience segment
  step_effects JSONB, -- how pattern varies by email step
  interaction_effects JSONB, -- effects when combined with other patterns
  
  -- Validation
  is_validated BOOLEAN DEFAULT FALSE,
  validated_at TIMESTAMP WITH TIME ZONE,
  
  last_computed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 3: Store decay tracking for variants
CREATE TABLE public.variant_decay_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.campaign_variants(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Performance tracking
  initial_reply_rate DECIMAL(7,4),
  current_reply_rate DECIMAL(7,4),
  initial_positive_rate DECIMAL(7,4),
  current_positive_rate DECIMAL(7,4),
  decay_percentage DECIMAL(7,4),
  
  -- Sample tracking
  initial_sample_size INTEGER, -- first 25% of sends
  current_sample_size INTEGER, -- last 25% of sends
  total_sends INTEGER,
  
  -- Decay status
  is_decaying BOOLEAN DEFAULT FALSE,
  decay_severity TEXT, -- 'mild', 'moderate', 'severe'
  decay_detected_at TIMESTAMP WITH TIME ZONE,
  decay_diagnosis TEXT, -- AI-generated explanation
  
  -- Statistical validation
  is_statistically_significant BOOLEAN DEFAULT FALSE,
  p_value DECIMAL(10,8),
  
  last_computed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(variant_id)
);

-- Create indexes for performance
CREATE INDEX idx_variant_features_workspace ON public.campaign_variant_features(workspace_id);
CREATE INDEX idx_variant_features_variant ON public.campaign_variant_features(variant_id);
CREATE INDEX idx_variant_features_cta_type ON public.campaign_variant_features(body_cta_type);
CREATE INDEX idx_variant_features_question ON public.campaign_variant_features(subject_is_question);

CREATE INDEX idx_copy_patterns_workspace ON public.copy_patterns(workspace_id);
CREATE INDEX idx_copy_patterns_type ON public.copy_patterns(pattern_type);
CREATE INDEX idx_copy_patterns_confidence ON public.copy_patterns(confidence_level);

CREATE INDEX idx_decay_tracking_workspace ON public.variant_decay_tracking(workspace_id);
CREATE INDEX idx_decay_tracking_decaying ON public.variant_decay_tracking(is_decaying) WHERE is_decaying = TRUE;

-- Enable RLS
ALTER TABLE public.campaign_variant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_decay_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaign_variant_features
CREATE POLICY "workspace_variant_features"
ON public.campaign_variant_features
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = campaign_variant_features.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
);

-- RLS Policies for copy_patterns
CREATE POLICY "workspace_copy_patterns"
ON public.copy_patterns
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = copy_patterns.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
);

-- RLS Policies for variant_decay_tracking
CREATE POLICY "workspace_decay_tracking"
ON public.variant_decay_tracking
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = variant_decay_tracking.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
);

-- Trigger to update updated_at
CREATE TRIGGER update_variant_features_updated_at
  BEFORE UPDATE ON public.campaign_variant_features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_copy_patterns_updated_at
  BEFORE UPDATE ON public.copy_patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_decay_tracking_updated_at
  BEFORE UPDATE ON public.variant_decay_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();