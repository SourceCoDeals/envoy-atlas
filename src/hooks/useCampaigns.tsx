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
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  bounce_rate: number;
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
      // Fetch campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (campaignsError) throw campaignsError;

      if (!campaignsData || campaignsData.length === 0) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      // Fetch daily metrics for all campaigns
      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metrics')
        .select('*')
        .in('campaign_id', campaignsData.map(c => c.id));

      if (metricsError) throw metricsError;

      // Aggregate metrics per campaign
      const campaignsWithMetrics: CampaignWithMetrics[] = campaignsData.map(campaign => {
        const campaignMetrics = (metricsData || []).filter(m => m.campaign_id === campaign.id);
        
        const total_sent = campaignMetrics.reduce((sum, m) => sum + (m.sent_count || 0), 0);
        const total_opened = campaignMetrics.reduce((sum, m) => sum + (m.opened_count || 0), 0);
        const total_clicked = campaignMetrics.reduce((sum, m) => sum + (m.clicked_count || 0), 0);
        const total_replied = campaignMetrics.reduce((sum, m) => sum + (m.replied_count || 0), 0);
        const total_bounced = campaignMetrics.reduce((sum, m) => sum + (m.bounced_count || 0), 0);

        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status || 'unknown',
          platform: campaign.platform,
          platform_campaign_id: campaign.platform_id,
          created_at: campaign.created_at,
          updated_at: campaign.updated_at,
          total_sent,
          total_opened,
          total_clicked,
          total_replied,
          total_bounced,
          open_rate: total_sent > 0 ? (total_opened / total_sent) * 100 : 0,
          click_rate: total_sent > 0 ? (total_clicked / total_sent) * 100 : 0,
          reply_rate: total_sent > 0 ? (total_replied / total_sent) * 100 : 0,
          bounce_rate: total_sent > 0 ? (total_bounced / total_sent) * 100 : 0,
        };
      });

      // Sort by total sent descending
      campaignsWithMetrics.sort((a, b) => b.total_sent - a.total_sent);

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
