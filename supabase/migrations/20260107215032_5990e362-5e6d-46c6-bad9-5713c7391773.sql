-- Create phoneburner_contacts table to store contact data from PhoneBurner
CREATE TABLE public.phoneburner_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  external_contact_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  category_id TEXT,
  tags TEXT[],
  date_added TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, external_contact_id)
);

-- Add index for email/phone matching
CREATE INDEX idx_phoneburner_contacts_email ON public.phoneburner_contacts(workspace_id, email);
CREATE INDEX idx_phoneburner_contacts_phone ON public.phoneburner_contacts(workspace_id, phone);

-- Enable RLS
ALTER TABLE public.phoneburner_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view phoneburner contacts in their workspace"
ON public.phoneburner_contacts FOR SELECT
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert phoneburner contacts in their workspace"
ON public.phoneburner_contacts FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update phoneburner contacts in their workspace"
ON public.phoneburner_contacts FOR UPDATE
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Add external_contact_id to phoneburner_calls for linking
ALTER TABLE public.phoneburner_calls ADD COLUMN IF NOT EXISTS external_contact_id TEXT;
ALTER TABLE public.phoneburner_calls ADD COLUMN IF NOT EXISTS activity_date TIMESTAMP WITH TIME ZONE;

-- Create index for external contact linking
CREATE INDEX IF NOT EXISTS idx_phoneburner_calls_external_contact ON public.phoneburner_calls(workspace_id, external_contact_id);

-- Add trigger for updated_at
CREATE TRIGGER update_phoneburner_contacts_updated_at
BEFORE UPDATE ON public.phoneburner_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();