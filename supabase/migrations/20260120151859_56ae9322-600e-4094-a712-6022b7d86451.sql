-- Add missing columns for comprehensive calling analytics

-- DM conversation flag
ALTER TABLE call_activities ADD COLUMN IF NOT EXISTS is_dm_conversation BOOLEAN DEFAULT false;

-- AI Scores from NocoDB (1-10 scale)
ALTER TABLE call_activities ADD COLUMN IF NOT EXISTS seller_interest_score DECIMAL(3,1);
ALTER TABLE call_activities ADD COLUMN IF NOT EXISTS quality_of_conversation_score DECIMAL(3,1);
ALTER TABLE call_activities ADD COLUMN IF NOT EXISTS objection_handling_score DECIMAL(3,1);
ALTER TABLE call_activities ADD COLUMN IF NOT EXISTS script_adherence_score DECIMAL(3,1);
ALTER TABLE call_activities ADD COLUMN IF NOT EXISTS value_proposition_score DECIMAL(3,1);
ALTER TABLE call_activities ADD COLUMN IF NOT EXISTS composite_score DECIMAL(3,1);

-- Call content additions
ALTER TABLE call_activities ADD COLUMN IF NOT EXISTS call_summary TEXT;
ALTER TABLE call_activities ADD COLUMN IF NOT EXISTS objections_list TEXT[];

-- Source tracking
ALTER TABLE call_activities ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'phoneburner';
ALTER TABLE call_activities ADD COLUMN IF NOT EXISTS nocodb_row_id TEXT;

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_call_activities_started_at ON call_activities(started_at);
CREATE INDEX IF NOT EXISTS idx_call_activities_disposition ON call_activities(disposition);
CREATE INDEX IF NOT EXISTS idx_call_activities_caller_name ON call_activities(caller_name);
CREATE INDEX IF NOT EXISTS idx_call_activities_nocodb_row_id ON call_activities(nocodb_row_id);
CREATE INDEX IF NOT EXISTS idx_call_activities_engagement_started ON call_activities(engagement_id, started_at);

-- Create daily calling metrics table for aggregated analytics
CREATE TABLE IF NOT EXISTS daily_calling_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  caller_name TEXT,
  
  -- Activity counts
  total_dials INTEGER DEFAULT 0,
  connections INTEGER DEFAULT 0,
  conversations INTEGER DEFAULT 0,
  dm_conversations INTEGER DEFAULT 0,
  meetings_booked INTEGER DEFAULT 0,
  voicemails_left INTEGER DEFAULT 0,
  
  -- Duration
  total_talk_time_seconds INTEGER DEFAULT 0,
  avg_call_duration_seconds INTEGER DEFAULT 0,
  
  -- Calculated rates (stored as percentages 0-100)
  connect_rate DECIMAL(5,2) DEFAULT 0,
  conversation_rate DECIMAL(5,2) DEFAULT 0,
  meeting_rate DECIMAL(5,2) DEFAULT 0,
  voicemail_rate DECIMAL(5,2) DEFAULT 0,
  
  -- AI score averages
  avg_interest_score DECIMAL(3,1),
  avg_quality_score DECIMAL(3,1),
  avg_composite_score DECIMAL(3,1),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(engagement_id, date, caller_name)
);

-- Indexes for daily_calling_metrics
CREATE INDEX IF NOT EXISTS idx_daily_calling_metrics_date ON daily_calling_metrics(date);
CREATE INDEX IF NOT EXISTS idx_daily_calling_metrics_engagement ON daily_calling_metrics(engagement_id);

-- Enable RLS
ALTER TABLE daily_calling_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_calling_metrics
CREATE POLICY "Users can view daily calling metrics for their engagements"
ON daily_calling_metrics
FOR SELECT
USING (
  engagement_id IN (
    SELECT e.id FROM engagements e
    JOIN clients c ON e.client_id = c.id
    JOIN client_members cm ON cm.client_id = c.id
    WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert daily calling metrics for their engagements"
ON daily_calling_metrics
FOR INSERT
WITH CHECK (
  engagement_id IN (
    SELECT e.id FROM engagements e
    JOIN clients c ON e.client_id = c.id
    JOIN client_members cm ON cm.client_id = c.id
    WHERE cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update daily calling metrics for their engagements"
ON daily_calling_metrics
FOR UPDATE
USING (
  engagement_id IN (
    SELECT e.id FROM engagements e
    JOIN clients c ON e.client_id = c.id
    JOIN client_members cm ON cm.client_id = c.id
    WHERE cm.user_id = auth.uid()
  )
);