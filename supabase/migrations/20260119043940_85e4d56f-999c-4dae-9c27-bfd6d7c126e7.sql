-- Add unique constraint for sequences table upserts (replyio-sync)
-- Using IF NOT EXISTS pattern
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sequences_campaign_external_unique'
  ) THEN
    ALTER TABLE public.sequences 
    ADD CONSTRAINT sequences_campaign_external_unique 
    UNIQUE (campaign_id, external_id);
  END IF;
END $$;