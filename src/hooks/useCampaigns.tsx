import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface CampaignWithMetrics {
  id: string;
  name: string;
  status: string;
  platform: string;
  platform_campaign_id: string | null;
  created_at: string;
  updated_at: string;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_replied: number;
  total_bounced: number;
  total_leads: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  bounce_rate: number;
}

interface BaseCampaign {
  id: string;
  name: string;
  status: string | null;
  platform_id: string;
  created_at: string;
  updated_at: string;
  workspace_id: string;
}

interface BaseMetric {
  campaign_id: string;
  sent_count: number | null;
  opened_count: number | null;
  clicked_count: number | null;
  replied_count: number | null;
  bounced_count: number | null;
}

export function useCampaigns() {
  const { currentWorkspace } = useWorkspace();
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace?.id) {
      setLoading(false);
      return;
    }

    fetchCampaigns();
  }, [currentWorkspace?.id]);

  const fetchCampaigns = async () => {
    if (!currentWorkspace?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch SmartLead campaigns
      const { data: smartleadCampaigns, error: smartleadError } = await supabase
        .from('smartlead_campaigns')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (smartleadError) throw smartleadError;

      // Fetch Reply.io campaigns
      const { data: replyioCampaigns, error: replyioError } = await supabase
        .from('replyio_campaigns')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (replyioError) throw replyioError;

      // Combine campaigns from both platforms
      const allCampaigns: BaseCampaign[] = [
        ...(smartleadCampaigns || []).map(c => ({ ...c, platform: 'smartlead' })),
        ...(replyioCampaigns || []).map(c => ({ ...c, platform: 'replyio' }))
      ];

      if (allCampaigns.length === 0) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      // Get campaign IDs by platform
      const smartleadIds = (smartleadCampaigns || []).map(c => c.id);
      const replyioIds = (replyioCampaigns || []).map(c => c.id);

      // Fetch daily metrics from both tables
      const [smartleadMetricsResult, replyioMetricsResult] = await Promise.all([
        smartleadIds.length > 0 
          ? supabase.from('smartlead_daily_metrics').select('*').in('campaign_id', smartleadIds)
          : Promise.resolve({ data: [], error: null }),
        replyioIds.length > 0
          ? supabase.from('replyio_daily_metrics').select('*').in('campaign_id', replyioIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (smartleadMetricsResult.error) throw smartleadMetricsResult.error;
      if (replyioMetricsResult.error) throw replyioMetricsResult.error;

      const allMetrics: BaseMetric[] = [
        ...(smartleadMetricsResult.data || []),
        ...(replyioMetricsResult.data || [])
      ];

      // Aggregate metrics per campaign
      const campaignsWithMetrics: CampaignWithMetrics[] = allCampaigns.map(campaign => {
        const campaignMetrics = allMetrics.filter(m => m.campaign_id === campaign.id);
        
        const total_sent = campaignMetrics.reduce((sum, m) => sum + (m.sent_count || 0), 0);
        const total_opened = campaignMetrics.reduce((sum, m) => sum + (m.opened_count || 0), 0);
        const total_clicked = campaignMetrics.reduce((sum, m) => sum + (m.clicked_count || 0), 0);
        const total_replied = campaignMetrics.reduce((sum, m) => sum + (m.replied_count || 0), 0);
        const total_bounced = campaignMetrics.reduce((sum, m) => sum + (m.bounced_count || 0), 0);
        const total_leads = 0; // Will be populated from leads table if needed

        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status || 'unknown',
          platform: (campaign as any).platform || 'smartlead',
          platform_campaign_id: campaign.platform_id,
          created_at: campaign.created_at,
          updated_at: campaign.updated_at,
          total_sent,
          total_opened,
          total_clicked,
          total_replied,
          total_bounced,
          total_leads,
          open_rate: total_sent > 0 ? (total_opened / total_sent) * 100 : 0,
          click_rate: total_sent > 0 ? (total_clicked / total_sent) * 100 : 0,
          reply_rate: total_sent > 0 ? (total_replied / total_sent) * 100 : 0,
          bounce_rate: total_sent > 0 ? (total_bounced / total_sent) * 100 : 0,
        };
      });

      // Sort: active statuses first, then by total sent descending
      const activeStatuses = ['active', 'started', 'running'];
      campaignsWithMetrics.sort((a, b) => {
        const aIsActive = activeStatuses.includes(a.status.toLowerCase());
        const bIsActive = activeStatuses.includes(b.status.toLowerCase());
        
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        
        return b.total_sent - a.total_sent;
      });

      setCampaigns(campaignsWithMetrics);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  return { campaigns, loading, error, refetch: fetchCampaigns };
}
