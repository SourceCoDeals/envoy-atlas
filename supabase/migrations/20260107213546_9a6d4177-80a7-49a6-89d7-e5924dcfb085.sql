-- Add member_id column to phoneburner_daily_metrics for per-member tracking
ALTER TABLE public.phoneburner_daily_metrics 
ADD COLUMN IF NOT EXISTS member_id text;

-- Drop the existing unique constraint if it exists
ALTER TABLE public.phoneburner_daily_metrics 
DROP CONSTRAINT IF EXISTS phoneburner_daily_metrics_workspace_id_date_key;

-- Create new unique constraint including member_id
ALTER TABLE public.phoneburner_daily_metrics 
ADD CONSTRAINT phoneburner_daily_metrics_workspace_date_member_key 
UNIQUE (workspace_id, date, member_id);