-- Create campaign_alerts table
CREATE TABLE IF NOT EXISTS public.campaign_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('bounce_spike', 'stalled', 'reply_drop', 'deliverability', 'opportunity')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  message text NOT NULL,
  details jsonb,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_campaign_alerts_campaign ON public.campaign_alerts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_alerts_unresolved ON public.campaign_alerts(is_resolved) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_campaign_alerts_created ON public.campaign_alerts(created_at DESC);

-- Enable RLS
ALTER TABLE public.campaign_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can read alerts for campaigns they have access to
CREATE POLICY "Users can read alerts for their campaigns"
ON public.campaign_alerts
FOR SELECT
USING (
  campaign_id IN (
    SELECT c.id FROM campaigns c
    JOIN engagements e ON c.engagement_id = e.id
    JOIN clients cl ON e.client_id = cl.id
    JOIN client_members cm ON cl.id = cm.client_id
    WHERE cm.user_id = auth.uid()
  )
);

-- RLS policy: Users can update alerts (resolve them)
CREATE POLICY "Users can resolve alerts for their campaigns"
ON public.campaign_alerts
FOR UPDATE
USING (
  campaign_id IN (
    SELECT c.id FROM campaigns c
    JOIN engagements e ON c.engagement_id = e.id
    JOIN clients cl ON e.client_id = cl.id
    JOIN client_members cm ON cl.id = cm.client_id
    WHERE cm.user_id = auth.uid()
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_campaign_alerts_updated_at
BEFORE UPDATE ON public.campaign_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();