-- COMPREHENSIVE FIX MIGRATION
-- 1. Add missing columns to clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- 2. Add missing goal columns to engagements
ALTER TABLE public.engagements
ADD COLUMN IF NOT EXISTS response_goal INTEGER,
ADD COLUMN IF NOT EXISTS companies_goal INTEGER;

-- 3. Add missing columns to campaign_variant_features
ALTER TABLE public.campaign_variant_features
ADD COLUMN IF NOT EXISTS hook_type TEXT,
ADD COLUMN IF NOT EXISTS you_we_ratio NUMERIC,
ADD COLUMN IF NOT EXISTS personalization_level TEXT,
ADD COLUMN IF NOT EXISTS has_attachments BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_links BOOLEAN DEFAULT false;

-- 4. Create call_ai_scores table
CREATE TABLE IF NOT EXISTS public.call_ai_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID REFERENCES public.call_activities(id) ON DELETE CASCADE,
  overall_score NUMERIC,
  opening_score NUMERIC,
  discovery_score NUMERIC,
  objection_handling_score NUMERIC,
  closing_score NUMERIC,
  key_moments JSONB,
  improvement_areas TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create call_transcripts table
CREATE TABLE IF NOT EXISTS public.call_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID REFERENCES public.call_activities(id) ON DELETE CASCADE,
  transcript_text TEXT,
  transcript_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. CREATE THE MISSING TRIGGER for positive replies
DROP TRIGGER IF EXISTS trigger_update_positive_replies ON public.email_activities;

CREATE TRIGGER trigger_update_positive_replies
  AFTER UPDATE OF reply_category ON public.email_activities
  FOR EACH ROW
  WHEN (NEW.reply_category IS DISTINCT FROM OLD.reply_category)
  EXECUTE FUNCTION public.update_daily_positive_replies();

-- 7. Enable RLS on new tables
ALTER TABLE public.call_ai_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies for call tables
CREATE POLICY "Users can view call scores via engagement membership" ON public.call_ai_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM call_activities ca
      JOIN engagements e ON ca.engagement_id = e.id
      JOIN client_members cm ON e.client_id = cm.client_id
      WHERE ca.id = call_ai_scores.call_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view transcripts via engagement membership" ON public.call_transcripts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM call_activities ca
      JOIN engagements e ON ca.engagement_id = e.id
      JOIN client_members cm ON e.client_id = cm.client_id
      WHERE ca.id = call_transcripts.call_id
      AND cm.user_id = auth.uid()
    )
  );