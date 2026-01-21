-- Comprehensive remediation migration (using client_members for RBAC)
-- Adds: function_logs table, sync_errors table, performance indexes

-- 1. Function logs table for structured logging
CREATE TABLE IF NOT EXISTS public.function_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  metadata JSONB,
  engagement_id UUID,
  workspace_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on function_logs
ALTER TABLE public.function_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for function_logs (admin-only read, write via service role)
CREATE POLICY "Admins can view function logs"
  ON public.function_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR
    (
      workspace_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.client_members
        WHERE client_id = function_logs.workspace_id
          AND user_id = auth.uid()
          AND role = 'admin'
      )
    )
  );

-- Index for querying logs by function and time
CREATE INDEX IF NOT EXISTS idx_function_logs_function_created 
  ON public.function_logs(function_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_function_logs_level_created 
  ON public.function_logs(level, created_at DESC) 
  WHERE level IN ('warn', 'error');

-- 2. Sync errors table (dead letter queue)
CREATE TABLE IF NOT EXISTS public.sync_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  data_source_id UUID,
  platform TEXT NOT NULL,
  operation TEXT NOT NULL,
  error_message TEXT NOT NULL,
  record_id TEXT,
  raw_data JSONB,
  retry_count INTEGER DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on sync_errors
ALTER TABLE public.sync_errors ENABLE ROW LEVEL SECURITY;

-- RLS policies for sync_errors
CREATE POLICY "Workspace admins can view sync errors"
  ON public.sync_errors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_members
      WHERE client_id = sync_errors.workspace_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Workspace admins can resolve sync errors"
  ON public.sync_errors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.client_members
      WHERE client_id = sync_errors.workspace_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- Index for unresolved errors
CREATE INDEX IF NOT EXISTS idx_sync_errors_unresolved 
  ON public.sync_errors(workspace_id, created_at DESC) 
  WHERE resolved_at IS NULL;

-- 3. Performance indexes for common query patterns (non-concurrent)
-- Email activities indexes
CREATE INDEX IF NOT EXISTS idx_email_activities_engagement_campaign 
  ON public.email_activities(engagement_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_email_activities_engagement_created 
  ON public.email_activities(engagement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_activities_campaign_sent 
  ON public.email_activities(campaign_id, sent_at DESC) 
  WHERE sent = true;

-- Partial index for positive replies (commonly queried)
CREATE INDEX IF NOT EXISTS idx_email_activities_positive_replies 
  ON public.email_activities(engagement_id, campaign_id, replied_at DESC) 
  WHERE reply_category IN ('meeting_request', 'interested');

-- Call activities indexes
CREATE INDEX IF NOT EXISTS idx_call_activities_engagement_created 
  ON public.call_activities(engagement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_activities_engagement_disposition 
  ON public.call_activities(engagement_id, disposition);

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_engagement_email 
  ON public.contacts(engagement_id, email);

CREATE INDEX IF NOT EXISTS idx_contacts_company_id 
  ON public.contacts(company_id);

-- Campaigns index
CREATE INDEX IF NOT EXISTS idx_campaigns_engagement_status 
  ON public.campaigns(engagement_id, status);

-- 4. Auto-cleanup old logs function
CREATE OR REPLACE FUNCTION public.cleanup_old_function_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.function_logs 
  WHERE created_at < now() - interval '30 days';
END;
$$;