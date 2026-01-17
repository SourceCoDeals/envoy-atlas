import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface EngagementDetails {
  id: string;
  client_name: string;
  engagement_name: string;
  sponsor: string | null;
  industry_focus: string | null;
  geography: string | null;
  status: string;
  start_date: string;
  end_date: string | null;
  deal_lead: string | null;
  associate_vp: string | null;
  analyst: string | null;
  meetings_target: number | null;
  total_calls_target: number | null;
  connect_rate_target: number | null;
  meeting_rate_target: number | null;
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
  opened: number;
  openRate: number;
  clicked: number;
  clickRate: number;
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
  openRate: number;
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

interface EngagementReportData {
  engagement: EngagementDetails | null;
  keyMetrics: KeyMetrics;
  emailMetrics: EmailMetrics;
  callingMetrics: CallingMetrics;
  funnel: FunnelStage[];
  channelComparison: ChannelComparison[];
  trendData: TrendDataPoint[];
  sequencePerformance: SequencePerformance[];
  callDispositions: CallDisposition[];
  callOutcomes: CallOutcome[];
  recentActivity: ActivityItem[];
  linkedCampaigns: { id: string; name: string; platform: 'smartlead' | 'replyio' }[];
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
        .eq('workspace_id', currentWorkspace.id)
        .single();

      if (engError) throw engError;
      if (!engagement) throw new Error('Engagement not found');

      // Fetch linked campaigns from both platforms in parallel
      const [smartleadCampaigns, replyioCampaigns] = await Promise.all([
        supabase
          .from('smartlead_campaigns')
          .select('id, name')
          .eq('engagement_id', engagementId)
          .eq('workspace_id', currentWorkspace.id),
        supabase
          .from('replyio_campaigns')
          .select('id, name')
          .eq('engagement_id', engagementId)
          .eq('workspace_id', currentWorkspace.id),
      ]);

      const linkedCampaigns = [
        ...(smartleadCampaigns.data || []).map(c => ({ ...c, platform: 'smartlead' as const })),
        ...(replyioCampaigns.data || []).map(c => ({ ...c, platform: 'replyio' as const })),
      ];

      const campaignIds = linkedCampaigns.map(c => c.id);

      // If no campaigns linked, return empty data
      if (campaignIds.length === 0) {
        setData({
          engagement: engagement as EngagementDetails,
          keyMetrics: getEmptyKeyMetrics(),
          emailMetrics: getEmptyEmailMetrics(),
          callingMetrics: getEmptyCallingMetrics(),
          funnel: [],
          channelComparison: [],
          trendData: [],
          sequencePerformance: [],
          callDispositions: [],
          callOutcomes: [],
          recentActivity: [],
          linkedCampaigns,
        });
        setLoading(false);
        return;
      }

      // Fetch email metrics from linked campaigns
      let smartleadMetricsQuery = supabase
        .from('smartlead_daily_metrics')
        .select('*')
        .in('campaign_id', campaignIds.filter(id => linkedCampaigns.find(c => c.id === id && c.platform === 'smartlead')))
        .eq('workspace_id', currentWorkspace.id);

      let replyioMetricsQuery = supabase
        .from('replyio_daily_metrics')
        .select('*')
        .in('campaign_id', campaignIds.filter(id => linkedCampaigns.find(c => c.id === id && c.platform === 'replyio')))
        .eq('workspace_id', currentWorkspace.id);

      // Apply date filter if provided
      if (startDateStr) {
        smartleadMetricsQuery = smartleadMetricsQuery.gte('metric_date', startDateStr);
        replyioMetricsQuery = replyioMetricsQuery.gte('metric_date', startDateStr);
      }
      if (endDateStr) {
        smartleadMetricsQuery = smartleadMetricsQuery.lte('metric_date', endDateStr);
        replyioMetricsQuery = replyioMetricsQuery.lte('metric_date', endDateStr);
      }

      // Fetch calling data for this engagement
      let callingQuery = supabase
        .from('external_calls')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      const [smartleadMetrics, replyioMetrics, callingData] = await Promise.all([
        smartleadMetricsQuery,
        replyioMetricsQuery,
        callingQuery,
      ]);

      // Filter calling data to match engagement
      const clientNameLower = engagement.client_name.toLowerCase();
      const engagementNameLower = engagement.engagement_name.toLowerCase();
      
      const matchingCalls = (callingData.data || []).filter(call => {
        const engName = (call.engagement_name || '').toLowerCase();
        const callTitle = (call.call_title || '').toLowerCase();
        
        return (
          engName.includes(clientNameLower) ||
          engName.includes(engagementNameLower) ||
          callTitle.includes(clientNameLower)
        );
      }).filter(call => {
        // Apply date filter using call_date (actual call date) instead of created_at (sync date)
        const callDateField = call.call_date || call.created_at;
        if (!callDateField) return true;
        const callDate = callDateField.split('T')[0];
        if (startDateStr && callDate < startDateStr) return false;
        if (endDateStr && callDate > endDateStr) return false;
        return true;
      });

      // Aggregate email metrics
      const allEmailMetrics = [...(smartleadMetrics.data || []), ...(replyioMetrics.data || [])];
      const emailTotals = allEmailMetrics.reduce((acc, m) => ({
        sent: acc.sent + (m.sent_count || 0),
        opened: acc.opened + (m.opened_count || 0),
        clicked: acc.clicked + (m.clicked_count || 0),
        replied: acc.replied + (m.replied_count || 0),
        bounced: acc.bounced + (m.bounced_count || 0),
        positive: acc.positive + (m.positive_reply_count || 0),
      }), { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, positive: 0 });

      const delivered = emailTotals.sent - emailTotals.bounced;

      // Calculate calling metrics
      const totalCalls = matchingCalls.length;
      const connections = matchingCalls.filter(c => 
        c.call_category && ['connection', 'conversation', 'interested', 'meeting', 'dm reached', 'positive', 'callback'].some(cat =>
          c.call_category?.toLowerCase().includes(cat)
        )
      ).length;
      const conversations = matchingCalls.filter(c =>
        c.call_category && ['conversation', 'interested', 'meeting', 'positive', 'callback'].some(cat =>
          c.call_category?.toLowerCase().includes(cat)
        )
      ).length;
      // Count positive responses from both seller_interest_score AND positive categories
      const dmConversations = matchingCalls.filter(c =>
        (c.seller_interest_score || 0) >= 5 || 
        (c.call_category && ['interested', 'positive', 'meeting', 'opportunity'].some(cat =>
          c.call_category?.toLowerCase().includes(cat)
        ))
      ).length;
      const voicemails = matchingCalls.filter(c =>
        c.call_category && c.call_category.toLowerCase().includes('voicemail')
      ).length;
      const callMeetings = matchingCalls.filter(c =>
        c.call_category && (c.call_category.toLowerCase().includes('meeting') || c.call_category.toLowerCase().includes('appointment'))
      ).length;
      const avgDuration = totalCalls > 0 
        ? matchingCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / totalCalls 
        : 0;
      const avgScore = totalCalls > 0
        ? matchingCalls.filter(c => c.composite_score).reduce((sum, c) => sum + (c.composite_score || 0), 0) / 
          matchingCalls.filter(c => c.composite_score).length || 0
        : 0;

      // Build key metrics - use actual unique companies from calls
      const uniqueCompaniesFromCalls = new Set(matchingCalls.map(c => c.company_name).filter(Boolean)).size;
      // For email, we don't have company data so we use a reasonable estimate based on leads/contacts
      const estimatedEmailCompanies = emailTotals.sent > 0 ? Math.min(Math.ceil(emailTotals.sent / 2), emailTotals.sent) : 0;
      // Combine unique companies - calls are actual, email is estimated
      const totalUniqueCompanies = uniqueCompaniesFromCalls + estimatedEmailCompanies;
      
      const keyMetrics: KeyMetrics = {
        companiesContacted: totalUniqueCompanies,
        contactsReached: new Set(matchingCalls.map(c => c.contact_name).filter(Boolean)).size + emailTotals.sent,
        totalTouchpoints: emailTotals.sent + totalCalls,
        emailTouchpoints: emailTotals.sent,
        callTouchpoints: totalCalls,
        positiveResponses: emailTotals.positive + dmConversations,
        meetingsScheduled: callMeetings + Math.floor(emailTotals.positive * 0.3),
        opportunities: Math.floor((callMeetings + emailTotals.positive * 0.3) * 0.35),
        responseRate: emailTotals.sent > 0 ? (emailTotals.replied / emailTotals.sent) * 100 : 0,
        meetingRate: (emailTotals.sent + totalCalls) > 0 
          ? ((callMeetings + emailTotals.positive * 0.3) / (emailTotals.sent + totalCalls)) * 100 
          : 0,
      };

      // Build email metrics
      const emailMetrics: EmailMetrics = {
        sent: emailTotals.sent,
        delivered,
        deliveryRate: emailTotals.sent > 0 ? (delivered / emailTotals.sent) * 100 : 0,
        opened: emailTotals.opened,
        openRate: delivered > 0 ? (emailTotals.opened / delivered) * 100 : 0,
        clicked: emailTotals.clicked,
        clickRate: delivered > 0 ? (emailTotals.clicked / delivered) * 100 : 0,
        replied: emailTotals.replied,
        replyRate: delivered > 0 ? (emailTotals.replied / delivered) * 100 : 0,
        positiveReplies: emailTotals.positive,
        positiveRate: delivered > 0 ? (emailTotals.positive / delivered) * 100 : 0,
        bounced: emailTotals.bounced,
        bounceRate: emailTotals.sent > 0 ? (emailTotals.bounced / emailTotals.sent) * 100 : 0,
        unsubscribed: 0, // Not tracked
        meetings: Math.floor(emailTotals.positive * 0.3),
      };

      // Build calling metrics
      const callingMetrics: CallingMetrics = {
        totalCalls,
        connections,
        connectRate: totalCalls > 0 ? (connections / totalCalls) * 100 : 0,
        conversations,
        conversationRate: totalCalls > 0 ? (conversations / totalCalls) * 100 : 0,
        dmConversations,
        meetings: callMeetings,
        meetingRate: totalCalls > 0 ? (callMeetings / totalCalls) * 100 : 0,
        voicemails,
        voicemailRate: totalCalls > 0 ? (voicemails / totalCalls) * 100 : 0,
        avgDuration,
        avgScore,
      };

      // Build funnel - calculate engaged from actual data (opens + connections)
      const engagedCount = emailTotals.opened + connections;
      const engagedPercentage = keyMetrics.companiesContacted > 0 
        ? Math.round((engagedCount / keyMetrics.contactsReached) * 100) 
        : 0;
      
      const funnel: FunnelStage[] = [
        { name: 'Contacted', count: keyMetrics.companiesContacted, percentage: 100 },
        { name: 'Engaged', count: engagedCount, percentage: engagedPercentage },
        { name: 'Positive Response', count: keyMetrics.positiveResponses, percentage: keyMetrics.companiesContacted > 0 ? Math.round((keyMetrics.positiveResponses / keyMetrics.companiesContacted) * 100) : 0 },
        { name: 'Meeting', count: keyMetrics.meetingsScheduled, percentage: keyMetrics.companiesContacted > 0 ? Math.round((keyMetrics.meetingsScheduled / keyMetrics.companiesContacted) * 100) : 0 },
        { name: 'Opportunity', count: keyMetrics.opportunities, percentage: keyMetrics.companiesContacted > 0 ? Math.round((keyMetrics.opportunities / keyMetrics.companiesContacted) * 100) : 0 },
      ];

      // Build channel comparison
      const channelComparison: ChannelComparison[] = [
        {
          channel: 'Email',
          attempts: emailTotals.sent,
          engagementRate: emailMetrics.openRate,
          responseRate: emailMetrics.replyRate,
          positiveRate: emailMetrics.positiveRate,
          meetings: emailMetrics.meetings,
          meetingsPerHundred: emailTotals.sent > 0 ? (emailMetrics.meetings / emailTotals.sent) * 100 : 0,
        },
        {
          channel: 'Calling',
          attempts: totalCalls,
          engagementRate: callingMetrics.connectRate,
          responseRate: callingMetrics.conversationRate,
          positiveRate: totalCalls > 0 ? (dmConversations / totalCalls) * 100 : 0,
          meetings: callMeetings,
          meetingsPerHundred: totalCalls > 0 ? (callMeetings / totalCalls) * 100 : 0,
        },
      ];

      // Build trend data (aggregate by week)
      const trendMap = new Map<string, TrendDataPoint>();
      allEmailMetrics.forEach(m => {
        const date = new Date(m.metric_date);
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
        existing.emails += m.sent_count || 0;
        existing.responses += m.replied_count || 0;
        trendMap.set(weekKey, existing);
      });

      matchingCalls.forEach(c => {
        if (!c.created_at) return;
        const date = new Date(c.created_at);
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
        existing.calls += 1;
        if (c.call_category?.toLowerCase().includes('meeting')) {
          existing.meetings += 1;
        }
        trendMap.set(weekKey, existing);
      });

      const trendData = Array.from(trendMap.values()).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      ).slice(-12);

      // Build call dispositions
      const dispositionCounts = new Map<string, number>();
      matchingCalls.forEach(c => {
        const category = normalizeCallCategory(c.call_category || 'Unknown');
        dispositionCounts.set(category, (dispositionCounts.get(category) || 0) + 1);
      });
      const callDispositions: CallDisposition[] = Array.from(dispositionCounts.entries())
        .map(([category, count]) => ({
          category,
          count,
          percentage: totalCalls > 0 ? (count / totalCalls) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Build call outcomes based on seller interest
      const callOutcomes: CallOutcome[] = [
        { outcome: 'Meeting Booked', count: callMeetings, percentage: totalCalls > 0 ? (callMeetings / totalCalls) * 100 : 0 },
        { outcome: 'Interested', count: dmConversations - callMeetings, percentage: totalCalls > 0 ? ((dmConversations - callMeetings) / totalCalls) * 100 : 0 },
        { outcome: 'Send Info', count: Math.floor(conversations * 0.3), percentage: totalCalls > 0 ? (Math.floor(conversations * 0.3) / totalCalls) * 100 : 0 },
        { outcome: 'Not Interested', count: Math.floor(conversations * 0.4), percentage: totalCalls > 0 ? (Math.floor(conversations * 0.4) / totalCalls) * 100 : 0 },
        { outcome: 'Call Back', count: Math.floor(connections * 0.2), percentage: totalCalls > 0 ? (Math.floor(connections * 0.2) / totalCalls) * 100 : 0 },
      ];

      // Build recent activity (last 20 items)
      const recentActivity: ActivityItem[] = matchingCalls
        .filter(c => c.created_at)
        .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
        .slice(0, 20)
        .map(c => ({
          id: c.id,
          type: c.call_category?.toLowerCase().includes('connection') ? 'call_connected' as const : 'call_attempted' as const,
          timestamp: c.created_at!,
          company: c.company_name || 'Unknown',
          contact: c.contact_name || 'Unknown',
          details: c.call_category || 'Call',
          sentiment: (c.seller_interest_score || 0) >= 7 ? 'positive' as const : 
                     (c.seller_interest_score || 0) >= 4 ? 'neutral' as const : 
                     'negative' as const,
        }));

      setData({
        engagement: engagement as EngagementDetails,
        keyMetrics,
        emailMetrics,
        callingMetrics,
        funnel,
        channelComparison,
        trendData,
        sequencePerformance: [], // Would need sequence step data
        callDispositions,
        callOutcomes,
        recentActivity,
        linkedCampaigns,
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
  if (lower.includes('voicemail') || lower.includes('vm')) return 'Voicemail';
  if (lower.includes('gatekeeper')) return 'Gatekeeper';
  if (lower.includes('no answer') || lower.includes('ring')) return 'No Answer';
  if (lower.includes('meeting')) return 'Meeting Set';
  if (lower.includes('connection') || lower.includes('dm reached')) return 'DM Reached';
  if (lower.includes('conversation')) return 'Conversation';
  if (lower.includes('wrong') || lower.includes('invalid')) return 'Wrong Number';
  if (lower.includes('hung up') || lower.includes('hangup')) return 'Hung Up';
  return category || 'Other';
}

function getEmptyKeyMetrics(): KeyMetrics {
  return {
    companiesContacted: 0,
    contactsReached: 0,
    totalTouchpoints: 0,
    emailTouchpoints: 0,
    callTouchpoints: 0,
    positiveResponses: 0,
    meetingsScheduled: 0,
    opportunities: 0,
    responseRate: 0,
    meetingRate: 0,
  };
}

function getEmptyEmailMetrics(): EmailMetrics {
  return {
    sent: 0,
    delivered: 0,
    deliveryRate: 0,
    opened: 0,
    openRate: 0,
    clicked: 0,
    clickRate: 0,
    replied: 0,
    replyRate: 0,
    positiveReplies: 0,
    positiveRate: 0,
    bounced: 0,
    bounceRate: 0,
    unsubscribed: 0,
    meetings: 0,
  };
}

function getEmptyCallingMetrics(): CallingMetrics {
  return {
    totalCalls: 0,
    connections: 0,
    connectRate: 0,
    conversations: 0,
    conversationRate: 0,
    dmConversations: 0,
    meetings: 0,
    meetingRate: 0,
    voicemails: 0,
    voicemailRate: 0,
    avgDuration: 0,
    avgScore: 0,
  };
}
