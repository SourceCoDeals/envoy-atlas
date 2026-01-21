-- ============================================================================
-- P0-1: REP ATTRIBUTION SYSTEM
-- Create reps table and link to call_activities
-- ============================================================================

-- Create reps table for proper rep tracking
CREATE TABLE IF NOT EXISTS public.reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
  
  -- Rep Identification
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  
  -- External linking
  external_id VARCHAR(255),
  platform VARCHAR(50) DEFAULT 'phoneburner',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicates
  CONSTRAINT unique_rep_email UNIQUE NULLS NOT DISTINCT (engagement_id, email),
  CONSTRAINT unique_rep_external UNIQUE NULLS NOT DISTINCT (engagement_id, platform, external_id)
);

-- Add rep_id FK to call_activities
ALTER TABLE public.call_activities 
  ADD COLUMN IF NOT EXISTS rep_id UUID REFERENCES public.reps(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_reps_engagement ON public.reps(engagement_id);
CREATE INDEX IF NOT EXISTS idx_reps_name ON public.reps(engagement_id, name);
CREATE INDEX IF NOT EXISTS idx_call_activities_rep_id ON public.call_activities(rep_id);

-- RLS for reps table
ALTER TABLE public.reps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reps in their engagements"
  ON public.reps FOR SELECT
  USING (
    engagement_id IN (
      SELECT e.id FROM public.engagements e
      JOIN public.client_members cm ON cm.client_id = e.client_id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage reps in their engagements"
  ON public.reps FOR ALL
  USING (
    engagement_id IN (
      SELECT e.id FROM public.engagements e
      JOIN public.client_members cm ON cm.client_id = e.client_id
      WHERE cm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- P0-2: DISPOSITION MAPPINGS TABLE
-- Configurable disposition → connection/outcome mapping per engagement
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.disposition_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
  
  -- Source platform
  platform VARCHAR(50) NOT NULL DEFAULT 'phoneburner',
  
  -- What the external system calls it
  external_disposition VARCHAR(100) NOT NULL,
  
  -- What we call it internally
  internal_disposition VARCHAR(50) NOT NULL,
  
  -- Business logic classification
  is_connection BOOLEAN DEFAULT false,
  is_conversation BOOLEAN DEFAULT false,
  is_voicemail BOOLEAN DEFAULT false,
  is_meeting BOOLEAN DEFAULT false,
  is_dm BOOLEAN DEFAULT false,
  
  -- Optional threshold override
  min_talk_duration_seconds INTEGER DEFAULT 30,
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicates per engagement
  UNIQUE(engagement_id, platform, external_disposition)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_disposition_mappings_engagement 
  ON public.disposition_mappings(engagement_id);
CREATE INDEX IF NOT EXISTS idx_disposition_mappings_lookup 
  ON public.disposition_mappings(engagement_id, platform, external_disposition);

-- RLS for disposition_mappings
ALTER TABLE public.disposition_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view disposition mappings in their engagements"
  ON public.disposition_mappings FOR SELECT
  USING (
    engagement_id IN (
      SELECT e.id FROM public.engagements e
      JOIN public.client_members cm ON cm.client_id = e.client_id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage disposition mappings in their engagements"
  ON public.disposition_mappings FOR ALL
  USING (
    engagement_id IN (
      SELECT e.id FROM public.engagements e
      JOIN public.client_members cm ON cm.client_id = e.client_id
      WHERE cm.user_id = auth.uid()
    )
  );

-- Seed default PhoneBurner disposition mappings
INSERT INTO public.disposition_mappings (engagement_id, platform, external_disposition, internal_disposition, is_connection, is_conversation, is_voicemail, is_meeting, is_dm, description)
SELECT 
  e.id,
  'phoneburner',
  unnest.external_disposition,
  unnest.internal_disposition,
  unnest.is_connection,
  unnest.is_conversation,
  unnest.is_voicemail,
  unnest.is_meeting,
  unnest.is_dm,
  unnest.description
FROM public.engagements e
CROSS JOIN (VALUES
  ('answered', 'conversation', true, true, false, false, false, 'Phone answered, conversation started'),
  ('completed_call', 'conversation', true, true, false, false, false, 'Call completed successfully'),
  ('connected', 'conversation', true, true, false, false, true, 'Connected with prospect'),
  ('connection_made', 'conversation', true, true, false, false, false, 'Connection established'),
  ('dm_conversation', 'dm_conversation', true, true, false, false, true, 'Decision maker conversation'),
  ('meeting_booked', 'meeting', true, true, false, true, true, 'Meeting booked'),
  ('interested', 'interested', true, true, false, false, true, 'Prospect expressed interest'),
  ('left_message', 'voicemail', false, false, true, false, false, 'Left voicemail'),
  ('voicemail', 'voicemail', false, false, true, false, false, 'Reached voicemail'),
  ('no_answer', 'no_answer', false, false, false, false, false, 'No answer'),
  ('busy', 'busy', false, false, false, false, false, 'Line was busy'),
  ('gatekeeper', 'gatekeeper', true, false, false, false, false, 'Reached gatekeeper'),
  ('not_interested', 'not_interested', true, true, false, false, true, 'Not interested'),
  ('callback', 'callback', true, true, false, false, false, 'Callback scheduled'),
  ('wrong_number', 'wrong_number', false, false, false, false, false, 'Wrong number'),
  ('disconnected', 'disconnected', false, false, false, false, false, 'Number disconnected')
) AS unnest(external_disposition, internal_disposition, is_connection, is_conversation, is_voicemail, is_meeting, is_dm, description)
ON CONFLICT (engagement_id, platform, external_disposition) DO NOTHING;

-- ============================================================================
-- P0-3: CALL OBJECTIONS TABLE
-- Store multiple objections per call with resolution tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.call_objections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.call_activities(id) ON DELETE CASCADE,
  engagement_id UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
  
  -- Objection Classification
  objection_type VARCHAR(100) NOT NULL,
  objection_text TEXT NOT NULL,
  timestamp_in_call INTEGER,
  
  -- Resolution tracking
  resolution_attempted VARCHAR(255),
  was_resolved BOOLEAN DEFAULT false,
  
  -- Extraction source
  extracted_by VARCHAR(50) DEFAULT 'manual',
  confidence NUMERIC(3, 2) DEFAULT 0.5,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_call_objections_call ON public.call_objections(call_id);
CREATE INDEX IF NOT EXISTS idx_call_objections_engagement ON public.call_objections(engagement_id);
CREATE INDEX IF NOT EXISTS idx_call_objections_type ON public.call_objections(objection_type);

-- RLS for call_objections
ALTER TABLE public.call_objections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view objections in their engagements"
  ON public.call_objections FOR SELECT
  USING (
    engagement_id IN (
      SELECT e.id FROM public.engagements e
      JOIN public.client_members cm ON cm.client_id = e.client_id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage objections in their engagements"
  ON public.call_objections FOR ALL
  USING (
    engagement_id IN (
      SELECT e.id FROM public.engagements e
      JOIN public.client_members cm ON cm.client_id = e.client_id
      WHERE cm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- P0-4: CAMPAIGN PLATFORM MAPPINGS
-- Link external campaign IDs to internal campaigns
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.campaign_platform_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  
  -- Platform tracking
  platform VARCHAR(50) NOT NULL,
  external_campaign_id VARCHAR(255) NOT NULL,
  external_campaign_name VARCHAR(255),
  
  -- Sync tracking
  last_synced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(engagement_id, platform, external_campaign_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_campaign_platform_mappings_lookup 
  ON public.campaign_platform_mappings(platform, external_campaign_id);

-- RLS for campaign_platform_mappings
ALTER TABLE public.campaign_platform_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign mappings in their engagements"
  ON public.campaign_platform_mappings FOR SELECT
  USING (
    engagement_id IN (
      SELECT e.id FROM public.engagements e
      JOIN public.client_members cm ON cm.client_id = e.client_id
      WHERE cm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTION: Backfill reps from existing call_activities
-- ============================================================================

CREATE OR REPLACE FUNCTION public.backfill_reps_from_calls()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create reps from distinct caller_names in call_activities
  INSERT INTO public.reps (engagement_id, name, email)
  SELECT DISTINCT 
    engagement_id,
    caller_name,
    caller_name || '@unknown.local'
  FROM public.call_activities
  WHERE caller_name IS NOT NULL
    AND caller_name != ''
    AND caller_name != 'Unknown'
  ON CONFLICT (engagement_id, email) DO NOTHING;
  
  -- Link calls to reps
  UPDATE public.call_activities ca
  SET rep_id = r.id
  FROM public.reps r
  WHERE ca.engagement_id = r.engagement_id
    AND ca.caller_name = r.name
    AND ca.rep_id IS NULL;
END;
$$;

-- ============================================================================
-- HELPER FUNCTION: Check if disposition is connection (configurable)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_connection_disposition(
  p_engagement_id UUID,
  p_disposition VARCHAR,
  p_talk_duration INTEGER DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_connection BOOLEAN;
  v_min_duration INTEGER;
BEGIN
  -- Check disposition mapping
  SELECT dm.is_connection, COALESCE(dm.min_talk_duration_seconds, 30)
  INTO v_is_connection, v_min_duration
  FROM public.disposition_mappings dm
  WHERE dm.engagement_id = p_engagement_id
    AND dm.platform = 'phoneburner'
    AND LOWER(dm.external_disposition) = LOWER(p_disposition);
  
  -- If mapped disposition is connection, return true
  IF v_is_connection = true THEN
    RETURN true;
  END IF;
  
  -- Fallback: check talk duration threshold
  IF p_talk_duration >= COALESCE(v_min_duration, 30) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- ============================================================================
-- Update trigger for updated_at on new tables
-- ============================================================================

CREATE TRIGGER update_reps_updated_at
  BEFORE UPDATE ON public.reps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_disposition_mappings_updated_at
  BEFORE UPDATE ON public.disposition_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();