import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

interface DashboardStats {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  totalBounced: number;
  totalPositive: number;
  totalSpam: number;
  totalDelivered: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  positiveRate: number;
  spamRate: number;
  deliveredRate: number;
}

interface TrendData {
  date: string;
  sent: number;
  replies: number;
  positiveReplies: number;
}

interface TopCampaign {
  id: string;
  name: string;
  replyRate: number;
  positiveRate: number;
  sent: number;
}

interface TimeData {
  day: number;
  hour: number;
  value: number;
}

interface DateRange {
  startDate: Date | null;
  endDate: Date;
}

export function useDashboardData(dateRange?: DateRange) {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalSent: 0, totalOpened: 0, totalClicked: 0, totalReplied: 0, 
    totalBounced: 0, totalPositive: 0, totalSpam: 0, totalDelivered: 0,
    openRate: 0, clickRate: 0, replyRate: 0, bounceRate: 0, 
    positiveRate: 0, spamRate: 0, deliveredRate: 0,
  });
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [topCampaigns, setTopCampaigns] = useState<TopCampaign[]>([]);
  const [timeData, setTimeData] = useState<TimeData[]>([]);

  const startDateStr = dateRange?.startDate?.toISOString().split('T')[0] ?? null;
  const endDateStr = dateRange?.endDate?.toISOString().split('T')[0] ?? null;

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchDashboardData();
    }
  }, [currentWorkspace?.id, startDateStr, endDateStr]);

  const fetchDashboardData = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Get engagement IDs for this client
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

      // Build query for daily metrics
      let metricsQuery = supabase
        .from('daily_metrics')
        .select('*')
        .in('engagement_id', engagementIds)
        .order('date', { ascending: true });

      if (startDateStr) {
        metricsQuery = metricsQuery.gte('date', startDateStr);
      }
      if (endDateStr) {
        metricsQuery = metricsQuery.lte('date', endDateStr);
      }

      const { data: metricsData, error: metricsError } = await metricsQuery;

      if (metricsError) {
        console.warn('Metrics error:', metricsError);
      }

      const metrics = metricsData || [];

      if (metrics.length === 0) {
        // Try to get data from campaigns table directly
        const { data: campaignsData } = await supabase
          .from('campaigns')
          .select('total_sent, total_opened, total_replied, total_bounced')
          .in('engagement_id', engagementIds);

        const campaignTotals = (campaignsData || []).reduce((acc, c) => ({
          sent: acc.sent + (c.total_sent || 0),
          opened: acc.opened + (c.total_opened || 0),
          replied: acc.replied + (c.total_replied || 0),
          bounced: acc.bounced + (c.total_bounced || 0),
        }), { sent: 0, opened: 0, replied: 0, bounced: 0 });

        if (campaignTotals.sent > 0) {
          setHasData(true);
          const delivered = campaignTotals.sent - campaignTotals.bounced;
          setStats({
            totalSent: campaignTotals.sent,
            totalOpened: campaignTotals.opened,
            totalClicked: 0,
            totalReplied: campaignTotals.replied,
            totalBounced: campaignTotals.bounced,
            totalPositive: 0,
            totalSpam: 0,
            totalDelivered: delivered,
            openRate: campaignTotals.sent > 0 ? (campaignTotals.opened / campaignTotals.sent) * 100 : 0,
            clickRate: 0,
            replyRate: campaignTotals.sent > 0 ? (campaignTotals.replied / campaignTotals.sent) * 100 : 0,
            bounceRate: campaignTotals.sent > 0 ? (campaignTotals.bounced / campaignTotals.sent) * 100 : 0,
            positiveRate: 0,
            spamRate: 0,
            deliveredRate: campaignTotals.sent > 0 ? (delivered / campaignTotals.sent) * 100 : 0,
          });
        } else {
          setHasData(false);
        }
        setLoading(false);
        return;
      }

      setHasData(true);

      // Aggregate metrics by date
      const metricsByDate = new Map<string, {
        sent: number;
        opened: number;
        clicked: number;
        replied: number;
        bounced: number;
        positive: number;
      }>();

      for (const m of metrics) {
        const existing = metricsByDate.get(m.date) || {
          sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, positive: 0
        };
        metricsByDate.set(m.date, {
          sent: existing.sent + (m.emails_sent || 0),
          opened: existing.opened + (m.emails_opened || 0),
          clicked: existing.clicked + (m.emails_clicked || 0),
          replied: existing.replied + (m.emails_replied || 0),
          bounced: existing.bounced + (m.emails_bounced || 0),
          positive: existing.positive + (m.positive_replies || 0),
        });
      }

      // Calculate totals
      const totals = { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, positive: 0 };
      metricsByDate.forEach(m => {
        totals.sent += m.sent;
        totals.opened += m.opened;
        totals.clicked += m.clicked;
        totals.replied += m.replied;
        totals.bounced += m.bounced;
        totals.positive += m.positive;
      });

      const delivered = totals.sent - totals.bounced;

      setStats({
        totalSent: totals.sent,
        totalOpened: totals.opened,
        totalClicked: totals.clicked,
        totalReplied: totals.replied,
        totalBounced: totals.bounced,
        totalPositive: totals.positive,
        totalSpam: 0,
        totalDelivered: delivered,
        openRate: totals.sent > 0 ? (totals.opened / totals.sent) * 100 : 0,
        clickRate: totals.sent > 0 ? (totals.clicked / totals.sent) * 100 : 0,
        replyRate: totals.sent > 0 ? (totals.replied / totals.sent) * 100 : 0,
        bounceRate: totals.sent > 0 ? (totals.bounced / totals.sent) * 100 : 0,
        positiveRate: totals.sent > 0 ? (totals.positive / totals.sent) * 100 : 0,
        spamRate: 0,
        deliveredRate: totals.sent > 0 ? (delivered / totals.sent) * 100 : 0,
      });

      // Build trend data
      const trend: TrendData[] = Array.from(metricsByDate.entries())
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sent: data.sent,
          replies: data.replied,
          positiveReplies: data.positive,
        }))
        .slice(-30);

      setTrendData(trend);

      // Fetch campaigns for top performers - include positive_replies
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, total_sent, total_replied, positive_replies')
        .in('engagement_id', engagementIds);

      if (campaigns && campaigns.length > 0) {
        const campaignStats = campaigns.map(c => ({
          id: c.id,
          name: c.name,
          sent: c.total_sent || 0,
          replyRate: (c.total_sent || 0) > 0 ? ((c.total_replied || 0) / (c.total_sent || 0)) * 100 : 0,
          positiveRate: (c.total_replied || 0) > 0 ? ((c.positive_replies || 0) / (c.total_replied || 0)) * 100 : 0,
        }));

        setTopCampaigns(
          campaignStats
            .filter(c => c.sent > 0)
            .sort((a, b) => b.replyRate - a.replyRate)
            .slice(0, 5)
        );
      }

      // Fetch hourly metrics for time heatmap
      const { data: hourlyMetricsData } = await supabase
        .from('hourly_metrics')
        .select('*')
        .in('engagement_id', engagementIds);

      if (hourlyMetricsData && hourlyMetricsData.length > 0) {
        const timeDataPoints: TimeData[] = hourlyMetricsData.map((h: any) => ({
          day: h.day_of_week || 0,
          hour: h.hour_of_day || 0,
          value: h.emails_replied || h.emails_sent || 0,
        }));
        setTimeData(timeDataPoints);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, startDateStr, endDateStr]);

  return { loading, hasData, stats, trendData, topCampaigns, timeData, refetch: fetchDashboardData };
}
