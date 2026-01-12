-- Add new columns to external_calls table for NocoDB sync
ALTER TABLE public.external_calls 
ADD COLUMN IF NOT EXISTS salesforce_url text,
ADD COLUMN IF NOT EXISTS call_date date,
ADD COLUMN IF NOT EXISTS call_direction text,
ADD COLUMN IF NOT EXISTS from_number text,
ADD COLUMN IF NOT EXISTS to_number text,
ADD COLUMN IF NOT EXISTS engagement_name text,
ADD COLUMN IF NOT EXISTS decision_maker_score numeric,
ADD COLUMN IF NOT EXISTS decision_maker_justification text,
ADD COLUMN IF NOT EXISTS referral_rate_score numeric,
ADD COLUMN IF NOT EXISTS referral_rate_justification text,
ADD COLUMN IF NOT EXISTS not_interested_reason text,
ADD COLUMN IF NOT EXISTS nocodb_created_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS nocodb_updated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rep_name text;

-- Create index for faster rep/analyst queries
CREATE INDEX IF NOT EXISTS idx_external_calls_rep_name ON public.external_calls(rep_name);
CREATE INDEX IF NOT EXISTS idx_external_calls_engagement_name ON public.external_calls(engagement_name);
CREATE INDEX IF NOT EXISTS idx_external_calls_call_category ON public.external_calls(call_category);
CREATE INDEX IF NOT EXISTS idx_external_calls_date_time ON public.external_calls(date_time DESC);
CREATE INDEX IF NOT EXISTS idx_external_calls_composite_score ON public.external_calls(composite_score DESC);

-- Update comment on table
COMMENT ON TABLE public.external_calls IS 'External call records synced from NocoDB with AI scores for caller dashboard analytics';