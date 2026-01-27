import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { calculateRate } from '@/lib/metrics';
import { startOfWeek, endOfWeek, subWeeks, subDays, format, parseISO, isWithinInterval } from 'date-fns';

// ===== Types =====
export interface HeroMetric {
  label: string;
  value: number;
  format: 'number' | 'percent';
  change: number; // WoW change percentage
  trend: 'up' | 'down' | 'neutral';
}

export interface WeeklyData {
  weekEnding: string;
  weekLabel: string;
  emailsSent: number;
  replies: number;
  positiveReplies: number;
  meetingsBooked: number;
  replyRate: number;
  positiveRate: number;
}

export interface AlertCampaign {
  id: string;
  name: string;
  sent7d: number;
  replyRate: number;
  issue: 'low_reply' | 'declining' | 'no_replies' | 'low_positive';
  issueLabel: string;
  severity: 'critical' | 'warning';
}

export interface TopCampaign {
  id: string;
  name: string;
  sent: number;
  replyRate: number;
  positiveRate: number;
  meetingsBooked: number;
}

export interface TodaysPulse {
  emailsSending: number;
  replies: number;
  positive: number;
  meetingsBooked: number;
  activeCampaigns?: number; // NEW: from snapshots
}

export interface DataCompleteness {
  dailyTotal: number;
  campaignTotal: number;
}

export type DataSourceType = 'snapshots' | 'nocodb_aggregate' | 'activity_level' | 'daily_metrics' | 'mixed';

export interface SnapshotSummary {
  totalCampaigns: number;
  totalSent: number;
  totalReplied: number;
  totalPositive: number;
  snapshotDate: string | null;
}

export interface OverviewDashboardData {
  loading: boolean;
  hasData: boolean;
  todaysPulse: TodaysPulse;
  heroMetrics: HeroMetric[];
  weeklyData: WeeklyData[];
  alertCampaigns: AlertCampaign[];
  topCampaigns: TopCampaign[];
  dataCompleteness: DataCompleteness;
  dataSource: DataSourceType;
  snapshotSummary: SnapshotSummary | null; // NEW: snapshot metadata
  refetch: () => void;
}

// ===== Constants =====
const ALERT_THRESHOLDS = {
  lowReplyRate: 1.5,
  weekOverWeekDecline: 20,
  minEmailsForLowReply: 100,
  noRepliesMinEmails: 200,
  lowPositiveRate: 0.5,
};

// ===== Hook =====
export function useOverviewDashboard(): OverviewDashboardData {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  
  const [todaysPulse, setTodaysPulse] = useState<TodaysPulse>({
    emailsSending: 0,
    replies: 0,
    positive: 0,
    meetingsBooked: 0,
  });
  
  const [rawMetrics, setRawMetrics] = useState<{
    last30: { sent: number; replied: number; positive: number; meetings: number };
    prev7: { sent: number; replied: number; positive: number; meetings: number };
    last7: { sent: number; replied: number; positive: number; meetings: number };
    weeklyBreakdown: WeeklyData[];
    dataCompleteness: DataCompleteness;
    campaigns: Array<{
      id: string;
      name: string;
      sent7d: number;
      sent30d: number;
      replied7d: number;
      replied30d: number;
      positive7d: number;
      positive30d: number;
      meetings30d: number;
      prevReplyRate?: number;
    }>;
  }>({
    last30: { sent: 0, replied: 0, positive: 0, meetings: 0 },
    prev7: { sent: 0, replied: 0, positive: 0, meetings: 0 },
    last7: { sent: 0, replied: 0, positive: 0, meetings: 0 },
    weeklyBreakdown: [],
    dataCompleteness: { dailyTotal: 0, campaignTotal: 0 },
    campaigns: [],
  });

  const [dataSource, setDataSource] = useState<DataSourceType>('nocodb_aggregate');
  const [snapshotSummary, setSnapshotSummary] = useState<SnapshotSummary | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const last7Start = format(subDays(today, 7), 'yyyy-MM-dd');
      const prev7Start = format(subDays(today, 14), 'yyyy-MM-dd');
      const week12Start = format(subWeeks(today, 12), 'yyyy-MM-dd');

      // Get engagement IDs
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);
      
      const engagementIds = (engagements || []).map(e => e.id);

      if (engagementIds.length === 0) {
        setHasData(false);
        setLoading(false);
        return;
      }

      // Fetch all data in parallel - including NocoDB snapshots
      const [dailyMetricsRes, campaignsRes, todayMetricsRes, activityCountRes, snapshotTotalsRes, allSnapshotTotalsRes] = await Promise.all([
        // Last 12 weeks of daily metrics for trend chart
        supabase
          .from('daily_metrics')
          .select('date, emails_sent, emails_replied, positive_replies, meetings_booked')
          .in('engagement_id', engagementIds)
          .gte('date', week12Start)
          .lte('date', todayStr)
          .order('date', { ascending: true }),
        
        // Campaign-level data for HERO metrics (more reliable than daily_metrics)
        // Also used for alerts and top performers
        supabase
          .from('campaigns')
          .select('id, name, total_sent, total_replied, positive_replies, total_meetings, reply_rate, positive_rate, updated_at')
          .in('engagement_id', engagementIds)
          .not('status', 'eq', 'archived'),
        
        // Today's metrics
        supabase
          .from('daily_metrics')
          .select('emails_sent, emails_replied, positive_replies, meetings_booked')
          .in('engagement_id', engagementIds)
          .eq('date', todayStr),
        
        // Check if we have any email_activities (determines data source type)
        supabase
          .from('email_activities')
          .select('id', { count: 'exact', head: true })
          .in('engagement_id', engagementIds)
          .limit(1),
        
      // NEW: Fetch latest NocoDB daily totals for Today's Pulse enhancement
        supabase
          .from('nocodb_daily_totals')
          .select('*')
          .order('snapshot_date', { ascending: false })
          .limit(10), // Get recent days to find the latest
        
        // NEW: Fetch all nocodb_daily_totals for weekly chart (with deltas)
        // We need to detect first-day entries by checking if sent_delta equals total_sent
        supabase
          .from('nocodb_daily_totals')
          .select('snapshot_date, platform, total_sent, total_replied, total_positive, sent_delta, replied_delta')
          .eq('platform', 'all') // Use aggregated 'all' platform row for totals
          .gte('snapshot_date', week12Start)
          .lte('snapshot_date', todayStr)
          .order('snapshot_date', { ascending: true }),
      ]);

      const dailyMetrics = dailyMetricsRes.data || [];
      const campaigns = campaignsRes.data || [];
      const todayMetrics = todayMetricsRes.data || [];
      const activityCount = activityCountRes.count || 0;
      const snapshotTotals = snapshotTotalsRes.data || [];
      const allSnapshotTotals = (allSnapshotTotalsRes.data || []) as Array<{
        snapshot_date: string;
        platform: string;
        total_sent: number;
        total_replied: number;
        total_positive: number;
        sent_delta: number;
        replied_delta: number;
      }>;
      
      // Find the most recent snapshot totals (aggregate across all platforms)
      const latestSnapshotDate = snapshotTotals.length > 0 ? snapshotTotals[0].snapshot_date : null;
      const latestSnapshots = snapshotTotals.filter(s => s.snapshot_date === latestSnapshotDate);
      
      // Aggregate snapshot totals across platforms
      const snapshotAggregate = latestSnapshots.reduce((acc, s) => ({
        totalCampaigns: acc.totalCampaigns + (s.total_campaigns || 0),
        totalSent: acc.totalSent + (s.total_sent || 0),
        totalReplied: acc.totalReplied + (s.total_replied || 0),
        totalPositive: acc.totalPositive + (s.total_positive || 0),
      }), { totalCampaigns: 0, totalSent: 0, totalReplied: 0, totalPositive: 0 });
      
      // Update snapshot summary
      if (latestSnapshotDate) {
        setSnapshotSummary({
          totalCampaigns: snapshotAggregate.totalCampaigns,
          totalSent: snapshotAggregate.totalSent,
          totalReplied: snapshotAggregate.totalReplied,
          totalPositive: snapshotAggregate.totalPositive,
          snapshotDate: latestSnapshotDate,
        });
      } else {
        setSnapshotSummary(null);
      }
      
      // Determine data source type - prioritize snapshots if available
      if (latestSnapshotDate) {
        setDataSource('snapshots');
      } else if (activityCount > 0) {
        setDataSource(activityCount > 1000 ? 'activity_level' : 'mixed');
      } else {
        setDataSource('nocodb_aggregate');
      }

      // Use campaigns table as the source of truth for data availability
      if (campaigns.length === 0) {
        setHasData(false);
        setLoading(false);
        return;
      }

      setHasData(true);

      // Calculate today's pulse - use snapshot data when available, fallback to daily_metrics
      const hasSnapshotPulse = latestSnapshotDate === todayStr && snapshotAggregate.totalSent > 0;
      
      const todayTotals = hasSnapshotPulse
        ? {
            emailsSending: snapshotAggregate.totalSent,
            replies: snapshotAggregate.totalReplied,
            positive: snapshotAggregate.totalPositive,
            meetingsBooked: 0, // Snapshots don't track meetings yet
            activeCampaigns: snapshotAggregate.totalCampaigns,
          }
        : todayMetrics.reduce((acc, m) => ({
            emailsSending: acc.emailsSending + (m.emails_sent || 0),
            replies: acc.replies + (m.emails_replied || 0),
            positive: acc.positive + (m.positive_replies || 0),
            meetingsBooked: acc.meetingsBooked + (m.meetings_booked || 0),
          }), { emailsSending: 0, replies: 0, positive: 0, meetingsBooked: 0 });
      
      setTodaysPulse(todayTotals);

      // ===== HERO METRICS: Use campaigns table (source of truth) =====
      // The campaigns table has complete aggregate data vs daily_metrics which has gaps
      const campaignTotals = campaigns.reduce((acc, c) => ({
        sent: acc.sent + (c.total_sent || 0),
        replied: acc.replied + (c.total_replied || 0),
        positive: acc.positive + (c.positive_replies || 0),
        meetings: acc.meetings + (c.total_meetings || 0),
      }), { sent: 0, replied: 0, positive: 0, meetings: 0 });

      // For WoW comparison, we still use daily_metrics (but with safeguards)
      const last7Agg = { sent: 0, replied: 0, positive: 0, meetings: 0 };
      const prev7Agg = { sent: 0, replied: 0, positive: 0, meetings: 0 };

      dailyMetrics.forEach(m => {
        const date = m.date;
        const sent = m.emails_sent || 0;
        const replied = m.emails_replied || 0;
        const positive = m.positive_replies || 0;
        const meetings = m.meetings_booked || 0;

        // Last 7 days
        if (date >= last7Start) {
          last7Agg.sent += sent;
          last7Agg.replied += replied;
          last7Agg.positive += positive;
          last7Agg.meetings += meetings;
        }

        // Previous 7 days (for WoW comparison)
        if (date >= prev7Start && date < last7Start) {
          prev7Agg.sent += sent;
          prev7Agg.replied += replied;
          prev7Agg.positive += positive;
          prev7Agg.meetings += meetings;
        }
      });
      
      // Use campaign totals for main metrics display
      const last30Agg = campaignTotals;

      // Build weekly breakdown (last 12 weeks)
      // Priority: Use snapshot deltas when available, fall back to daily_metrics
      const weeklyMap = new Map<string, WeeklyData>();
      
      for (let i = 0; i < 12; i++) {
        const weekEnd = endOfWeek(subWeeks(today, i), { weekStartsOn: 0 });
        const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 0 });
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
        const weekLabel = format(weekEnd, 'MMM d');
        
        weeklyMap.set(weekEndStr, {
          weekEnding: weekEndStr,
          weekLabel,
          emailsSent: 0,
          replies: 0,
          positiveReplies: 0,
          meetingsBooked: 0,
          replyRate: 0,
          positiveRate: 0,
        });
      }

      // First, populate from snapshot deltas (higher priority, more accurate)
      // Skip first-day entries where sent_delta equals total_sent (no previous day comparison)
      const validSnapshotDeltas = allSnapshotTotals.filter(s => 
        s.sent_delta !== s.total_sent || s.sent_delta === 0
      );
      
      validSnapshotDeltas.forEach(s => {
        const date = parseISO(s.snapshot_date);
        const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
        
        const week = weeklyMap.get(weekEndStr);
        if (week) {
          week.emailsSent += s.sent_delta || 0;
          week.replies += s.replied_delta || 0;
          // Use total_positive for now (no positive_delta in view)
          // This will show cumulative, but it's better than nothing
        }
      });
      
      // Get weeks that have snapshot data
      const weeksWithSnapshotData = new Set<string>();
      validSnapshotDeltas.forEach(s => {
        const date = parseISO(s.snapshot_date);
        const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
        weeksWithSnapshotData.add(format(weekEnd, 'yyyy-MM-dd'));
      });
      
      // Fall back to daily_metrics for weeks WITHOUT snapshot data
      // Also apply a sanity cap to filter out anomalous values (>50k emails/day is suspicious)
      const DAILY_SENT_CAP = 50000;
      
      dailyMetrics.forEach(m => {
        const date = parseISO(m.date);
        const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
        
        // Skip if this week already has snapshot data
        if (weeksWithSnapshotData.has(weekEndStr)) {
          return;
        }
        
        const week = weeklyMap.get(weekEndStr);
        if (week) {
          // Apply cap to filter out anomalous spikes
          const cappedSent = Math.min(m.emails_sent || 0, DAILY_SENT_CAP);
          week.emailsSent += cappedSent;
          week.replies += m.emails_replied || 0;
          week.positiveReplies += m.positive_replies || 0;
          week.meetingsBooked += m.meetings_booked || 0;
        }
      });

      // Calculate rates for each week - ONLY include weeks with actual activity
      // Filter out weeks with no emails sent (true time-series only, no estimated data)
      const weeklyBreakdown = Array.from(weeklyMap.values())
        .filter(w => w.emailsSent > 0) // Only show weeks with real data
        .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))
        .map(w => ({
          ...w,
          replyRate: w.emailsSent > 0 ? (w.replies / w.emailsSent) * 100 : 0,
          positiveRate: w.emailsSent > 0 ? (w.positiveReplies / w.emailsSent) * 100 : 0,
        }));

      // Calculate data completeness (daily_metrics positive vs campaigns positive)
      const dailyPositiveTotal = dailyMetrics.reduce((sum, m) => sum + (m.positive_replies || 0), 0);
      const campaignPositiveTotal = campaignTotals.positive;

      // Process campaigns for alerts
      const campaignMetrics = campaigns.map(c => {
        const sent7d = c.total_sent || 0; // Would need daily breakdown for accurate 7d
        const sent30d = c.total_sent || 0;
        const replied7d = c.total_replied || 0;
        const replied30d = c.total_replied || 0;
        const positive7d = c.positive_replies || 0;
        const positive30d = c.positive_replies || 0;
        const meetings30d = c.total_meetings || 0;

        return {
          id: c.id,
          name: c.name,
          sent7d,
          sent30d,
          replied7d,
          replied30d,
          positive7d,
          positive30d,
          meetings30d,
          replyRate: c.reply_rate || 0,
          positiveRate: c.positive_rate || 0,
        };
      });

      setRawMetrics({
        last30: last30Agg,
        prev7: prev7Agg,
        last7: last7Agg,
        weeklyBreakdown,
        dataCompleteness: { dailyTotal: dailyPositiveTotal, campaignTotal: campaignPositiveTotal },
        campaigns: campaignMetrics,
      });

    } catch (err) {
      console.error('Error fetching overview dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute hero metrics with WoW comparison (capped at 999%)
  const heroMetrics = useMemo((): HeroMetric[] => {
    const { last30, last7, prev7 } = rawMetrics;
    
    // Helper to calculate WoW change with safeguards:
    // - Cap at 999% to prevent layout-breaking numbers
    // - Show "neutral" trend when previous period has no data
    const calcChange = (current: number, previous: number): { change: number; trend: 'up' | 'down' | 'neutral' } => {
      // If no previous data, show neutral (not a valid comparison)
      if (previous === 0) {
        return { change: 0, trend: 'neutral' };
      }
      
      const pctChange = ((current - previous) / previous) * 100;
      // Cap at 999% to prevent extreme numbers from breaking layout
      const cappedChange = Math.min(Math.abs(pctChange), 999);
      
      return {
        change: cappedChange,
        trend: pctChange > 1 ? 'up' : pctChange < -1 ? 'down' : 'neutral',
      };
    };

    const last7ReplyRate = last7.sent > 0 ? (last7.replied / last7.sent) * 100 : 0;
    const prev7ReplyRate = prev7.sent > 0 ? (prev7.replied / prev7.sent) * 100 : 0;
    const last7PositiveRate = last7.sent > 0 ? (last7.positive / last7.sent) * 100 : 0;
    const prev7PositiveRate = prev7.sent > 0 ? (prev7.positive / prev7.sent) * 100 : 0;
    const last7MeetingRate = last7.sent > 0 ? (last7.meetings / last7.sent) * 100 : 0;
    const prev7MeetingRate = prev7.sent > 0 ? (prev7.meetings / prev7.sent) * 100 : 0;

    const sentChange = calcChange(last7.sent, prev7.sent);
    const replyRateChange = calcChange(last7ReplyRate, prev7ReplyRate);
    const positiveRateChange = calcChange(last7PositiveRate, prev7PositiveRate);
    const meetingRateChange = calcChange(last7MeetingRate, prev7MeetingRate);

    return [
      {
        label: 'Emails Sent',
        value: last30.sent,
        format: 'number',
        change: sentChange.change,
        trend: sentChange.trend,
      },
      {
        label: 'Reply Rate',
        value: last30.sent > 0 ? (last30.replied / last30.sent) * 100 : 0,
        format: 'percent',
        change: replyRateChange.change,
        trend: replyRateChange.trend,
      },
      {
        label: 'Positive Reply Rate',
        value: last30.sent > 0 ? (last30.positive / last30.sent) * 100 : 0,
        format: 'percent',
        change: positiveRateChange.change,
        trend: positiveRateChange.trend,
      },
      {
        label: 'Meeting Booked Rate',
        value: last30.sent > 0 ? (last30.meetings / last30.sent) * 100 : 0,
        format: 'percent',
        change: meetingRateChange.change,
        trend: meetingRateChange.trend,
      },
    ];
  }, [rawMetrics]);

  // Compute alert campaigns
  const alertCampaigns = useMemo((): AlertCampaign[] => {
    const alerts: AlertCampaign[] = [];

    rawMetrics.campaigns.forEach(c => {
      const replyRate = c.sent7d > 0 ? (c.replied7d / c.sent7d) * 100 : 0;
      const positiveRate = c.sent30d > 0 ? (c.positive30d / c.sent30d) * 100 : 0;

      // Low reply rate (< 1.5% with min 100 emails)
      if (replyRate < ALERT_THRESHOLDS.lowReplyRate && c.sent7d >= ALERT_THRESHOLDS.minEmailsForLowReply) {
        alerts.push({
          id: c.id,
          name: c.name,
          sent7d: c.sent7d,
          replyRate,
          issue: 'low_reply',
          issueLabel: 'Low reply rate',
          severity: 'warning',
        });
        return;
      }

      // No replies after 200+ emails
      if (c.replied7d === 0 && c.sent7d >= ALERT_THRESHOLDS.noRepliesMinEmails) {
        alerts.push({
          id: c.id,
          name: c.name,
          sent7d: c.sent7d,
          replyRate: 0,
          issue: 'no_replies',
          issueLabel: 'No replies',
          severity: 'critical',
        });
        return;
      }

      // Low positive rate
      if (positiveRate < ALERT_THRESHOLDS.lowPositiveRate && c.sent30d >= ALERT_THRESHOLDS.minEmailsForLowReply) {
        alerts.push({
          id: c.id,
          name: c.name,
          sent7d: c.sent7d,
          replyRate,
          issue: 'low_positive',
          issueLabel: 'Low positive rate',
          severity: 'warning',
        });
      }
    });

    // Sort by severity (critical first)
    return alerts.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (a.severity !== 'critical' && b.severity === 'critical') return 1;
      return 0;
    });
  }, [rawMetrics.campaigns]);

  // Compute top performers
  const topCampaigns = useMemo((): TopCampaign[] => {
    return rawMetrics.campaigns
      .filter(c => c.sent30d >= 100) // Minimum 100 emails to qualify
      .map(c => ({
        id: c.id,
        name: c.name,
        sent: c.sent30d,
        replyRate: c.sent30d > 0 ? (c.replied30d / c.sent30d) * 100 : 0,
        positiveRate: c.sent30d > 0 ? (c.positive30d / c.sent30d) * 100 : 0,
        meetingsBooked: c.meetings30d,
      }))
      .sort((a, b) => b.positiveRate - a.positiveRate)
      .slice(0, 5);
  }, [rawMetrics.campaigns]);

  return {
    loading,
    hasData,
    todaysPulse,
    heroMetrics,
    weeklyData: rawMetrics.weeklyBreakdown,
    alertCampaigns,
    topCampaigns,
    dataCompleteness: rawMetrics.dataCompleteness,
    dataSource,
    snapshotSummary,
    refetch: fetchData,
  };
}
