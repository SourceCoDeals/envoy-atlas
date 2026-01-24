-- Add AI categorization columns to smartlead_inbox_webhooks
ALTER TABLE public.smartlead_inbox_webhooks 
ADD COLUMN IF NOT EXISTS ai_category TEXT,
ADD COLUMN IF NOT EXISTS ai_sentiment TEXT,
ADD COLUMN IF NOT EXISTS ai_is_positive BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
ADD COLUMN IF NOT EXISTS categorized_at TIMESTAMP WITH TIME ZONE;

-- Add index for filtering by category
CREATE INDEX IF NOT EXISTS idx_smartlead_inbox_ai_category ON public.smartlead_inbox_webhooks(ai_category);
CREATE INDEX IF NOT EXISTS idx_smartlead_inbox_ai_sentiment ON public.smartlead_inbox_webhooks(ai_sentiment);