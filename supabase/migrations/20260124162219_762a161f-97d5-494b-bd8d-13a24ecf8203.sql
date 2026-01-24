-- Create table to store SmartLead webhook responses
CREATE TABLE public.smartlead_inbox_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Campaign info
  campaign_status TEXT,
  campaign_name TEXT,
  campaign_id BIGINT,
  
  -- Lead identifiers
  stats_id TEXT,
  sl_email_lead_id TEXT,
  sl_email_lead_map_id BIGINT,
  sl_lead_email TEXT,
  
  -- Email details
  from_email TEXT,
  to_email TEXT,
  to_name TEXT,
  cc_emails JSONB DEFAULT '[]'::jsonb,
  subject TEXT,
  message_id TEXT,
  
  -- Sent message
  sent_message_body TEXT,
  sent_message JSONB,
  
  -- Reply details
  time_replied TIMESTAMP WITH TIME ZONE,
  event_timestamp TIMESTAMP WITH TIME ZONE,
  reply_message JSONB,
  reply_body TEXT,
  preview_text TEXT,
  
  -- Sequence info
  sequence_number INTEGER,
  
  -- Links and metadata
  secret_key TEXT,
  app_url TEXT,
  ui_master_inbox_link TEXT,
  description TEXT,
  metadata JSONB,
  lead_correspondence JSONB,
  
  -- Webhook info
  webhook_url TEXT,
  webhook_id BIGINT,
  webhook_name TEXT,
  event_type TEXT,
  
  -- Client reference (nullable as per example)
  client_id TEXT,
  
  -- Raw payload for debugging
  raw_payload JSONB,
  
  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for common queries
CREATE INDEX idx_smartlead_inbox_webhooks_campaign_id ON public.smartlead_inbox_webhooks(campaign_id);
CREATE INDEX idx_smartlead_inbox_webhooks_sl_lead_email ON public.smartlead_inbox_webhooks(sl_lead_email);
CREATE INDEX idx_smartlead_inbox_webhooks_event_type ON public.smartlead_inbox_webhooks(event_type);
CREATE INDEX idx_smartlead_inbox_webhooks_created_at ON public.smartlead_inbox_webhooks(created_at DESC);
CREATE INDEX idx_smartlead_inbox_webhooks_time_replied ON public.smartlead_inbox_webhooks(time_replied DESC);

-- Enable RLS
ALTER TABLE public.smartlead_inbox_webhooks ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for edge function)
CREATE POLICY "Service role can manage smartlead_inbox_webhooks"
ON public.smartlead_inbox_webhooks
FOR ALL
USING (true)
WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read smartlead_inbox_webhooks"
ON public.smartlead_inbox_webhooks
FOR SELECT
TO authenticated
USING (true);

-- Add comment
COMMENT ON TABLE public.smartlead_inbox_webhooks IS 'Stores SmartLead webhook responses forwarded from n8n';