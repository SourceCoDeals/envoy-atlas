-- Add deliverability-specific columns to sending_domains
ALTER TABLE sending_domains 
ADD COLUMN IF NOT EXISTS domain_age_days INTEGER,
ADD COLUMN IF NOT EXISTS warmup_percentage NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS google_postmaster_reputation TEXT,
ADD COLUMN IF NOT EXISTS microsoft_snds_status TEXT,
ADD COLUMN IF NOT EXISTS blacklist_status TEXT DEFAULT 'clean',
ADD COLUMN IF NOT EXISTS blacklisted_on TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_blacklist_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS daily_volume_limit INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_volume_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bounce_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS reply_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS spam_complaint_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS domain_status TEXT DEFAULT 'active';

-- Add deliverability-specific columns to email_accounts
ALTER TABLE email_accounts 
ADD COLUMN IF NOT EXISTS warmup_percentage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS warmup_status TEXT DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS warmup_start_date DATE,
ADD COLUMN IF NOT EXISTS bounce_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS reply_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS spam_complaint_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS sent_30d INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active';

-- Create domain health summary view
CREATE OR REPLACE VIEW domain_health_summary AS
SELECT 
  SUBSTRING(ea.email_address FROM '@(.*)$') as domain,
  ea.workspace_id,
  COUNT(*) as mailbox_count,
  COUNT(CASE WHEN ea.is_active THEN 1 END) as active_mailboxes,
  SUM(ea.daily_limit) as total_daily_capacity,
  AVG(ea.health_score) as avg_health_score,
  AVG(ea.warmup_percentage) as avg_warmup_percentage,
  COUNT(CASE WHEN ea.warmup_enabled THEN 1 END) as warming_up_count,
  AVG(ea.bounce_rate) as avg_bounce_rate,
  AVG(ea.reply_rate) as avg_reply_rate,
  sd.spf_valid,
  sd.dkim_valid,
  sd.dmarc_valid,
  sd.is_bulk_sender,
  sd.blacklist_status,
  sd.google_postmaster_reputation,
  sd.domain_status
FROM email_accounts ea
LEFT JOIN sending_domains sd ON sd.domain = SUBSTRING(ea.email_address FROM '@(.*)$') 
  AND sd.workspace_id = ea.workspace_id
GROUP BY 
  SUBSTRING(ea.email_address FROM '@(.*)$'), 
  ea.workspace_id, 
  sd.spf_valid, 
  sd.dkim_valid, 
  sd.dmarc_valid, 
  sd.is_bulk_sender,
  sd.blacklist_status,
  sd.google_postmaster_reputation,
  sd.domain_status;

-- Create deliverability_alerts table for tracking specific deliverability issues
CREATE TABLE IF NOT EXISTS deliverability_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'bounce_rate', 'spam_complaint', 'blacklist', 'auth_failure', 'warmup_stalled'
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT, -- 'domain', 'email_account', 'campaign'
  entity_id TEXT,
  entity_name TEXT,
  metric_value NUMERIC,
  threshold_value NUMERIC,
  is_read BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on deliverability_alerts
ALTER TABLE deliverability_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for deliverability_alerts
CREATE POLICY "Users can view deliverability alerts in their workspace"
ON deliverability_alerts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = deliverability_alerts.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update deliverability alerts in their workspace"
ON deliverability_alerts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = deliverability_alerts.workspace_id
    AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert deliverability alerts in their workspace"
ON deliverability_alerts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = deliverability_alerts.workspace_id
    AND wm.user_id = auth.uid()
  )
);

-- Create index for faster alert queries
CREATE INDEX IF NOT EXISTS idx_deliverability_alerts_workspace 
ON deliverability_alerts(workspace_id, is_resolved, created_at DESC);

-- Function to check deliverability thresholds and generate alerts
CREATE OR REPLACE FUNCTION check_deliverability_thresholds()
RETURNS TRIGGER AS $$
BEGIN
  -- Check bounce rate thresholds
  IF NEW.bounce_rate IS NOT NULL AND NEW.bounce_rate > 5 THEN
    INSERT INTO deliverability_alerts (
      workspace_id, 
      alert_type, 
      severity, 
      title, 
      message, 
      entity_type, 
      entity_id,
      entity_name,
      metric_value,
      threshold_value
    )
    VALUES (
      NEW.workspace_id,
      'bounce_rate',
      CASE WHEN NEW.bounce_rate > 10 THEN 'critical' ELSE 'warning' END,
      'High Bounce Rate: ' || NEW.email_address,
      'Bounce rate of ' || ROUND(NEW.bounce_rate::numeric, 2) || '% exceeds threshold. This may damage your sender reputation.',
      'email_account',
      NEW.id::text,
      NEW.email_address,
      NEW.bounce_rate,
      5
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Check spam complaint thresholds
  IF NEW.spam_complaint_rate IS NOT NULL AND NEW.spam_complaint_rate > 0.1 THEN
    INSERT INTO deliverability_alerts (
      workspace_id, 
      alert_type, 
      severity, 
      title, 
      message, 
      entity_type, 
      entity_id,
      entity_name,
      metric_value,
      threshold_value
    )
    VALUES (
      NEW.workspace_id,
      'spam_complaint',
      CASE WHEN NEW.spam_complaint_rate > 0.3 THEN 'critical' ELSE 'warning' END,
      'High Spam Complaints: ' || NEW.email_address,
      'Spam complaint rate of ' || ROUND(NEW.spam_complaint_rate::numeric, 3) || '% is above safe threshold.',
      'email_account',
      NEW.id::text,
      NEW.email_address,
      NEW.spam_complaint_rate,
      0.1
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for email_accounts
DROP TRIGGER IF EXISTS check_email_account_thresholds ON email_accounts;
CREATE TRIGGER check_email_account_thresholds
AFTER UPDATE OF bounce_rate, spam_complaint_rate ON email_accounts
FOR EACH ROW
EXECUTE FUNCTION check_deliverability_thresholds();