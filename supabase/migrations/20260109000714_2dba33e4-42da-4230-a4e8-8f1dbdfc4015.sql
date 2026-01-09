-- Add unique constraint for leads upsert from external_calls
CREATE UNIQUE INDEX IF NOT EXISTS leads_workspace_platform_lead_unique 
ON public.leads (workspace_id, platform, platform_lead_id) 
WHERE platform_lead_id IS NOT NULL;