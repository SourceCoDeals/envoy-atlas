import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { startOfWeek, format, parseISO } from 'date-fns';
import { calculateRate } from '@/lib/metrics';

export interface EngagementDetails {
  id: string;
  name: string;
  client_id: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  meeting_goal: number | null;
  target_list_size: number | null;
}

export interface KeyMetrics {
  companiesContacted: number;
  contactsReached: number;
  totalTouchpoints: number;
  emailTouchpoints: number;
  callTouchpoints: number;
  positiveResponses: number;
  meetingsScheduled: number;
  opportunities: number;
  responseRate: number;
  meetingRate: number;
}

export interface EmailMetrics {
  sent: number;
  delivered: number;
  deliveryRate: number;
  replied: number;
  replyRate: number;
  positiveReplies: number;
  positiveRate: number;
  bounced: number;
  bounceRate: number;
  unsubscribed: number;
  meetings: number;
}

export interface CallingMetrics {
  totalCalls: number;
  connections: number;
  connectRate: number;
  conversations: number;
  conversationRate: number;
  dmConversations: number;
  meetings: number;
  meetingRate: number;
  voicemails: number;
  voicemailRate: number;
  avgDuration: number;
  avgScore: number;
}

export interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
}

export interface ChannelComparison {
  channel: string;
  attempts: number;
  engagementRate: number;
  responseRate: number;
  positiveRate: number;
  meetings: number;
  meetingsPerHundred: number;
}

export interface TrendDataPoint {
  date: string;
  week: string;
  emails: number;
  calls: number;
  responses: number;
  meetings: number;
}

export interface WeeklyPerformance {
  weekLabel: string;
  weekStart: string;
  sent: number;
  replied: number;
  positiveReplies: number;
  bounced: number;
}

export interface SequencePerformance {
  id: string;
  name: string;
  step: number;
  stepName: string;
  sent: number;
  replyRate: number;
  positiveReplies: number;
}

export interface CallDisposition {
  category: string;
  count: number;
  percentage: number;
}

export interface CallOutcome {
  outcome: string;
  count: number;
  percentage: number;
}

export interface ActivityItem {
  id: string;
  type: 'email_sent' | 'email_opened' | 'email_replied' | 'call_attempted' | 'call_connected' | 'meeting_scheduled';
  timestamp: string;
  company: string;
  contact: string;
  details: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface DateRange {
  startDate: Date | null;
  endDate: Date;
}

export interface DomainBreakdown {
  domain: string;
  mailboxCount: number;
  dailyCapacity: number;
  spfValid: boolean | null;
  dkimValid: boolean | null;
  dmarcValid: boolean | null;
  bounceRate: number;
  healthScore: number;
  warmupCount: number;
}

export interface InfrastructureMetrics {
  totalDomains: number;
  totalMailboxes: number;
  activeMailboxes: number;
  totalDailyCapacity: number;
  currentDailySending: number;
  utilizationRate: number;
  warmupCount: number;
  domainsWithFullAuth: number;
  avgHealthScore: number;
  avgBounceRate: number;
  domainBreakdown: DomainBreakdown[];
}

// New enrollment tracking interfaces
export interface EnrollmentMetrics {
  totalLeads: number;
  notStarted: number;  // This is the BACKLOG
  inProgress: number;
  completed: number;
  blocked: number;
  backlogRate: number; // notStarted / totalLeads * 100
}

export interface WeeklyEnrollmentTrend {
  weekStart: string;
  weekLabel: string;
  newLeadsEnrolled: number;
  cumulativeTotal: number;
  backlog: number;
}

interface DataAvailability {
  emailDailyMetrics: boolean;
  emailCampaignFallback: boolean;
  /** True when the selected date range has no rows, but the engagement has older daily_metrics. */
  hasHistoricalEmailMetrics: boolean;
  historicalEmailMinDate: string | null;
  historicalEmailMaxDate: string | null;
  /** True when we are showing weekly data generated from campaign totals (synthetic rows). */
  isEstimated: boolean;
  callingData: boolean;
  infrastructureData: boolean;
  syncInProgress: boolean;
  /** NEW: True when we have NocoDB snapshot data for this engagement's campaigns */
  hasSnapshotData: boolean;
  snapshotDateRange: { min: string; max: string } | null;
  /** NEW: Data source type for transparency */
  dataSource: 'snapshots' | 'daily_metrics' | 'campaign_totals' | 'estimated';
}

export interface LinkedCampaignWithStats {
  id: string;
  name: string;
  platform: string;
  status: string | null;
  enrolled: number;
  sent: number;
  replied: number;
  replyRate: number;
  positiveReplies: number;
  positiveRate: number;
}

interface EngagementReportData {
  engagement: EngagementDetails | null;
  keyMetrics: KeyMetrics;
  emailMetrics: EmailMetrics;
  callingMetrics: CallingMetrics;
  infrastructureMetrics: InfrastructureMetrics;
  enrollmentMetrics: EnrollmentMetrics;
  weeklyEnrollmentTrend: WeeklyEnrollmentTrend[];
  weeklyPerformance: WeeklyPerformance[];
  funnel: FunnelStage[];
  channelComparison: ChannelComparison[];
  trendData: TrendDataPoint[];
  sequencePerformance: SequencePerformance[];
  callDispositions: CallDisposition[];
  callOutcomes: CallOutcome[];
  recentActivity: ActivityItem[];
  linkedCampaignsWithStats: LinkedCampaignWithStats[];
  linkedCampaigns: { id: string; name: string; platform: string }[];
  dataAvailability: DataAvailability;
}

export function useEngagementReport(engagementId: string, dateRange?: DateRange) {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EngagementReportData | null>(null);

  const startDateStr = dateRange?.startDate?.toISOString().split('T')[0] ?? null;
  const endDateStr = dateRange?.endDate?.toISOString().split('T')[0] ?? null;

  useEffect(() => {
    if (currentWorkspace?.id && engagementId) {
      fetchReportData();
    }
  }, [currentWorkspace?.id, engagementId, startDateStr, endDateStr]);

  const fetchReportData = async () => {
    if (!currentWorkspace?.id || !engagementId) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch engagement details
      const { data: engagement, error: engError } = await supabase
        .from('engagements')
        .select('*')
        .eq('id', engagementId)
        .single();

      if (engError) throw engError;
      if (!engagement) throw new Error('Engagement not found');

      // Fetch linked campaigns from unified campaigns table with stats and settings
      // Include external_id for snapshot joining
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, campaign_type, status, total_sent, total_replied, total_bounced, reply_rate, positive_replies, positive_rate, settings, external_id')
        .eq('engagement_id', engagementId)
        .order('total_sent', { ascending: false });

      // Fetch campaign variants for sequence performance
      const campaignIds = (campaigns || []).map(c => c.id);
      const externalCampaignIds = (campaigns || []).map(c => c.external_id).filter(Boolean) as string[];
      
      let variantsData: any[] = [];
      if (campaignIds.length > 0) {
        const { data: variants } = await supabase
          .from('campaign_variants')
          .select('id, campaign_id, subject_line, step_number, total_sent, total_replied, positive_replies, reply_rate')
          .in('campaign_id', campaignIds);
        variantsData = variants || [];
      }
      
      // Fetch NocoDB snapshots for linked campaigns via external_id
      let snapshotData: any[] = [];
      if (externalCampaignIds.length > 0) {
        let snapshotQuery = supabase
          .from('nocodb_campaign_daily_snapshots')
          .select('*')
          .in('campaign_id', externalCampaignIds)
          .order('snapshot_date', { ascending: true });
        
        if (startDateStr) snapshotQuery = snapshotQuery.gte('snapshot_date', startDateStr);
        if (endDateStr) snapshotQuery = snapshotQuery.lte('snapshot_date', endDateStr);
        
        const { data: snapshots } = await snapshotQuery;
        snapshotData = snapshots || [];
      }

      const linkedCampaigns = (campaigns || []).map(c => ({ 
        id: c.id, 
        name: c.name, 
        platform: c.campaign_type 
      }));

      const linkedCampaignsWithStats: LinkedCampaignWithStats[] = (campaigns || []).map(c => {
        const settings = c.settings as Record<string, number> | null;
        return {
          id: c.id,
          name: c.name,
          platform: c.campaign_type,
          status: c.status,
          enrolled: settings?.total_leads || c.total_sent || 0,
          sent: c.total_sent || 0,
          replied: c.total_replied || 0,
          replyRate: c.reply_rate || 0,
          positiveReplies: c.positive_replies || 0,
          positiveRate: c.positive_rate || 0,
        };
      });

      // Fetch enrollment snapshots for weekly trend
      const { data: enrollmentSnapshots } = await supabase
        .from('enrollment_snapshots')
        .select('*')
        .eq('engagement_id', engagementId)
        .order('date', { ascending: true });

      // Fetch daily metrics for email data
      let dailyMetricsQuery = supabase
        .from('daily_metrics')
        .select('*')
        .eq('engagement_id', engagementId);

      if (startDateStr) dailyMetricsQuery = dailyMetricsQuery.gte('date', startDateStr);
      if (endDateStr) dailyMetricsQuery = dailyMetricsQuery.lte('date', endDateStr);

      // Fetch call activities
      let callsQuery = supabase
        .from('call_activities')
        .select('*')
        .eq('engagement_id', engagementId);

      if (startDateStr) callsQuery = callsQuery.gte('started_at', startDateStr);
      if (endDateStr) callsQuery = callsQuery.lte('started_at', endDateStr);

      // Fetch meetings
      const meetingsQuery = supabase
        .from('meetings')
        .select('*')
        .eq('engagement_id', engagementId);

      // Fetch email accounts for infrastructure metrics
      const emailAccountsQuery = supabase
        .from('email_accounts')
        .select('*')
        .eq('engagement_id', engagementId);

      // Fetch contacts for enrollment trend fallback
      const contactsQuery = supabase
        .from('contacts')
        .select('id, enrolled_at, current_step, finish_reason')
        .eq('engagement_id', engagementId);

      const [dailyMetricsResult, callsResult, meetingsResult, emailAccountsResult, contactsResult] = await Promise.all([
        dailyMetricsQuery,
        callsQuery,
        meetingsQuery,
        emailAccountsQuery,
        contactsQuery,
      ]);

      const dailyMetrics = dailyMetricsResult.data || [];
      const calls = callsResult.data || [];
      const meetings = meetingsResult.data || [];
      const emailAccounts = emailAccountsResult.data || [];
      const contacts = contactsResult.data || [];

      // If the selected date range returns no rows, detect whether this engagement has
      // older daily metrics so the UI can suggest switching to "All time".
      let hasHistoricalEmailMetrics = false;
      let historicalEmailMinDate: string | null = null;
      let historicalEmailMaxDate: string | null = null;
      let allHistoricalDailyMetrics: typeof dailyMetrics = [];

      if (startDateStr && dailyMetrics.length === 0) {
        const [minRes, maxRes, allHistoricalRes] = await Promise.all([
          supabase
            .from('daily_metrics')
            .select('date')
            .eq('engagement_id', engagementId)
            .order('date', { ascending: true })
            .limit(1),
          supabase
            .from('daily_metrics')
            .select('date')
            .eq('engagement_id', engagementId)
            .order('date', { ascending: false })
            .limit(1),
          supabase
            .from('daily_metrics')
            .select('*')
            .eq('engagement_id', engagementId)
            .order('date', { ascending: true }),
        ]);

        historicalEmailMinDate = (minRes.data?.[0]?.date as string | undefined) ?? null;
        historicalEmailMaxDate = (maxRes.data?.[0]?.date as string | undefined) ?? null;
        hasHistoricalEmailMetrics = Boolean(historicalEmailMinDate || historicalEmailMaxDate);
        allHistoricalDailyMetrics = allHistoricalRes.data || [];
      }
      
      // For weekly performance, use all historical data if date filter returns empty
      const metricsForWeeklyBreakdown = dailyMetrics.length > 0 ? dailyMetrics : allHistoricalDailyMetrics;

      // Calculate email metrics from daily_metrics first
      const dailyTotals = dailyMetrics.reduce((acc, m) => ({
        sent: acc.sent + (m.emails_sent || 0),
        delivered: acc.delivered + (m.emails_delivered || 0),
        replied: acc.replied + (m.emails_replied || 0),
        bounced: acc.bounced + (m.emails_bounced || 0),
        positive: acc.positive + (m.positive_replies || 0),
      }), { sent: 0, delivered: 0, replied: 0, bounced: 0, positive: 0 });

      // Calculate campaign totals as fallback (sum across all linked campaigns)
      const campaignTotals = (campaigns || []).reduce((acc, c) => ({
        sent: acc.sent + (c.total_sent || 0),
        replied: acc.replied + (c.total_replied || 0),
        positive: acc.positive + (c.positive_replies || 0),
        bounced: acc.bounced + ((c as any).total_bounced || 0),
      }), { sent: 0, replied: 0, positive: 0, bounced: 0 });

      // If we have *no* daily metrics in the selected range but campaign totals exist,
      // treat this as a campaign fallback and surface All-Time totals instead of 0s.
      const isCampaignFallbackInRange = Boolean(startDateStr && dailyTotals.sent === 0 && campaignTotals.sent > 0);

      const allTimeEmailTotals = {
        sent: campaignTotals.sent,
        replied: campaignTotals.replied,
        positive: campaignTotals.positive,
        bounced: campaignTotals.bounced,
        delivered: Math.max(0, campaignTotals.sent - campaignTotals.bounced),
      };

      const rangeEmailTotals = {
        sent: dailyTotals.sent,
        replied: dailyTotals.replied,
        positive: dailyTotals.positive,
        bounced: dailyTotals.bounced,
        delivered: Math.max(0, dailyTotals.delivered || (dailyTotals.sent - dailyTotals.bounced)),
      };

      const finalEmailTotals = startDateStr
        ? (isCampaignFallbackInRange ? allTimeEmailTotals : rangeEmailTotals)
        : allTimeEmailTotals;

      const delivered = finalEmailTotals.delivered;

      // Calculate calling metrics
      const totalCalls = calls.length;
      const connections = calls.filter(c => 
        (c.talk_duration || 0) > 60 || 
        c.disposition?.toLowerCase().includes('connect')
      ).length;
      const conversations = calls.filter(c => (c.talk_duration || 0) >= 180).length;
      const voicemails = calls.filter(c => c.voicemail_left).length;
      const callMeetings = calls.filter(c =>
        c.conversation_outcome?.toLowerCase().includes('meeting')
      ).length;
      const avgDuration = totalCalls > 0 
        ? calls.reduce((sum, c) => sum + (c.talk_duration || 0), 0) / totalCalls 
        : 0;

      // Build key metrics
      const uniqueCompanies = new Set(calls.map(c => c.company_id).filter(Boolean)).size;
      const uniqueContacts = new Set(calls.map(c => c.contact_id).filter(Boolean)).size;
      const meetingsBooked = meetings.length;

      const keyMetrics: KeyMetrics = {
        companiesContacted: uniqueCompanies,
        contactsReached: uniqueContacts + finalEmailTotals.replied,
        totalTouchpoints: finalEmailTotals.sent + totalCalls,
        emailTouchpoints: finalEmailTotals.sent,
        callTouchpoints: totalCalls,
        positiveResponses: finalEmailTotals.positive + conversations,
        meetingsScheduled: meetingsBooked,
        opportunities: 0,
        responseRate: calculateRate(finalEmailTotals.replied, finalEmailTotals.sent),
        meetingRate: calculateRate(meetingsBooked, finalEmailTotals.sent + totalCalls),
      };

      // Build email metrics - use delivered as denominator for engagement rates
      const emailMetrics: EmailMetrics = {
        sent: finalEmailTotals.sent,
        delivered,
        deliveryRate: calculateRate(delivered, finalEmailTotals.sent),
        replied: finalEmailTotals.replied,
        replyRate: calculateRate(finalEmailTotals.replied, delivered),
        positiveReplies: finalEmailTotals.positive,
        positiveRate: calculateRate(finalEmailTotals.positive, delivered),
        bounced: finalEmailTotals.bounced,
        bounceRate: calculateRate(finalEmailTotals.bounced, finalEmailTotals.sent), // Bounce rate uses sent
        unsubscribed: 0,
        meetings: 0,
      };

      // Build calling metrics
      const callingMetrics: CallingMetrics = {
        totalCalls,
        connections,
        connectRate: calculateRate(connections, totalCalls),
        conversations,
        conversationRate: calculateRate(conversations, totalCalls),
        dmConversations: conversations,
        meetings: callMeetings,
        meetingRate: calculateRate(callMeetings, totalCalls),
        voicemails,
        voicemailRate: calculateRate(voicemails, totalCalls),
        avgDuration,
        avgScore: 0,
      };

      // Build funnel
      const funnel: FunnelStage[] = [
        { name: 'Contacted', count: keyMetrics.companiesContacted, percentage: 100 },
        { name: 'Engaged', count: finalEmailTotals.replied + connections, percentage: Math.round(calculateRate(finalEmailTotals.replied + connections, keyMetrics.companiesContacted)) },
        { name: 'Positive Response', count: keyMetrics.positiveResponses, percentage: Math.round(calculateRate(keyMetrics.positiveResponses, keyMetrics.companiesContacted)) },
        { name: 'Meeting', count: meetingsBooked, percentage: Math.round(calculateRate(meetingsBooked, keyMetrics.companiesContacted)) },
        { name: 'Opportunity', count: 0, percentage: 0 },
      ];

      // Build channel comparison
      const channelComparison: ChannelComparison[] = [
        {
          channel: 'Email',
          attempts: finalEmailTotals.sent,
          engagementRate: emailMetrics.replyRate, // Use reply rate instead of open rate
          responseRate: emailMetrics.replyRate,
          positiveRate: emailMetrics.positiveRate,
          meetings: 0,
          meetingsPerHundred: 0,
        },
        {
          channel: 'Calling',
          attempts: totalCalls,
          engagementRate: callingMetrics.connectRate,
          responseRate: callingMetrics.conversationRate,
          positiveRate: calculateRate(conversations, totalCalls),
          meetings: callMeetings,
          meetingsPerHundred: calculateRate(callMeetings, totalCalls),
        },
      ];

      // Build trend data from filtered daily metrics
      // Use Monday-based weeks for consistency
      const trendMap = new Map<string, TrendDataPoint>();
      
      dailyMetrics.forEach(m => {
        const date = new Date(m.date);
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        const weekLabel = `Week of ${format(weekStart, 'MMM d')}`;
        
        // Build trend data
        const existing = trendMap.get(weekKey) || {
          date: weekKey,
          week: weekLabel,
          emails: 0,
          calls: 0,
          responses: 0,
          meetings: 0,
        };
        existing.emails += m.emails_sent || 0;
        existing.calls += m.calls_made || 0;
        existing.responses += m.emails_replied || 0;
        existing.meetings += m.meetings_booked || 0;
        trendMap.set(weekKey, existing);
      });
      
      // Build weekly performance data from metricsForWeeklyBreakdown (includes historical data if current filter is empty)
      // Use Monday-based weeks for consistency with backfill-daily-metrics
      const weeklyPerfMap = new Map<string, { sent: number; replied: number; positive: number; bounced: number; weekLabel: string }>();
      
      metricsForWeeklyBreakdown.forEach(m => {
        const date = new Date(m.date);
        // Use startOfWeek with Monday as start (weekStartsOn: 1)
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        const weekLabel = `Week of ${format(weekStart, 'MMM d')}`;
        
        const existingPerf = weeklyPerfMap.get(weekKey) || {
          sent: 0,
          replied: 0,
          positive: 0,
          bounced: 0,
          weekLabel,
        };
        existingPerf.sent += m.emails_sent || 0;
        existingPerf.replied += m.emails_replied || 0;
        existingPerf.positive += m.positive_replies || 0;
        existingPerf.bounced += m.emails_bounced || 0;
        weeklyPerfMap.set(weekKey, existingPerf);
      });

      const trendData = Array.from(trendMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-12);

      // Build weekly performance array
      const weeklyPerformance: WeeklyPerformance[] = Array.from(weeklyPerfMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekStart, data]) => ({
          weekStart,
          weekLabel: data.weekLabel,
          sent: data.sent,
          replied: data.replied,
          positiveReplies: data.positive,
          bounced: data.bounced,
        }));

      // Build call dispositions
      const dispositionCounts = new Map<string, number>();
      calls.forEach(c => {
        const category = normalizeCallCategory(c.disposition || 'Unknown');
        dispositionCounts.set(category, (dispositionCounts.get(category) || 0) + 1);
      });
      const callDispositions: CallDisposition[] = Array.from(dispositionCounts.entries())
        .map(([category, count]) => ({
          category,
          count,
          percentage: calculateRate(count, totalCalls),
        }))
        .sort((a, b) => b.count - a.count);

      // Build call outcomes
      const callOutcomes: CallOutcome[] = [
        { outcome: 'Meeting Booked', count: callMeetings, percentage: calculateRate(callMeetings, totalCalls) },
        { outcome: 'Interested', count: conversations - callMeetings, percentage: calculateRate(conversations - callMeetings, totalCalls) },
        { outcome: 'Not Interested', count: 0, percentage: 0 },
        { outcome: 'Call Back', count: calls.filter(c => c.callback_scheduled).length, percentage: 0 },
      ];

      // Build recent activity
      const recentActivity: ActivityItem[] = calls
        .filter(c => c.started_at)
        .sort((a, b) => new Date(b.started_at!).getTime() - new Date(a.started_at!).getTime())
        .slice(0, 20)
        .map(c => ({
          id: c.id,
          type: (c.talk_duration || 0) > 60 ? 'call_connected' as const : 'call_attempted' as const,
          timestamp: c.started_at!,
          company: c.to_name || 'Unknown',
          contact: c.to_name || 'Unknown',
          details: c.disposition || 'Call',
          sentiment: (c.talk_duration || 0) >= 180 ? 'positive' as const : 
                     (c.talk_duration || 0) >= 60 ? 'neutral' as const : 
                     'negative' as const,
        }));

      // Infrastructure metrics - calculated from email_accounts
      const domainMap = new Map<string, {
        mailboxCount: number;
        dailyCapacity: number;
        currentSending: number;
        warmupCount: number;
        activeCount: number;
        spfValid: boolean | null;
        dkimValid: boolean | null;
        dmarcValid: boolean | null;
        healthScores: number[];
        bounceRates: number[];
      }>();

      emailAccounts.forEach((account: any) => {
        const email = account.from_email || '';
        const domain = email.split('@')[1] || 'unknown';
        
        const existing = domainMap.get(domain) || {
          mailboxCount: 0,
          dailyCapacity: 0,
          currentSending: 0,
          warmupCount: 0,
          activeCount: 0,
          spfValid: null,
          dkimValid: null,
          dmarcValid: null,
          healthScores: [],
          bounceRates: [],
        };

        existing.mailboxCount += 1;
        existing.dailyCapacity += account.message_per_day || 0;
        existing.currentSending += account.daily_sent_count || 0;
        if (account.warmup_enabled) existing.warmupCount += 1;
        if (account.is_active) existing.activeCount += 1;
        if (account.warmup_reputation !== null) existing.healthScores.push(account.warmup_reputation);
        
        domainMap.set(domain, existing);
      });

      const domainBreakdown: DomainBreakdown[] = Array.from(domainMap.entries())
        .map(([domain, data]) => ({
          domain,
          mailboxCount: data.mailboxCount,
          dailyCapacity: data.dailyCapacity,
          spfValid: data.spfValid,
          dkimValid: data.dkimValid,
          dmarcValid: data.dmarcValid,
          bounceRate: data.bounceRates.length > 0 
            ? data.bounceRates.reduce((a, b) => a + b, 0) / data.bounceRates.length 
            : 0,
          healthScore: data.healthScores.length > 0 
            ? data.healthScores.reduce((a, b) => a + b, 0) / data.healthScores.length 
            : 0,
          warmupCount: data.warmupCount,
        }))
        .sort((a, b) => b.mailboxCount - a.mailboxCount);

      const totalMailboxes = emailAccounts.length;
      const activeMailboxes = emailAccounts.filter((a: any) => a.is_active).length;
      const totalDailyCapacity = emailAccounts.reduce((sum: number, a: any) => sum + (a.message_per_day || 0), 0);
      const currentDailySending = emailAccounts.reduce((sum: number, a: any) => sum + (a.daily_sent_count || 0), 0);
      const warmupCount = emailAccounts.filter((a: any) => a.warmup_enabled).length;
      const allHealthScores = emailAccounts
        .filter((a: any) => a.warmup_reputation !== null)
        .map((a: any) => a.warmup_reputation);

      const infrastructureMetrics: InfrastructureMetrics = {
        totalDomains: domainMap.size,
        totalMailboxes,
        activeMailboxes,
        totalDailyCapacity,
        currentDailySending,
        utilizationRate: calculateRate(currentDailySending, totalDailyCapacity),
        warmupCount,
        domainsWithFullAuth: domainBreakdown.filter(d => d.spfValid && d.dkimValid && d.dmarcValid).length,
        avgHealthScore: allHealthScores.length > 0 
          ? allHealthScores.reduce((a: number, b: number) => a + b, 0) / allHealthScores.length 
          : 0,
        avgBounceRate: 0,
        domainBreakdown,
      };

      // Calculate enrollment metrics - use contacts as primary source, campaign settings as fallback
      const contactsCount = contacts.length;
      const contactsNotStarted = contacts.filter((c: any) => !c.current_step || c.current_step === 0).length;
      const contactsCompleted = contacts.filter((c: any) => c.finish_reason === 'completed' || c.finish_reason === 'replied').length;
      const contactsInProgress = contacts.filter((c: any) => 
        c.current_step && c.current_step > 0 && !c.finish_reason
      ).length;
      const contactsBlocked = contacts.filter((c: any) => 
        c.finish_reason === 'bounced' || c.finish_reason === 'unsubscribed'
      ).length;

      // Fallback to campaign settings if no contacts
      const campaignEnrollment = (campaigns || []).reduce((acc, c) => {
        const settings = c.settings as Record<string, number> | null;
        return {
          totalLeads: acc.totalLeads + (settings?.total_leads || 0),
          notStarted: acc.notStarted + (settings?.not_started || 0),
          inProgress: acc.inProgress + (settings?.in_progress || 0),
          completed: acc.completed + (settings?.completed || 0),
          blocked: acc.blocked + (settings?.blocked || 0),
        };
      }, { totalLeads: 0, notStarted: 0, inProgress: 0, completed: 0, blocked: 0 });

      const useContactsData = contactsCount > 0;
      const enrollmentMetrics: EnrollmentMetrics = {
        totalLeads: useContactsData ? contactsCount : campaignEnrollment.totalLeads,
        notStarted: useContactsData ? contactsNotStarted : campaignEnrollment.notStarted,
        inProgress: useContactsData ? contactsInProgress : campaignEnrollment.inProgress,
        completed: useContactsData ? contactsCompleted : campaignEnrollment.completed,
        blocked: useContactsData ? contactsBlocked : campaignEnrollment.blocked,
        backlogRate: (useContactsData ? contactsCount : campaignEnrollment.totalLeads) > 0 
          ? ((useContactsData ? contactsNotStarted : campaignEnrollment.notStarted) / 
             (useContactsData ? contactsCount : campaignEnrollment.totalLeads)) * 100 
          : 0,
      };

      // Calculate weekly enrollment trends - use contacts.enrolled_at as primary source
      const weeklyEnrollmentTrend: WeeklyEnrollmentTrend[] = [];
      
      // Build from contacts.enrolled_at
      if (contacts.length > 0) {
        const weeklyContactsMap = new Map<string, number>();
        
        contacts.forEach((c: any) => {
          if (c.enrolled_at) {
            const enrolledDate = parseISO(c.enrolled_at);
            const weekStart = startOfWeek(enrolledDate, { weekStartsOn: 1 });
            const weekKey = format(weekStart, 'yyyy-MM-dd');
            weeklyContactsMap.set(weekKey, (weeklyContactsMap.get(weekKey) || 0) + 1);
          }
        });

        const sortedWeeks = Array.from(weeklyContactsMap.entries())
          .sort(([a], [b]) => a.localeCompare(b));

        let cumulativeTotal = 0;
        sortedWeeks.forEach(([weekKey, count]) => {
          cumulativeTotal += count;
          const weekStart = parseISO(weekKey);
          weeklyEnrollmentTrend.push({
            weekStart: weekKey,
            weekLabel: `Week of ${format(weekStart, 'MMM d')}`,
            newLeadsEnrolled: count,
            cumulativeTotal,
            backlog: 0, // Can't calculate historical backlog from current data
          });
        });
      } else if ((enrollmentSnapshots || []).length > 0) {
        // Fallback to snapshots
        const snapshots = enrollmentSnapshots || [];
        const weeklyMap = new Map<string, { total: number; backlog: number; date: string }>();
        
        snapshots.forEach((s: any) => {
          const snapshotDate = parseISO(s.date);
          const weekStart = startOfWeek(snapshotDate, { weekStartsOn: 1 });
          const weekKey = format(weekStart, 'yyyy-MM-dd');
          
          const existing = weeklyMap.get(weekKey);
          weeklyMap.set(weekKey, {
            total: (existing?.total || 0) + (s.total_leads || 0),
            backlog: (existing?.backlog || 0) + (s.not_started || 0),
            date: weekKey,
          });
        });

        const sortedWeeks = Array.from(weeklyMap.entries())
          .sort(([a], [b]) => a.localeCompare(b));

        let previousTotal = 0;
        sortedWeeks.forEach(([weekKey, data], index) => {
          const weekStart = parseISO(weekKey);
          const newLeads = index === 0 ? data.total : Math.max(0, data.total - previousTotal);
          
          weeklyEnrollmentTrend.push({
            weekStart: weekKey,
            weekLabel: `Week of ${format(weekStart, 'MMM d')}`,
            newLeadsEnrolled: newLeads,
            cumulativeTotal: data.total,
            backlog: data.backlog,
          });
          
          previousTotal = data.total;
        });
      }

      const isEstimated = (metricsForWeeklyBreakdown as any[]).some((m) => Boolean(m.is_estimated));

      setData({
        engagement: engagement as EngagementDetails,
        keyMetrics,
        emailMetrics,
        callingMetrics,
        infrastructureMetrics,
        enrollmentMetrics,
        weeklyEnrollmentTrend,
        weeklyPerformance,
        funnel,
        channelComparison,
        trendData,
        sequencePerformance: variantsData.map((v: any) => ({
          id: v.id,
          name: v.subject_line || `Step ${v.step_number || 1}`,
          step: v.step_number || 1,
          stepName: `Step ${v.step_number || 1}`,
          sent: v.total_sent || 0,
          replyRate: v.reply_rate || calculateRate(v.total_replied || 0, v.total_sent || 0),
          positiveReplies: v.positive_replies || 0,
        })).sort((a: any, b: any) => a.step - b.step),
        callDispositions,
        callOutcomes,
        recentActivity,
        linkedCampaignsWithStats,
        linkedCampaigns,
        dataAvailability: {
          emailDailyMetrics: dailyMetrics.length > 0,
          emailCampaignFallback: (campaigns || []).some(c => (c.total_sent || 0) > 0),
          hasHistoricalEmailMetrics,
          historicalEmailMinDate,
          historicalEmailMaxDate,
          isEstimated,
          callingData: calls.length > 0,
          infrastructureData: emailAccounts.length > 0,
          syncInProgress: false,
          hasSnapshotData: snapshotData.length > 0,
          snapshotDateRange: snapshotData.length > 0 
            ? {
                min: snapshotData[0]?.snapshot_date || '',
                max: snapshotData[snapshotData.length - 1]?.snapshot_date || '',
              }
            : null,
          dataSource: snapshotData.length > 0 
            ? 'snapshots' 
            : isEstimated 
              ? 'estimated' 
              : dailyMetrics.length > 0 
                ? 'daily_metrics' 
                : 'campaign_totals',
        },
      });

    } catch (err) {
      console.error('Error fetching engagement report:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch: fetchReportData };
}

function normalizeCallCategory(category: string): string {
  const lower = category.toLowerCase();
  const normalized = lower.replace(/\s*-\s*\d+\s*seconds?/i, '').trim();
  
  if (normalized.includes('voicemail') || normalized.includes('vm')) return 'Voicemail';
  if (normalized.includes('gatekeeper')) return 'Gatekeeper';
  if (normalized.includes('no answer') || normalized.includes('ring')) return 'No Answer';
  if (normalized.includes('meeting')) return 'Meeting Set';
  if (normalized.includes('connection') || normalized.includes('dm reached')) return 'DM Reached';
  if (normalized.includes('conversation')) return 'Conversation';
  if (normalized.includes('wrong') || normalized.includes('invalid')) return 'Wrong Number';
  if (normalized.includes('hung up') || normalized.includes('hangup')) return 'Hung Up';
  if (normalized.includes('positive') || normalized.includes('interested')) return 'Positive/Interested';
  if (normalized.includes('callback') || normalized.includes('call back')) return 'Callback Requested';
  if (normalized.includes('not interested') || normalized.includes('dnc')) return 'Not Interested';
  if (normalized.includes('busy')) return 'Busy';
  return category ? category.split(' - ')[0].trim() : 'Other';
}
