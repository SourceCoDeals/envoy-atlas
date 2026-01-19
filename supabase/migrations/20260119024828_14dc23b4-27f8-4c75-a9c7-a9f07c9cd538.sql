-- ============================================
-- TIER 5: COMPANIES & CONTACTS
-- ============================================

-- COMPANIES
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    website TEXT,
    description TEXT,
    linkedin_url TEXT,
    industry VARCHAR(100),
    sub_industry VARCHAR(100),
    revenue BIGINT,
    revenue_range VARCHAR(50),
    employee_count INTEGER,
    employee_range VARCHAR(50),
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_state VARCHAR(100),
    address_postal VARCHAR(20),
    address_country VARCHAR(100) DEFAULT 'USA',
    year_founded INTEGER,
    status VARCHAR(50) DEFAULT 'not_contacted',
    source VARCHAR(100),
    total_touches INTEGER DEFAULT 0,
    email_touches INTEGER DEFAULT 0,
    call_touches INTEGER DEFAULT 0,
    last_touch_at TIMESTAMP WITH TIME ZONE,
    last_touch_type VARCHAR(50),
    first_response_at TIMESTAMP WITH TIME ZONE,
    response_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_engagement_domain 
    ON companies(engagement_id, domain) 
    WHERE domain IS NOT NULL;

CREATE INDEX idx_companies_engagement ON companies(engagement_id);
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_industry ON companies(industry);

-- CONTACTS
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    title VARCHAR(255),
    title_level VARCHAR(50),
    seniority_level VARCHAR(50),
    department VARCHAR(100),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    phone_status VARCHAR(50) DEFAULT 'unknown',
    email_status VARCHAR(50) DEFAULT 'unknown',
    linkedin_url TEXT,
    timezone VARCHAR(100),
    best_time_to_call VARCHAR(50),
    company_size_category VARCHAR(50),
    is_primary BOOLEAN DEFAULT false,
    is_decision_maker BOOLEAN DEFAULT false,
    do_not_contact BOOLEAN DEFAULT false,
    do_not_email BOOLEAN DEFAULT false,
    do_not_call BOOLEAN DEFAULT false,
    source VARCHAR(100),
    total_emails_sent INTEGER DEFAULT 0,
    total_emails_opened INTEGER DEFAULT 0,
    total_emails_replied INTEGER DEFAULT 0,
    total_calls INTEGER DEFAULT 0,
    total_conversations INTEGER DEFAULT 0,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    last_responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_engagement_email 
    ON contacts(engagement_id, email) 
    WHERE email IS NOT NULL;

CREATE INDEX idx_contacts_engagement ON contacts(engagement_id);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_seniority ON contacts(seniority_level);
CREATE INDEX idx_contacts_department ON contacts(department);

-- ============================================
-- TIER 6: EMAIL & CALL ACTIVITIES
-- ============================================

-- EMAIL ACTIVITIES
CREATE TABLE IF NOT EXISTS email_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    sequence_id UUID REFERENCES sequences(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES campaign_variants(id) ON DELETE SET NULL,
    data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    external_id VARCHAR(255),
    external_message_id VARCHAR(255),
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    to_email VARCHAR(255) NOT NULL,
    subject TEXT,
    body_preview TEXT,
    step_number INTEGER,
    sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered BOOLEAN DEFAULT false,
    delivered_at TIMESTAMP WITH TIME ZONE,
    bounced BOOLEAN DEFAULT false,
    bounced_at TIMESTAMP WITH TIME ZONE,
    bounce_type VARCHAR(50),
    bounce_reason TEXT,
    opened BOOLEAN DEFAULT false,
    open_count INTEGER DEFAULT 0,
    first_opened_at TIMESTAMP WITH TIME ZONE,
    last_opened_at TIMESTAMP WITH TIME ZONE,
    clicked BOOLEAN DEFAULT false,
    click_count INTEGER DEFAULT 0,
    first_clicked_at TIMESTAMP WITH TIME ZONE,
    replied BOOLEAN DEFAULT false,
    replied_at TIMESTAMP WITH TIME ZONE,
    reply_text TEXT,
    reply_category VARCHAR(50),
    reply_sentiment VARCHAR(50),
    unsubscribed BOOLEAN DEFAULT false,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    marked_spam BOOLEAN DEFAULT false,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_activities_external 
    ON email_activities(data_source_id, external_id) 
    WHERE external_id IS NOT NULL;

CREATE INDEX idx_email_activities_contact ON email_activities(contact_id);
CREATE INDEX idx_email_activities_company ON email_activities(company_id);
CREATE INDEX idx_email_activities_engagement ON email_activities(engagement_id);
CREATE INDEX idx_email_activities_campaign ON email_activities(campaign_id);
CREATE INDEX idx_email_activities_variant ON email_activities(variant_id);
CREATE INDEX idx_email_activities_sent_at ON email_activities(sent_at);
CREATE INDEX idx_email_activities_replied ON email_activities(replied) WHERE replied = true;

-- CALL ACTIVITIES
CREATE TABLE IF NOT EXISTS call_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    external_id VARCHAR(255),
    caller_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    caller_name VARCHAR(255),
    caller_phone VARCHAR(50),
    to_phone VARCHAR(50) NOT NULL,
    to_name VARCHAR(255),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    ring_duration INTEGER DEFAULT 0,
    talk_duration INTEGER DEFAULT 0,
    disposition VARCHAR(50) NOT NULL,
    conversation_outcome VARCHAR(50),
    notes TEXT,
    recording_url TEXT,
    recording_duration INTEGER,
    transcription TEXT,
    callback_scheduled BOOLEAN DEFAULT false,
    callback_datetime TIMESTAMP WITH TIME ZONE,
    callback_notes TEXT,
    voicemail_left BOOLEAN DEFAULT false,
    voicemail_template VARCHAR(255),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_activities_external 
    ON call_activities(data_source_id, external_id) 
    WHERE external_id IS NOT NULL;

CREATE INDEX idx_call_activities_contact ON call_activities(contact_id);
CREATE INDEX idx_call_activities_company ON call_activities(company_id);
CREATE INDEX idx_call_activities_engagement ON call_activities(engagement_id);
CREATE INDEX idx_call_activities_started_at ON call_activities(started_at);
CREATE INDEX idx_call_activities_disposition ON call_activities(disposition);

-- ============================================
-- TIER 7: RESPONSES & MEETINGS
-- ============================================

-- RESPONSES
CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    email_activity_id UUID REFERENCES email_activities(id) ON DELETE SET NULL,
    call_activity_id UUID REFERENCES call_activities(id) ON DELETE SET NULL,
    response_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    response_channel VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    sub_category VARCHAR(100),
    summary TEXT,
    full_text TEXT,
    sentiment_score DECIMAL(3,2),
    sentiment_label VARCHAR(50),
    converted_to_meeting BOOLEAN DEFAULT false,
    meeting_id UUID,
    requires_follow_up BOOLEAN DEFAULT true,
    follow_up_date DATE,
    follow_up_notes TEXT,
    processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_responses_engagement ON responses(engagement_id);
CREATE INDEX idx_responses_category ON responses(category);
CREATE INDEX idx_responses_positive ON responses(engagement_id, category) WHERE category = 'positive';

-- MEETINGS
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    response_id UUID REFERENCES responses(id) ON DELETE SET NULL,
    title VARCHAR(255),
    description TEXT,
    meeting_type VARCHAR(50),
    scheduled_datetime TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 30,
    timezone VARCHAR(100),
    location_type VARCHAR(50),
    meeting_link TEXT,
    meeting_phone VARCHAR(50),
    meeting_address TEXT,
    client_attendees JSONB DEFAULT '[]',
    target_attendees JSONB DEFAULT '[]',
    internal_attendees JSONB DEFAULT '[]',
    source_channel VARCHAR(50),
    source_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    source_variant_id UUID REFERENCES campaign_variants(id) ON DELETE SET NULL,
    touch_count_at_booking INTEGER,
    days_to_meeting INTEGER,
    status VARCHAR(50) DEFAULT 'scheduled',
    outcome VARCHAR(50),
    outcome_notes TEXT,
    calendar_event_id VARCHAR(255),
    calendar_provider VARCHAR(50),
    booked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add FK from responses to meetings
ALTER TABLE responses 
    ADD CONSTRAINT fk_responses_meeting 
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL;

CREATE INDEX idx_meetings_engagement ON meetings(engagement_id);
CREATE INDEX idx_meetings_scheduled ON meetings(scheduled_datetime);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_source ON meetings(source_channel);

-- ============================================
-- TIER 8: DEAL HUB
-- ============================================

-- DEAL CLIENTS
CREATE TABLE IF NOT EXISTS deal_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    client_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DEALS
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
    deal_client_id UUID REFERENCES deal_clients(id) ON DELETE SET NULL,
    project_name VARCHAR(255) NOT NULL,
    business_description TEXT,
    client_name VARCHAR(255),
    geography VARCHAR(255),
    industry VARCHAR(255),
    sub_industry VARCHAR(255),
    revenue BIGINT,
    revenue_display VARCHAR(50),
    ebitda BIGINT,
    ebitda_display VARCHAR(50),
    asking_price BIGINT,
    asking_price_display VARCHAR(50),
    revenue_multiple DECIMAL(4,2),
    ebitda_multiple DECIMAL(4,2),
    stage VARCHAR(50) NOT NULL DEFAULT 'new',
    teaser_url TEXT,
    cim_url TEXT,
    nda_signed_date DATE,
    notes TEXT,
    pass_reason TEXT,
    source_type VARCHAR(50),
    source_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    source_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    source_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_deals_engagement ON deals(engagement_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_client ON deals(deal_client_id);
CREATE INDEX idx_deals_industry ON deals(industry);

-- ============================================
-- TIER 9: EXPERIMENTS
-- ============================================

-- EXPERIMENTS
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    hypothesis TEXT,
    test_variable VARCHAR(100) NOT NULL,
    target_sample_size INTEGER DEFAULT 500,
    actual_sample_size INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft',
    result VARCHAR(50),
    winning_variant_id UUID,
    confidence_level DECIMAL(5,4),
    p_value DECIMAL(8,6),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EXPERIMENT VARIANTS
CREATE TABLE IF NOT EXISTS experiment_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    campaign_variant_id UUID REFERENCES campaign_variants(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    is_control BOOLEAN DEFAULT false,
    content_diff JSONB DEFAULT '{}',
    total_sent INTEGER DEFAULT 0,
    total_replied INTEGER DEFAULT 0,
    reply_rate DECIMAL(5,4) DEFAULT 0,
    margin_of_error DECIMAL(5,4),
    ci_lower DECIMAL(5,4),
    ci_upper DECIMAL(5,4),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_experiment_variants_experiment ON experiment_variants(experiment_id);

-- ============================================
-- TIER 10: AGGREGATED METRICS
-- ============================================

-- DAILY METRICS
CREATE TABLE IF NOT EXISTS daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES campaign_variants(id) ON DELETE CASCADE,
    data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    unique_opens INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    emails_replied INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,
    hard_bounces INTEGER DEFAULT 0,
    soft_bounces INTEGER DEFAULT 0,
    emails_unsubscribed INTEGER DEFAULT 0,
    positive_replies INTEGER DEFAULT 0,
    timing_replies INTEGER DEFAULT 0,
    not_interested_replies INTEGER DEFAULT 0,
    auto_replies INTEGER DEFAULT 0,
    calls_made INTEGER DEFAULT 0,
    calls_connected INTEGER DEFAULT 0,
    dm_conversations INTEGER DEFAULT 0,
    voicemails_left INTEGER DEFAULT 0,
    meetings_booked INTEGER DEFAULT 0,
    open_rate DECIMAL(5,4),
    reply_rate DECIMAL(5,4),
    bounce_rate DECIMAL(5,4),
    positive_rate DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, engagement_id, campaign_id, variant_id)
);

CREATE INDEX idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX idx_daily_metrics_engagement ON daily_metrics(engagement_id);
CREATE INDEX idx_daily_metrics_campaign ON daily_metrics(campaign_id);
CREATE INDEX idx_daily_metrics_variant ON daily_metrics(variant_id);
CREATE INDEX idx_daily_metrics_lookup ON daily_metrics(engagement_id, date);

-- ============================================
-- TIER 11: COPY LIBRARY & PLAYBOOK
-- ============================================

-- COPY LIBRARY (Save successful copy)
CREATE TABLE IF NOT EXISTS copy_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES campaign_variants(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    subject_line TEXT NOT NULL,
    body_html TEXT,
    body_plain TEXT,
    category VARCHAR(100),
    tags TEXT[],
    notes TEXT,
    is_template BOOLEAN DEFAULT false,
    total_sent INTEGER DEFAULT 0,
    total_replied INTEGER DEFAULT 0,
    reply_rate DECIMAL(5,4) DEFAULT 0,
    positive_rate DECIMAL(5,4) DEFAULT 0,
    performance_snapshot JSONB,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_copy_library_engagement ON copy_library(engagement_id);
CREATE INDEX idx_copy_library_category ON copy_library(category);

-- PLAYBOOK ENTRIES (Documented wins)
CREATE TABLE IF NOT EXISTS playbook_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    test_type VARCHAR(100) NOT NULL,
    winning_pattern TEXT NOT NULL,
    context TEXT,
    metrics JSONB,
    tags TEXT[],
    experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
    copy_library_id UUID REFERENCES copy_library(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_playbook_engagement ON playbook_entries(engagement_id);
CREATE INDEX idx_playbook_test_type ON playbook_entries(test_type);

-- ============================================
-- CONTACT NOTES
-- ============================================

CREATE TABLE IF NOT EXISTS contact_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    note_type VARCHAR(50) DEFAULT 'manual',
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contact_notes_contact ON contact_notes(contact_id);

-- ============================================
-- USER ROLES (Security)
-- ============================================

-- Create the role enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('admin', 'analyst', 'viewer');
    END IF;
END$$;

-- USER ROLES
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role)
);