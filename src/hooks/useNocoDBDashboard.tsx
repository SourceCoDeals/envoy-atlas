import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateRate } from '@/lib/metrics';
import { logger } from '@/lib/logger';
import { startOfWeek, endOfWeek, subWeeks, format, parseISO } from 'date-fns';

// ===== Types =====
export interface NocoDBTotals {
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;
  totalReplied: number;
  totalPositive: number;
  totalMeetings: number;
  activeCampaigns: number;
  replyRate: number;
  positiveRate: number;
  bounceRate: number;
}

export interface NocoDBWeeklyData {
  weekEnding: string;
  weekLabel: string;
  emailsSent: number;
  replies: number;
  positiveReplies: number;
  replyRate: number;
  positiveRate: number;
}

export interface NocoDBDashboardData {
  loading: boolean;
  hasData: boolean;
  totals: NocoDBTotals;
  weeklyData: NocoDBWeeklyData[];
  refetch: () => void;
}

/**
 * Hook that fetches dashboard metrics directly from NocoDB tables.
 * This is the source of truth for Email Dashboard metrics.
 * 
 * Data sources:
 * - Hero Metrics: nocodb_smartlead_campaigns + nocodb_replyio_campaigns
 * - Weekly Chart: nocodb_campaign_daily_deltas view
 * - Active Campaigns: Count where status = 'ACTIVE' (SmartLead) or 'Active' (Reply.io)
 */
export function useNocoDBDashboard(): NocoDBDashboardData {
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [totals, setTotals] = useState<NocoDBTotals>({
    totalSent: 0,
    totalDelivered: 0,
    totalBounced: 0,
    totalReplied: 0,
    totalPositive: 0,
    totalMeetings: 0,
    activeCampaigns: 0,
    replyRate: 0,
    positiveRate: 0,
    bounceRate: 0,
  });
  const [weeklyData, setWeeklyData] = useState<NocoDBWeeklyData[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const today = new Date();
      const week12Start = format(subWeeks(today, 12), 'yyyy-MM-dd');
      const todayStr = format(today, 'yyyy-MM-dd');

      // Fetch NocoDB campaign tables in parallel
      const [smartleadRes, replyioRes, deltasRes] = await Promise.all([
        supabase
          .from('nocodb_smartlead_campaigns')
          .select('campaign_id, total_emails_sent, total_replies, total_bounces, leads_interested, status'),
        supabase
          .from('nocodb_replyio_campaigns')
          .select('campaign_id, deliveries, bounces, replies, status'),
        // Fetch daily deltas for weekly chart
        supabase
          .from('nocodb_campaign_daily_deltas')
          .select('snapshot_date, campaign_id, platform, emails_sent_delta, emails_replied_delta, positive_delta, prev_snapshot_date')
          .gte('snapshot_date', week12Start)
          .lte('snapshot_date', todayStr)
          .order('snapshot_date', { ascending: true }),
      ]);

      const smartleadData = smartleadRes.data || [];
      const replyioData = replyioRes.data || [];
      const deltasData = deltasRes.data || [];

      // Check if we have any data
      if (smartleadData.length === 0 && replyioData.length === 0) {
        setHasData(false);
        setLoading(false);
        return;
      }

      setHasData(true);

      // ===== Aggregate Totals from NocoDB =====
      const smartleadTotals = smartleadData.reduce((acc, r) => ({
        sent: acc.sent + (r.total_emails_sent || 0),
        replied: acc.replied + (r.total_replies || 0),
        bounced: acc.bounced + (r.total_bounces || 0),
        positive: acc.positive + (r.leads_interested || 0),
      }), { sent: 0, replied: 0, bounced: 0, positive: 0 });

      const replyioTotals = replyioData.reduce((acc, r) => ({
        sent: acc.sent + (r.deliveries || 0) + (r.bounces || 0),
        replied: acc.replied + (r.replies || 0),
        bounced: acc.bounced + (r.bounces || 0),
        delivered: acc.delivered + (r.deliveries || 0),
      }), { sent: 0, replied: 0, bounced: 0, delivered: 0 });

      // Combined totals
      const totalSent = smartleadTotals.sent + replyioTotals.sent;
      const totalBounced = smartleadTotals.bounced + replyioTotals.bounced;
      const totalDelivered = Math.max(0, totalSent - totalBounced);
      const totalReplied = smartleadTotals.replied + replyioTotals.replied;
      const totalPositive = smartleadTotals.positive; // Reply.io doesn't have positive replies in NocoDB

      // Calculate rates using delivered as denominator (SmartLead convention)
      const replyRate = calculateRate(totalReplied, totalDelivered);
      const positiveRate = calculateRate(totalPositive, totalDelivered);
      const bounceRate = calculateRate(totalBounced, totalSent);

      // Count active campaigns from NocoDB
      const smartleadActive = smartleadData.filter(c => 
        c.status?.toUpperCase() === 'ACTIVE'
      ).length;
      const replyioActive = replyioData.filter(c => 
        c.status === 'Active'
      ).length;
      const activeCampaigns = smartleadActive + replyioActive;

      setTotals({
        totalSent,
        totalDelivered,
        totalBounced,
        totalReplied,
        totalPositive,
        totalMeetings: 0, // Not tracked in NocoDB
        activeCampaigns,
        replyRate,
        positiveRate,
        bounceRate,
      });

      // ===== Weekly Chart Data from Deltas View =====
      // Initialize weekly buckets
      const weeklyMap = new Map<string, NocoDBWeeklyData>();
      
      for (let i = 0; i < 12; i++) {
        const weekEnd = endOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
        const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
        const weekLabel = format(weekStart, 'MMM d');
        
        weeklyMap.set(weekEndStr, {
          weekEnding: weekEndStr,
          weekLabel,
          emailsSent: 0,
          replies: 0,
          positiveReplies: 0,
          replyRate: 0,
          positiveRate: 0,
        });
      }

      // Aggregate deltas into weekly buckets
      // IMPORTANT: Skip first-snapshot entries where prev_snapshot_date is NULL (no previous day comparison)
      // These entries have emails_sent_delta = cumulative total which would spike the chart
      deltasData.forEach(d => {
        // Skip first-snapshot anomalies (prev_snapshot_date is NULL means no prior day)
        if (d.prev_snapshot_date === null) {
          return;
        }

        const date = parseISO(d.snapshot_date);
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
        
        const week = weeklyMap.get(weekEndStr);
        if (week) {
          week.emailsSent += d.emails_sent_delta || 0;
          week.replies += d.emails_replied_delta || 0;
          week.positiveReplies += d.positive_delta || 0;
        }
      });

      // Calculate rates and filter to weeks with data
      const weeklyBreakdown = Array.from(weeklyMap.values())
        .filter(w => w.emailsSent > 0)
        .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))
        .map(w => ({
          ...w,
          replyRate: calculateRate(w.replies, w.emailsSent),
          positiveRate: calculateRate(w.positiveReplies, w.emailsSent),
        }));

      setWeeklyData(weeklyBreakdown);

    } catch (err) {
      logger.error('Error fetching NocoDB dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    hasData,
    totals,
    weeklyData,
    refetch: fetchData,
  };
}
