-- Drop the existing platform check constraint
ALTER TABLE public.api_connections DROP CONSTRAINT IF EXISTS api_connections_platform_check;

-- Add updated constraint that includes 'phoneburner'
ALTER TABLE public.api_connections ADD CONSTRAINT api_connections_platform_check 
CHECK (platform IN ('smartlead', 'replyio', 'phoneburner'));