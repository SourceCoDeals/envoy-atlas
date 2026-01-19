-- Create team_members table for tracking people who work on engagements
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR,
  email VARCHAR,
  title VARCHAR,
  is_active BOOLEAN DEFAULT true,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for team_members
CREATE POLICY "Users can view team members in their client" ON public.team_members
  FOR SELECT USING (public.is_client_member(client_id, auth.uid()));

CREATE POLICY "Admins can insert team members" ON public.team_members
  FOR INSERT WITH CHECK (public.is_client_admin(client_id, auth.uid()));

CREATE POLICY "Admins can update team members" ON public.team_members
  FOR UPDATE USING (public.is_client_admin(client_id, auth.uid()));

CREATE POLICY "Admins can delete team members" ON public.team_members
  FOR DELETE USING (public.is_client_admin(client_id, auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Extend engagements table with new business fields
ALTER TABLE public.engagements
  ADD COLUMN IF NOT EXISTS sponsor_name VARCHAR,
  ADD COLUMN IF NOT EXISTS portfolio_company VARCHAR,
  ADD COLUMN IF NOT EXISTS fee_schedule VARCHAR,
  ADD COLUMN IF NOT EXISTS monthly_retainer DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS is_platform BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS deal_lead_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS associate_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS analyst_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS analyst_2_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS research_lead_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS research_mid_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX idx_team_members_client_id ON public.team_members(client_id);
CREATE INDEX idx_team_members_is_active ON public.team_members(is_active);
CREATE INDEX idx_engagements_deal_lead_id ON public.engagements(deal_lead_id);
CREATE INDEX idx_engagements_sponsor_name ON public.engagements(sponsor_name);