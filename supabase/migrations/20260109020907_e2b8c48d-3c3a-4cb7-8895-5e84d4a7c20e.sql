-- Add unique constraint on workspace_id + email for lead deduplication
CREATE UNIQUE INDEX IF NOT EXISTS leads_workspace_email_unique 
ON public.leads (workspace_id, email);