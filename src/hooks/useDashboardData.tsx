import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { calculateRate } from '@/lib/metrics';

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
  platform?: 'smartlead' | 'replyio';
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

      // Fetch NocoDB campaigns as primary data source (global - not workspace filtered yet)
      const [smartleadRes, replyioRes] = await Promise.all([
        supabase
          .from('nocodb_smartlead_campaigns')
          .select('campaign_id, campaign_name, status, total_emails_sent, total_replies, leads_interested')
          .order('total_emails_sent', { ascending: false }),
        supabase
          .from('nocodb_replyio_campaigns')
          .select('campaign_id, campaign_name, status, deliveries, bounces, replies')
          .order('deliveries', { ascending: false }),
      ]);

      const smartleadData = smartleadRes.data || [];
      const replyioData = replyioRes.data || [];

      // Calculate NocoDB totals
      const nocodbTotals = {
        sent: 0,
        delivered: 0,
        bounced: 0,
        replied: 0,
        positive: 0,
      };

      // SmartLead totals
      smartleadData.forEach(row => {
        const sent = row.total_emails_sent || 0;
        nocodbTotals.sent += sent;
        nocodbTotals.delivered += sent; // No bounce data in SmartLead
        nocodbTotals.replied += row.total_replies || 0;
        nocodbTotals.positive += row.leads_interested || 0;
      });

      // Reply.io totals
      replyioData.forEach(row => {
        const delivered = row.deliveries || 0;
        const bounced = row.bounces || 0;
        nocodbTotals.sent += delivered + bounced;
        nocodbTotals.delivered += delivered;
        nocodbTotals.bounced += bounced;
        nocodbTotals.replied += row.replies || 0;
      });

      // Try to get workspace-specific daily metrics if we have engagements
      let hasWorkspaceData = false;
      let workspaceTotals = { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, positive: 0 };

      if (engagementIds.length > 0) {
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

        const { data: metricsData } = await metricsQuery;
        const metrics = metricsData || [];

        if (metrics.length > 0) {
          hasWorkspaceData = true;
          
          // Aggregate metrics by date for trends
          const metricsByDate = new Map<string, {
            sent: number; opened: number; clicked: number; replied: number; bounced: number; positive: number;
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

          // Calculate workspace totals
          metricsByDate.forEach(m => {
            workspaceTotals.sent += m.sent;
            workspaceTotals.opened += m.opened;
            workspaceTotals.clicked += m.clicked;
            workspaceTotals.replied += m.replied;
            workspaceTotals.bounced += m.bounced;
            workspaceTotals.positive += m.positive;
          });

          // Build trend data from workspace metrics
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
        }
      }

      // Determine which data source to use for stats
      // Priority: workspace daily_metrics > NocoDB global
      const usedTotals = hasWorkspaceData ? workspaceTotals : {
        sent: nocodbTotals.sent,
        opened: 0, // NocoDB doesn't have opens
        clicked: 0,
        replied: nocodbTotals.replied,
        bounced: nocodbTotals.bounced,
        positive: nocodbTotals.positive,
      };

      const delivered = usedTotals.sent - usedTotals.bounced;

      if (usedTotals.sent > 0 || nocodbTotals.sent > 0) {
        setHasData(true);
        setStats({
          totalSent: usedTotals.sent || nocodbTotals.sent,
          totalOpened: usedTotals.opened,
          totalClicked: usedTotals.clicked,
          totalReplied: usedTotals.replied || nocodbTotals.replied,
          totalBounced: usedTotals.bounced || nocodbTotals.bounced,
          totalPositive: usedTotals.positive || nocodbTotals.positive,
          totalSpam: 0,
          totalDelivered: delivered || nocodbTotals.delivered,
          openRate: calculateRate(usedTotals.opened, delivered),
          clickRate: calculateRate(usedTotals.clicked, delivered),
          replyRate: calculateRate(usedTotals.replied || nocodbTotals.replied, delivered || nocodbTotals.delivered),
          bounceRate: calculateRate(usedTotals.bounced || nocodbTotals.bounced, usedTotals.sent || nocodbTotals.sent),
          positiveRate: calculateRate(usedTotals.positive || nocodbTotals.positive, delivered || nocodbTotals.delivered),
          spamRate: 0,
          deliveredRate: calculateRate(delivered || nocodbTotals.delivered, usedTotals.sent || nocodbTotals.sent),
        });
      } else {
        setHasData(false);
      }

      // Build top campaigns from NocoDB data
      const nocodbCampaigns: TopCampaign[] = [];

      smartleadData.forEach(row => {
        const sent = row.total_emails_sent || 0;
        if (sent > 0) {
          nocodbCampaigns.push({
            id: row.campaign_id,
            name: row.campaign_name,
            sent,
            replyRate: calculateRate(row.total_replies || 0, sent),
            positiveRate: calculateRate(row.leads_interested || 0, sent),
            platform: 'smartlead',
          });
        }
      });

      replyioData.forEach(row => {
        const delivered = row.deliveries || 0;
        if (delivered > 0) {
          nocodbCampaigns.push({
            id: row.campaign_id,
            name: row.campaign_name,
            sent: delivered + (row.bounces || 0),
            replyRate: calculateRate(row.replies || 0, delivered),
            positiveRate: 0, // Reply.io doesn't have positive flag
            platform: 'replyio',
          });
        }
      });

      // Sort by reply rate and take top 5
      nocodbCampaigns.sort((a, b) => b.replyRate - a.replyRate);
      setTopCampaigns(nocodbCampaigns.slice(0, 5));

      // Fetch hourly metrics for time heatmap (workspace specific)
      if (engagementIds.length > 0) {
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
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, startDateStr, endDateStr]);

  return { loading, hasData, stats, trendData, topCampaigns, timeData, refetch: fetchDashboardData };
}
