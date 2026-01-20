import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { calculateRate } from '@/lib/metrics';

// Metrics status to distinguish "zero" vs "missing/broken source"
export type MetricsStatus = 'verified' | 'partial' | 'missing' | 'broken';
export type MetricsSource = 'cumulative' | 'daily' | 'none';

export interface CampaignWithMetrics {
  id: string;
  name: string;
  status: string;
  campaign_type: string;
  platform: string; // Alias for campaign_type for backward compatibility
  data_source_id: string | null;
  created_at: string;
  updated_at: string | null;
  total_sent: number;
  total_replied: number;
  total_bounced: number;
  total_leads: number;
  positive_replies: number;
  reply_rate: number;
  bounce_rate: number;
  positive_rate: number;
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
      // Get engagement IDs for this client
      const { data: engagements, error: engError } = await supabase
        .from('engagements')
        .select('id, name')
        .eq('client_id', currentWorkspace.id);

      if (engError) throw engError;

      const engagementIds = (engagements || []).map(e => e.id);
      const engagementMap = new Map<string, string>();
      (engagements || []).forEach(e => {
        engagementMap.set(e.id, e.name);
      });

      if (engagementIds.length === 0) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      // Fetch campaigns for these engagements
      const { data: campaignsData, error: campError } = await supabase
        .from('campaigns')
        .select('*')
        .in('engagement_id', engagementIds);

      if (campError) throw campError;

      const allCampaigns = campaignsData || [];

      if (allCampaigns.length === 0) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      const campaignIds = allCampaigns.map(c => c.id);

      // Fetch daily metrics aggregated per campaign - including positive_replies
      const { data: dailyData } = await supabase
        .from('daily_metrics')
        .select('campaign_id, emails_sent, emails_opened, emails_clicked, emails_replied, emails_bounced, positive_replies')
        .in('campaign_id', campaignIds);

      // Build daily aggregation map
      const dailyAggregateMap = new Map<string, {
        total_sent: number;
        total_opened: number;
        total_clicked: number;
        total_replied: number;
        total_bounced: number;
        positive_replies: number;
      }>();

      (dailyData || []).forEach(row => {
        const existing = dailyAggregateMap.get(row.campaign_id);
        if (existing) {
          existing.total_sent += row.emails_sent || 0;
          existing.total_opened += row.emails_opened || 0;
          existing.total_clicked += row.emails_clicked || 0;
          existing.total_replied += row.emails_replied || 0;
          existing.total_bounced += row.emails_bounced || 0;
          existing.positive_replies += row.positive_replies || 0;
        } else {
          dailyAggregateMap.set(row.campaign_id, {
            total_sent: row.emails_sent || 0,
            total_opened: row.emails_opened || 0,
            total_clicked: row.emails_clicked || 0,
            total_replied: row.emails_replied || 0,
            total_bounced: row.emails_bounced || 0,
            positive_replies: row.positive_replies || 0,
          });
        }
      });

      // Build campaigns with metrics
      const campaignsWithMetrics: CampaignWithMetrics[] = allCampaigns.map(campaign => {
        const dailyAggregate = dailyAggregateMap.get(campaign.id);
        
        // Use campaign cumulative fields first, then fall back to daily aggregate
        const hasCumulativeData = (campaign.total_sent || 0) > 0;
        const hasDailyData = dailyAggregate && dailyAggregate.total_sent > 0;

        let total_sent = 0;
        let total_replied = 0;
        let total_bounced = 0;
        let positive_replies = 0;
        let metricsStatus: MetricsStatus;
        let metricsSource: MetricsSource;

        if (hasCumulativeData) {
          total_sent = campaign.total_sent || 0;
          total_replied = campaign.total_replied || 0;
          total_bounced = campaign.total_bounced || 0;
          positive_replies = (campaign as any).positive_replies || 0;
          metricsStatus = 'verified';
          metricsSource = 'cumulative';
        } else if (hasDailyData) {
          total_sent = dailyAggregate!.total_sent;
          total_replied = dailyAggregate!.total_replied;
          total_bounced = dailyAggregate!.total_bounced;
          positive_replies = dailyAggregate!.positive_replies;
          metricsStatus = 'partial';
          metricsSource = 'daily';
        } else {
          metricsStatus = 'missing';
          metricsSource = 'none';
        }

        // Use delivered as denominator for engagement rates
        const delivered = total_sent - total_bounced;
        const reply_rate = calculateRate(total_replied, delivered);
        const bounce_rate = calculateRate(total_bounced, total_sent); // Bounce rate uses sent
        const positive_rate = calculateRate(positive_replies, delivered);

        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status || 'unknown',
          campaign_type: campaign.campaign_type,
          platform: campaign.campaign_type, // Backward compatibility alias
          data_source_id: campaign.data_source_id,
          created_at: campaign.created_at || new Date().toISOString(),
          updated_at: campaign.updated_at,
          total_sent,
          total_replied,
          total_bounced,
          positive_replies,
          total_leads: 0,
          reply_rate,
          bounce_rate,
          positive_rate,
          engagement_id: campaign.engagement_id || null,
          engagement_name: campaign.engagement_id ? engagementMap.get(campaign.engagement_id) || null : null,
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
