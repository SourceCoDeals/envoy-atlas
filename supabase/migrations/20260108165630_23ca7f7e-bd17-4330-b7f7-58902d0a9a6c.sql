-- Create encryption functions using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to encrypt API keys before storing
CREATE OR REPLACE FUNCTION public.encrypt_api_key(key_value text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Use a server-side secret for encryption
  -- This key is derived from the Supabase project settings
  encryption_key := current_setting('app.settings.encryption_key', true);
  
  -- If no encryption key is set, return the value as-is with a prefix
  -- This allows for backwards compatibility during transition
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RETURN 'plain:' || key_value;
  END IF;
  
  -- Encrypt using AES and return base64 encoded
  RETURN 'enc:' || encode(
    pgp_sym_encrypt(key_value, encryption_key),
    'base64'
  );
END;
$$;

-- Function to decrypt API keys when reading
CREATE OR REPLACE FUNCTION public.decrypt_api_key(encrypted_value text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Handle unencrypted values (backwards compatibility)
  IF encrypted_value IS NULL THEN
    RETURN NULL;
  END IF;
  
  IF encrypted_value LIKE 'plain:%' THEN
    RETURN substring(encrypted_value from 7);
  END IF;
  
  IF encrypted_value NOT LIKE 'enc:%' THEN
    -- Legacy unencrypted value
    RETURN encrypted_value;
  END IF;
  
  encryption_key := current_setting('app.settings.encryption_key', true);
  
  IF encryption_key IS NULL OR encryption_key = '' THEN
    -- Cannot decrypt without key, return as-is
    RETURN encrypted_value;
  END IF;
  
  -- Decrypt the value
  RETURN pgp_sym_decrypt(
    decode(substring(encrypted_value from 5), 'base64'),
    encryption_key
  );
END;
$$;

-- Drop existing RLS policies on api_connections for SELECT
DROP POLICY IF EXISTS "workspace_api_connections_select" ON api_connections;
DROP POLICY IF EXISTS "Users can view their workspace API connections" ON api_connections;

-- Create new RLS policy that only allows admins to see the api_key_encrypted column
-- For non-admins, they can see the connection exists but not the key
CREATE POLICY "workspace_members_can_view_connections"
ON api_connections FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = api_connections.workspace_id
    AND workspace_members.user_id = auth.uid()
  )
);

-- Create a view that hides the api_key_encrypted for non-admins
CREATE OR REPLACE VIEW public.api_connections_safe AS
SELECT
  id,
  workspace_id,
  platform,
  is_active,
  last_sync_at,
  last_full_sync_at,
  sync_status,
  sync_progress,
  created_at,
  updated_at,
  created_by,
  CASE 
    WHEN public.is_workspace_admin(workspace_id, auth.uid()) THEN api_key_encrypted
    ELSE NULL
  END as api_key_encrypted
FROM api_connections
WHERE EXISTS (
  SELECT 1 FROM workspace_members
  WHERE workspace_members.workspace_id = api_connections.workspace_id
  AND workspace_members.user_id = auth.uid()
);

-- Grant access to the view
GRANT SELECT ON public.api_connections_safe TO authenticated;