-- Add unique constraint to replyio_message_events for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS replyio_message_events_unique_message 
ON replyio_message_events (workspace_id, campaign_id, message_id);

-- Add index on campaign_id for faster filtering
CREATE INDEX IF NOT EXISTS replyio_message_events_campaign_id_idx 
ON replyio_message_events (campaign_id);

-- Add index on event_type for filtering replies
CREATE INDEX IF NOT EXISTS replyio_message_events_event_type_idx 
ON replyio_message_events (event_type);