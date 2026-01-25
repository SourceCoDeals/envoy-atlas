-- Add new columns for enhanced call tracking and scoring
ALTER TABLE cold_calls 
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id),
ADD COLUMN IF NOT EXISTS engagement_id UUID REFERENCES engagements(id),
ADD COLUMN IF NOT EXISTS enhanced_score NUMERIC(4,2),
ADD COLUMN IF NOT EXISTS score_breakdown JSONB,
ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS flag_reason TEXT,
ADD COLUMN IF NOT EXISTS rep_notes TEXT,
ADD COLUMN IF NOT EXISTS follow_up_date DATE,
ADD COLUMN IF NOT EXISTS is_first_attempt_dm BOOLEAN DEFAULT false;

-- Create index for performance on new columns
CREATE INDEX IF NOT EXISTS idx_cold_calls_enhanced_score ON cold_calls(enhanced_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_cold_calls_flagged ON cold_calls(flagged_for_review) WHERE flagged_for_review = true;
CREATE INDEX IF NOT EXISTS idx_cold_calls_campaign ON cold_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cold_calls_engagement ON cold_calls(engagement_id);