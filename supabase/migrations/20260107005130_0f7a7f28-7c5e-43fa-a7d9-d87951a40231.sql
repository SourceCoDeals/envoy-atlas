-- Create best practices table for storing channel-specific rules and patterns
CREATE TABLE public.channel_best_practices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin_connection', 'linkedin_inmail', 'linkedin_message', 'linkedin_voice_note', 'phone_cold_call', 'phone_voicemail', 'direct_mail_letter', 'direct_mail_postcard', 'sms')),
  category TEXT NOT NULL,
  practice_type TEXT NOT NULL CHECK (practice_type IN ('constraint', 'pattern', 'anti_pattern', 'structure')),
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  performance_lift NUMERIC,
  source TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create industry intelligence table
CREATE TABLE public.industry_intelligence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  industry TEXT NOT NULL,
  intel_type TEXT NOT NULL CHECK (intel_type IN ('pain_point', 'terminology', 'decision_maker', 'buying_trigger', 'objection', 'success_metric', 'competitor', 'seasonality', 'regulation', 'messaging_angle', 'proof_point', 'language_pattern')),
  content TEXT NOT NULL,
  context TEXT,
  source_document TEXT,
  is_global BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create copy generation sessions table
CREATE TABLE public.copy_generation_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  sequence_step TEXT NOT NULL,
  target_industry TEXT,
  target_persona TEXT,
  company_context TEXT,
  trigger_event TEXT,
  tone TEXT,
  specific_instructions TEXT,
  generated_variations JSONB DEFAULT '[]',
  selected_variation_index INTEGER,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.channel_best_practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industry_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_generation_sessions ENABLE ROW LEVEL SECURITY;

-- RLS for channel_best_practices (read-only for all authenticated users)
CREATE POLICY "Anyone can view best practices"
ON public.channel_best_practices FOR SELECT
TO authenticated
USING (true);

-- RLS for industry_intelligence
CREATE POLICY "Users can view global or workspace intel"
ON public.industry_intelligence FOR SELECT
TO authenticated
USING (is_global = true OR workspace_id IN (
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert workspace intel"
ON public.industry_intelligence FOR INSERT
TO authenticated
WITH CHECK (workspace_id IN (
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
));

-- RLS for copy_generation_sessions
CREATE POLICY "Users can view workspace sessions"
ON public.copy_generation_sessions FOR SELECT
TO authenticated
USING (workspace_id IN (
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert workspace sessions"
ON public.copy_generation_sessions FOR INSERT
TO authenticated
WITH CHECK (workspace_id IN (
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
));

-- Add indexes
CREATE INDEX idx_best_practices_channel ON public.channel_best_practices(channel);
CREATE INDEX idx_industry_intel_workspace ON public.industry_intelligence(workspace_id);
CREATE INDEX idx_industry_intel_industry ON public.industry_intelligence(industry);
CREATE INDEX idx_generation_sessions_workspace ON public.copy_generation_sessions(workspace_id);

-- Insert default email best practices
INSERT INTO public.channel_best_practices (channel, category, practice_type, name, description, config, performance_lift, source) VALUES
-- Email Subject Line Constraints
('email', 'subject_line', 'constraint', 'character_limit', 'Maximum character limit for email subjects', '{"hard_limit": 78, "ideal_min": 30, "ideal_max": 50, "warning_threshold": 60, "unit": "characters"}', null, 'Gmail/Mobile research'),
('email', 'subject_line', 'constraint', 'word_limit', 'Maximum word limit for email subjects', '{"hard_limit": 15, "ideal_min": 4, "ideal_max": 8, "unit": "words"}', null, 'Industry research'),

-- Email Subject Line Patterns
('email', 'subject_line', 'pattern', 'question_format', 'Use question format in subject line', '{"example": "Quick question about {company}''s outbound?"}', 22.0, 'Cross-workspace data'),
('email', 'subject_line', 'pattern', 'personalization', 'Include first name in subject', '{"example": "{first_name} - thought of you"}', 14.0, 'Cross-workspace data'),
('email', 'subject_line', 'pattern', 'lowercase_style', 'Use lowercase or sentence case', '{"example": "quick thought about your team"}', 8.0, 'Industry research'),

-- Email Subject Line Anti-patterns
('email', 'subject_line', 'anti_pattern', 'all_caps', 'Avoid ALL CAPS - triggers spam filters', '{"example": "FREE MONEY NOW!!!"}', -35.0, 'Deliverability research'),
('email', 'subject_line', 'anti_pattern', 'excessive_punctuation', 'Avoid multiple exclamation marks', '{"example": "Amazing offer!!!"}', -25.0, 'Spam filter analysis'),
('email', 'subject_line', 'anti_pattern', 'spam_words', 'Avoid spam trigger words', '{"words": ["free", "guarantee", "act now", "winner", "click here", "no obligation"]}', -30.0, 'Deliverability research'),

-- Email Body Constraints
('email', 'body', 'constraint', 'word_limit', 'Maximum word limit for email body', '{"hard_limit": 200, "ideal_min": 50, "ideal_max": 125, "warning_threshold": 150, "unit": "words"}', null, 'Response rate analysis'),
('email', 'body', 'constraint', 'paragraph_limit', 'Maximum paragraphs', '{"hard_limit": 5, "ideal_min": 2, "ideal_max": 4, "unit": "paragraphs"}', null, 'Readability research'),
('email', 'body', 'constraint', 'link_limit', 'Maximum links for deliverability', '{"hard_limit": 2, "ideal_min": 0, "ideal_max": 1, "unit": "links"}', null, 'Deliverability research'),
('email', 'body', 'constraint', 'reading_level', 'Target reading grade level', '{"hard_limit": 10, "ideal_min": 5, "ideal_max": 8, "unit": "grade"}', null, 'Comprehension research'),

-- Email Opening Patterns
('email', 'opening', 'pattern', 'trigger_event', 'Reference a trigger event', '{"example": "Saw {company} just raised Series B — congrats!"}', 35.0, 'Cross-workspace data'),
('email', 'opening', 'pattern', 'personalized_observation', 'Reference their content/activity', '{"example": "Loved your recent post on scaling SDRs"}', 28.0, 'Cross-workspace data'),
('email', 'opening', 'pattern', 'mutual_connection', 'Reference shared connection', '{"example": "{mutual_connection} mentioned you might be interested"}', 45.0, 'Cross-workspace data'),
('email', 'opening', 'pattern', 'specific_pain_point', 'Lead with their pain point', '{"example": "Most VPs of Sales struggle with..."}', 22.0, 'Cross-workspace data'),

-- Email Opening Anti-patterns
('email', 'opening', 'anti_pattern', 'hope_well', 'Avoid "Hope this finds you well"', '{"example": "Hope this email finds you well!"}', -25.0, 'Response rate analysis'),
('email', 'opening', 'anti_pattern', 'reaching_out', 'Avoid "I''m reaching out because"', '{"example": "I''m reaching out because..."}', -18.0, 'Response rate analysis'),
('email', 'opening', 'anti_pattern', 'name_intro', 'Avoid starting with your name/company', '{"example": "My name is John from ABC Corp..."}', -15.0, 'Response rate analysis'),

-- Email CTA Patterns
('email', 'cta', 'pattern', 'choice_cta', 'Offer two specific times', '{"example": "Would Tuesday at 2pm or Thursday at 10am work?"}', 61.0, 'Meeting conversion data'),
('email', 'cta', 'pattern', 'value_first', 'Lead with value before ask', '{"example": "Want me to send over the case study?"}', 42.0, 'Meeting conversion data'),
('email', 'cta', 'pattern', 'specific_time', 'Propose a specific duration', '{"example": "Worth a 15-minute chat?"}', 28.0, 'Meeting conversion data'),
('email', 'cta', 'pattern', 'soft_ask', 'Low-commitment question', '{"example": "Open to exploring this?"}', 0.0, 'Baseline'),

-- Email CTA Anti-patterns
('email', 'cta', 'anti_pattern', 'multiple_ctas', 'Avoid multiple CTAs', '{"example": "Book a call, download our ebook, or visit our site"}', -35.0, 'Response rate analysis'),
('email', 'cta', 'anti_pattern', 'no_cta', 'Avoid emails without clear CTA', '{"example": "Let me know your thoughts."}', -15.0, 'Response rate analysis'),

-- Email Structure
('email', 'structure', 'structure', 'first_touch', 'First touch email structure', '{"lines": ["Personalized hook (why them, why now)", "Value proposition / pain point", "Social proof or credibility (optional)", "Clear CTA"], "word_range": [50, 75], "personalization_min": 3}', null, 'Best practice compilation'),
('email', 'structure', 'structure', 'follow_up', 'Follow-up email structure', '{"lines": ["Brief reference to previous touch", "Different angle or new value", "Slightly more direct CTA"], "word_range": [40, 60], "personalization_min": 2}', null, 'Best practice compilation'),
('email', 'structure', 'structure', 'value_add', 'Value-add email structure', '{"lines": ["Quick check-in", "Share case study, stat, or resource", "Connect to their situation", "Value-first or choice CTA"], "word_range": [60, 80], "personalization_min": 2}', null, 'Best practice compilation'),
('email', 'structure', 'structure', 'breakup', 'Breakup email structure', '{"lines": ["Acknowledge no response", "Quick value reminder", "Easy out + direct final ask"], "word_range": [30, 50], "personalization_min": 1}', null, 'Best practice compilation');

-- Insert LinkedIn best practices
INSERT INTO public.channel_best_practices (channel, category, practice_type, name, description, config, performance_lift, source) VALUES
('linkedin_connection', 'message', 'constraint', 'character_limit', 'LinkedIn connection request limit', '{"hard_limit": 300, "ideal_min": 150, "ideal_max": 250, "warning_threshold": 280, "unit": "characters"}', null, 'LinkedIn platform'),
('linkedin_connection', 'message', 'constraint', 'sentence_limit', 'Keep it brief', '{"hard_limit": 4, "ideal_min": 2, "ideal_max": 3, "unit": "sentences"}', null, 'Best practice'),
('linkedin_connection', 'message', 'structure', 'optimal_structure', 'Connection request structure', '{"lines": ["Why you''re connecting (personalized reason)", "Brief context/commonality", "Simple ask (just to connect, no pitch)"]}', null, 'Best practice'),
('linkedin_inmail', 'subject', 'constraint', 'character_limit', 'InMail subject limit', '{"hard_limit": 200, "ideal_min": 30, "ideal_max": 60, "unit": "characters"}', null, 'LinkedIn platform'),
('linkedin_inmail', 'body', 'constraint', 'character_limit', 'InMail body limit', '{"hard_limit": 1900, "ideal_min": 400, "ideal_max": 800, "unit": "characters"}', null, 'LinkedIn platform'),
('linkedin_message', 'first_message', 'constraint', 'character_limit', 'Post-connection first message', '{"hard_limit": 8000, "ideal_min": 150, "ideal_max": 400, "warning_threshold": 600, "unit": "characters"}', null, 'LinkedIn platform');

-- Insert phone best practices  
INSERT INTO public.channel_best_practices (channel, category, practice_type, name, description, config, performance_lift, source) VALUES
('phone_cold_call', 'opener', 'constraint', 'duration_limit', 'Hook them quickly', '{"ideal_min": 15, "ideal_max": 30, "unit": "seconds"}', null, 'Sales training'),
('phone_cold_call', 'pitch', 'constraint', 'duration_limit', 'Total pitch before asking for time', '{"ideal_min": 30, "ideal_max": 90, "unit": "seconds"}', null, 'Sales training'),
('phone_cold_call', 'script', 'structure', 'optimal_structure', 'Cold call script structure', '{"lines": ["Opener (10-15 sec): Name, company, casual greeting", "Permission/Hook (10-15 sec): Acknowledge interruption, personalized reason", "Value Prop (15-20 sec): How you help + quick proof", "CTA (5-10 sec): Worth a chat, or off base?"]}', null, 'Sales training'),
('phone_voicemail', 'message', 'constraint', 'duration_limit', 'Voicemail duration', '{"hard_limit": 30, "ideal_min": 18, "ideal_max": 25, "unit": "seconds"}', null, 'Sales training'),
('phone_voicemail', 'message', 'structure', 'optimal_structure', 'Voicemail structure', '{"lines": ["Name and company", "One sentence reason (about them)", "Phone number (slowly)", "Repeat: name, phone number"]}', null, 'Sales training');

-- Insert SMS best practices
INSERT INTO public.channel_best_practices (channel, category, practice_type, name, description, config, performance_lift, source) VALUES
('sms', 'message', 'constraint', 'character_limit', 'Stay in single SMS', '{"hard_limit": 160, "ideal_min": 80, "ideal_max": 140, "warning_threshold": 150, "unit": "characters"}', null, 'SMS platform');