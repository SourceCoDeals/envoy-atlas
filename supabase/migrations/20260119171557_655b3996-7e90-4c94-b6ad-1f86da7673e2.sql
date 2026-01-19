-- Create enrollment_snapshots table for tracking daily enrollment stats
CREATE TABLE public.enrollment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  engagement_id UUID REFERENCES public.engagements(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_leads INTEGER DEFAULT 0,
  not_started INTEGER DEFAULT 0,
  in_progress INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  blocked INTEGER DEFAULT 0,
  paused INTEGER DEFAULT 0,
  unsubscribed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, date)
);

-- Create index for faster queries
CREATE INDEX idx_enrollment_snapshots_engagement_date ON public.enrollment_snapshots(engagement_id, date);
CREATE INDEX idx_enrollment_snapshots_campaign_date ON public.enrollment_snapshots(campaign_id, date);

-- Enable RLS
ALTER TABLE public.enrollment_snapshots ENABLE ROW LEVEL SECURITY;

-- Service role can manage snapshots
CREATE POLICY "Service role manages enrollment snapshots"
ON public.enrollment_snapshots
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view snapshots for their engagements
CREATE POLICY "Users can view enrollment snapshots"
ON public.enrollment_snapshots
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM engagements e
  WHERE e.id = enrollment_snapshots.engagement_id
  AND is_client_member(e.client_id, auth.uid())
));