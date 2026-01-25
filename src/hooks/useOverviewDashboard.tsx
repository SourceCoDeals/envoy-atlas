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
}

export interface OverviewDashboardData {
  loading: boolean;
  hasData: boolean;
  todaysPulse: TodaysPulse;
  heroMetrics: HeroMetric[];
  weeklyData: WeeklyData[];
  alertCampaigns: AlertCampaign[];
  topCampaigns: TopCampaign[];
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
    campaigns: [],
  });

  const fetchData = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const last7Start = format(subDays(today, 7), 'yyyy-MM-dd');
      const prev7Start = format(subDays(today, 14), 'yyyy-MM-dd');
      const last30Start = format(subDays(today, 30), 'yyyy-MM-dd');
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

      // Fetch all data in parallel
      const [dailyMetricsRes, campaignsRes, todayMetricsRes] = await Promise.all([
        // Last 12 weeks of daily metrics for trend chart
        supabase
          .from('daily_metrics')
          .select('date, emails_sent, emails_replied, positive_replies, meetings_booked')
          .in('engagement_id', engagementIds)
          .gte('date', week12Start)
          .lte('date', todayStr)
          .order('date', { ascending: true }),
        
        // Campaign-level data for alerts and top performers
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
      ]);

      const dailyMetrics = dailyMetricsRes.data || [];
      const campaigns = campaignsRes.data || [];
      const todayMetrics = todayMetricsRes.data || [];

      if (dailyMetrics.length === 0 && campaigns.length === 0) {
        setHasData(false);
        setLoading(false);
        return;
      }

      setHasData(true);

      // Calculate today's pulse
      const todayTotals = todayMetrics.reduce((acc, m) => ({
        emailsSending: acc.emailsSending + (m.emails_sent || 0),
        replies: acc.replies + (m.emails_replied || 0),
        positive: acc.positive + (m.positive_replies || 0),
        meetingsBooked: acc.meetingsBooked + (m.meetings_booked || 0),
      }), { emailsSending: 0, replies: 0, positive: 0, meetingsBooked: 0 });
      
      setTodaysPulse(todayTotals);

      // Aggregate daily metrics by time period
      const last30Agg = { sent: 0, replied: 0, positive: 0, meetings: 0 };
      const last7Agg = { sent: 0, replied: 0, positive: 0, meetings: 0 };
      const prev7Agg = { sent: 0, replied: 0, positive: 0, meetings: 0 };

      dailyMetrics.forEach(m => {
        const date = m.date;
        const sent = m.emails_sent || 0;
        const replied = m.emails_replied || 0;
        const positive = m.positive_replies || 0;
        const meetings = m.meetings_booked || 0;

        // Last 30 days
        if (date >= last30Start) {
          last30Agg.sent += sent;
          last30Agg.replied += replied;
          last30Agg.positive += positive;
          last30Agg.meetings += meetings;
        }

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

      // Build weekly breakdown (last 12 weeks)
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

      dailyMetrics.forEach(m => {
        const date = parseISO(m.date);
        const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
        
        const week = weeklyMap.get(weekEndStr);
        if (week) {
          week.emailsSent += m.emails_sent || 0;
          week.replies += m.emails_replied || 0;
          week.positiveReplies += m.positive_replies || 0;
          week.meetingsBooked += m.meetings_booked || 0;
        }
      });

      // Calculate rates for each week
      const weeklyBreakdown = Array.from(weeklyMap.values())
        .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))
        .map(w => ({
          ...w,
          replyRate: w.emailsSent > 0 ? (w.replies / w.emailsSent) * 100 : 0,
          positiveRate: w.emailsSent > 0 ? (w.positiveReplies / w.emailsSent) * 100 : 0,
        }));

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

  // Compute hero metrics with WoW comparison
  const heroMetrics = useMemo((): HeroMetric[] => {
    const { last30, last7, prev7 } = rawMetrics;
    
    const calcChange = (current: number, previous: number): { change: number; trend: 'up' | 'down' | 'neutral' } => {
      if (previous === 0) return { change: 0, trend: 'neutral' };
      const pctChange = ((current - previous) / previous) * 100;
      return {
        change: Math.abs(pctChange),
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
    refetch: fetchData,
  };
}
