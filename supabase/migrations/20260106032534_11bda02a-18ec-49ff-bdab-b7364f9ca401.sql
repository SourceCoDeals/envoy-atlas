-- Add unique constraint for leads upsert (workspace_id, campaign_id, platform, platform_lead_id)
ALTER TABLE public.leads 
ADD CONSTRAINT leads_workspace_campaign_platform_lead_unique 
UNIQUE (workspace_id, campaign_id, platform, platform_lead_id);

-- Add unique constraint for campaign_variants upsert (campaign_id, platform_variant_id)
ALTER TABLE public.campaign_variants 
ADD CONSTRAINT campaign_variants_campaign_platform_unique 
UNIQUE (campaign_id, platform_variant_id);

-- Add index for message_events deduplication checks
CREATE INDEX IF NOT EXISTS idx_message_events_dedupe 
ON public.message_events (workspace_id, lead_id, event_type, platform_event_id);