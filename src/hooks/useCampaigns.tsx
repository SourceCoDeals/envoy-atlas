import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

// Metrics status to distinguish "zero" vs "missing/broken source"
export type MetricsStatus = 'verified' | 'partial' | 'missing' | 'broken';
export type MetricsSource = 'cumulative' | 'daily' | 'none';

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
  metricsStatus: MetricsStatus;
  metricsSource: MetricsSource;
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
      // Fetch campaigns with cumulative metrics and engagements in parallel
      const [campaignsResult, cumulativeResult, engagementsResult] = await Promise.all([
        supabase
          .from('campaigns')
          .select('*')
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('campaign_cumulative')
          .select('*')
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('engagements')
          .select('id, engagement_name')
          .eq('workspace_id', currentWorkspace.id)
      ]);

      if (campaignsResult.error) throw campaignsResult.error;

      // Build engagement lookup map
      const engagementMap = new Map<string, string>();
      (engagementsResult.data || []).forEach(e => {
        engagementMap.set(e.id, e.engagement_name);
      });

      // Build cumulative lookup map
      const cumulativeMap = new Map<string, {
        total_sent: number | null;
        total_opened: number | null;
        total_clicked: number | null;
        total_replied: number | null;
        total_bounced: number | null;
      }>();
      (cumulativeResult.data || []).forEach(c => {
        cumulativeMap.set(c.campaign_id, c);
      });

      const allCampaigns = campaignsResult.data || [];

      if (allCampaigns.length === 0) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      // Fetch daily metrics aggregated per campaign (as fallback if cumulative is empty)
      const dailyResult = await supabase
        .from('campaign_metrics')
        .select('campaign_id, sent_count, opened_count, clicked_count, replied_count, bounced_count')
        .eq('workspace_id', currentWorkspace.id);

      // Build daily aggregation map
      const dailyAggregateMap = new Map<string, {
        total_sent: number;
        total_opened: number;
        total_clicked: number;
        total_replied: number;
        total_bounced: number;
      }>();

      (dailyResult.data || []).forEach(row => {
        const existing = dailyAggregateMap.get(row.campaign_id);
        if (existing) {
          existing.total_sent += row.sent_count || 0;
          existing.total_opened += row.opened_count || 0;
          existing.total_clicked += row.clicked_count || 0;
          existing.total_replied += row.replied_count || 0;
          existing.total_bounced += row.bounced_count || 0;
        } else {
          dailyAggregateMap.set(row.campaign_id, {
            total_sent: row.sent_count || 0,
            total_opened: row.opened_count || 0,
            total_clicked: row.clicked_count || 0,
            total_replied: row.replied_count || 0,
            total_bounced: row.bounced_count || 0,
          });
        }
      });

      // Build campaigns with metrics
      const campaignsWithMetrics: CampaignWithMetrics[] = allCampaigns.map(campaign => {
        const cumulative = cumulativeMap.get(campaign.id);
        const dailyAggregate = dailyAggregateMap.get(campaign.id);

        // Use cumulative if it has data, otherwise fall back to daily aggregate
        const hasCumulativeData = cumulative && (cumulative.total_sent || 0) > 0;
        const hasDailyData = dailyAggregate && dailyAggregate.total_sent > 0;
        const source = hasCumulativeData ? cumulative : dailyAggregate;

        const total_sent = source?.total_sent || 0;
        const total_opened = source?.total_opened || 0;
        const total_clicked = source?.total_clicked || 0;
        const total_replied = source?.total_replied || 0;
        const total_bounced = source?.total_bounced || 0;
        const total_leads = 0;

        // Determine metrics status
        let metricsStatus: MetricsStatus;
        let metricsSource: MetricsSource;

        if (hasCumulativeData) {
          metricsStatus = 'verified';
          metricsSource = 'cumulative';
        } else if (hasDailyData) {
          metricsStatus = 'partial';
          metricsSource = 'daily';
        } else {
          metricsStatus = 'missing';
          metricsSource = 'none';
        }

        // Cast to include engagement_id from the schema
        const c = campaign as typeof campaign & { engagement_id?: string | null };
        
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
          engagement_id: c.engagement_id || null,
          engagement_name: c.engagement_id ? engagementMap.get(c.engagement_id) || null : null,
          metricsStatus,
          metricsSource,
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
