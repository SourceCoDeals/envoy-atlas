-- Drop the existing platform check constraint and recreate with nocodb
ALTER TABLE api_connections DROP CONSTRAINT IF EXISTS api_connections_platform_check;

ALTER TABLE api_connections ADD CONSTRAINT api_connections_platform_check 
CHECK (platform IN ('smartlead', 'replyio', 'phoneburner', 'nocodb'));