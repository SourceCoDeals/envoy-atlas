-- Add variant_id column to smartlead_daily_metrics
ALTER TABLE smartlead_daily_metrics ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES smartlead_variants(id) ON DELETE CASCADE;

-- Add variant_id column to replyio_daily_metrics
ALTER TABLE replyio_daily_metrics ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES replyio_variants(id) ON DELETE CASCADE;

-- Create indexes for variant_id
CREATE INDEX IF NOT EXISTS idx_smartlead_daily_metrics_variant ON smartlead_daily_metrics(variant_id);
CREATE INDEX IF NOT EXISTS idx_replyio_daily_metrics_variant ON replyio_daily_metrics(variant_id);