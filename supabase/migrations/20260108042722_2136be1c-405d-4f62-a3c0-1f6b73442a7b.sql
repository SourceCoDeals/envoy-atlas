-- =====================================================
-- SOURCECO COLD CALLING PLATFORM SCHEMA
-- Supports all 9 dashboard pages from requirements doc
-- =====================================================

-- 1. Rep Profiles - Link users to PhoneBurner members
CREATE TABLE public.rep_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    phoneburner_member_id text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    avatar_url text,
    hire_date date,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(workspace_id, phoneburner_member_id),
    UNIQUE(workspace_id, user_id)
);

-- 2. Engagements (PE firm projects) - Page 2
CREATE TABLE public.engagements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_name text NOT NULL,
    engagement_name text NOT NULL,
    industry_focus text,
    geography text,
    revenue_min numeric,
    revenue_max numeric,
    start_date date NOT NULL,
    end_date date,
    total_calls_target integer DEFAULT 0,
    meetings_target integer DEFAULT 0,
    pipeline_value_target numeric DEFAULT 0,
    connect_rate_target numeric DEFAULT 20,
    meeting_rate_target numeric DEFAULT 5,
    status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Engagement Rep Assignments
CREATE TABLE public.engagement_reps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id uuid NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
    rep_profile_id uuid NOT NULL REFERENCES public.rep_profiles(id) ON DELETE CASCADE,
    assigned_at timestamptz DEFAULT now(),
    UNIQUE(engagement_id, rep_profile_id)
);

-- 4. Rep Goals - Personal targets per engagement
CREATE TABLE public.rep_goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_profile_id uuid NOT NULL REFERENCES public.rep_profiles(id) ON DELETE CASCADE,
    engagement_id uuid REFERENCES public.engagements(id) ON DELETE CASCADE,
    goal_type text NOT NULL CHECK (goal_type IN ('daily_dials', 'weekly_meetings', 'connect_rate', 'ai_score', 'talk_time')),
    target_value numeric NOT NULL,
    period text DEFAULT 'weekly' CHECK (period IN ('daily', 'weekly', 'monthly', 'engagement')),
    effective_from date DEFAULT CURRENT_DATE,
    effective_to date,
    created_at timestamptz DEFAULT now()
);

-- 5. Deals (Top Deals Tracker) - Page 3
CREATE TABLE public.calling_deals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    engagement_id uuid REFERENCES public.engagements(id) ON DELETE SET NULL,
    lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
    company_name text NOT NULL,
    contact_name text,
    contact_title text,
    contact_phone text,
    contact_email text,
    -- Company Info
    industry text,
    location text,
    revenue numeric,
    employees integer,
    -- Seller Profile (AI-extracted)
    seller_interest_score integer CHECK (seller_interest_score BETWEEN 1 AND 10),
    seller_interest_summary text,
    timeline_to_sell text,
    motivation_factors text[],
    valuation_expectations text,
    buyer_preferences text,
    key_concerns text[],
    -- Deal Score Components
    company_size_score integer DEFAULT 0,
    motivation_score integer DEFAULT 0,
    timeline_score integer DEFAULT 0,
    total_deal_score integer GENERATED ALWAYS AS (company_size_score + motivation_score + timeline_score) STORED,
    -- Status
    status text DEFAULT 'open' CHECK (status IN ('open', 'qualified', 'meeting_set', 'closed_won', 'closed_lost')),
    next_action text,
    next_action_date date,
    -- Metadata
    last_contact_at timestamptz,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 6. Call Library Categories (Page 6 - already have call_library_entries, add categories)
CREATE TABLE public.call_library_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    use_case text,
    display_order integer DEFAULT 0,
    is_system boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(workspace_id, slug)
);

-- Insert default categories from requirements
INSERT INTO public.call_library_categories (workspace_id, name, slug, description, use_case, display_order, is_system)
SELECT w.id, cat.name, cat.slug, cat.description, cat.use_case, cat.display_order, true
FROM public.workspaces w
CROSS JOIN (VALUES
    ('Best Openings', 'best-openings', 'Calls where opening led to engagement', 'Train new reps on hooks', 1),
    ('Discovery Excellence', 'discovery-excellence', 'Great questioning technique', 'Improve discovery skills', 2),
    ('Objection Handling', 'objection-handling', 'By objection type', 'Practice specific objections', 3),
    ('Strong Closes', 'strong-closes', 'Calls that converted to meetings', 'Learn closing techniques', 4),
    ('Value Prop Delivery', 'value-prop', 'Clear SourceCo positioning', 'Message consistency', 5),
    ('Rapport Building', 'rapport-building', 'Personal connection examples', 'Relationship skills', 6),
    ('Full Examples', 'full-examples', 'Complete best practice calls', 'End-to-end reference', 7),
    ('Learning Moments', 'learning-moments', 'Common mistakes (anonymized)', 'What NOT to do', 8)
) AS cat(name, slug, description, use_case, display_order);

-- 7. AI Coaching Recommendations
CREATE TABLE public.ai_coaching_recommendations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    rep_profile_id uuid REFERENCES public.rep_profiles(id) ON DELETE CASCADE,
    recommendation_type text NOT NULL CHECK (recommendation_type IN ('strength', 'improvement', 'focus_area', 'pattern')),
    title text NOT NULL,
    description text NOT NULL,
    data_evidence jsonb,
    priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    is_acknowledged boolean DEFAULT false,
    acknowledged_at timestamptz,
    valid_until date,
    created_at timestamptz DEFAULT now()
);

-- 8. Weekly AI Summaries (Page 8)
CREATE TABLE public.ai_weekly_summaries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    week_start date NOT NULL,
    week_end date NOT NULL,
    team_health_score integer CHECK (team_health_score BETWEEN 0 AND 100),
    team_health_trend text CHECK (team_health_trend IN ('up', 'down', 'flat')),
    key_driver text,
    whats_working jsonb,
    areas_needing_attention jsonb,
    weekly_focus_recommendations jsonb,
    generated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    UNIQUE(workspace_id, week_start)
);

-- 9. Engagement Daily Metrics (for tracking progress)
CREATE TABLE public.engagement_daily_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id uuid NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
    rep_profile_id uuid REFERENCES public.rep_profiles(id) ON DELETE SET NULL,
    date date NOT NULL,
    dials integer DEFAULT 0,
    connects integer DEFAULT 0,
    conversations integer DEFAULT 0,
    meetings_set integer DEFAULT 0,
    voicemails integer DEFAULT 0,
    talk_time_seconds integer DEFAULT 0,
    avg_ai_score numeric,
    created_at timestamptz DEFAULT now(),
    UNIQUE(engagement_id, rep_profile_id, date)
);

-- 10. Mandatory Questions Tracking (17 questions from requirements)
CREATE TABLE public.mandatory_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    question_number integer NOT NULL,
    question_text text NOT NULL,
    category text,
    is_active boolean DEFAULT true,
    display_order integer,
    created_at timestamptz DEFAULT now(),
    UNIQUE(workspace_id, question_number)
);

-- 11. AI Chatbot Conversations (Page 9)
CREATE TABLE public.ai_chatbot_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.ai_chatbot_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.ai_chatbot_conversations(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text NOT NULL,
    intent_category text,
    data_sources_used text[],
    visualizations jsonb,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.rep_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rep_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calling_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_library_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coaching_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandatory_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chatbot_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workspace members can view rep profiles" ON public.rep_profiles
    FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins can manage rep profiles" ON public.rep_profiles
    FOR ALL USING (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Users can view own rep profile" ON public.rep_profiles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Workspace members can view engagements" ON public.engagements
    FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins can manage engagements" ON public.engagements
    FOR ALL USING (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can view engagement reps" ON public.engagement_reps
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.engagements e WHERE e.id = engagement_id AND public.is_workspace_member(e.workspace_id, auth.uid()))
    );

CREATE POLICY "Workspace members can view rep goals" ON public.rep_goals
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.rep_profiles r WHERE r.id = rep_profile_id AND public.is_workspace_member(r.workspace_id, auth.uid()))
    );

CREATE POLICY "Workspace members can view calling deals" ON public.calling_deals
    FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can manage calling deals" ON public.calling_deals
    FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can view call library categories" ON public.call_library_categories
    FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can view coaching recommendations" ON public.ai_coaching_recommendations
    FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can view weekly summaries" ON public.ai_weekly_summaries
    FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can view engagement metrics" ON public.engagement_daily_metrics
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.engagements e WHERE e.id = engagement_id AND public.is_workspace_member(e.workspace_id, auth.uid()))
    );

CREATE POLICY "Workspace members can view mandatory questions" ON public.mandatory_questions
    FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can view own chatbot conversations" ON public.ai_chatbot_conversations
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own chatbot conversations" ON public.ai_chatbot_conversations
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view messages in own conversations" ON public.ai_chatbot_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.ai_chatbot_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
    );

CREATE POLICY "Users can insert messages in own conversations" ON public.ai_chatbot_messages
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.ai_chatbot_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
    );

-- Create indexes for performance
CREATE INDEX idx_rep_profiles_workspace ON public.rep_profiles(workspace_id);
CREATE INDEX idx_rep_profiles_user ON public.rep_profiles(user_id);
CREATE INDEX idx_engagements_workspace ON public.engagements(workspace_id);
CREATE INDEX idx_engagements_status ON public.engagements(status);
CREATE INDEX idx_calling_deals_workspace ON public.calling_deals(workspace_id);
CREATE INDEX idx_calling_deals_score ON public.calling_deals(total_deal_score DESC);
CREATE INDEX idx_engagement_metrics_engagement ON public.engagement_daily_metrics(engagement_id);
CREATE INDEX idx_engagement_metrics_date ON public.engagement_daily_metrics(date);
CREATE INDEX idx_ai_summaries_week ON public.ai_weekly_summaries(workspace_id, week_start);

-- Triggers for updated_at
CREATE TRIGGER update_rep_profiles_updated_at BEFORE UPDATE ON public.rep_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_engagements_updated_at BEFORE UPDATE ON public.engagements
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_calling_deals_updated_at BEFORE UPDATE ON public.calling_deals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_chatbot_conversations_updated_at BEFORE UPDATE ON public.ai_chatbot_conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();