-- Add platform_variant_id to campaign_variants for Smartlead variant tracking
ALTER TABLE public.campaign_variants 
ADD COLUMN IF NOT EXISTS platform_variant_id text;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_campaign_variants_platform_variant_id 
ON public.campaign_variants(platform_variant_id);

-- Add last_full_sync_at and sync_progress to api_connections
ALTER TABLE public.api_connections 
ADD COLUMN IF NOT EXISTS last_full_sync_at timestamptz,
ADD COLUMN IF NOT EXISTS sync_progress jsonb;