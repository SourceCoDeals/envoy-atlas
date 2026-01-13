-- Drop single-column constraints we just added
ALTER TABLE smartlead_variants DROP CONSTRAINT IF EXISTS smartlead_variants_platform_variant_id_key;
ALTER TABLE replyio_variants DROP CONSTRAINT IF EXISTS replyio_variants_platform_variant_id_key;

-- Add composite unique constraints for variants
CREATE UNIQUE INDEX IF NOT EXISTS smartlead_variants_campaign_platform_key ON smartlead_variants(campaign_id, platform_variant_id);
CREATE UNIQUE INDEX IF NOT EXISTS replyio_variants_campaign_platform_key ON replyio_variants(campaign_id, platform_variant_id);

-- Add composite unique constraints for sequence_steps
CREATE UNIQUE INDEX IF NOT EXISTS smartlead_sequence_steps_campaign_step_key ON smartlead_sequence_steps(campaign_id, step_number);
CREATE UNIQUE INDEX IF NOT EXISTS replyio_sequence_steps_campaign_step_key ON replyio_sequence_steps(campaign_id, step_number);

-- Add composite unique constraints for daily_metrics
CREATE UNIQUE INDEX IF NOT EXISTS smartlead_daily_metrics_campaign_date_key ON smartlead_daily_metrics(campaign_id, metric_date);
CREATE UNIQUE INDEX IF NOT EXISTS replyio_daily_metrics_campaign_date_key ON replyio_daily_metrics(campaign_id, metric_date);