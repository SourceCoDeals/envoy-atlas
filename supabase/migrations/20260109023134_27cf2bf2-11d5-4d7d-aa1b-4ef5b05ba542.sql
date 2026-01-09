-- Add team assignment columns to engagements table to match the client tracker format
ALTER TABLE engagements
  ADD COLUMN IF NOT EXISTS sponsor TEXT,
  ADD COLUMN IF NOT EXISTS deal_lead TEXT,
  ADD COLUMN IF NOT EXISTS associate_vp TEXT,
  ADD COLUMN IF NOT EXISTS analyst TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low'));