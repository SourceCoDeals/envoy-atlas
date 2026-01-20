import { useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format, endOfWeek, eachWeekOfInterval } from 'date-fns';
import { calculateRate } from '@/lib/metrics';

export interface MonthlyMetrics {
  sent: number;
  delivered: number;
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
    sent: 0, delivered: 0, replied: 0,
    positiveReplies: 0, bounced: 0, spamComplaints: 0, unsubscribed: 0
  });
  const [previousMetrics, setPreviousMetrics] = useState<MonthlyMetrics>({
    sent: 0, delivered: 0, replied: 0,
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
        // Get engagements for this client/workspace
        const { data: engagements } = await supabase
          .from('engagements')
          .select('id')
          .eq('client_id', currentWorkspace.id);

        const engagementIds = (engagements || []).map(e => e.id);

        if (engagementIds.length === 0) {
          setLoading(false);
          return;
        }

        // Fetch current month metrics from daily_metrics table
        const { data: currentDailyMetrics } = await supabase
          .from('daily_metrics')
          .select('date, emails_sent, emails_replied, positive_replies, emails_bounced')
          .in('engagement_id', engagementIds)
          .gte('date', format(monthStart, 'yyyy-MM-dd'))
          .lte('date', format(monthEnd, 'yyyy-MM-dd'));

        const currentData = (currentDailyMetrics || []).map(d => ({
          ...d,
          sent_count: d.emails_sent || 0,
          replied_count: d.emails_replied || 0,
          positive_reply_count: d.positive_replies || 0,
          bounced_count: d.emails_bounced || 0,
        }));

        // Fetch previous month metrics
        const { data: previousDailyMetrics } = await supabase
          .from('daily_metrics')
          .select('emails_sent, emails_replied, positive_replies, emails_bounced')
          .in('engagement_id', engagementIds)
          .gte('date', format(prevMonthStart, 'yyyy-MM-dd'))
          .lte('date', format(prevMonthEnd, 'yyyy-MM-dd'));

        const previousData = (previousDailyMetrics || []).map(d => ({
          sent_count: d.emails_sent || 0,
          replied_count: d.emails_replied || 0,
          positive_reply_count: d.positive_replies || 0,
          bounced_count: d.emails_bounced || 0,
        }));

        // Aggregate current month
        const current = currentData.reduce((acc, row) => ({
          sent: acc.sent + row.sent_count,
          delivered: acc.delivered + row.sent_count - row.bounced_count,
          replied: acc.replied + row.replied_count,
          positiveReplies: acc.positiveReplies + row.positive_reply_count,
          bounced: acc.bounced + row.bounced_count,
          spamComplaints: 0,
          unsubscribed: 0,
        }), { sent: 0, delivered: 0, replied: 0, positiveReplies: 0, bounced: 0, spamComplaints: 0, unsubscribed: 0 });

        // Aggregate previous month
        const previous = previousData.reduce((acc, row) => ({
          sent: acc.sent + row.sent_count,
          delivered: acc.delivered + row.sent_count - row.bounced_count,
          replied: acc.replied + row.replied_count,
          positiveReplies: acc.positiveReplies + row.positive_reply_count,
          bounced: acc.bounced + row.bounced_count,
          spamComplaints: 0,
          unsubscribed: 0,
        }), { sent: 0, delivered: 0, replied: 0, positiveReplies: 0, bounced: 0, spamComplaints: 0, unsubscribed: 0 });

        setCurrentMetrics(current);
        setPreviousMetrics(previous);

        // Build daily trends
        const dailyMap = new Map<string, DailyTrend>();
        currentData.forEach(row => {
          const existing = dailyMap.get(row.date) || { date: row.date, sent: 0, replied: 0, replyRate: 0 };
          existing.sent += row.sent_count;
          existing.replied += row.replied_count;
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
          const weekRows = currentData.filter(row => {
            const d = new Date(row.date);
            return d >= weekStart && d <= weekEnd;
          });
          const agg = weekRows.reduce((acc, row) => ({
            sent: acc.sent + row.sent_count,
            delivered: acc.delivered + row.sent_count - row.bounced_count,
            replied: acc.replied + row.replied_count,
            positiveReplies: acc.positiveReplies + row.positive_reply_count,
            bounced: acc.bounced + row.bounced_count,
          }), { sent: 0, delivered: 0, replied: 0, positiveReplies: 0, bounced: 0 });
          return {
            weekStart: format(weekStart, 'MMM d'),
            weekEnd: format(weekEnd, 'MMM d'),
            weekLabel: `Week ${idx + 1}`,
            ...agg
          };
        });
        setWeeklyBreakdown(weeklyData);

        // Fetch campaigns from unified campaigns table - include positive_replies
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('id, name, status, total_sent, total_opened, total_replied, total_bounced, positive_replies')
          .in('engagement_id', engagementIds);

        const campPerf: CampaignPerformance[] = (campaigns || [])
          .map(c => {
            const sent = c.total_sent || 0;
            const replied = c.total_replied || 0;
            const bounced = c.total_bounced || 0;
            const positiveReplies = c.positive_replies || 0;
            const delivered = sent - bounced;
            return {
              id: c.id,
              name: c.name,
              status: c.status || 'unknown',
              sent,
              delivered,
              replied,
              positiveReplies,
              bounced,
              replyRate: calculateRate(replied, delivered),
              positiveRate: calculateRate(positiveReplies, delivered),
              bounceRate: calculateRate(bounced, sent), // Bounce rate uses sent
            };
          })
          .filter(c => c.sent > 0)
          .sort((a, b) => b.replyRate - a.replyRate);
        setCampaignPerformance(campPerf);

        // Fetch email accounts for infrastructure stats
        const { data: emailAccountsData } = await supabase
          .from('email_accounts')
          .select('*')
          .in('engagement_id', engagementIds);

        const emailAccounts = emailAccountsData || [];
        
        // Calculate domains from email accounts
        const domainSet = new Set<string>();
        emailAccounts.forEach((a: any) => {
          const email = a.from_email || '';
          const domain = email.split('@')[1];
          if (domain) domainSet.add(domain);
        });

        setInfrastructure({
          totalDomains: domainSet.size,
          domainsWithSpf: 0, // Would need sending_domains table
          domainsWithDkim: 0,
          domainsWithDmarc: 0,
          totalMailboxes: emailAccounts.length,
          activeMailboxes: emailAccounts.filter((a: any) => a.is_active).length,
          totalDailyCapacity: emailAccounts.reduce((sum: number, a: any) => sum + (a.message_per_day || 0), 0),
          warmupEnabled: emailAccounts.filter((a: any) => a.warmup_enabled).length,
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
    currentMetrics,
    previousMetrics,
    weeklyBreakdown,
    campaignPerformance,
    infrastructure,
    dailyTrends,
    loading,
    hasData,
    setSelectedMonth,
  };
}
