import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CampaignSnapshot {
  id: string;
  snapshotDate: string;
  platform: 'smartlead' | 'replyio';
  campaignId: string;
  campaignName: string;
  status: string | null;
  
  // Cumulative metrics
  emailsSent: number;
  emailsDelivered: number;
  emailsBounced: number;
  emailsReplied: number;
  positiveReplies: number;
  
  // Lead metrics
  totalLeads: number;
  leadsActive: number;
  leadsCompleted: number;
  leadsPaused: number;
  
  // Reply.io specific
  optouts: number;
  ooos: number;
}

export interface CampaignDelta {
  snapshotDate: string;
  platform: string;
  campaignId: string;
  campaignName: string;
  status: string | null;
  
  // Cumulative values
  emailsSent: number;
  emailsReplied: number;
  emailsBounced: number;
  positiveReplies: number;
  totalLeads: number;
  
  // Daily deltas
  emailsSentDelta: number;
  emailsRepliedDelta: number;
  emailsBouncedDelta: number;
  positiveDelta: number;
  
  prevSnapshotDate: string | null;
  daysSinceLast: number;
}

export interface DailyTotals {
  snapshotDate: string;
  platform: 'smartlead' | 'replyio' | 'all';
  totalCampaigns: number;
  totalSent: number;
  totalReplied: number;
  totalBounced: number;
  totalPositive: number;
  totalLeads: number;
  sentDelta: number;
  repliedDelta: number;
}

export interface TrendFilters {
  startDate?: Date;
  endDate?: Date;
  platform?: 'smartlead' | 'replyio' | 'all';
  campaignId?: string;
}

export function useNocoDBCampaignTrends(filters?: TrendFilters) {
  const [snapshots, setSnapshots] = useState<CampaignSnapshot[]>([]);
  const [deltas, setDeltas] = useState<CampaignDelta[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrendData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query for snapshots
      let snapshotsQuery = supabase
        .from('nocodb_campaign_daily_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false });

      if (filters?.startDate) {
        snapshotsQuery = snapshotsQuery.gte('snapshot_date', filters.startDate.toISOString().split('T')[0]);
      }
      if (filters?.endDate) {
        snapshotsQuery = snapshotsQuery.lte('snapshot_date', filters.endDate.toISOString().split('T')[0]);
      }
      if (filters?.platform && filters.platform !== 'all') {
        snapshotsQuery = snapshotsQuery.eq('platform', filters.platform);
      }
      if (filters?.campaignId) {
        snapshotsQuery = snapshotsQuery.eq('campaign_id', filters.campaignId);
      }

      const { data: snapshotsData, error: snapshotsError } = await snapshotsQuery;

      if (snapshotsError) throw snapshotsError;

      const mappedSnapshots: CampaignSnapshot[] = (snapshotsData || []).map(row => ({
        id: row.id,
        snapshotDate: row.snapshot_date,
        platform: row.platform as 'smartlead' | 'replyio',
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        status: row.status,
        emailsSent: row.emails_sent || 0,
        emailsDelivered: row.emails_delivered || 0,
        emailsBounced: row.emails_bounced || 0,
        emailsReplied: row.emails_replied || 0,
        positiveReplies: row.positive_replies || 0,
        totalLeads: row.total_leads || 0,
        leadsActive: row.leads_active || 0,
        leadsCompleted: row.leads_completed || 0,
        leadsPaused: row.leads_paused || 0,
        optouts: row.optouts || 0,
        ooos: row.ooos || 0,
      }));

      setSnapshots(mappedSnapshots);

      // Fetch deltas view
      let deltasQuery = supabase
        .from('nocodb_campaign_daily_deltas')
        .select('*')
        .order('snapshot_date', { ascending: false });

      if (filters?.startDate) {
        deltasQuery = deltasQuery.gte('snapshot_date', filters.startDate.toISOString().split('T')[0]);
      }
      if (filters?.endDate) {
        deltasQuery = deltasQuery.lte('snapshot_date', filters.endDate.toISOString().split('T')[0]);
      }
      if (filters?.platform && filters.platform !== 'all') {
        deltasQuery = deltasQuery.eq('platform', filters.platform);
      }
      if (filters?.campaignId) {
        deltasQuery = deltasQuery.eq('campaign_id', filters.campaignId);
      }

      const { data: deltasData, error: deltasError } = await deltasQuery;

      if (deltasError) {
        console.warn('Deltas view query failed, computing client-side:', deltasError);
        // Fallback: compute deltas client-side if view fails
        setDeltas([]);
      } else {
        const mappedDeltas: CampaignDelta[] = (deltasData || []).map(row => ({
          snapshotDate: row.snapshot_date,
          platform: row.platform,
          campaignId: row.campaign_id,
          campaignName: row.campaign_name,
          status: row.status,
          emailsSent: row.emails_sent || 0,
          emailsReplied: row.emails_replied || 0,
          emailsBounced: row.emails_bounced || 0,
          positiveReplies: row.positive_replies || 0,
          totalLeads: row.total_leads || 0,
          emailsSentDelta: row.emails_sent_delta || 0,
          emailsRepliedDelta: row.emails_replied_delta || 0,
          emailsBouncedDelta: row.emails_bounced_delta || 0,
          positiveDelta: row.positive_delta || 0,
          prevSnapshotDate: row.prev_snapshot_date,
          daysSinceLast: row.days_since_last || 0,
        }));
        setDeltas(mappedDeltas);
      }

      // Fetch daily totals view
      let totalsQuery = supabase
        .from('nocodb_daily_totals')
        .select('*')
        .order('snapshot_date', { ascending: false });

      if (filters?.startDate) {
        totalsQuery = totalsQuery.gte('snapshot_date', filters.startDate.toISOString().split('T')[0]);
      }
      if (filters?.endDate) {
        totalsQuery = totalsQuery.lte('snapshot_date', filters.endDate.toISOString().split('T')[0]);
      }
      if (filters?.platform && filters.platform !== 'all') {
        totalsQuery = totalsQuery.eq('platform', filters.platform);
      }

      const { data: totalsData, error: totalsError } = await totalsQuery;

      if (totalsError) {
        console.warn('Daily totals view query failed:', totalsError);
        setDailyTotals([]);
      } else {
        const mappedTotals: DailyTotals[] = (totalsData || []).map(row => ({
          snapshotDate: row.snapshot_date,
          platform: row.platform as 'smartlead' | 'replyio' | 'all',
          totalCampaigns: row.total_campaigns || 0,
          totalSent: row.total_sent || 0,
          totalReplied: row.total_replied || 0,
          totalBounced: row.total_bounced || 0,
          totalPositive: row.total_positive || 0,
          totalLeads: row.total_leads || 0,
          sentDelta: row.sent_delta || 0,
          repliedDelta: row.replied_delta || 0,
        }));
        setDailyTotals(mappedTotals);
      }

    } catch (err) {
      console.error('Error fetching NocoDB campaign trends:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trend data');
    } finally {
      setLoading(false);
    }
  }, [filters?.startDate, filters?.endDate, filters?.platform, filters?.campaignId]);

  useEffect(() => {
    fetchTrendData();
  }, [fetchTrendData]);

  // Aggregate helpers
  const getSnapshotsForCampaign = useCallback((campaignId: string) => {
    return snapshots.filter(s => s.campaignId === campaignId);
  }, [snapshots]);

  const getLatestTotals = useCallback((platform: 'smartlead' | 'replyio' | 'all' = 'all') => {
    return dailyTotals.find(t => t.platform === platform);
  }, [dailyTotals]);

  const getTotalsByDate = useCallback((date: string) => {
    return dailyTotals.filter(t => t.snapshotDate === date);
  }, [dailyTotals]);

  return {
    snapshots,
    deltas,
    dailyTotals,
    loading,
    error,
    refetch: fetchTrendData,
    getSnapshotsForCampaign,
    getLatestTotals,
    getTotalsByDate,
  };
}
