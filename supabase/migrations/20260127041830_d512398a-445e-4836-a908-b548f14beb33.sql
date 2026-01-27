-- Create the daily snapshots table for tracking campaign metrics over time
CREATE TABLE public.nocodb_campaign_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('smartlead', 'replyio')),
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT,
  
  -- Email metrics (cumulative)
  emails_sent INTEGER DEFAULT 0,
  emails_delivered INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  positive_replies INTEGER DEFAULT 0,
  
  -- Lead/people metrics
  total_leads INTEGER DEFAULT 0,
  leads_active INTEGER DEFAULT 0,
  leads_completed INTEGER DEFAULT 0,
  leads_paused INTEGER DEFAULT 0,
  
  -- Reply.io specific
  optouts INTEGER DEFAULT 0,
  ooos INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate snapshots for same campaign on same day
  UNIQUE(snapshot_date, platform, campaign_id)
);

-- Indexes for common queries
CREATE INDEX idx_snapshots_date ON nocodb_campaign_daily_snapshots(snapshot_date);
CREATE INDEX idx_snapshots_campaign ON nocodb_campaign_daily_snapshots(campaign_id);
CREATE INDEX idx_snapshots_platform_date ON nocodb_campaign_daily_snapshots(platform, snapshot_date);

-- Enable RLS
ALTER TABLE public.nocodb_campaign_daily_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read snapshots
CREATE POLICY "Authenticated users can view snapshots"
ON public.nocodb_campaign_daily_snapshots
FOR SELECT
TO authenticated
USING (true);

-- Create view for daily deltas (changes between snapshots)
CREATE OR REPLACE VIEW public.nocodb_campaign_daily_deltas AS
SELECT 
  s.snapshot_date,
  s.platform,
  s.campaign_id,
  s.campaign_name,
  s.status,
  s.emails_sent,
  s.emails_replied,
  s.emails_bounced,
  s.positive_replies,
  s.total_leads,
  -- Calculate deltas using LAG
  s.emails_sent - COALESCE(LAG(s.emails_sent) OVER w, 0) AS emails_sent_delta,
  s.emails_replied - COALESCE(LAG(s.emails_replied) OVER w, 0) AS emails_replied_delta,
  s.emails_bounced - COALESCE(LAG(s.emails_bounced) OVER w, 0) AS emails_bounced_delta,
  s.positive_replies - COALESCE(LAG(s.positive_replies) OVER w, 0) AS positive_delta,
  LAG(s.snapshot_date) OVER w AS prev_snapshot_date,
  s.snapshot_date - COALESCE(LAG(s.snapshot_date) OVER w, s.snapshot_date) AS days_since_last
FROM public.nocodb_campaign_daily_snapshots s
WINDOW w AS (PARTITION BY s.platform, s.campaign_id ORDER BY s.snapshot_date);

-- Create view for aggregate daily totals
CREATE OR REPLACE VIEW public.nocodb_daily_totals AS
WITH daily_by_platform AS (
  SELECT 
    snapshot_date,
    platform,
    COUNT(*) AS total_campaigns,
    SUM(emails_sent) AS total_sent,
    SUM(emails_replied) AS total_replied,
    SUM(emails_bounced) AS total_bounced,
    SUM(positive_replies) AS total_positive,
    SUM(total_leads) AS total_leads
  FROM public.nocodb_campaign_daily_snapshots
  GROUP BY snapshot_date, platform
),
with_deltas AS (
  SELECT 
    snapshot_date,
    platform,
    total_campaigns,
    total_sent,
    total_replied,
    total_bounced,
    total_positive,
    total_leads,
    total_sent - COALESCE(LAG(total_sent) OVER (PARTITION BY platform ORDER BY snapshot_date), 0) AS sent_delta,
    total_replied - COALESCE(LAG(total_replied) OVER (PARTITION BY platform ORDER BY snapshot_date), 0) AS replied_delta
  FROM daily_by_platform
)
SELECT * FROM with_deltas
UNION ALL
SELECT 
  snapshot_date,
  'all' AS platform,
  SUM(total_campaigns)::INTEGER AS total_campaigns,
  SUM(total_sent)::INTEGER AS total_sent,
  SUM(total_replied)::INTEGER AS total_replied,
  SUM(total_bounced)::INTEGER AS total_bounced,
  SUM(total_positive)::INTEGER AS total_positive,
  SUM(total_leads)::INTEGER AS total_leads,
  SUM(sent_delta)::INTEGER AS sent_delta,
  SUM(replied_delta)::INTEGER AS replied_delta
FROM with_deltas
GROUP BY snapshot_date;