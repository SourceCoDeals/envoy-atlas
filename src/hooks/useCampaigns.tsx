import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { calculateRate } from '@/lib/metrics';

// Metrics status to distinguish "zero" vs "missing/broken source"
export type MetricsStatus = 'verified' | 'partial' | 'missing' | 'broken';
export type MetricsSource = 'cumulative' | 'daily' | 'nocodb' | 'none';

export interface CampaignWithMetrics {
  id: string;
  name: string;
  status: string;
  campaign_type: string;
  platform: string; // 'smartlead' or 'replyio'
  data_source_id: string | null;
  created_at: string;
  updated_at: string | null;
  total_sent: number;
  total_delivered: number;
  total_replied: number;
  total_bounced: number;
  total_leads: number;
  positive_replies: number;
  reply_rate: number;
  bounce_rate: number;
  positive_rate: number;
  delivery_rate: number;
  engagement_id: string | null;
  engagement_name?: string | null;
  metricsStatus: MetricsStatus;
  metricsSource: MetricsSource;
  // NocoDB specific fields
  nocodbId?: string;
  stepsCount?: number;
  leadsActive?: number;
  leadsCompleted?: number;
  optouts?: number;
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

      // Fetch campaigns from internal table AND NocoDB tables in parallel
      const [internalRes, smartleadRes, replyioRes] = await Promise.all([
        engagementIds.length > 0
          ? supabase.from('campaigns').select('*').in('engagement_id', engagementIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('nocodb_smartlead_campaigns')
          .select('*')
          .order('total_emails_sent', { ascending: false }),
        supabase
          .from('nocodb_replyio_campaigns')
          .select('*')
          .order('deliveries', { ascending: false }),
      ]);

      if (internalRes.error) throw internalRes.error;

      const internalCampaigns = internalRes.data || [];
      const smartleadData = smartleadRes.data || [];
      const replyioData = replyioRes.data || [];

      // Build maps for matching NocoDB campaigns to internal campaigns
      const internalByExternalId = new Map<string, any>();
      const internalByName = new Map<string, any>();
      internalCampaigns.forEach(c => {
        if (c.external_id) {
          internalByExternalId.set(c.external_id, c);
        }
        if (c.name) {
          internalByName.set(c.name.toLowerCase().trim(), c);
        }
      });

      // Helper to find matching internal campaign
      const findInternalMatch = (nocodbCampaignId: string | null, campaignName: string) => {
        // First try external_id match
        if (nocodbCampaignId && internalByExternalId.has(nocodbCampaignId)) {
          return internalByExternalId.get(nocodbCampaignId);
        }
        // Then try name match
        const normalizedName = campaignName?.toLowerCase().trim();
        if (normalizedName && internalByName.has(normalizedName)) {
          return internalByName.get(normalizedName);
        }
        return null;
      };

      // Fetch daily metrics for internal campaigns if any
      const campaignIds = internalCampaigns.map(c => c.id);
      let dailyAggregateMap = new Map<string, {
        total_sent: number; total_replied: number; total_bounced: number; positive_replies: number;
      }>();

      if (campaignIds.length > 0) {
        const { data: dailyData } = await supabase
          .from('daily_metrics')
          .select('campaign_id, emails_sent, emails_replied, emails_bounced, positive_replies')
          .in('campaign_id', campaignIds);

        (dailyData || []).forEach(row => {
          const existing = dailyAggregateMap.get(row.campaign_id);
          if (existing) {
            existing.total_sent += row.emails_sent || 0;
            existing.total_replied += row.emails_replied || 0;
            existing.total_bounced += row.emails_bounced || 0;
            existing.positive_replies += row.positive_replies || 0;
          } else {
            dailyAggregateMap.set(row.campaign_id, {
              total_sent: row.emails_sent || 0,
              total_replied: row.emails_replied || 0,
              total_bounced: row.emails_bounced || 0,
              positive_replies: row.positive_replies || 0,
            });
          }
        });
      }

      const allCampaigns: CampaignWithMetrics[] = [];

      // Process SmartLead campaigns from NocoDB
      smartleadData.forEach(row => {
        const sent = row.total_emails_sent || 0;
        const replied = row.total_replies || 0;
        const bounced = 0; // SmartLead doesn't have bounce data in NocoDB yet
        const delivered = sent - bounced;
        const positive = row.leads_interested || 0;

        // Try to find matching internal campaign for engagement link
        const internalMatch = findInternalMatch(row.campaign_id, row.campaign_name);
        const engagementId = internalMatch?.engagement_id || null;
        const engagementName = engagementId ? engagementMap.get(engagementId) || null : null;

        allCampaigns.push({
          id: internalMatch?.id || row.id,
          name: row.campaign_name,
          status: row.status || 'unknown',
          campaign_type: 'smartlead',
          platform: 'smartlead',
          data_source_id: internalMatch?.data_source_id || null,
          created_at: row.campaign_created_date || row.created_at,
          updated_at: row.updated_at,
          total_sent: sent,
          total_delivered: delivered,
          total_replied: replied,
          total_bounced: bounced,
          total_leads: row.total_leads || 0,
          positive_replies: positive,
          reply_rate: calculateRate(replied, delivered > 0 ? delivered : sent),
          bounce_rate: calculateRate(bounced, sent),
          positive_rate: calculateRate(positive, delivered > 0 ? delivered : sent),
          delivery_rate: calculateRate(delivered, sent),
          engagement_id: engagementId,
          engagement_name: engagementName,
          metricsStatus: sent > 0 ? 'verified' : 'missing',
          metricsSource: 'nocodb',
          nocodbId: row.campaign_id,
          stepsCount: row.steps_count || 0,
          leadsActive: row.leads_in_progress || 0,
          leadsCompleted: row.leads_completed || 0,
          optouts: 0,
        });
      });

      // Process Reply.io campaigns from NocoDB
      replyioData.forEach(row => {
        const delivered = row.deliveries || 0;
        const bounced = row.bounces || 0;
        const sent = delivered + bounced;
        const replied = row.replies || 0;
        const positive = 0; // Reply.io doesn't have positive flag

        // Try to find matching internal campaign for engagement link
        const internalMatch = findInternalMatch(row.campaign_id, row.campaign_name);
        const engagementId = internalMatch?.engagement_id || null;
        const engagementName = engagementId ? engagementMap.get(engagementId) || null : null;

        allCampaigns.push({
          id: internalMatch?.id || row.id,
          name: row.campaign_name,
          status: row.status || 'unknown',
          campaign_type: 'replyio',
          platform: 'replyio',
          data_source_id: internalMatch?.data_source_id || null,
          created_at: row.campaign_created_date || row.created_at,
          updated_at: row.updated_at,
          total_sent: sent,
          total_delivered: delivered,
          total_replied: replied,
          total_bounced: bounced,
          total_leads: row.people_count || 0,
          positive_replies: positive,
          reply_rate: calculateRate(replied, delivered),
          bounce_rate: calculateRate(bounced, sent),
          positive_rate: calculateRate(positive, delivered),
          delivery_rate: calculateRate(delivered, sent),
          engagement_id: engagementId,
          engagement_name: engagementName,
          metricsStatus: delivered > 0 ? 'verified' : 'missing',
          metricsSource: 'nocodb',
          nocodbId: row.campaign_id,
          stepsCount: countSteps(row),
          leadsActive: row.people_active || 0,
          leadsCompleted: row.people_finished || 0,
          optouts: row.optouts || 0,
        });
      });

      // Also add internal campaigns that may not be in NocoDB
      internalCampaigns.forEach(campaign => {
        // Check if this campaign is already in the list (by external_id match)
        const alreadyExists = allCampaigns.some(
          c => c.nocodbId === campaign.external_id || 
               c.name.toLowerCase() === campaign.name?.toLowerCase()
        );

        if (!alreadyExists) {
          const dailyAggregate = dailyAggregateMap.get(campaign.id);
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

          const delivered = total_sent - total_bounced;

          allCampaigns.push({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status || 'unknown',
            campaign_type: campaign.campaign_type,
            platform: campaign.campaign_type,
            data_source_id: campaign.data_source_id,
            created_at: campaign.created_at || new Date().toISOString(),
            updated_at: campaign.updated_at,
            total_sent,
            total_delivered: delivered,
            total_replied,
            total_bounced,
            positive_replies,
            total_leads: 0,
            reply_rate: calculateRate(total_replied, delivered),
            bounce_rate: calculateRate(total_bounced, total_sent),
            positive_rate: calculateRate(positive_replies, delivered),
            delivery_rate: calculateRate(delivered, total_sent),
            engagement_id: campaign.engagement_id || null,
            engagement_name: campaign.engagement_id ? engagementMap.get(campaign.engagement_id) || null : null,
            metricsStatus,
            metricsSource,
          });
        }
      });

      // Sort: active statuses first, then by total sent descending
      const activeStatuses = ['active', 'started', 'running'];
      allCampaigns.sort((a, b) => {
        const aIsActive = activeStatuses.includes(a.status.toLowerCase());
        const bIsActive = activeStatuses.includes(b.status.toLowerCase());
        
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        
        return b.total_sent - a.total_sent;
      });

      setCampaigns(allCampaigns);
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

// Helper to count non-empty steps
function countSteps(row: any): number {
  let count = 0;
  for (let i = 1; i <= 9; i++) {
    if (row[`step${i}_subject`] || row[`step${i}_body`]) {
      count++;
    }
  }
  return count;
}
