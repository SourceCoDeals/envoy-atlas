-- Add unique constraint for hourly_metrics upsert
ALTER TABLE hourly_metrics ADD CONSTRAINT hourly_metrics_workspace_campaign_date_hour_unique 
  UNIQUE (workspace_id, campaign_id, date, hour);

-- Add unique constraint for sequence_steps
ALTER TABLE sequence_steps ADD CONSTRAINT sequence_steps_campaign_step_unique 
  UNIQUE (campaign_id, step_number);

-- Create partial unique index for daily_metrics (for upsert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_metrics_campaign_level 
  ON daily_metrics (workspace_id, campaign_id, date) 
  WHERE variant_id IS NULL AND email_account_id IS NULL AND segment_id IS NULL;