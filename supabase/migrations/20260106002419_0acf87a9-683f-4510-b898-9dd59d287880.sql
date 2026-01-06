-- Add unique constraints for proper upserts
ALTER TABLE campaigns ADD CONSTRAINT campaigns_workspace_platform_unique 
  UNIQUE (workspace_id, platform_id, platform);

ALTER TABLE email_accounts ADD CONSTRAINT email_accounts_workspace_platform_unique 
  UNIQUE (workspace_id, platform_id, platform);

-- Add sent_at timestamp to message_events
ALTER TABLE message_events ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- Add more lead metadata columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_email_workspace ON leads(email, workspace_id);
CREATE INDEX IF NOT EXISTS idx_message_events_lead_workspace ON message_events(lead_id, workspace_id);