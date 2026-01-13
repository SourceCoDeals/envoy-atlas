import { useState, useEffect } from 'react';
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

export function useDashboardData() {
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

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchDashboardData();
    }
  }, [currentWorkspace?.id]);

  const fetchDashboardData = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Fetch daily metrics from both platform tables
      const [smartleadMetrics, replyioMetrics] = await Promise.all([
        supabase.from('smartlead_daily_metrics').select('*').eq('workspace_id', currentWorkspace.id).order('metric_date', { ascending: true }),
        supabase.from('replyio_daily_metrics').select('*').eq('workspace_id', currentWorkspace.id).order('metric_date', { ascending: true })
      ]);

      if (smartleadMetrics.error) throw smartleadMetrics.error;
      if (replyioMetrics.error) throw replyioMetrics.error;

      const metrics = [...(smartleadMetrics.data || []), ...(replyioMetrics.data || [])];

      if (!metrics || metrics.length === 0) {
        setHasData(false);
        setLoading(false);
        return;
      }

      setHasData(true);

      // Calculate totals (note: these tables don't have spam_complaint_count or delivered_count)
      const totals = metrics.reduce((acc, m) => ({
        sent: acc.sent + (m.sent_count || 0),
        opened: acc.opened + (m.opened_count || 0),
        clicked: acc.clicked + (m.clicked_count || 0),
        replied: acc.replied + (m.replied_count || 0),
        bounced: acc.bounced + (m.bounced_count || 0),
        positive: acc.positive + (m.positive_reply_count || 0),
        spam: 0,
        delivered: 0,
      }), { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, positive: 0, spam: 0, delivered: 0 });

      // Calculate delivered if not tracked separately (sent - bounced)
      const delivered = totals.delivered > 0 ? totals.delivered : (totals.sent - totals.bounced);

      setStats({
        totalSent: totals.sent,
        totalOpened: totals.opened,
        totalClicked: totals.clicked,
        totalReplied: totals.replied,
        totalBounced: totals.bounced,
        totalPositive: totals.positive,
        totalSpam: totals.spam,
        totalDelivered: delivered,
        openRate: totals.sent > 0 ? (totals.opened / totals.sent) * 100 : 0,
        clickRate: totals.sent > 0 ? (totals.clicked / totals.sent) * 100 : 0,
        replyRate: totals.sent > 0 ? (totals.replied / totals.sent) * 100 : 0,
        bounceRate: totals.sent > 0 ? (totals.bounced / totals.sent) * 100 : 0,
        positiveRate: totals.sent > 0 ? (totals.positive / totals.sent) * 100 : 0,
        spamRate: totals.sent > 0 ? (totals.spam / totals.sent) * 100 : 0,
        deliveredRate: totals.sent > 0 ? (delivered / totals.sent) * 100 : 0,
      });

      // Group by date for trend (use metric_date from new tables)
      const dateMap = new Map<string, { sent: number; replies: number; positive: number }>();
      metrics.forEach(m => {
        const dateKey = m.metric_date;
        const existing = dateMap.get(dateKey) || { sent: 0, replies: 0, positive: 0 };
        dateMap.set(dateKey, {
          sent: existing.sent + (m.sent_count || 0),
          replies: existing.replies + (m.replied_count || 0),
          positive: existing.positive + (m.positive_reply_count || 0),
        });
      });

      const trend: TrendData[] = Array.from(dateMap.entries())
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sent: data.sent,
          replies: data.replies,
          positiveReplies: data.positive,
        }))
        .slice(-14); // Last 14 days

      setTrendData(trend);

      // Fetch campaigns from both platforms for top performers
      const [smartleadCampaigns, replyioCampaigns] = await Promise.all([
        supabase.from('smartlead_campaigns').select('id, name').eq('workspace_id', currentWorkspace.id),
        supabase.from('replyio_campaigns').select('id, name').eq('workspace_id', currentWorkspace.id)
      ]);

      const campaigns = [
        ...(smartleadCampaigns.data || []),
        ...(replyioCampaigns.data || [])
      ];

      if (campaigns) {
        const campaignMetrics = campaigns.map(c => {
          const cMetrics = metrics.filter(m => m.campaign_id === c.id);
          const sent = cMetrics.reduce((s, m) => s + (m.sent_count || 0), 0);
          const replied = cMetrics.reduce((s, m) => s + (m.replied_count || 0), 0);
          const positive = cMetrics.reduce((s, m) => s + (m.positive_reply_count || 0), 0);

          return {
            id: c.id,
            name: c.name,
            sent,
            replyRate: sent > 0 ? (replied / sent) * 100 : 0,
            positiveRate: sent > 0 ? (positive / sent) * 100 : 0,
          };
        });

        setTopCampaigns(
          campaignMetrics
            .filter(c => c.sent > 0)
            .sort((a, b) => b.positiveRate - a.positiveRate)
            .slice(0, 5)
        );
      }

      // Fetch reply events from both platform tables for time heatmap (use event_timestamp)
      const [smartleadEvents, replyioEvents] = await Promise.all([
        supabase.from('smartlead_message_events').select('event_timestamp').eq('workspace_id', currentWorkspace.id).in('event_type', ['reply', 'replied', 'positive_reply', 'negative_reply']),
        supabase.from('replyio_message_events').select('event_timestamp').eq('workspace_id', currentWorkspace.id).in('event_type', ['reply', 'replied', 'positive_reply', 'negative_reply'])
      ]);

      const replyEvents = [
        ...(smartleadEvents.data || []),
        ...(replyioEvents.data || [])
      ];

      if (replyEvents) {
        const timeMap = new Map<string, number>();
        replyEvents.forEach(e => {
          const d = new Date(e.event_timestamp);
          const key = `${d.getDay()}-${d.getHours()}`;
          timeMap.set(key, (timeMap.get(key) || 0) + 1);
        });

        const timeArr: TimeData[] = [];
        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour++) {
            timeArr.push({
              day,
              hour,
              value: timeMap.get(`${day}-${hour}`) || 0,
            });
          }
        }
        setTimeData(timeArr);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  return { loading, hasData, stats, trendData, topCampaigns, timeData, refetch: fetchDashboardData };
}
