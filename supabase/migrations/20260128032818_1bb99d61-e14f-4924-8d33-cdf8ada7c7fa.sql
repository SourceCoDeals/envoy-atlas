-- Add unique constraint for webhook idempotency
-- This prevents duplicate event processing

-- Rename external_id to event_id for clarity and add UNIQUE constraint
-- First, update any NULL values to prevent unique constraint failures
UPDATE public.webhook_events 
SET external_id = 'legacy-' || id::text 
WHERE external_id IS NULL;

-- Create unique index for idempotency (allows NULLs to be duplicated, non-nulls unique per source)
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_idempotency 
  ON public.webhook_events(source_type, external_id) 
  WHERE external_id IS NOT NULL;

-- Add performance indexes referenced in audit
CREATE INDEX IF NOT EXISTS idx_campaigns_engagement_status 
  ON public.campaigns(engagement_id, status);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date_engagement 
  ON public.daily_metrics(date, engagement_id);

CREATE INDEX IF NOT EXISTS idx_cold_calls_date 
  ON public.cold_calls(called_date);

CREATE INDEX IF NOT EXISTS idx_cold_calls_analyst_engagement 
  ON public.cold_calls(analyst, engagement_id);

-- Partial index for active campaigns only
CREATE INDEX IF NOT EXISTS idx_campaigns_active 
  ON public.campaigns(engagement_id, updated_at) 
  WHERE status IN ('active', 'started', 'running');