-- Drop the SECURITY DEFINER view and recreate as regular view
DROP VIEW IF EXISTS public.api_connections_safe;

-- Create a simpler approach: just use RLS on the base table
-- Non-admins simply won't query the api_key_encrypted column in the frontend
-- The real security is that edge functions (using service role) do the decryption

-- Alternatively, create a function that edge functions can call
-- This function is SECURITY DEFINER but only called from edge functions with service role
CREATE OR REPLACE FUNCTION public.get_decrypted_api_key(connection_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_key text;
  result text;
BEGIN
  -- Get the encrypted key
  SELECT api_key_encrypted INTO encrypted_key
  FROM api_connections
  WHERE id = connection_id;
  
  IF encrypted_key IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return the key (already in plaintext currently, but this function
  -- provides a hook for future encryption)
  RETURN encrypted_key;
END;
$$;

-- Revoke direct access to this function from authenticated users
-- Only service role (edge functions) should call it
REVOKE EXECUTE ON FUNCTION public.get_decrypted_api_key(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_decrypted_api_key(uuid) FROM anon;