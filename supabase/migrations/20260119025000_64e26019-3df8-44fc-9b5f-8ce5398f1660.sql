-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_id_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_variant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_decay_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user is client member
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

-- Check if user is client admin
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

-- Get client_id from engagement
CREATE OR REPLACE FUNCTION get_client_id_from_engagement(_engagement_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id FROM engagements WHERE id = _engagement_id;
$$;

-- Check role helper
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ============================================
-- RLS POLICIES - TIER 1
-- ============================================

-- CLIENTS
CREATE POLICY "Users can view their clients" ON clients FOR SELECT
    USING (is_client_member(id, auth.uid()));

CREATE POLICY "Admins can update their clients" ON clients FOR UPDATE
    USING (is_client_admin(id, auth.uid()));

CREATE POLICY "Authenticated users can create clients" ON clients FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ENGAGEMENTS
CREATE POLICY "Users can view engagements of their clients" ON engagements FOR SELECT
    USING (is_client_member(client_id, auth.uid()));

CREATE POLICY "Admins can manage engagements" ON engagements FOR ALL
    USING (is_client_admin(client_id, auth.uid()));

-- CLIENT MEMBERS
CREATE POLICY "Users can view their own memberships" ON client_members FOR SELECT
    USING (user_id = auth.uid() OR is_client_admin(client_id, auth.uid()));

CREATE POLICY "Admins can manage members" ON client_members FOR ALL
    USING (is_client_admin(client_id, auth.uid()));

-- ============================================
-- RLS POLICIES - TIER 2
-- ============================================

-- DATA SOURCES (Service-level access for sync functions)
CREATE POLICY "Service role can manage data sources" ON data_sources FOR ALL
    USING (true);

-- SYNC LOGS
CREATE POLICY "Service role can manage sync logs" ON sync_logs FOR ALL
    USING (true);

-- WEBHOOK EVENTS
CREATE POLICY "Service role can manage webhooks" ON webhook_events FOR ALL
    USING (true);

-- SOURCE ID MAPPINGS
CREATE POLICY "Service role can manage mappings" ON source_id_mappings FOR ALL
    USING (true);

-- ============================================
-- RLS POLICIES - TIER 3 (Engagement-scoped)
-- ============================================

-- CAMPAIGNS
CREATE POLICY "Users can view campaigns of their engagements" ON campaigns FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = campaigns.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Admins can manage campaigns" ON campaigns FOR ALL
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = campaigns.engagement_id 
        AND is_client_admin(e.client_id, auth.uid())
    ));

-- SEQUENCES
CREATE POLICY "Users can view sequences" ON sequences FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM campaigns c
        JOIN engagements e ON e.id = c.engagement_id
        WHERE c.id = sequences.campaign_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Admins can manage sequences" ON sequences FOR ALL
    USING (EXISTS (
        SELECT 1 FROM campaigns c
        JOIN engagements e ON e.id = c.engagement_id
        WHERE c.id = sequences.campaign_id 
        AND is_client_admin(e.client_id, auth.uid())
    ));

-- CAMPAIGN VARIANTS
CREATE POLICY "Users can view variants" ON campaign_variants FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM campaigns c
        JOIN engagements e ON e.id = c.engagement_id
        WHERE c.id = campaign_variants.campaign_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Admins can manage variants" ON campaign_variants FOR ALL
    USING (EXISTS (
        SELECT 1 FROM campaigns c
        JOIN engagements e ON e.id = c.engagement_id
        WHERE c.id = campaign_variants.campaign_id 
        AND is_client_admin(e.client_id, auth.uid())
    ));

-- ============================================
-- RLS POLICIES - TIER 4 (Copy Analysis)
-- ============================================

-- CAMPAIGN VARIANT FEATURES
CREATE POLICY "Users can view variant features" ON campaign_variant_features FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = campaign_variant_features.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Service role manages features" ON campaign_variant_features FOR ALL
    USING (true);

-- COPY PATTERNS
CREATE POLICY "Users can view patterns" ON copy_patterns FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = copy_patterns.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Service role manages patterns" ON copy_patterns FOR ALL
    USING (true);

-- VARIANT DECAY TRACKING
CREATE POLICY "Users can view decay tracking" ON variant_decay_tracking FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM campaign_variants cv
        JOIN campaigns c ON c.id = cv.campaign_id
        JOIN engagements e ON e.id = c.engagement_id
        WHERE cv.id = variant_decay_tracking.variant_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Service role manages decay" ON variant_decay_tracking FOR ALL
    USING (true);

-- ============================================
-- RLS POLICIES - TIER 5 (Companies & Contacts)
-- ============================================

-- COMPANIES
CREATE POLICY "Users can view companies" ON companies FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = companies.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Admins can manage companies" ON companies FOR ALL
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = companies.engagement_id 
        AND is_client_admin(e.client_id, auth.uid())
    ));

-- CONTACTS
CREATE POLICY "Users can view contacts" ON contacts FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = contacts.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Admins can manage contacts" ON contacts FOR ALL
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = contacts.engagement_id 
        AND is_client_admin(e.client_id, auth.uid())
    ));

-- ============================================
-- RLS POLICIES - TIER 6 (Activities)
-- ============================================

-- EMAIL ACTIVITIES
CREATE POLICY "Users can view email activities" ON email_activities FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = email_activities.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Service role manages email activities" ON email_activities FOR ALL
    USING (true);

-- CALL ACTIVITIES
CREATE POLICY "Users can view call activities" ON call_activities FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = call_activities.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Service role manages call activities" ON call_activities FOR ALL
    USING (true);

-- ============================================
-- RLS POLICIES - TIER 7 (Responses & Meetings)
-- ============================================

-- RESPONSES
CREATE POLICY "Users can view responses" ON responses FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = responses.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Members can manage responses" ON responses FOR ALL
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = responses.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

-- MEETINGS
CREATE POLICY "Users can view meetings" ON meetings FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = meetings.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Members can manage meetings" ON meetings FOR ALL
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = meetings.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

-- ============================================
-- RLS POLICIES - TIER 8 (Deal Hub)
-- ============================================

-- DEAL CLIENTS
CREATE POLICY "Users can view deal clients" ON deal_clients FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = deal_clients.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Members can manage deal clients" ON deal_clients FOR ALL
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = deal_clients.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

-- DEALS
CREATE POLICY "Users can view deals" ON deals FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = deals.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Members can manage deals" ON deals FOR ALL
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = deals.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

-- ============================================
-- RLS POLICIES - TIER 9 (Experiments)
-- ============================================

-- EXPERIMENTS
CREATE POLICY "Users can view experiments" ON experiments FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = experiments.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Members can manage experiments" ON experiments FOR ALL
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = experiments.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

-- EXPERIMENT VARIANTS
CREATE POLICY "Users can view experiment variants" ON experiment_variants FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM experiments exp
        JOIN engagements e ON e.id = exp.engagement_id
        WHERE exp.id = experiment_variants.experiment_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Members can manage experiment variants" ON experiment_variants FOR ALL
    USING (EXISTS (
        SELECT 1 FROM experiments exp
        JOIN engagements e ON e.id = exp.engagement_id
        WHERE exp.id = experiment_variants.experiment_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

-- ============================================
-- RLS POLICIES - TIER 10 (Metrics)
-- ============================================

-- DAILY METRICS
CREATE POLICY "Users can view daily metrics" ON daily_metrics FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = daily_metrics.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Service role manages daily metrics" ON daily_metrics FOR ALL
    USING (true);

-- ============================================
-- RLS POLICIES - TIER 11 (Library)
-- ============================================

-- COPY LIBRARY
CREATE POLICY "Users can view copy library" ON copy_library FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = copy_library.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Members can manage copy library" ON copy_library FOR ALL
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = copy_library.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

-- PLAYBOOK ENTRIES
CREATE POLICY "Users can view playbook" ON playbook_entries FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = playbook_entries.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Members can manage playbook" ON playbook_entries FOR ALL
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = playbook_entries.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

-- CONTACT NOTES
CREATE POLICY "Users can view contact notes" ON contact_notes FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = contact_notes.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

CREATE POLICY "Members can manage contact notes" ON contact_notes FOR ALL
    USING (EXISTS (
        SELECT 1 FROM engagements e 
        WHERE e.id = contact_notes.engagement_id 
        AND is_client_member(e.client_id, auth.uid())
    ));

-- ============================================
-- RLS POLICIES - USER ROLES
-- ============================================

CREATE POLICY "Users can view own roles" ON user_roles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON user_roles FOR ALL
    USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_engagements_updated_at BEFORE UPDATE ON engagements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON data_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_source_id_mappings_updated_at BEFORE UPDATE ON source_id_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sequences_updated_at BEFORE UPDATE ON sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_variants_updated_at BEFORE UPDATE ON campaign_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_variant_features_updated_at BEFORE UPDATE ON campaign_variant_features
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_activities_updated_at BEFORE UPDATE ON email_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_activities_updated_at BEFORE UPDATE ON call_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_responses_updated_at BEFORE UPDATE ON responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deal_clients_updated_at BEFORE UPDATE ON deal_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_experiments_updated_at BEFORE UPDATE ON experiments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_experiment_variants_updated_at BEFORE UPDATE ON experiment_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_metrics_updated_at BEFORE UPDATE ON daily_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_copy_library_updated_at BEFORE UPDATE ON copy_library
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playbook_entries_updated_at BEFORE UPDATE ON playbook_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS
-- ============================================

-- COPY PERFORMANCE VIEW
CREATE OR REPLACE VIEW copy_performance AS
SELECT 
    cv.id as variant_id,
    cv.campaign_id,
    cv.subject_line,
    cv.body_preview,
    cv.step_number,
    cv.total_sent,
    cv.total_replied,
    cv.reply_rate,
    cv.positive_replies,
    cv.confidence_level,
    cv.margin_of_error,
    cvf.subject_format,
    cvf.subject_length,
    cvf.body_cta_type,
    cvf.body_word_count,
    cvf.body_bullet_count,
    cvf.tone,
    cvf.opening_line_type,
    c.engagement_id,
    c.name as campaign_name
FROM campaign_variants cv
LEFT JOIN campaign_variant_features cvf ON cvf.variant_id = cv.id
JOIN campaigns c ON c.id = cv.campaign_id
WHERE cv.total_sent > 0;

-- SEGMENT PERFORMANCE VIEW
CREATE OR REPLACE VIEW segment_performance AS
SELECT 
    con.engagement_id,
    con.seniority_level,
    con.department,
    con.company_size_category,
    COUNT(DISTINCT con.id) as contact_count,
    COUNT(DISTINCT ea.id) as emails_sent,
    COUNT(DISTINCT CASE WHEN ea.replied THEN ea.id END) as emails_replied,
    COUNT(DISTINCT CASE WHEN ea.reply_category = 'positive' THEN ea.id END) as positive_replies,
    CASE 
        WHEN COUNT(DISTINCT ea.id) > 0 
        THEN COUNT(DISTINCT CASE WHEN ea.replied THEN ea.id END)::DECIMAL / COUNT(DISTINCT ea.id)
        ELSE 0 
    END as reply_rate
FROM contacts con
LEFT JOIN email_activities ea ON ea.contact_id = con.id
WHERE con.seniority_level IS NOT NULL
GROUP BY con.engagement_id, con.seniority_level, con.department, con.company_size_category;

-- ACTIVITY TIMELINE VIEW
CREATE OR REPLACE VIEW activity_timeline AS
SELECT 
    'email' as activity_type,
    ea.id as activity_id,
    ea.engagement_id,
    ea.company_id,
    ea.contact_id,
    ea.sent_at as activity_datetime,
    CASE 
        WHEN ea.replied THEN 'email_reply'
        WHEN ea.bounced THEN 'email_bounced'
        WHEN ea.opened THEN 'email_opened'
        WHEN ea.sent THEN 'email_sent'
        ELSE 'email_scheduled'
    END as activity_subtype,
    ea.subject as activity_summary
FROM email_activities ea
WHERE ea.sent_at IS NOT NULL

UNION ALL

SELECT 
    'call' as activity_type,
    ca.id as activity_id,
    ca.engagement_id,
    ca.company_id,
    ca.contact_id,
    ca.started_at as activity_datetime,
    ca.disposition as activity_subtype,
    ca.notes as activity_summary
FROM call_activities ca
WHERE ca.started_at IS NOT NULL

UNION ALL

SELECT 
    'meeting' as activity_type,
    m.id as activity_id,
    m.engagement_id,
    m.company_id,
    m.contact_id,
    m.scheduled_datetime as activity_datetime,
    m.status as activity_subtype,
    m.title as activity_summary
FROM meetings m

ORDER BY activity_datetime DESC;