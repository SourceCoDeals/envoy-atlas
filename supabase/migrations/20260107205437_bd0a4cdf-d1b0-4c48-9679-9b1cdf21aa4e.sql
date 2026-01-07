-- Call Transcripts table - stores AI-generated transcriptions
CREATE TABLE public.call_transcripts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    call_id UUID NOT NULL REFERENCES public.phoneburner_calls(id) ON DELETE CASCADE,
    transcript_text TEXT,
    speaker_segments JSONB DEFAULT '[]'::jsonb,
    transcription_status TEXT NOT NULL DEFAULT 'pending',
    transcription_error TEXT,
    word_count INTEGER,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_transcription_status CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Call AI Scores table - stores 10-dimension AI analysis
CREATE TABLE public.call_ai_scores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    call_id UUID NOT NULL REFERENCES public.phoneburner_calls(id) ON DELETE CASCADE,
    transcript_id UUID REFERENCES public.call_transcripts(id) ON DELETE SET NULL,
    
    -- Core scoring dimensions (1-10)
    seller_interest_score INTEGER,
    seller_interest_justification TEXT,
    objection_handling_score INTEGER,
    objection_handling_justification TEXT,
    objections_list JSONB DEFAULT '[]'::jsonb,
    rapport_building_score INTEGER,
    rapport_building_justification TEXT,
    value_proposition_score INTEGER,
    value_proposition_justification TEXT,
    engagement_score INTEGER,
    engagement_justification TEXT,
    script_adherence_score INTEGER,
    script_adherence_justification TEXT,
    next_step_clarity_score INTEGER,
    next_step_clarity_justification TEXT,
    valuation_discussion_score INTEGER,
    valuation_discussion_justification TEXT,
    
    -- Mandatory questions adherence (0-100%)
    mandatory_questions_adherence INTEGER,
    mandatory_questions_asked JSONB DEFAULT '[]'::jsonb,
    
    -- Extracted insights
    personal_insights TEXT,
    timeline_to_sell TEXT,
    buyer_type_preference TEXT,
    opening_type TEXT,
    trigger_events JSONB DEFAULT '[]'::jsonb,
    
    -- Composite score (0-100 weighted total)
    composite_score INTEGER,
    
    -- Metadata
    scoring_model TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_scores CHECK (
        (seller_interest_score IS NULL OR (seller_interest_score >= 1 AND seller_interest_score <= 10)) AND
        (objection_handling_score IS NULL OR (objection_handling_score >= 1 AND objection_handling_score <= 10)) AND
        (rapport_building_score IS NULL OR (rapport_building_score >= 1 AND rapport_building_score <= 10)) AND
        (value_proposition_score IS NULL OR (value_proposition_score >= 1 AND value_proposition_score <= 10)) AND
        (engagement_score IS NULL OR (engagement_score >= 1 AND engagement_score <= 10)) AND
        (script_adherence_score IS NULL OR (script_adherence_score >= 1 AND script_adherence_score <= 10)) AND
        (next_step_clarity_score IS NULL OR (next_step_clarity_score >= 1 AND next_step_clarity_score <= 10)) AND
        (valuation_discussion_score IS NULL OR (valuation_discussion_score >= 1 AND valuation_discussion_score <= 10)) AND
        (mandatory_questions_adherence IS NULL OR (mandatory_questions_adherence >= 0 AND mandatory_questions_adherence <= 100)) AND
        (composite_score IS NULL OR (composite_score >= 0 AND composite_score <= 100))
    )
);

-- Call Library Entries table - curated calls for training
CREATE TABLE public.call_library_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    call_id UUID NOT NULL REFERENCES public.phoneburner_calls(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    highlight_start_time INTEGER,
    highlight_end_time INTEGER,
    tags TEXT[] DEFAULT '{}'::text[],
    added_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT valid_category CHECK (category IN (
        'best_openings', 'discovery_excellence', 'objection_handling', 
        'strong_closes', 'rapport_building', 'value_proposition',
        'worst_examples', 'training_required', 'other'
    ))
);

-- Training Assignments table - coaching queue
CREATE TABLE public.training_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    assignee_id UUID NOT NULL,
    assigned_by UUID NOT NULL,
    call_id UUID NOT NULL REFERENCES public.phoneburner_calls(id) ON DELETE CASCADE,
    assignment_type TEXT NOT NULL DEFAULT 'listen',
    focus_area TEXT,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    rep_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT valid_assignment_type CHECK (assignment_type IN ('listen', 'review', 'practice', 'discuss'))
);

-- Enable RLS on all tables
ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_ai_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_library_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_transcripts
CREATE POLICY "Users can view transcripts in their workspaces"
ON public.call_transcripts FOR SELECT
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert transcripts in their workspaces"
ON public.call_transcripts FOR INSERT
WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update transcripts in their workspaces"
ON public.call_transcripts FOR UPDATE
USING (is_workspace_member(workspace_id, auth.uid()));

-- RLS Policies for call_ai_scores
CREATE POLICY "Users can view scores in their workspaces"
ON public.call_ai_scores FOR SELECT
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert scores in their workspaces"
ON public.call_ai_scores FOR INSERT
WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update scores in their workspaces"
ON public.call_ai_scores FOR UPDATE
USING (is_workspace_member(workspace_id, auth.uid()));

-- RLS Policies for call_library_entries
CREATE POLICY "Users can view library entries in their workspaces"
ON public.call_library_entries FOR SELECT
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert library entries in their workspaces"
ON public.call_library_entries FOR INSERT
WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update library entries in their workspaces"
ON public.call_library_entries FOR UPDATE
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can delete library entries"
ON public.call_library_entries FOR DELETE
USING (is_workspace_admin(workspace_id, auth.uid()));

-- RLS Policies for training_assignments
CREATE POLICY "Users can view assignments in their workspaces"
ON public.training_assignments FOR SELECT
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert assignments in their workspaces"
ON public.training_assignments FOR INSERT
WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update assignments in their workspaces"
ON public.training_assignments FOR UPDATE
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Admins can delete assignments"
ON public.training_assignments FOR DELETE
USING (is_workspace_admin(workspace_id, auth.uid()));

-- Indexes for performance
CREATE INDEX idx_call_transcripts_workspace_id ON public.call_transcripts(workspace_id);
CREATE INDEX idx_call_transcripts_call_id ON public.call_transcripts(call_id);
CREATE INDEX idx_call_transcripts_status ON public.call_transcripts(transcription_status);

CREATE INDEX idx_call_ai_scores_workspace_id ON public.call_ai_scores(workspace_id);
CREATE INDEX idx_call_ai_scores_call_id ON public.call_ai_scores(call_id);
CREATE INDEX idx_call_ai_scores_composite ON public.call_ai_scores(composite_score);

CREATE INDEX idx_call_library_entries_workspace_id ON public.call_library_entries(workspace_id);
CREATE INDEX idx_call_library_entries_category ON public.call_library_entries(category);

CREATE INDEX idx_training_assignments_workspace_id ON public.training_assignments(workspace_id);
CREATE INDEX idx_training_assignments_assignee ON public.training_assignments(assignee_id);

-- Full-text search index on transcripts
CREATE INDEX idx_call_transcripts_text_search ON public.call_transcripts 
USING gin(to_tsvector('english', COALESCE(transcript_text, '')));

-- Trigger for updated_at on call_library_entries
CREATE TRIGGER update_call_library_entries_updated_at
BEFORE UPDATE ON public.call_library_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();