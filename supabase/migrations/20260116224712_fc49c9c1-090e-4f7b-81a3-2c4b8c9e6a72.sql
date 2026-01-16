
-- Add missing unique constraint for smartlead_message_events to enable proper upsert
CREATE UNIQUE INDEX IF NOT EXISTS smartlead_message_events_workspace_campaign_message_key 
ON smartlead_message_events(workspace_id, campaign_id, message_id);
