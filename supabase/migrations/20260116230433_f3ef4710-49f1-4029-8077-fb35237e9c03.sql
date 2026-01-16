-- Add unique constraint on replyio_message_events (using DO block for conditional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'replyio_message_events_unique_message'
  ) THEN
    ALTER TABLE public.replyio_message_events 
    ADD CONSTRAINT replyio_message_events_unique_message 
    UNIQUE (workspace_id, campaign_id, message_id);
  END IF;
END $$;