-- Create deals table
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  business_description TEXT,
  client_id UUID,
  client_name TEXT,
  geography TEXT,
  industry TEXT,
  revenue NUMERIC,
  ebitda NUMERIC,
  stage TEXT NOT NULL DEFAULT 'New',
  teaser_url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create clients table for broker/client tracking
CREATE TABLE public.deal_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key for client
ALTER TABLE public.deals 
ADD CONSTRAINT deals_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES public.deal_clients(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_clients ENABLE ROW LEVEL SECURITY;

-- RLS policies for deals
CREATE POLICY "Workspace members can view deals"
ON public.deals FOR SELECT
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create deals"
ON public.deals FOR INSERT
WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update deals"
ON public.deals FOR UPDATE
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can delete deals"
ON public.deals FOR DELETE
USING (is_workspace_admin(workspace_id, auth.uid()));

-- RLS policies for deal_clients
CREATE POLICY "Workspace members can view clients"
ON public.deal_clients FOR SELECT
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create clients"
ON public.deal_clients FOR INSERT
WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update clients"
ON public.deal_clients FOR UPDATE
USING (is_workspace_member(workspace_id, auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_deals_updated_at
BEFORE UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();