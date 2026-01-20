-- Add metrics_hash column to campaigns table for incremental sync optimization
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS metrics_hash TEXT;