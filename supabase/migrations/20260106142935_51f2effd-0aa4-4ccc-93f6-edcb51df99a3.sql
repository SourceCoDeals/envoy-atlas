-- Ensure Reply.io sync upserts work by adding the missing uniqueness constraint used by onConflict
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'leads_workspace_platform_platform_lead_id_uidx'
  ) THEN
    CREATE UNIQUE INDEX leads_workspace_platform_platform_lead_id_uidx
      ON public.leads (workspace_id, platform, platform_lead_id);
  END IF;
END $$;