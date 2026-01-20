-- Phase 3: Sync Reliability Tables

-- 3.1 Sync Progress Tracking
CREATE TABLE IF NOT EXISTS public.sync_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid REFERENCES public.data_sources(id) ON DELETE CASCADE,
  engagement_id uuid REFERENCES public.engagements(id) ON DELETE CASCADE,
  status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  total_campaigns int DEFAULT 0,
  processed_campaigns int DEFAULT 0,
  current_campaign_name text,
  current_phase text, -- campaigns, leads, statistics, variants, aggregation
  records_synced int DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  started_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Index for finding running syncs
CREATE INDEX IF NOT EXISTS idx_sync_progress_running 
  ON public.sync_progress(data_source_id) 
  WHERE status = 'running';

-- Index for recent syncs
CREATE INDEX IF NOT EXISTS idx_sync_progress_recent 
  ON public.sync_progress(started_at DESC);

-- 3.2 Retry Queue
CREATE TABLE IF NOT EXISTS public.sync_retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid REFERENCES public.data_sources(id) ON DELETE CASCADE,
  engagement_id uuid REFERENCES public.engagements(id) ON DELETE CASCADE,
  retry_count int DEFAULT 0,
  max_retries int DEFAULT 5,
  last_error text,
  next_retry_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for pending retries
CREATE INDEX IF NOT EXISTS idx_sync_retry_pending 
  ON public.sync_retry_queue(next_retry_at) 
  WHERE status = 'pending';

-- Enable RLS on new tables
ALTER TABLE public.sync_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_retry_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for sync_progress (allow authenticated users to view, service role to modify)
CREATE POLICY "Allow authenticated users to view sync progress"
  ON public.sync_progress FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access to sync progress"
  ON public.sync_progress FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS policies for sync_retry_queue
CREATE POLICY "Allow authenticated users to view retry queue"
  ON public.sync_retry_queue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow service role full access to retry queue"
  ON public.sync_retry_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_sync_progress_updated
  BEFORE UPDATE ON public.sync_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_sync_updated_at();

CREATE TRIGGER trg_sync_retry_updated
  BEFORE UPDATE ON public.sync_retry_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_sync_updated_at();