import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

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

interface DataAvailability {
  emailDailyMetrics: boolean;
  emailCampaignFallback: boolean;
  callingData: boolean;
  infrastructureData: boolean;
  syncInProgress: boolean;
}

export interface LinkedCampaignWithStats {
  id: string;
  name: string;
  platform: string;
  status: string | null;
  sent: number;
  replyRate: number;
}

interface EngagementReportData {
  engagement: EngagementDetails | null;
  keyMetrics: KeyMetrics;
  emailMetrics: EmailMetrics;
  callingMetrics: CallingMetrics;
  infrastructureMetrics: InfrastructureMetrics;
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

      // Fetch linked campaigns from unified campaigns table with stats
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, campaign_type, status, total_sent, reply_rate')
        .eq('engagement_id', engagementId)
        .order('total_sent', { ascending: false });

      const linkedCampaigns = (campaigns || []).map(c => ({ 
        id: c.id, 
        name: c.name, 
        platform: c.campaign_type 
      }));

      const linkedCampaignsWithStats: LinkedCampaignWithStats[] = (campaigns || []).map(c => ({
        id: c.id,
        name: c.name,
        platform: c.campaign_type,
        status: c.status,
        sent: c.total_sent || 0,
        replyRate: c.reply_rate || 0,
      }));

      const campaignIds = linkedCampaigns.map(c => c.id);

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

      const [dailyMetricsResult, callsResult, meetingsResult] = await Promise.all([
        dailyMetricsQuery,
        callsQuery,
        meetingsQuery,
      ]);

      const dailyMetrics = dailyMetricsResult.data || [];
      const calls = callsResult.data || [];
      const meetings = meetingsResult.data || [];

      // Calculate email metrics from daily_metrics
      const emailTotals = dailyMetrics.reduce((acc, m) => ({
        sent: acc.sent + (m.emails_sent || 0),
        delivered: acc.delivered + (m.emails_delivered || 0),
        replied: acc.replied + (m.emails_replied || 0),
        bounced: acc.bounced + (m.emails_bounced || 0),
        positive: acc.positive + (m.positive_replies || 0),
      }), { sent: 0, delivered: 0, replied: 0, bounced: 0, positive: 0 });

      const delivered = emailTotals.delivered || (emailTotals.sent - emailTotals.bounced);

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
        contactsReached: uniqueContacts + emailTotals.replied,
        totalTouchpoints: emailTotals.sent + totalCalls,
        emailTouchpoints: emailTotals.sent,
        callTouchpoints: totalCalls,
        positiveResponses: emailTotals.positive + conversations,
        meetingsScheduled: meetingsBooked,
        opportunities: 0,
        responseRate: emailTotals.sent > 0 ? (emailTotals.replied / emailTotals.sent) * 100 : 0,
        meetingRate: (emailTotals.sent + totalCalls) > 0 
          ? (meetingsBooked / (emailTotals.sent + totalCalls)) * 100 
          : 0,
      };

      // Build email metrics
      const emailMetrics: EmailMetrics = {
        sent: emailTotals.sent,
        delivered,
        deliveryRate: emailTotals.sent > 0 ? (delivered / emailTotals.sent) * 100 : 0,
        replied: emailTotals.replied,
        replyRate: delivered > 0 ? (emailTotals.replied / delivered) * 100 : 0,
        positiveReplies: emailTotals.positive,
        positiveRate: delivered > 0 ? (emailTotals.positive / delivered) * 100 : 0,
        bounced: emailTotals.bounced,
        bounceRate: emailTotals.sent > 0 ? (emailTotals.bounced / emailTotals.sent) * 100 : 0,
        unsubscribed: 0,
        meetings: 0,
      };

      // Build calling metrics
      const callingMetrics: CallingMetrics = {
        totalCalls,
        connections,
        connectRate: totalCalls > 0 ? (connections / totalCalls) * 100 : 0,
        conversations,
        conversationRate: totalCalls > 0 ? (conversations / totalCalls) * 100 : 0,
        dmConversations: conversations,
        meetings: callMeetings,
        meetingRate: totalCalls > 0 ? (callMeetings / totalCalls) * 100 : 0,
        voicemails,
        voicemailRate: totalCalls > 0 ? (voicemails / totalCalls) * 100 : 0,
        avgDuration,
        avgScore: 0,
      };

      // Build funnel
      const funnel: FunnelStage[] = [
        { name: 'Contacted', count: keyMetrics.companiesContacted, percentage: 100 },
        { name: 'Engaged', count: emailTotals.replied + connections, percentage: keyMetrics.companiesContacted > 0 ? Math.round(((emailTotals.replied + connections) / keyMetrics.companiesContacted) * 100) : 0 },
        { name: 'Positive Response', count: keyMetrics.positiveResponses, percentage: keyMetrics.companiesContacted > 0 ? Math.round((keyMetrics.positiveResponses / keyMetrics.companiesContacted) * 100) : 0 },
        { name: 'Meeting', count: meetingsBooked, percentage: keyMetrics.companiesContacted > 0 ? Math.round((meetingsBooked / keyMetrics.companiesContacted) * 100) : 0 },
        { name: 'Opportunity', count: 0, percentage: 0 },
      ];

      // Build channel comparison
      const channelComparison: ChannelComparison[] = [
        {
          channel: 'Email',
          attempts: emailTotals.sent,
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
          positiveRate: totalCalls > 0 ? (conversations / totalCalls) * 100 : 0,
          meetings: callMeetings,
          meetingsPerHundred: totalCalls > 0 ? (callMeetings / totalCalls) * 100 : 0,
        },
      ];

      // Build trend data
      const trendMap = new Map<string, TrendDataPoint>();
      dailyMetrics.forEach(m => {
        const date = new Date(m.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        const existing = trendMap.get(weekKey) || {
          date: weekKey,
          week: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
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

      const trendData = Array.from(trendMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-12);

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
          percentage: totalCalls > 0 ? (count / totalCalls) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Build call outcomes
      const callOutcomes: CallOutcome[] = [
        { outcome: 'Meeting Booked', count: callMeetings, percentage: totalCalls > 0 ? (callMeetings / totalCalls) * 100 : 0 },
        { outcome: 'Interested', count: conversations - callMeetings, percentage: totalCalls > 0 ? ((conversations - callMeetings) / totalCalls) * 100 : 0 },
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

      // Infrastructure metrics - simplified since we don't have email_accounts/sending_domains tables
      const infrastructureMetrics: InfrastructureMetrics = {
        totalDomains: 0,
        totalMailboxes: 0,
        activeMailboxes: 0,
        totalDailyCapacity: 0,
        currentDailySending: 0,
        utilizationRate: 0,
        warmupCount: 0,
        domainsWithFullAuth: 0,
        avgHealthScore: 0,
        avgBounceRate: 0,
        domainBreakdown: [],
      };

      setData({
        engagement: engagement as EngagementDetails,
        keyMetrics,
        emailMetrics,
        callingMetrics,
        infrastructureMetrics,
        funnel,
        channelComparison,
        trendData,
        sequencePerformance: [],
        callDispositions,
        callOutcomes,
        recentActivity,
        linkedCampaignsWithStats,
        linkedCampaigns,
        dataAvailability: {
          emailDailyMetrics: dailyMetrics.length > 0,
          emailCampaignFallback: false,
          callingData: calls.length > 0,
          infrastructureData: false,
          syncInProgress: false,
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
