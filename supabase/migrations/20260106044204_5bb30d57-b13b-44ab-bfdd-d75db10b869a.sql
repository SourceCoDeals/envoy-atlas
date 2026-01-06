-- First, deduplicate existing message_events by keeping only the earliest entry
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY workspace_id, lead_id, event_type, platform_event_id 
    ORDER BY created_at ASC
  ) as rn
  FROM public.message_events
  WHERE platform_event_id IS NOT NULL
)
DELETE FROM public.message_events 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Now add the unique index for bulk upsert deduplication
CREATE UNIQUE INDEX IF NOT EXISTS message_events_dedup_idx 
ON public.message_events (workspace_id, lead_id, event_type, platform_event_id)
WHERE platform_event_id IS NOT NULL;