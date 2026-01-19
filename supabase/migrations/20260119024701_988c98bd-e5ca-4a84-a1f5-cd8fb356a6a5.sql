-- ============================================
-- PHASE 1: DROP ALL EXISTING TABLES
-- Drop tables in dependency order (children first)
-- ============================================

-- Drop all views first
DROP VIEW IF EXISTS copy_performance CASCADE;
DROP VIEW IF EXISTS segment_performance CASCADE;
DROP VIEW IF EXISTS activity_timeline CASCADE;

-- Drop dependent tables first
DROP TABLE IF EXISTS variant_decay_tracking CASCADE;
DROP TABLE IF EXISTS campaign_variant_features CASCADE;
DROP TABLE IF EXISTS copy_patterns CASCADE;
DROP TABLE IF EXISTS experiment_variants CASCADE;
DROP TABLE IF EXISTS experiments CASCADE;
DROP TABLE IF EXISTS playbook_entries CASCADE;
DROP TABLE IF EXISTS copy_library CASCADE;
DROP TABLE IF EXISTS daily_metrics CASCADE;
DROP TABLE IF EXISTS call_activities CASCADE;
DROP TABLE IF EXISTS email_activities CASCADE;
DROP TABLE IF EXISTS responses CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS deal_clients CASCADE;
DROP TABLE IF EXISTS campaign_variants CASCADE;
DROP TABLE IF EXISTS sequences CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS engagements CASCADE;
DROP TABLE IF EXISTS client_members CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS source_id_mappings CASCADE;
DROP TABLE IF EXISTS sync_logs CASCADE;
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS data_sources CASCADE;

-- Drop workspace-related tables (legacy)
DROP TABLE IF EXISTS workspace_members CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;

-- Drop all legacy tables
DROP TABLE IF EXISTS audience_performance CASCADE;
DROP TABLE IF EXISTS ai_chatbot_messages CASCADE;
DROP TABLE IF EXISTS api_connections CASCADE;
DROP TABLE IF EXISTS calling_deals CASCADE;
DROP TABLE IF EXISTS call_library_entries CASCADE;
DROP TABLE IF EXISTS call_summaries CASCADE;
DROP TABLE IF EXISTS contact_notes CASCADE;
DROP TABLE IF EXISTS copy_generation_sessions CASCADE;
DROP TABLE IF EXISTS deliverability_alerts CASCADE;
DROP TABLE IF EXISTS email_account_health CASCADE;
DROP TABLE IF EXISTS engagement_daily_metrics CASCADE;
DROP TABLE IF EXISTS engagement_reps CASCADE;
DROP TABLE IF EXISTS external_calls CASCADE;
DROP TABLE IF EXISTS hourly_metrics CASCADE;
DROP TABLE IF EXISTS industry_intelligence CASCADE;
DROP TABLE IF EXISTS lead_call_attempts CASCADE;
DROP TABLE IF EXISTS mandatory_questions CASCADE;
DROP TABLE IF EXISTS message_events CASCADE;
DROP TABLE IF EXISTS phoneburner_calls CASCADE;
DROP TABLE IF EXISTS phoneburner_contacts CASCADE;
DROP TABLE IF EXISTS phoneburner_daily_metrics CASCADE;
DROP TABLE IF EXISTS phoneburner_dial_sessions CASCADE;
DROP TABLE IF EXISTS phoneburner_members CASCADE;
DROP TABLE IF EXISTS rep_goals CASCADE;
DROP TABLE IF EXISTS replyio_campaign_cumulative CASCADE;
DROP TABLE IF EXISTS replyio_daily_metrics CASCADE;
DROP TABLE IF EXISTS replyio_message_events CASCADE;
DROP TABLE IF EXISTS replyio_variants CASCADE;
DROP TABLE IF EXISTS segment_metrics CASCADE;
DROP TABLE IF EXISTS sequence_features CASCADE;
DROP TABLE IF EXISTS sequence_performance CASCADE;
DROP TABLE IF EXISTS smartlead_campaign_cumulative CASCADE;
DROP TABLE IF EXISTS smartlead_daily_metrics CASCADE;
DROP TABLE IF EXISTS smartlead_leads CASCADE;
DROP TABLE IF EXISTS smartlead_variants CASCADE;
DROP TABLE IF EXISTS sync_cursors CASCADE;
DROP TABLE IF EXISTS time_performance CASCADE;
DROP TABLE IF EXISTS training_assignments CASCADE;
DROP TABLE IF EXISTS training_items CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;

-- ============================================
-- PHASE 2: HELPER FUNCTIONS
-- ============================================

-- Keep existing profiles table (linked to auth.users)
-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Calculate margin of error for a proportion
CREATE OR REPLACE FUNCTION calc_margin_of_error(successes INTEGER, total INTEGER, confidence DECIMAL DEFAULT 0.95)
RETURNS DECIMAL
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    p DECIMAL;
    z DECIMAL;
    moe DECIMAL;
BEGIN
    IF total < 30 THEN
        RETURN NULL;
    END IF;
    
    p := successes::DECIMAL / total;
    
    z := CASE 
        WHEN confidence >= 0.99 THEN 2.576
        WHEN confidence >= 0.95 THEN 1.96
        WHEN confidence >= 0.90 THEN 1.645
        ELSE 1.96
    END;
    
    moe := z * SQRT((p * (1 - p)) / total);
    
    RETURN ROUND(moe, 4);
END;
$$;

-- ============================================
-- TIER 1: ORGANIZATION STRUCTURE
-- ============================================

-- CLIENTS (PE Firms / Corporate Buyers)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    client_type VARCHAR(50) NOT NULL DEFAULT 'pe_firm',
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),
    settings JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ENGAGEMENTS (Client Projects)
CREATE TABLE IF NOT EXISTS engagements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_criteria JSONB DEFAULT '{}',
    target_list_size INTEGER,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'draft',
    meeting_goal INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- CLIENT MEMBERS (Access Control)
CREATE TABLE IF NOT EXISTS client_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, user_id)
);

-- ============================================
-- TIER 2: DATA SOURCE CONNECTIONS
-- ============================================

-- DATA SOURCES (Platform Connections)
CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    webhook_secret TEXT,
    additional_config JSONB DEFAULT '{}',
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    sync_enabled BOOLEAN DEFAULT true,
    sync_frequency VARCHAR(50) DEFAULT '5_minutes',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(50),
    last_sync_error TEXT,
    last_sync_records_processed INTEGER DEFAULT 0,
    total_syncs INTEGER DEFAULT 0,
    failed_syncs INTEGER DEFAULT 0,
    avg_sync_duration_ms INTEGER,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SYNC LOGS
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    status VARCHAR(50) NOT NULL,
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
    cursor_state JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WEBHOOK EVENTS
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    source_type VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255),
    headers JSONB,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    retry_count INTEGER DEFAULT 0,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_dedup 
    ON webhook_events(source_type, event_id) 
    WHERE event_id IS NOT NULL;

-- SOURCE ID MAPPINGS
CREATE TABLE IF NOT EXISTS source_id_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    external_entity_type VARCHAR(50) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    internal_entity_type VARCHAR(50) NOT NULL,
    internal_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(data_source_id, external_entity_type, external_id)
);

-- ============================================
-- TIER 3: CAMPAIGNS & CONTENT
-- ============================================

-- CAMPAIGNS
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(50) NOT NULL,
    external_id VARCHAR(255),
    external_url TEXT,
    settings JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft',
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_replied INTEGER DEFAULT 0,
    total_bounced INTEGER DEFAULT 0,
    total_meetings INTEGER DEFAULT 0,
    reply_rate DECIMAL(5,4) DEFAULT 0,
    open_rate DECIMAL(5,4) DEFAULT 0,
    bounce_rate DECIMAL(5,4) DEFAULT 0,
    quality_score INTEGER,
    quality_tier VARCHAR(20),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_synced_at TIMESTAMP WITH TIME ZONE
);

-- SEQUENCES
CREATE TABLE IF NOT EXISTS sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(255),
    subject_line TEXT,
    body_template TEXT,
    body_html TEXT,
    body_plain TEXT,
    delay_days INTEGER DEFAULT 0,
    delay_hours INTEGER DEFAULT 0,
    send_window_start TIME,
    send_window_end TIME,
    send_days TEXT[],
    external_id VARCHAR(255),
    total_sent INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_replied INTEGER DEFAULT 0,
    reply_rate DECIMAL(5,4) DEFAULT 0,
    open_rate DECIMAL(5,4) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, step_number)
);

-- CAMPAIGN VARIANTS (A/B Testing)
CREATE TABLE IF NOT EXISTS campaign_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    sequence_id UUID REFERENCES sequences(id) ON DELETE SET NULL,
    data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    external_id VARCHAR(255),
    subject_line TEXT NOT NULL,
    body_html TEXT,
    body_plain TEXT,
    body_preview VARCHAR(500),
    personalization_vars JSONB DEFAULT '[]',
    step_number INTEGER,
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_replied INTEGER DEFAULT 0,
    total_bounced INTEGER DEFAULT 0,
    total_unsubscribed INTEGER DEFAULT 0,
    delivery_rate DECIMAL(5,4) DEFAULT 0,
    open_rate DECIMAL(5,4) DEFAULT 0,
    click_rate DECIMAL(5,4) DEFAULT 0,
    reply_rate DECIMAL(5,4) DEFAULT 0,
    bounce_rate DECIMAL(5,4) DEFAULT 0,
    positive_reply_rate DECIMAL(5,4) DEFAULT 0,
    positive_replies INTEGER DEFAULT 0,
    timing_replies INTEGER DEFAULT 0,
    not_interested_replies INTEGER DEFAULT 0,
    sample_size_sufficient BOOLEAN DEFAULT false,
    confidence_level VARCHAR(20),
    margin_of_error DECIMAL(5,4),
    status VARCHAR(50) DEFAULT 'active',
    is_control BOOLEAN DEFAULT false,
    first_sent_at TIMESTAMP WITH TIME ZONE,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_campaign_variants_campaign ON campaign_variants(campaign_id);
CREATE INDEX idx_campaign_variants_external ON campaign_variants(data_source_id, external_id);
CREATE INDEX idx_campaign_variants_reply_rate ON campaign_variants(reply_rate DESC) WHERE total_sent >= 500;

-- ============================================
-- TIER 4: COPY ANALYSIS & INSIGHTS
-- ============================================

-- CAMPAIGN VARIANT FEATURES
CREATE TABLE IF NOT EXISTS campaign_variant_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES campaign_variants(id) ON DELETE CASCADE,
    engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
    subject_length INTEGER,
    subject_word_count INTEGER,
    subject_format VARCHAR(50),
    subject_has_personalization BOOLEAN DEFAULT false,
    subject_personalization_type VARCHAR(50),
    subject_first_word_type VARCHAR(50),
    subject_has_emoji BOOLEAN DEFAULT false,
    subject_has_number BOOLEAN DEFAULT false,
    subject_capitalization VARCHAR(50),
    subject_punctuation VARCHAR(50),
    subject_urgency_score DECIMAL(5,2),
    subject_spam_word_count INTEGER DEFAULT 0,
    body_length INTEGER,
    body_word_count INTEGER,
    body_paragraph_count INTEGER,
    body_sentence_count INTEGER,
    body_has_bullets BOOLEAN DEFAULT false,
    body_bullet_count INTEGER DEFAULT 0,
    body_has_personalization BOOLEAN DEFAULT false,
    body_personalization_count INTEGER DEFAULT 0,
    body_reading_grade DECIMAL(4,1),
    body_you_i_ratio DECIMAL(5,2),
    body_question_count INTEGER DEFAULT 0,
    body_link_count INTEGER DEFAULT 0,
    body_has_calendar_link BOOLEAN DEFAULT false,
    body_cta_type VARCHAR(50),
    body_cta_strength VARCHAR(20),
    body_cta_position VARCHAR(20),
    body_value_proposition_count INTEGER DEFAULT 0,
    opening_line_type VARCHAR(50),
    opening_line_text TEXT,
    tone VARCHAR(50),
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(variant_id)
);

CREATE INDEX idx_variant_features_variant ON campaign_variant_features(variant_id);
CREATE INDEX idx_variant_features_engagement ON campaign_variant_features(engagement_id);
CREATE INDEX idx_variant_features_cta ON campaign_variant_features(body_cta_type);
CREATE INDEX idx_variant_features_format ON campaign_variant_features(subject_format);

-- COPY PATTERNS
CREATE TABLE IF NOT EXISTS copy_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
    pattern_type VARCHAR(50) NOT NULL,
    pattern_value VARCHAR(100) NOT NULL,
    total_variants INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_replied INTEGER DEFAULT 0,
    avg_reply_rate DECIMAL(5,4) DEFAULT 0,
    reply_rate_ci_lower DECIMAL(5,4),
    reply_rate_ci_upper DECIMAL(5,4),
    p_value DECIMAL(8,6),
    is_significant BOOLEAN DEFAULT false,
    lift_vs_baseline DECIMAL(6,2),
    baseline_reply_rate DECIMAL(5,4),
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(engagement_id, pattern_type, pattern_value)
);

CREATE INDEX idx_copy_patterns_engagement ON copy_patterns(engagement_id);
CREATE INDEX idx_copy_patterns_type ON copy_patterns(pattern_type);

-- VARIANT DECAY TRACKING
CREATE TABLE IF NOT EXISTS variant_decay_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES campaign_variants(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    sends_this_week INTEGER DEFAULT 0,
    replies_this_week INTEGER DEFAULT 0,
    reply_rate_this_week DECIMAL(5,4) DEFAULT 0,
    cumulative_sends INTEGER DEFAULT 0,
    cumulative_replies INTEGER DEFAULT 0,
    cumulative_reply_rate DECIMAL(5,4) DEFAULT 0,
    decay_from_peak DECIMAL(5,2),
    decay_severity VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(variant_id, week_number)
);

CREATE INDEX idx_variant_decay_variant ON variant_decay_tracking(variant_id);
CREATE INDEX idx_variant_decay_week ON variant_decay_tracking(week_start);