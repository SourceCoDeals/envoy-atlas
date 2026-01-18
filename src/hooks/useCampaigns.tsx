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
  engagement_id: string | null;
  engagement_name?: string | null;
}

interface BaseCampaign {
  id: string;
  name: string;
  status: string | null;
  platform_id: string;
  created_at: string;
  updated_at: string;
  workspace_id: string;
  engagement_id: string | null;
}

interface CumulativeMetric {
  campaign_id: string;
  total_sent: number | null;
  total_opened: number | null;
  total_clicked: number | null;
  total_replied: number | null;
  total_bounced: number | null;
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
      // Fetch campaigns from both platforms and engagements in parallel
      const [smartleadResult, replyioResult, engagementsResult] = await Promise.all([
        supabase
          .from('smartlead_campaigns')
          .select('*')
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('replyio_campaigns')
          .select('*')
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('engagements')
          .select('id, engagement_name')
          .eq('workspace_id', currentWorkspace.id)
      ]);

      if (smartleadResult.error) throw smartleadResult.error;
      if (replyioResult.error) throw replyioResult.error;

      // Build engagement lookup map
      const engagementMap = new Map<string, string>();
      (engagementsResult.data || []).forEach(e => {
        engagementMap.set(e.id, e.engagement_name);
      });

      // Tag campaigns with their platform
      const allCampaigns: (BaseCampaign & { platform: string })[] = [
        ...(smartleadResult.data || []).map(c => ({ ...c, platform: 'smartlead' })),
        ...(replyioResult.data || []).map(c => ({ ...c, platform: 'replyio' }))
      ];

      if (allCampaigns.length === 0) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      // Fetch daily metrics AND cumulative metrics (fallback) using workspace_id
      // Fetch cumulative metrics (campaign-level totals). We avoid scanning daily metric tables here
      // because list views can exceed row limits and produce incomplete totals.
      const [smartleadCumulativeResult, replyioCumulativeResult] = await Promise.all([
        supabase
          .from('smartlead_campaign_cumulative')
          .select('*')
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('replyio_campaign_cumulative')
          .select('*')
          .eq('workspace_id', currentWorkspace.id),
      ]);

      // Build cumulative lookup map
      const cumulativeMap = new Map<string, CumulativeMetric>();
      (smartleadCumulativeResult.data || []).forEach(c => cumulativeMap.set(c.campaign_id, c));
      (replyioCumulativeResult.data || []).forEach(c => cumulativeMap.set(c.campaign_id, c));

      // Build campaigns with metrics (cumulative only)
      const campaignsWithMetrics: CampaignWithMetrics[] = allCampaigns.map(campaign => {
        const cumulative = cumulativeMap.get(campaign.id);

        const total_sent = cumulative?.total_sent || 0;
        const total_opened = cumulative?.total_opened || 0;
        const total_clicked = cumulative?.total_clicked || 0;
        const total_replied = cumulative?.total_replied || 0;
        const total_bounced = cumulative?.total_bounced || 0;
        const total_leads = 0;

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
          total_leads,
          open_rate: total_sent > 0 ? (total_opened / total_sent) * 100 : 0,
          click_rate: total_sent > 0 ? (total_clicked / total_sent) * 100 : 0,
          reply_rate: total_sent > 0 ? (total_replied / total_sent) * 100 : 0,
          bounce_rate: total_sent > 0 ? (total_bounced / total_sent) * 100 : 0,
          engagement_id: campaign.engagement_id,
          engagement_name: campaign.engagement_id ? engagementMap.get(campaign.engagement_id) || null : null,
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
    } catch (err: unknown) {
      console.error('Error fetching campaigns:', err);
      // Better error extraction for PostgREST errors
      let errorMessage = 'Failed to fetch campaigns';
      if (err && typeof err === 'object') {
        const e = err as { message?: string; details?: string; hint?: string; code?: string };
        if (e.message) errorMessage = e.message;
        if (e.details) errorMessage += ` - ${e.details}`;
        if (e.hint) errorMessage += ` (${e.hint})`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return { campaigns, loading, error, refetch: fetchCampaigns };
}
