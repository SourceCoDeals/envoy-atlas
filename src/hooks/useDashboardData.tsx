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

  // Memoize date range strings to avoid unnecessary refetches
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
      // Define workspace metrics type for the new table
      interface WorkspaceMetric {
        id: string;
        workspace_id: string;
        metric_date: string;
        sent_count: number | null;
        opened_count: number | null;
        clicked_count: number | null;
        replied_count: number | null;
        bounced_count: number | null;
        positive_reply_count?: number | null;
        unsubscribed_count?: number | null;
      }

      // Fetch workspace-level metrics from BOTH platforms
      let smartleadWorkspaceQuery = supabase
        .from('smartlead_workspace_daily_metrics')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('metric_date', { ascending: true });

      // Query the new Reply.io workspace metrics table (now exists after migration)
      let replyioWorkspaceQuery = supabase
        .from('replyio_workspace_daily_metrics')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('metric_date', { ascending: true });

      // Build queries for campaign-level metrics (for totals and campaign ranking)
      let smartleadQuery = supabase
        .from('smartlead_daily_metrics')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('metric_date', { ascending: true });
      
      let replyioQuery = supabase
        .from('replyio_daily_metrics')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('metric_date', { ascending: true });

      // Apply date range filter if provided
      if (startDateStr) {
        smartleadQuery = smartleadQuery.gte('metric_date', startDateStr);
        replyioQuery = replyioQuery.gte('metric_date', startDateStr);
        smartleadWorkspaceQuery = smartleadWorkspaceQuery.gte('metric_date', startDateStr);
        replyioWorkspaceQuery = replyioWorkspaceQuery.gte('metric_date', startDateStr);
      }
      if (endDateStr) {
        smartleadQuery = smartleadQuery.lte('metric_date', endDateStr);
        replyioQuery = replyioQuery.lte('metric_date', endDateStr);
        smartleadWorkspaceQuery = smartleadWorkspaceQuery.lte('metric_date', endDateStr);
        replyioWorkspaceQuery = replyioWorkspaceQuery.lte('metric_date', endDateStr);
      }

      const [smartleadWorkspace, replyioWorkspace, smartleadMetrics, replyioMetrics] = await Promise.all([
        smartleadWorkspaceQuery,
        replyioWorkspaceQuery,
        smartleadQuery,
        replyioQuery
      ]);

      if (smartleadWorkspace.error) console.warn('SmartLead workspace metrics error:', smartleadWorkspace.error);
      if (replyioWorkspace.error) console.warn('Reply.io workspace metrics error:', replyioWorkspace.error);
      if (smartleadMetrics.error) console.warn('SmartLead campaign metrics error:', smartleadMetrics.error);
      if (replyioMetrics.error) console.warn('Reply.io campaign metrics error:', replyioMetrics.error);

      const campaignMetrics = [...(smartleadMetrics.data || []), ...(replyioMetrics.data || [])];
      const smartleadHistorical = (smartleadWorkspace.data || []) as WorkspaceMetric[];
      const replyioHistorical = (replyioWorkspace.data || []) as WorkspaceMetric[];
      
      // Merge workspace metrics from both platforms by date
      const metricsByDate = new Map<string, WorkspaceMetric>();
      
      // Add SmartLead metrics first
      for (const m of smartleadHistorical) {
        metricsByDate.set(m.metric_date, { ...m });
      }
      
      // Merge Reply.io metrics (add to existing dates or create new entries)
      for (const m of replyioHistorical) {
        const existing = metricsByDate.get(m.metric_date);
        if (existing) {
          existing.sent_count = (existing.sent_count || 0) + (m.sent_count || 0);
          existing.opened_count = (existing.opened_count || 0) + (m.opened_count || 0);
          existing.clicked_count = (existing.clicked_count || 0) + (m.clicked_count || 0);
          existing.replied_count = (existing.replied_count || 0) + (m.replied_count || 0);
          existing.bounced_count = (existing.bounced_count || 0) + (m.bounced_count || 0);
          existing.positive_reply_count = (existing.positive_reply_count || 0) + (m.positive_reply_count || 0);
        } else {
          metricsByDate.set(m.metric_date, { ...m });
        }
      }
      
      // Convert back to sorted array
      const historicalMetrics = Array.from(metricsByDate.values())
        .sort((a, b) => new Date(a.metric_date).getTime() - new Date(b.metric_date).getTime());
      
      console.log(`Dashboard: SmartLead workspace=${smartleadHistorical.length}, Reply.io workspace=${replyioHistorical.length}, merged=${historicalMetrics.length}`);

      // Check if we have any data
      const hasWorkspaceData = historicalMetrics.length > 0;
      const hasCampaignData = campaignMetrics.length > 0;
      
      if (!hasWorkspaceData && !hasCampaignData) {
        setHasData(false);
        setLoading(false);
        return;
      }

      setHasData(true);

      // Calculate totals from campaign-level metrics (more accurate per-campaign data)
      const totals = campaignMetrics.reduce((acc, m) => ({
        sent: acc.sent + (m.sent_count || 0),
        opened: acc.opened + (m.opened_count || 0),
        clicked: acc.clicked + (m.clicked_count || 0),
        replied: acc.replied + (m.replied_count || 0),
        bounced: acc.bounced + (m.bounced_count || 0),
        positive: acc.positive + (m.positive_reply_count || 0),
        spam: 0,
        delivered: 0,
      }), { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, positive: 0, spam: 0, delivered: 0 });

      // If campaign metrics are empty but workspace metrics exist, use workspace metrics for totals
      if (!hasCampaignData && hasWorkspaceData) {
        const workspaceTotals = historicalMetrics.reduce((acc, m) => ({
          sent: acc.sent + (m.sent_count || 0),
          opened: acc.opened + (m.opened_count || 0),
          clicked: acc.clicked + (m.clicked_count || 0),
          replied: acc.replied + (m.replied_count || 0),
          bounced: acc.bounced + (m.bounced_count || 0),
        }), { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 });
        
        totals.sent = workspaceTotals.sent;
        totals.opened = workspaceTotals.opened;
        totals.clicked = workspaceTotals.clicked;
        totals.replied = workspaceTotals.replied;
        totals.bounced = workspaceTotals.bounced;
      }

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

      // Use workspace-level historical metrics for trend data (properly aggregated by date)
      if (hasWorkspaceData) {
        const trend: TrendData[] = historicalMetrics
          .map(m => ({
            date: new Date(m.metric_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            sent: m.sent_count || 0,
            replies: m.replied_count || 0,
            positiveReplies: 0, // Positive replies need classification logic
          }))
          .slice(-30); // Last 30 days for better trend visibility

        setTrendData(trend);
      } else if (hasCampaignData) {
        // Fallback to campaign metrics if workspace metrics don't exist
        const dateMap = new Map<string, { sent: number; replies: number; positive: number }>();
        campaignMetrics.forEach(m => {
          const dateKey = m.metric_date;
          const existing = dateMap.get(dateKey) || { sent: 0, replies: 0, positive: 0 };
          dateMap.set(dateKey, {
            sent: existing.sent + (m.sent_count || 0),
            replies: existing.replies + (m.replied_count || 0),
            positive: existing.positive + (m.positive_reply_count || 0),
          });
        });

        const trend: TrendData[] = Array.from(dateMap.entries())
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .map(([date, data]) => ({
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            sent: data.sent,
            replies: data.replies,
            positiveReplies: data.positive,
          }))
          .slice(-30);

        setTrendData(trend);
      }

      // Fetch campaigns from both platforms for top performers
      const [smartleadCampaigns, replyioCampaigns] = await Promise.all([
        supabase.from('smartlead_campaigns').select('id, name').eq('workspace_id', currentWorkspace.id),
        supabase.from('replyio_campaigns').select('id, name').eq('workspace_id', currentWorkspace.id)
      ]);

      const campaigns = [
        ...(smartleadCampaigns.data || []),
        ...(replyioCampaigns.data || [])
      ];

      if (campaigns.length > 0 && hasCampaignData) {
        const campaignStats = campaigns.map(c => {
          const cMetrics = campaignMetrics.filter(m => m.campaign_id === c.id);
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
          campaignStats
            .filter(c => c.sent > 0)
            .sort((a, b) => b.replyRate - a.replyRate) // Sort by reply rate since positive may be 0
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

      if (replyEvents.length > 0) {
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
  }, [currentWorkspace?.id, startDateStr, endDateStr]);

  return { loading, hasData, stats, trendData, topCampaigns, timeData, refetch: fetchDashboardData };
}
