-- ============================================
-- PHASE 1: DROP ALL EXISTING TABLES
-- ============================================
-- This will cascade and remove all data, triggers, policies, etc.

-- Drop all views first
DROP VIEW IF EXISTS audience_performance CASCADE;
DROP VIEW IF EXISTS contact_engagement_summary CASCADE;
DROP VIEW IF EXISTS copy_performance CASCADE;

-- Drop all existing tables (in dependency order)
DROP TABLE IF EXISTS ai_chatbot_messages CASCADE;
DROP TABLE IF EXISTS ai_chatbot_conversations CASCADE;
DROP TABLE IF EXISTS ai_coaching_recommendations CASCADE;
DROP TABLE IF EXISTS ai_weekly_summaries CASCADE;
DROP TABLE IF EXISTS alert_configs CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS api_connections CASCADE;
DROP TABLE IF EXISTS audience_segments CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS call_ai_scores CASCADE;
DROP TABLE IF EXISTS call_library_categories CASCADE;
DROP TABLE IF EXISTS call_library_entries CASCADE;
DROP TABLE IF EXISTS call_summaries CASCADE;
DROP TABLE IF EXISTS call_transcripts CASCADE;
DROP TABLE IF EXISTS calling_deals CASCADE;
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS campaign_cumulative CASCADE;
DROP TABLE IF EXISTS campaign_metrics CASCADE;
DROP TABLE IF EXISTS campaign_variant_features CASCADE;
DROP TABLE IF EXISTS campaign_variant_metrics CASCADE;
DROP TABLE IF EXISTS campaign_variants CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS channel_best_practices CASCADE;
DROP TABLE IF EXISTS cold_calling_benchmarks CASCADE;
DROP TABLE IF EXISTS cold_calls CASCADE;
DROP TABLE IF EXISTS copy_library CASCADE;
DROP TABLE IF EXISTS daily_metrics CASCADE;
DROP TABLE IF EXISTS deliverability_alerts CASCADE;
DROP TABLE IF EXISTS email_accounts CASCADE;
DROP TABLE IF EXISTS engagements CASCADE;
DROP TABLE IF EXISTS experiment_results CASCADE;
DROP TABLE IF EXISTS experiment_variants CASCADE;
DROP TABLE IF EXISTS experiments CASCADE;
DROP TABLE IF EXISTS external_calls CASCADE;
DROP TABLE IF EXISTS industry_documents CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS link_previews CASCADE;
DROP TABLE IF EXISTS message_events CASCADE;
DROP TABLE IF EXISTS oauth_tokens CASCADE;
DROP TABLE IF EXISTS pending_team_invites CASCADE;
DROP TABLE IF EXISTS phoneburner_calls CASCADE;
DROP TABLE IF EXISTS rep_profiles CASCADE;
DROP TABLE IF EXISTS reply_classifications CASCADE;
DROP TABLE IF EXISTS replyio_campaign_leads CASCADE;
DROP TABLE IF EXISTS replyio_campaigns CASCADE;
DROP TABLE IF EXISTS replyio_leads CASCADE;
DROP TABLE IF EXISTS sending_domains CASCADE;
DROP TABLE IF EXISTS smartlead_campaign_leads CASCADE;
DROP TABLE IF EXISTS smartlead_campaigns CASCADE;
DROP TABLE IF EXISTS smartlead_leads CASCADE;
DROP TABLE IF EXISTS sync_status CASCADE;
DROP TABLE IF EXISTS training_assignments CASCADE;
DROP TABLE IF EXISTS unified_campaign_variants CASCADE;
DROP TABLE IF EXISTS unified_campaigns CASCADE;
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS workspace_members CASCADE;
DROP TABLE IF EXISTS workspace_metrics CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;

-- Keep profiles and user_roles for auth (as requested)
-- DROP TABLE IF EXISTS profiles CASCADE; -- KEEPING
-- DROP TABLE IF EXISTS user_roles CASCADE; -- KEEPING

-- ============================================
-- PHASE 2: CREATE NEW CORE SCHEMA
-- ============================================

-- 1. CLIENTS (PE Firms / Corporate Buyers we serve)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic Info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    client_type VARCHAR(50) NOT NULL DEFAULT 'pe_firm', -- 'pe_firm', 'corporate', 'family_office', 'independent_sponsor'
    
    -- Contact Info
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),
    
    -- Settings
    settings JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'paused', 'churned'
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_slug ON clients(slug);

-- 2. ENGAGEMENTS (Client Projects/Campaigns)
CREATE TABLE engagements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Basic Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Targeting Criteria
    target_criteria JSONB DEFAULT '{}',
    target_list_size INTEGER,
    
    -- Timeline
    start_date DATE,
    end_date DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed'
    
    -- Goals
    meeting_goal INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_engagements_client ON engagements(client_id);
CREATE INDEX idx_engagements_status ON engagements(status);
CREATE INDEX idx_engagements_dates ON engagements(start_date, end_date);

-- 3. DATA SOURCES (External Platform Connections)
CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source Identity
    source_type VARCHAR(50) NOT NULL, -- 'reply_io', 'smartlead', 'phoneburner', 'instantly', 'custom'
    name VARCHAR(255) NOT NULL,
    
    -- Connection Config
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    webhook_secret TEXT,
    additional_config JSONB DEFAULT '{}',
    
    -- Sync Settings
    sync_enabled BOOLEAN DEFAULT true,
    sync_frequency VARCHAR(50) DEFAULT '5_minutes',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(50),
    last_sync_error TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'error'
    
    -- OAuth tokens (for PhoneBurner, etc.)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_data_sources_type ON data_sources(source_type);
CREATE INDEX idx_data_sources_status ON data_sources(status);

-- 4. CAMPAIGNS (Email or Calling Campaigns)
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    
    -- Basic Info
    name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(50) NOT NULL, -- 'email', 'calling', 'linkedin', 'mixed'
    
    -- External Reference
    external_id VARCHAR(255),
    external_url TEXT,
    
    -- Settings
    settings JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed'
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Sync tracking
    last_synced_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_campaigns_engagement ON campaigns(engagement_id);
CREATE INDEX idx_campaigns_source ON campaigns(data_source_id);
CREATE INDEX idx_campaigns_external ON campaigns(data_source_id, external_id);
CREATE INDEX idx_campaigns_type ON campaigns(campaign_type);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- 5. SEQUENCES (Email Sequence Steps)
CREATE TABLE sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Step Info
    step_number INTEGER NOT NULL,
    step_name VARCHAR(255),
    
    -- Content
    subject_line TEXT,
    body_template TEXT,
    
    -- Timing
    delay_days INTEGER DEFAULT 0,
    delay_hours INTEGER DEFAULT 0,
    send_window_start TIME,
    send_window_end TIME,
    send_days TEXT[],
    
    -- External Reference
    external_id VARCHAR(255),
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(campaign_id, step_number)
);

CREATE INDEX idx_sequences_campaign ON sequences(campaign_id);

-- 6. TARGET COMPANIES
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    
    -- Company Info
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    website TEXT,
    
    -- Firmographics
    industry VARCHAR(255),
    sub_industry VARCHAR(255),
    revenue BIGINT,
    revenue_range VARCHAR(50),
    employee_count INTEGER,
    employee_range VARCHAR(50),
    year_founded INTEGER,
    
    -- Location
    address_street VARCHAR(255),
    address_city VARCHAR(255),
    address_state VARCHAR(100),
    address_postal VARCHAR(20),
    address_country VARCHAR(100) DEFAULT 'USA',
    
    -- Enrichment Data
    linkedin_url TEXT,
    description TEXT,
    
    -- Engagement Status (denormalized for performance)
    status VARCHAR(50) DEFAULT 'not_contacted',
    
    -- Rollup Metrics (denormalized)
    total_touches INTEGER DEFAULT 0,
    email_touches INTEGER DEFAULT 0,
    call_touches INTEGER DEFAULT 0,
    last_touch_at TIMESTAMP WITH TIME ZONE,
    last_touch_type VARCHAR(50),
    first_response_at TIMESTAMP WITH TIME ZONE,
    response_type VARCHAR(50),
    
    -- Source Tracking
    source VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(engagement_id, domain)
);

CREATE INDEX idx_companies_engagement ON companies(engagement_id);
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_industry ON companies(industry);

-- 7. CONTACTS (People at Target Companies)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    
    -- Contact Info
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    email_status VARCHAR(50) DEFAULT 'unknown',
    phone VARCHAR(50),
    phone_status VARCHAR(50) DEFAULT 'unknown',
    mobile VARCHAR(50),
    
    -- Professional Info
    title VARCHAR(255),
    title_level VARCHAR(50),
    department VARCHAR(100),
    linkedin_url TEXT,
    
    -- Contact Preferences
    timezone VARCHAR(100),
    best_time_to_call VARCHAR(50),
    do_not_contact BOOLEAN DEFAULT false,
    do_not_email BOOLEAN DEFAULT false,
    do_not_call BOOLEAN DEFAULT false,
    
    -- Engagement Status
    is_primary BOOLEAN DEFAULT false,
    is_decision_maker BOOLEAN DEFAULT false,
    
    -- Rollup Metrics
    total_emails_sent INTEGER DEFAULT 0,
    total_emails_opened INTEGER DEFAULT 0,
    total_emails_replied INTEGER DEFAULT 0,
    total_calls INTEGER DEFAULT 0,
    total_conversations INTEGER DEFAULT 0,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    last_responded_at TIMESTAMP WITH TIME ZONE,
    
    -- Source Tracking
    source VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_engagement ON contacts(engagement_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_primary ON contacts(company_id, is_primary) WHERE is_primary = true;

-- 8. EMAIL ACTIVITIES
CREATE TABLE email_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    sequence_id UUID REFERENCES sequences(id) ON DELETE SET NULL,
    data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    
    -- External Reference
    external_id VARCHAR(255),
    external_message_id VARCHAR(255),
    
    -- Email Details
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    to_email VARCHAR(255) NOT NULL,
    subject TEXT,
    body_preview TEXT,
    
    -- Sequence Info
    step_number INTEGER,
    
    -- Status Flags
    sent BOOLEAN DEFAULT false,
    delivered BOOLEAN,
    bounced BOOLEAN DEFAULT false,
    bounce_type VARCHAR(50),
    bounce_reason TEXT,
    opened BOOLEAN DEFAULT false,
    open_count INTEGER DEFAULT 0,
    clicked BOOLEAN DEFAULT false,
    click_count INTEGER DEFAULT 0,
    replied BOOLEAN DEFAULT false,
    unsubscribed BOOLEAN DEFAULT false,
    marked_spam BOOLEAN DEFAULT false,
    
    -- Timestamps
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    bounced_at TIMESTAMP WITH TIME ZONE,
    first_opened_at TIMESTAMP WITH TIME ZONE,
    last_opened_at TIMESTAMP WITH TIME ZONE,
    first_clicked_at TIMESTAMP WITH TIME ZONE,
    replied_at TIMESTAMP WITH TIME ZONE,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    
    -- Reply Details
    reply_text TEXT,
    reply_sentiment VARCHAR(50),
    
    -- Sync Tracking
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_data JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_email_activities_external 
    ON email_activities(data_source_id, external_id) 
    WHERE external_id IS NOT NULL;

CREATE INDEX idx_email_activities_contact ON email_activities(contact_id);
CREATE INDEX idx_email_activities_company ON email_activities(company_id);
CREATE INDEX idx_email_activities_engagement ON email_activities(engagement_id);
CREATE INDEX idx_email_activities_campaign ON email_activities(campaign_id);
CREATE INDEX idx_email_activities_sent_at ON email_activities(sent_at);
CREATE INDEX idx_email_activities_replied ON email_activities(engagement_id, replied) WHERE replied = true;

-- 9. CALL ACTIVITIES
CREATE TABLE call_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    
    -- External Reference
    external_id VARCHAR(255),
    
    -- Caller Info
    caller_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    caller_name VARCHAR(255),
    caller_phone VARCHAR(50),
    
    -- Call Details
    to_phone VARCHAR(50) NOT NULL,
    to_name VARCHAR(255),
    
    -- Timing
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    ring_duration INTEGER DEFAULT 0,
    talk_duration INTEGER DEFAULT 0,
    
    -- Disposition
    disposition VARCHAR(50) NOT NULL,
    
    -- Conversation Outcome
    conversation_outcome VARCHAR(50),
    
    -- Notes & Recording
    notes TEXT,
    recording_url TEXT,
    recording_duration INTEGER,
    transcription TEXT,
    
    -- Follow-up
    callback_scheduled BOOLEAN DEFAULT false,
    callback_datetime TIMESTAMP WITH TIME ZONE,
    callback_notes TEXT,
    
    -- Voicemail
    voicemail_left BOOLEAN DEFAULT false,
    voicemail_template VARCHAR(255),
    
    -- Sync Tracking
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_data JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_call_activities_external 
    ON call_activities(data_source_id, external_id) 
    WHERE external_id IS NOT NULL;

CREATE INDEX idx_call_activities_contact ON call_activities(contact_id);
CREATE INDEX idx_call_activities_company ON call_activities(company_id);
CREATE INDEX idx_call_activities_engagement ON call_activities(engagement_id);
CREATE INDEX idx_call_activities_started_at ON call_activities(started_at);
CREATE INDEX idx_call_activities_disposition ON call_activities(disposition);

-- 10. RESPONSES (Unified Response Tracking)
CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    
    -- Source Activity
    source_type VARCHAR(50) NOT NULL,
    email_activity_id UUID REFERENCES email_activities(id) ON DELETE SET NULL,
    call_activity_id UUID REFERENCES call_activities(id) ON DELETE SET NULL,
    
    -- Response Details
    response_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    response_channel VARCHAR(50) NOT NULL,
    
    -- Categorization
    category VARCHAR(50) NOT NULL,
    sub_category VARCHAR(100),
    
    -- Content
    summary TEXT,
    full_text TEXT,
    
    -- Sentiment Analysis
    sentiment_score DECIMAL(3,2),
    sentiment_label VARCHAR(50),
    
    -- Meeting Conversion
    converted_to_meeting BOOLEAN DEFAULT false,
    meeting_id UUID,
    
    -- Follow-up
    requires_follow_up BOOLEAN DEFAULT true,
    follow_up_date DATE,
    follow_up_notes TEXT,
    
    -- Processing
    processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_responses_contact ON responses(contact_id);
CREATE INDEX idx_responses_company ON responses(company_id);
CREATE INDEX idx_responses_engagement ON responses(engagement_id);
CREATE INDEX idx_responses_datetime ON responses(response_datetime);
CREATE INDEX idx_responses_category ON responses(category);

-- 11. MEETINGS
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    response_id UUID REFERENCES responses(id) ON DELETE SET NULL,
    
    -- Meeting Details
    title VARCHAR(255),
    description TEXT,
    meeting_type VARCHAR(50),
    
    -- Scheduling
    scheduled_datetime TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 30,
    timezone VARCHAR(100),
    
    -- Location/Link
    location_type VARCHAR(50),
    meeting_link TEXT,
    meeting_phone VARCHAR(50),
    meeting_address TEXT,
    
    -- Attendees
    client_attendees JSONB DEFAULT '[]',
    target_attendees JSONB DEFAULT '[]',
    internal_attendees JSONB DEFAULT '[]',
    
    -- Attribution
    source_channel VARCHAR(50),
    source_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    touch_count_at_booking INTEGER,
    days_to_meeting INTEGER,
    
    -- Status
    status VARCHAR(50) DEFAULT 'scheduled',
    
    -- Outcome
    outcome VARCHAR(50),
    outcome_notes TEXT,
    
    -- Calendar Integration
    calendar_event_id VARCHAR(255),
    calendar_provider VARCHAR(50),
    
    -- Timestamps
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

CREATE INDEX idx_meetings_contact ON meetings(contact_id);
CREATE INDEX idx_meetings_company ON meetings(company_id);
CREATE INDEX idx_meetings_engagement ON meetings(engagement_id);
CREATE INDEX idx_meetings_scheduled ON meetings(scheduled_datetime);
CREATE INDEX idx_meetings_status ON meetings(status);

-- 12. SOURCE ID MAPPINGS (For Deduplication)
CREATE TABLE source_id_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source Info
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    
    -- External ID
    external_entity_type VARCHAR(50) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    
    -- Internal ID
    internal_entity_type VARCHAR(50) NOT NULL,
    internal_id UUID NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(data_source_id, external_entity_type, external_id)
);

CREATE INDEX idx_source_mappings_external ON source_id_mappings(data_source_id, external_entity_type, external_id);
CREATE INDEX idx_source_mappings_internal ON source_id_mappings(internal_entity_type, internal_id);

-- 13. SYNC LOGS
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    
    -- Sync Details
    sync_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    
    -- Results
    status VARCHAR(50) NOT NULL,
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    
    -- Errors
    error_message TEXT,
    error_details JSONB,
    
    -- Pagination State
    cursor_state JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_source ON sync_logs(data_source_id);
CREATE INDEX idx_sync_logs_started ON sync_logs(started_at);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);

-- 14. WEBHOOK EVENTS (Raw Event Storage)
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source
    data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
    source_type VARCHAR(50) NOT NULL,
    
    -- Event Details
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255),
    
    -- Payload
    headers JSONB,
    payload JSONB NOT NULL,
    
    -- Processing
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_webhook_events_dedup 
    ON webhook_events(source_type, event_id) 
    WHERE event_id IS NOT NULL;

CREATE INDEX idx_webhook_events_source ON webhook_events(data_source_id);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_unprocessed ON webhook_events(processed, received_at) WHERE processed = false;

-- 15. CLIENT MEMBERS (Link users to clients for access control)
CREATE TABLE client_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'viewer', -- 'admin', 'manager', 'analyst', 'viewer'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(client_id, user_id)
);

CREATE INDEX idx_client_members_client ON client_members(client_id);
CREATE INDEX idx_client_members_user ON client_members(user_id);

-- ============================================
-- PHASE 3: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_id_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PHASE 4: RLS POLICIES
-- ============================================

-- Helper function to check if user is member of a client
CREATE OR REPLACE FUNCTION is_client_member(_client_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_members
    WHERE client_id = _client_id AND user_id = _user_id
  );
$$;

-- Helper function to check if user is admin of a client
CREATE OR REPLACE FUNCTION is_client_admin(_client_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM client_members
    WHERE client_id = _client_id AND user_id = _user_id AND role = 'admin'
  );
$$;

-- CLIENTS policies
CREATE POLICY "Users can view clients they belong to"
    ON clients FOR SELECT
    USING (is_client_member(id, auth.uid()));

CREATE POLICY "Admins can update clients"
    ON clients FOR UPDATE
    USING (is_client_admin(id, auth.uid()));

CREATE POLICY "Authenticated users can create clients"
    ON clients FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- CLIENT MEMBERS policies
CREATE POLICY "Users can view their own memberships"
    ON client_members FOR SELECT
    USING (user_id = auth.uid() OR is_client_admin(client_id, auth.uid()));

CREATE POLICY "Admins can manage client members"
    ON client_members FOR ALL
    USING (is_client_admin(client_id, auth.uid()));

-- ENGAGEMENTS policies
CREATE POLICY "Users can view engagements of their clients"
    ON engagements FOR SELECT
    USING (is_client_member(client_id, auth.uid()));

CREATE POLICY "Admins can manage engagements"
    ON engagements FOR ALL
    USING (is_client_admin(client_id, auth.uid()));

-- DATA SOURCES - open for now (shared infrastructure)
CREATE POLICY "Authenticated users can view data sources"
    ON data_sources FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage data sources"
    ON data_sources FOR ALL
    USING (auth.uid() IS NOT NULL);

-- CAMPAIGNS policies
CREATE POLICY "Users can view campaigns of their engagements"
    ON campaigns FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM engagements e
            WHERE e.id = campaigns.engagement_id
            AND is_client_member(e.client_id, auth.uid())
        )
    );

CREATE POLICY "Users can manage campaigns of their engagements"
    ON campaigns FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM engagements e
            WHERE e.id = campaigns.engagement_id
            AND is_client_admin(e.client_id, auth.uid())
        )
    );

-- SEQUENCES policies
CREATE POLICY "Users can view sequences"
    ON sequences FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            JOIN engagements e ON e.id = c.engagement_id
            WHERE c.id = sequences.campaign_id
            AND is_client_member(e.client_id, auth.uid())
        )
    );

-- COMPANIES policies
CREATE POLICY "Users can view companies in their engagements"
    ON companies FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM engagements e
            WHERE e.id = companies.engagement_id
            AND is_client_member(e.client_id, auth.uid())
        )
    );

CREATE POLICY "Users can manage companies in their engagements"
    ON companies FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM engagements e
            WHERE e.id = companies.engagement_id
            AND is_client_admin(e.client_id, auth.uid())
        )
    );

-- CONTACTS policies
CREATE POLICY "Users can view contacts in their engagements"
    ON contacts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM engagements e
            WHERE e.id = contacts.engagement_id
            AND is_client_member(e.client_id, auth.uid())
        )
    );

CREATE POLICY "Users can manage contacts in their engagements"
    ON contacts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM engagements e
            WHERE e.id = contacts.engagement_id
            AND is_client_admin(e.client_id, auth.uid())
        )
    );

-- EMAIL_ACTIVITIES policies
CREATE POLICY "Users can view email activities in their engagements"
    ON email_activities FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM engagements e
            WHERE e.id = email_activities.engagement_id
            AND is_client_member(e.client_id, auth.uid())
        )
    );

-- CALL_ACTIVITIES policies
CREATE POLICY "Users can view call activities in their engagements"
    ON call_activities FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM engagements e
            WHERE e.id = call_activities.engagement_id
            AND is_client_member(e.client_id, auth.uid())
        )
    );

-- RESPONSES policies
CREATE POLICY "Users can view responses in their engagements"
    ON responses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM engagements e
            WHERE e.id = responses.engagement_id
            AND is_client_member(e.client_id, auth.uid())
        )
    );

-- MEETINGS policies
CREATE POLICY "Users can view meetings in their engagements"
    ON meetings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM engagements e
            WHERE e.id = meetings.engagement_id
            AND is_client_member(e.client_id, auth.uid())
        )
    );

-- SOURCE_ID_MAPPINGS - service level access
CREATE POLICY "Authenticated users can view source mappings"
    ON source_id_mappings FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- SYNC_LOGS - service level access
CREATE POLICY "Authenticated users can view sync logs"
    ON sync_logs FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- WEBHOOK_EVENTS - service level access
CREATE POLICY "Authenticated users can view webhook events"
    ON webhook_events FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- ============================================
-- PHASE 5: TRIGGERS FOR updated_at
-- ============================================

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_engagements_updated_at
    BEFORE UPDATE ON engagements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_sources_updated_at
    BEFORE UPDATE ON data_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sequences_updated_at
    BEFORE UPDATE ON sequences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_activities_updated_at
    BEFORE UPDATE ON email_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_activities_updated_at
    BEFORE UPDATE ON call_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_responses_updated_at
    BEFORE UPDATE ON responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_source_id_mappings_updated_at
    BEFORE UPDATE ON source_id_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();