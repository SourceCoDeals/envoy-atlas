-- Create a SECURITY DEFINER function to atomically create a workspace and add the creator as admin
CREATE OR REPLACE FUNCTION public.create_workspace(_name text)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slug text;
  _workspace public.workspaces;
  _user_id uuid;
BEGIN
  -- Get the current user
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Generate slug from name
  _slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g'));
  _slug := trim(both '-' from _slug);
  
  -- Handle empty slug
  IF _slug = '' THEN
    _slug := 'workspace';
  END IF;

  -- Make slug unique by appending random suffix if needed
  WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = _slug) LOOP
    _slug := _slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;

  -- Insert the workspace
  INSERT INTO public.workspaces (name, slug)
  VALUES (_name, _slug)
  RETURNING * INTO _workspace;

  -- Add the creator as admin member
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (_workspace.id, _user_id, 'admin');

  RETURN _workspace;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_workspace(text) TO authenticated;