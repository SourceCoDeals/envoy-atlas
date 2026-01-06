import { useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns';

export interface MonthlyMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  positiveReplies: number;
  bounced: number;
  spamComplaints: number;
  unsubscribed: number;
}

export interface WeeklyBreakdown {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  sent: number;
  delivered: number;
  replied: number;
  positiveReplies: number;
  bounced: number;
}

export interface CampaignPerformance {
  id: string;
  name: string;
  status: string;
  sent: number;
  delivered: number;
  replied: number;
  positiveReplies: number;
  bounced: number;
  replyRate: number;
  positiveRate: number;
  bounceRate: number;
}

export interface InfrastructureStats {
  totalDomains: number;
  domainsWithSpf: number;
  domainsWithDkim: number;
  domainsWithDmarc: number;
  totalMailboxes: number;
  activeMailboxes: number;
  totalDailyCapacity: number;
  warmupEnabled: number;
}

export interface DailyTrend {
  date: string;
  sent: number;
  replied: number;
  replyRate: number;
}

export interface MonthlyReportData {
  selectedMonth: Date;
  currentMetrics: MonthlyMetrics;
  previousMetrics: MonthlyMetrics;
  weeklyBreakdown: WeeklyBreakdown[];
  campaignPerformance: CampaignPerformance[];
  infrastructure: InfrastructureStats;
  dailyTrends: DailyTrend[];
  loading: boolean;
  hasData: boolean;
}

export function useMonthlyReportData(selectedMonth: Date = new Date()): MonthlyReportData & { setSelectedMonth: (date: Date) => void } {
  const { currentWorkspace } = useWorkspace();
  const [month, setSelectedMonth] = useState(selectedMonth);
  const [loading, setLoading] = useState(true);
  const [currentMetrics, setCurrentMetrics] = useState<MonthlyMetrics>({
    sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0,
    positiveReplies: 0, bounced: 0, spamComplaints: 0, unsubscribed: 0
  });
  const [previousMetrics, setPreviousMetrics] = useState<MonthlyMetrics>({
    sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0,
    positiveReplies: 0, bounced: 0, spamComplaints: 0, unsubscribed: 0
  });
  const [weeklyBreakdown, setWeeklyBreakdown] = useState<WeeklyBreakdown[]>([]);
  const [campaignPerformance, setCampaignPerformance] = useState<CampaignPerformance[]>([]);
  const [infrastructure, setInfrastructure] = useState<InfrastructureStats>({
    totalDomains: 0, domainsWithSpf: 0, domainsWithDkim: 0, domainsWithDmarc: 0,
    totalMailboxes: 0, activeMailboxes: 0, totalDailyCapacity: 0, warmupEnabled: 0
  });
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);

  const monthStart = useMemo(() => startOfMonth(month), [month]);
  const monthEnd = useMemo(() => endOfMonth(month), [month]);
  const prevMonthStart = useMemo(() => startOfMonth(subMonths(month, 1)), [month]);
  const prevMonthEnd = useMemo(() => endOfMonth(subMonths(month, 1)), [month]);

  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const fetchData = async () => {
      setLoading(true);

      try {
        // Fetch current month metrics
        const { data: currentData } = await supabase
          .from('daily_metrics')
          .select('sent_count, delivered_count, opened_count, clicked_count, replied_count, positive_reply_count, bounced_count, spam_complaint_count, unsubscribed_count, date')
          .eq('workspace_id', currentWorkspace.id)
          .gte('date', format(monthStart, 'yyyy-MM-dd'))
          .lte('date', format(monthEnd, 'yyyy-MM-dd'));

        // Fetch previous month metrics
        const { data: previousData } = await supabase
          .from('daily_metrics')
          .select('sent_count, delivered_count, opened_count, clicked_count, replied_count, positive_reply_count, bounced_count, spam_complaint_count, unsubscribed_count')
          .eq('workspace_id', currentWorkspace.id)
          .gte('date', format(prevMonthStart, 'yyyy-MM-dd'))
          .lte('date', format(prevMonthEnd, 'yyyy-MM-dd'));

        // Aggregate current month
        const current = (currentData || []).reduce((acc, row) => ({
          sent: acc.sent + (row.sent_count || 0),
          delivered: acc.delivered + (row.delivered_count || 0),
          opened: acc.opened + (row.opened_count || 0),
          clicked: acc.clicked + (row.clicked_count || 0),
          replied: acc.replied + (row.replied_count || 0),
          positiveReplies: acc.positiveReplies + (row.positive_reply_count || 0),
          bounced: acc.bounced + (row.bounced_count || 0),
          spamComplaints: acc.spamComplaints + (row.spam_complaint_count || 0),
          unsubscribed: acc.unsubscribed + (row.unsubscribed_count || 0),
        }), { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, positiveReplies: 0, bounced: 0, spamComplaints: 0, unsubscribed: 0 });

        // Aggregate previous month
        const previous = (previousData || []).reduce((acc, row) => ({
          sent: acc.sent + (row.sent_count || 0),
          delivered: acc.delivered + (row.delivered_count || 0),
          opened: acc.opened + (row.opened_count || 0),
          clicked: acc.clicked + (row.clicked_count || 0),
          replied: acc.replied + (row.replied_count || 0),
          positiveReplies: acc.positiveReplies + (row.positive_reply_count || 0),
          bounced: acc.bounced + (row.bounced_count || 0),
          spamComplaints: acc.spamComplaints + (row.spam_complaint_count || 0),
          unsubscribed: acc.unsubscribed + (row.unsubscribed_count || 0),
        }), { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, positiveReplies: 0, bounced: 0, spamComplaints: 0, unsubscribed: 0 });

        setCurrentMetrics(current);
        setPreviousMetrics(previous);

        // Build daily trends
        const dailyMap = new Map<string, DailyTrend>();
        (currentData || []).forEach(row => {
          const existing = dailyMap.get(row.date) || { date: row.date, sent: 0, replied: 0, replyRate: 0 };
          existing.sent += row.sent_count || 0;
          existing.replied += row.replied_count || 0;
          dailyMap.set(row.date, existing);
        });
        const trends = Array.from(dailyMap.values())
          .map(d => ({ ...d, replyRate: d.sent > 0 ? (d.replied / d.sent) * 100 : 0 }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setDailyTrends(trends);

        // Build weekly breakdown
        const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
        const weeklyData: WeeklyBreakdown[] = weeks.map((weekStart, idx) => {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          const weekRows = (currentData || []).filter(row => {
            const d = new Date(row.date);
            return d >= weekStart && d <= weekEnd;
          });
          const agg = weekRows.reduce((acc, row) => ({
            sent: acc.sent + (row.sent_count || 0),
            delivered: acc.delivered + (row.delivered_count || 0),
            replied: acc.replied + (row.replied_count || 0),
            positiveReplies: acc.positiveReplies + (row.positive_reply_count || 0),
            bounced: acc.bounced + (row.bounced_count || 0),
          }), { sent: 0, delivered: 0, replied: 0, positiveReplies: 0, bounced: 0 });
          return {
            weekStart: format(weekStart, 'MMM d'),
            weekEnd: format(weekEnd, 'MMM d'),
            weekLabel: `Week ${idx + 1}`,
            ...agg
          };
        });
        setWeeklyBreakdown(weeklyData);

        // Fetch campaign performance
        const { data: campaignsData } = await supabase
          .from('campaigns')
          .select('id, name, status')
          .eq('workspace_id', currentWorkspace.id);

        const { data: campaignMetrics } = await supabase
          .from('daily_metrics')
          .select('campaign_id, sent_count, delivered_count, replied_count, positive_reply_count, bounced_count')
          .eq('workspace_id', currentWorkspace.id)
          .gte('date', format(monthStart, 'yyyy-MM-dd'))
          .lte('date', format(monthEnd, 'yyyy-MM-dd'))
          .not('campaign_id', 'is', null);

        const campaignAgg = new Map<string, { sent: number; delivered: number; replied: number; positiveReplies: number; bounced: number }>();
        (campaignMetrics || []).forEach(row => {
          if (!row.campaign_id) return;
          const existing = campaignAgg.get(row.campaign_id) || { sent: 0, delivered: 0, replied: 0, positiveReplies: 0, bounced: 0 };
          existing.sent += row.sent_count || 0;
          existing.delivered += row.delivered_count || 0;
          existing.replied += row.replied_count || 0;
          existing.positiveReplies += row.positive_reply_count || 0;
          existing.bounced += row.bounced_count || 0;
          campaignAgg.set(row.campaign_id, existing);
        });

        const campPerf: CampaignPerformance[] = (campaignsData || [])
          .map(c => {
            const metrics = campaignAgg.get(c.id) || { sent: 0, delivered: 0, replied: 0, positiveReplies: 0, bounced: 0 };
            return {
              id: c.id,
              name: c.name,
              status: c.status || 'unknown',
              ...metrics,
              replyRate: metrics.sent > 0 ? (metrics.replied / metrics.sent) * 100 : 0,
              positiveRate: metrics.sent > 0 ? (metrics.positiveReplies / metrics.sent) * 100 : 0,
              bounceRate: metrics.sent > 0 ? (metrics.bounced / metrics.sent) * 100 : 0,
            };
          })
          .filter(c => c.sent > 0)
          .sort((a, b) => b.replyRate - a.replyRate);
        setCampaignPerformance(campPerf);

        // Fetch infrastructure stats
        const { data: domains } = await supabase
          .from('sending_domains')
          .select('spf_valid, dkim_valid, dmarc_valid')
          .eq('workspace_id', currentWorkspace.id);

        const { data: accounts } = await supabase
          .from('email_accounts')
          .select('is_active, daily_limit, warmup_enabled')
          .eq('workspace_id', currentWorkspace.id);

        // Count unique domains from email accounts if no sending_domains
        const { data: emailAccounts } = await supabase
          .from('email_accounts')
          .select('email_address')
          .eq('workspace_id', currentWorkspace.id);

        const uniqueDomains = new Set((emailAccounts || []).map(e => e.email_address.split('@')[1]));

        setInfrastructure({
          totalDomains: (domains && domains.length > 0) ? domains.length : uniqueDomains.size,
          domainsWithSpf: (domains || []).filter(d => d.spf_valid).length,
          domainsWithDkim: (domains || []).filter(d => d.dkim_valid).length,
          domainsWithDmarc: (domains || []).filter(d => d.dmarc_valid).length,
          totalMailboxes: (accounts || []).length,
          activeMailboxes: (accounts || []).filter(a => a.is_active).length,
          totalDailyCapacity: (accounts || []).reduce((sum, a) => sum + (a.daily_limit || 50), 0),
          warmupEnabled: (accounts || []).filter(a => a.warmup_enabled).length,
        });

      } catch (error) {
        console.error('Error fetching monthly report data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentWorkspace?.id, monthStart, monthEnd, prevMonthStart, prevMonthEnd]);

  const hasData = currentMetrics.sent > 0;

  return {
    selectedMonth: month,
    setSelectedMonth,
    currentMetrics,
    previousMetrics,
    weeklyBreakdown,
    campaignPerformance,
    infrastructure,
    dailyTrends,
    loading,
    hasData
  };
}
