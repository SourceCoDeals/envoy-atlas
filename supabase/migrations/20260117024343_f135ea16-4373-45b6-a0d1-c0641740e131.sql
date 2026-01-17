-- Add positive_reply_count column to smartlead_workspace_daily_metrics for consistency
ALTER TABLE smartlead_workspace_daily_metrics
ADD COLUMN IF NOT EXISTS positive_reply_count INTEGER DEFAULT 0;