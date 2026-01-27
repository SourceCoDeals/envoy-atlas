import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns';

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

export interface WeeklyAggregation {
  weekStart: string;
  weekLabel: string;
  emailsSent: number;
  emailsReplied: number;
  positiveReplies: number;
  emailsBounced: number;
  campaignCount: number;
}

export interface TrendFilters {
  startDate?: Date;
  endDate?: Date;
  platform?: 'smartlead' | 'replyio' | 'all';
  campaignId?: string;
  engagementId?: string; // NEW: Filter via campaign join
}

export function useNocoDBCampaignTrends(filters?: TrendFilters) {
  const [snapshots, setSnapshots] = useState<CampaignSnapshot[]>([]);
  const [deltas, setDeltas] = useState<CampaignDelta[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch campaign IDs for engagement filtering
  const fetchCampaignIdsForEngagement = useCallback(async (engagementId: string): Promise<string[]> => {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('external_id')
      .eq('engagement_id', engagementId)
      .not('external_id', 'is', null);
    
    return (campaigns || []).map(c => c.external_id).filter(Boolean) as string[];
  }, []);

  const fetchTrendData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // If filtering by engagement, first get the campaign IDs
      let engagementCampaignIds: string[] | null = null;
      if (filters?.engagementId) {
        engagementCampaignIds = await fetchCampaignIdsForEngagement(filters.engagementId);
        if (engagementCampaignIds.length === 0) {
          // No campaigns linked to this engagement
          setSnapshots([]);
          setDeltas([]);
          setDailyTotals([]);
          setLoading(false);
          return;
        }
      }

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
      if (engagementCampaignIds) {
        snapshotsQuery = snapshotsQuery.in('campaign_id', engagementCampaignIds);
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
      if (engagementCampaignIds) {
        deltasQuery = deltasQuery.in('campaign_id', engagementCampaignIds);
      }

      const { data: deltasData, error: deltasError } = await deltasQuery;

      if (deltasError) {
        console.warn('Deltas view query failed, computing client-side:', deltasError);
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

      // Fetch daily totals view (only if not filtering by specific campaign or engagement)
      // For engagement-specific totals, we aggregate from snapshots instead
      if (!engagementCampaignIds && !filters?.campaignId) {
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
      } else {
        // Compute engagement-specific totals from snapshots
        const totalsMap = new Map<string, DailyTotals>();
        mappedSnapshots.forEach(s => {
          const key = s.snapshotDate;
          const existing = totalsMap.get(key);
          if (existing) {
            existing.totalCampaigns += 1;
            existing.totalSent += s.emailsSent;
            existing.totalReplied += s.emailsReplied;
            existing.totalBounced += s.emailsBounced;
            existing.totalPositive += s.positiveReplies;
            existing.totalLeads += s.totalLeads;
          } else {
            totalsMap.set(key, {
              snapshotDate: s.snapshotDate,
              platform: 'all',
              totalCampaigns: 1,
              totalSent: s.emailsSent,
              totalReplied: s.emailsReplied,
              totalBounced: s.emailsBounced,
              totalPositive: s.positiveReplies,
              totalLeads: s.totalLeads,
              sentDelta: 0, // Would need previous day to calculate
              repliedDelta: 0,
            });
          }
        });
        setDailyTotals(Array.from(totalsMap.values()).sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate)));
      }

    } catch (err) {
      console.error('Error fetching NocoDB campaign trends:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trend data');
    } finally {
      setLoading(false);
    }
  }, [filters?.startDate, filters?.endDate, filters?.platform, filters?.campaignId, filters?.engagementId, fetchCampaignIdsForEngagement]);

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

  // NEW: Aggregate deltas by week for chart compatibility
  const aggregateByWeek = useCallback((deltasToAggregate?: CampaignDelta[]): WeeklyAggregation[] => {
    const dataToUse = deltasToAggregate || deltas;
    const weekMap = new Map<string, WeeklyAggregation>();

    dataToUse.forEach(d => {
      const date = parseISO(d.snapshotDate);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      const weekLabel = `Week of ${format(weekStart, 'MMM d')}`;

      const existing = weekMap.get(weekKey) || {
        weekStart: weekKey,
        weekLabel,
        emailsSent: 0,
        emailsReplied: 0,
        positiveReplies: 0,
        emailsBounced: 0,
        campaignCount: 0,
      };

      // Use delta values for true weekly activity
      existing.emailsSent += d.emailsSentDelta;
      existing.emailsReplied += d.emailsRepliedDelta;
      existing.positiveReplies += d.positiveDelta;
      existing.emailsBounced += d.emailsBouncedDelta;
      existing.campaignCount = Math.max(existing.campaignCount, 1);

      weekMap.set(weekKey, existing);
    });

    return Array.from(weekMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [deltas]);

  // NEW: Aggregate daily totals by week
  const aggregateTotalsByWeek = useCallback((totalsToAggregate?: DailyTotals[]): WeeklyAggregation[] => {
    const dataToUse = totalsToAggregate || dailyTotals;
    const weekMap = new Map<string, WeeklyAggregation>();

    dataToUse.forEach(t => {
      const date = parseISO(t.snapshotDate);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      const weekLabel = `Week of ${format(weekStart, 'MMM d')}`;

      const existing = weekMap.get(weekKey) || {
        weekStart: weekKey,
        weekLabel,
        emailsSent: 0,
        emailsReplied: 0,
        positiveReplies: 0,
        emailsBounced: 0,
        campaignCount: 0,
      };

      // Use delta values for true weekly activity
      existing.emailsSent += t.sentDelta;
      existing.emailsReplied += t.repliedDelta;
      existing.positiveReplies += t.totalPositive; // totals don't have positive delta yet
      existing.emailsBounced += t.totalBounced;
      existing.campaignCount = Math.max(existing.campaignCount, t.totalCampaigns);

      weekMap.set(weekKey, existing);
    });

    return Array.from(weekMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [dailyTotals]);

  // NEW: Convert snapshots to WeeklyPerformance format for engagement reports
  const convertToWeeklyPerformance = useCallback((snapshotsToConvert?: CampaignSnapshot[]) => {
    const dataToUse = snapshotsToConvert || snapshots;
    const weekMap = new Map<string, {
      weekStart: string;
      weekLabel: string;
      sent: number;
      replied: number;
      positiveReplies: number;
      bounced: number;
    }>();

    // Group by campaign and week to calculate deltas
    const campaignWeekMap = new Map<string, Map<string, CampaignSnapshot>>();
    
    dataToUse.forEach(s => {
      const date = parseISO(s.snapshotDate);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      
      if (!campaignWeekMap.has(s.campaignId)) {
        campaignWeekMap.set(s.campaignId, new Map());
      }
      const campaignMap = campaignWeekMap.get(s.campaignId)!;
      
      // Keep the latest snapshot for each week per campaign
      const existing = campaignMap.get(weekKey);
      if (!existing || s.snapshotDate > existing.snapshotDate) {
        campaignMap.set(weekKey, s);
      }
    });

    // Aggregate across campaigns for each week
    campaignWeekMap.forEach(campaignMap => {
      campaignMap.forEach((snapshot, weekKey) => {
        const weekLabel = `Week of ${format(parseISO(weekKey), 'MMM d')}`;
        
        const existing = weekMap.get(weekKey) || {
          weekStart: weekKey,
          weekLabel,
          sent: 0,
          replied: 0,
          positiveReplies: 0,
          bounced: 0,
        };

        existing.sent += snapshot.emailsSent;
        existing.replied += snapshot.emailsReplied;
        existing.positiveReplies += snapshot.positiveReplies;
        existing.bounced += snapshot.emailsBounced;

        weekMap.set(weekKey, existing);
      });
    });

    return Array.from(weekMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }, [snapshots]);

  // NEW: Get the most recent snapshot date
  const latestSnapshotDate = useMemo(() => {
    if (snapshots.length === 0) return null;
    return snapshots.reduce((latest, s) => 
      s.snapshotDate > latest ? s.snapshotDate : latest, 
      snapshots[0].snapshotDate
    );
  }, [snapshots]);

  // NEW: Check if we have sufficient historical data
  const hasMultipleDays = useMemo(() => {
    const uniqueDates = new Set(snapshots.map(s => s.snapshotDate));
    return uniqueDates.size > 1;
  }, [snapshots]);

  // NEW: Summary statistics
  const summary = useMemo(() => {
    const latestDate = latestSnapshotDate;
    if (!latestDate) return null;

    const latestSnapshots = snapshots.filter(s => s.snapshotDate === latestDate);
    
    return {
      date: latestDate,
      totalCampaigns: latestSnapshots.length,
      totalSent: latestSnapshots.reduce((sum, s) => sum + s.emailsSent, 0),
      totalReplied: latestSnapshots.reduce((sum, s) => sum + s.emailsReplied, 0),
      totalPositive: latestSnapshots.reduce((sum, s) => sum + s.positiveReplies, 0),
      totalLeads: latestSnapshots.reduce((sum, s) => sum + s.totalLeads, 0),
      byPlatform: {
        smartlead: latestSnapshots.filter(s => s.platform === 'smartlead').length,
        replyio: latestSnapshots.filter(s => s.platform === 'replyio').length,
      },
    };
  }, [snapshots, latestSnapshotDate]);

  return {
    snapshots,
    deltas,
    dailyTotals,
    loading,
    error,
    refetch: fetchTrendData,
    // Existing helpers
    getSnapshotsForCampaign,
    getLatestTotals,
    getTotalsByDate,
    // NEW helpers
    aggregateByWeek,
    aggregateTotalsByWeek,
    convertToWeeklyPerformance,
    // NEW metadata
    latestSnapshotDate,
    hasMultipleDays,
    summary,
  };
}
