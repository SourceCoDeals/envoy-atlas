-- ============================================
-- UNIFIED BACKEND DATA STORAGE REBUILD
-- ============================================

-- Drop existing unified tables if they exist (fresh start)
DROP TABLE IF EXISTS campaign_variant_metrics CASCADE;
DROP TABLE IF EXISTS unified_campaign_variants CASCADE;
DROP TABLE IF EXISTS campaign_cumulative CASCADE;
DROP TABLE IF EXISTS campaign_metrics CASCADE;
DROP TABLE IF EXISTS workspace_metrics CASCADE;
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS unified_campaigns CASCADE;
DROP TABLE IF EXISTS sync_status CASCADE;

-- ============================================
-- 1. UNIFIED CAMPAIGNS TABLE
-- ============================================
CREATE TABLE unified_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('smartlead', 'replyio')),
  platform_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  engagement_id UUID REFERENCES engagements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, platform, platform_id)
);

CREATE INDEX idx_unified_campaigns_workspace ON unified_campaigns(workspace_id);
CREATE INDEX idx_unified_campaigns_platform ON unified_campaigns(platform);
CREATE INDEX idx_unified_campaigns_status ON unified_campaigns(status);

-- ============================================
-- 2. CAMPAIGN METRICS (Daily Trends - Primary)
-- ============================================
CREATE TABLE campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES unified_campaigns(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  positive_reply_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, metric_date)
);

CREATE INDEX idx_campaign_metrics_workspace ON campaign_metrics(workspace_id);
CREATE INDEX idx_campaign_metrics_date ON campaign_metrics(metric_date);
CREATE INDEX idx_campaign_metrics_campaign_date ON campaign_metrics(campaign_id, metric_date);

-- ============================================
-- 3. CAMPAIGN CUMULATIVE (Lifetime Totals)
-- ============================================
CREATE TABLE campaign_cumulative (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES unified_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_positive_replies INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_unsubscribed INTEGER DEFAULT 0,
  baseline_sent INTEGER DEFAULT 0,
  baseline_opened INTEGER DEFAULT 0,
  baseline_clicked INTEGER DEFAULT 0,
  baseline_replied INTEGER DEFAULT 0,
  baseline_bounced INTEGER DEFAULT 0,
  first_synced_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id)
);

CREATE INDEX idx_campaign_cumulative_workspace ON campaign_cumulative(workspace_id);

-- ============================================
-- 4. CAMPAIGN VARIANTS (Email Templates/Steps)
-- ============================================
CREATE TABLE unified_campaign_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES unified_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_variant_id TEXT,
  step_number INTEGER NOT NULL,
  name TEXT,
  subject_line TEXT,
  email_body TEXT,
  body_preview TEXT,
  delay_days INTEGER DEFAULT 0,
  is_control BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, step_number)
);

CREATE INDEX idx_campaign_variants_campaign ON unified_campaign_variants(campaign_id);

-- ============================================
-- 5. CAMPAIGN VARIANT METRICS
-- ============================================
CREATE TABLE campaign_variant_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES unified_campaign_variants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES unified_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(variant_id, metric_date)
);

CREATE INDEX idx_variant_metrics_campaign ON campaign_variant_metrics(campaign_id);
CREATE INDEX idx_variant_metrics_date ON campaign_variant_metrics(metric_date);

-- ============================================
-- 6. WORKSPACE METRICS (Aggregated Daily)
-- ============================================
CREATE TABLE workspace_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  metric_date DATE NOT NULL,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  positive_reply_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  active_campaigns INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, platform, metric_date)
);

CREATE INDEX idx_workspace_metrics_date ON workspace_metrics(workspace_id, metric_date);

-- ============================================
-- 7. UNIFIED CALLS TABLE
-- ============================================
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('nocodb', 'phoneburner')),
  external_id TEXT,
  
  -- Call metadata
  analyst TEXT,
  called_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  direction TEXT,
  category TEXT,
  
  -- Contact info
  contact_name TEXT,
  contact_company TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  
  -- Content
  transcript TEXT,
  summary TEXT,
  recording_url TEXT,
  salesforce_url TEXT,
  
  -- AI Scores (1-10 scale, normalized)
  composite_score NUMERIC(4,2),
  seller_interest_score NUMERIC(4,2),
  objection_handling_score NUMERIC(4,2),
  quality_score NUMERIC(4,2),
  value_proposition_score NUMERIC(4,2),
  rapport_score NUMERIC(4,2),
  engagement_score NUMERIC(4,2),
  gatekeeper_score NUMERIC(4,2),
  next_step_score NUMERIC(4,2),
  
  -- Tracking
  primary_opportunity TEXT,
  opening_type TEXT,
  key_concerns TEXT[],
  target_pain_points TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, platform, external_id)
);

CREATE INDEX idx_calls_workspace ON calls(workspace_id);
CREATE INDEX idx_calls_analyst ON calls(analyst);
CREATE INDEX idx_calls_called_at ON calls(called_at);
CREATE INDEX idx_calls_category ON calls(category);
CREATE INDEX idx_calls_platform ON calls(platform);

-- ============================================
-- 8. SYNC STATUS TABLE
-- ============================================
CREATE TABLE sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error_message TEXT,
  last_cursor TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sync_status_workspace ON sync_status(workspace_id);
CREATE INDEX idx_sync_status_platform ON sync_status(workspace_id, platform);

-- ============================================
-- 9. RLS POLICIES
-- ============================================

ALTER TABLE unified_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_cumulative ENABLE ROW LEVEL SECURITY;
ALTER TABLE unified_campaign_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_variant_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- Unified Campaigns policies
CREATE POLICY "Users can view campaigns in their workspace"
  ON unified_campaigns FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert campaigns in their workspace"
  ON unified_campaigns FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update campaigns in their workspace"
  ON unified_campaigns FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can delete campaigns in their workspace"
  ON unified_campaigns FOR DELETE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- Campaign Metrics policies
CREATE POLICY "Users can view campaign_metrics in their workspace"
  ON campaign_metrics FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert campaign_metrics in their workspace"
  ON campaign_metrics FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update campaign_metrics in their workspace"
  ON campaign_metrics FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- Campaign Cumulative policies
CREATE POLICY "Users can view campaign_cumulative in their workspace"
  ON campaign_cumulative FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert campaign_cumulative in their workspace"
  ON campaign_cumulative FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update campaign_cumulative in their workspace"
  ON campaign_cumulative FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- Campaign Variants policies
CREATE POLICY "Users can view variants in their workspace"
  ON unified_campaign_variants FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert variants in their workspace"
  ON unified_campaign_variants FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update variants in their workspace"
  ON unified_campaign_variants FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- Variant Metrics policies
CREATE POLICY "Users can view variant_metrics in their workspace"
  ON campaign_variant_metrics FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert variant_metrics in their workspace"
  ON campaign_variant_metrics FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

-- Workspace Metrics policies
CREATE POLICY "Users can view workspace_metrics in their workspace"
  ON workspace_metrics FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert workspace_metrics in their workspace"
  ON workspace_metrics FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update workspace_metrics in their workspace"
  ON workspace_metrics FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- Calls policies
CREATE POLICY "Users can view calls in their workspace"
  ON calls FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert calls in their workspace"
  ON calls FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update calls in their workspace"
  ON calls FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can delete calls in their workspace"
  ON calls FOR DELETE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- Sync Status policies
CREATE POLICY "Users can view sync_status in their workspace"
  ON sync_status FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can insert sync_status in their workspace"
  ON sync_status FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can update sync_status in their workspace"
  ON sync_status FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- ============================================
-- 10. SERVICE ROLE POLICIES (for edge functions)
-- ============================================

CREATE POLICY "Service role has full access to unified_campaigns"
  ON unified_campaigns FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to campaign_metrics"
  ON campaign_metrics FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to campaign_cumulative"
  ON campaign_cumulative FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to unified_campaign_variants"
  ON unified_campaign_variants FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to campaign_variant_metrics"
  ON campaign_variant_metrics FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to workspace_metrics"
  ON workspace_metrics FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to calls"
  ON calls FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to sync_status"
  ON sync_status FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 11. UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER update_unified_campaigns_updated_at
  BEFORE UPDATE ON unified_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_metrics_updated_at
  BEFORE UPDATE ON campaign_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_unified_campaign_variants_updated_at
  BEFORE UPDATE ON unified_campaign_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();