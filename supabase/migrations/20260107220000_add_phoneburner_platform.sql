-- Add phoneburner to api_connections platform constraint
-- First drop the existing constraint, then add a new one with phoneburner included

ALTER TABLE public.api_connections
DROP CONSTRAINT IF EXISTS api_connections_platform_check;

ALTER TABLE public.api_connections
ADD CONSTRAINT api_connections_platform_check
CHECK (platform IN ('smartlead', 'replyio', 'phoneburner'));

-- Also update leads table if it has a platform constraint
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_platform_check;

-- Add comment for documentation
COMMENT ON TABLE public.api_connections IS 'Stores API connections for external platforms (smartlead, replyio, phoneburner)';
