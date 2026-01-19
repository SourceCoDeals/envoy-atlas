-- Seed the default SourceCo client and provide a safe RPC to join it

-- 1) Ensure SourceCo client exists
INSERT INTO public.clients (name, slug, client_type)
SELECT 'SourceCo', 'sourceco', 'internal'
WHERE NOT EXISTS (
  SELECT 1 FROM public.clients WHERE slug = 'sourceco'
);

-- 2) Create SECURITY DEFINER function to join the default client
CREATE OR REPLACE FUNCTION public.join_default_client()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_client_id
  FROM public.clients
  WHERE slug = 'sourceco'
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Default client not found';
  END IF;

  -- Add the current user as a member (idempotent)
  INSERT INTO public.client_members (client_id, user_id, role)
  VALUES (v_client_id, auth.uid(), 'admin')
  ON CONFLICT DO NOTHING;

  RETURN v_client_id;
END;
$$;

-- 3) Lock down function execution
REVOKE ALL ON FUNCTION public.join_default_client() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_default_client() TO authenticated;
