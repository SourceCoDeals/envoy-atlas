-- Add additional CTA classification columns to features table
ALTER TABLE public.campaign_variant_features
  ADD COLUMN IF NOT EXISTS body_cta_strength TEXT,
  ADD COLUMN IF NOT EXISTS subject_urgency_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS body_value_proposition_count INTEGER;

-- Add decay_severity column to variant_decay_tracking if not exists
ALTER TABLE public.variant_decay_tracking
  ADD COLUMN IF NOT EXISTS decay_severity TEXT;