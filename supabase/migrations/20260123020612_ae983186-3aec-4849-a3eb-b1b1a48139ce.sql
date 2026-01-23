-- Create sponsor_aliases table for mapping abbreviations to canonical names
CREATE TABLE IF NOT EXISTS public.sponsor_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  alias text NOT NULL,
  canonical_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, alias)
);

-- Enable RLS
ALTER TABLE public.sponsor_aliases ENABLE ROW LEVEL SECURITY;

-- RLS policies for workspace members
CREATE POLICY "Workspace members can view aliases"
  ON public.sponsor_aliases FOR SELECT
  USING (public.is_client_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins can manage aliases"
  ON public.sponsor_aliases FOR ALL
  USING (public.is_client_admin(workspace_id, auth.uid()));

-- Seed with discovered patterns from existing campaigns
-- Get the default workspace ID (SourceCo)
INSERT INTO public.sponsor_aliases (workspace_id, alias, canonical_name)
SELECT 
  c.id,
  alias_data.alias,
  alias_data.canonical_name
FROM public.clients c
CROSS JOIN (
  VALUES
    ('NH', 'New Heritage'),
    ('GP', 'GP Partners'),
    ('O2', 'O2 Investment Partners'),
    ('FMS', 'FMS'),
    ('JF', 'JF'),
    ('Prop Mgmt', 'Property Management'),
    ('K12', 'K-12'),
    ('Sr Living', 'Senior Living'),
    ('Sr. Living', 'Senior Living')
) AS alias_data(alias, canonical_name)
WHERE c.slug = 'sourceco'
ON CONFLICT (workspace_id, alias) DO NOTHING;

-- Add index for fast alias lookups
CREATE INDEX IF NOT EXISTS idx_sponsor_aliases_workspace_alias 
  ON public.sponsor_aliases (workspace_id, LOWER(alias));

-- Add trigger for updated_at
CREATE TRIGGER update_sponsor_aliases_updated_at
  BEFORE UPDATE ON public.sponsor_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();