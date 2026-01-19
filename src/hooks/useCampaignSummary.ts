import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface CampaignSummaryData {
  campaign: {
    id: string;
    name: string;
    status: string;
    platform: string;
    created_at: string;
    engagement_id?: string | null;
  } | null;
  
  metrics: {
    total_sent: number;
    total_delivered: number;
    total_replied: number;
    total_bounced: number;
    total_positive_replies: number;
    delivery_rate: number;
    reply_rate: number;
    bounce_rate: number;
    positive_rate: number;
  };

  infrastructure: {
    inboxes: InboxHealth[];
    domains: DomainHealth[];
    total_daily_capacity: number;
    warmup_count: number;
  };

  bounceAnalysis: {
    hard_bounces: number;
    soft_bounces: number;
    by_reason: { reason: string; count: number; type: 'hard' | 'soft' }[];
    by_domain: { domain: string; count: number; rate: number }[];
    by_inbox: { email: string; count: number; rate: number }[];
  };

  leadBreakdown: {
    total: number;
    by_status: { status: string; count: number }[];
  };

  positiveReplies: {
    count: number;
    rate: number;
    samples: { lead_id: string; snippet: string; timestamp: string }[];
  };

  variants: VariantPerformance[];
  sequenceSteps: SequenceStepPerformance[];
  dailyData: { date: string; sent: number; opened: number; replied: number }[];
}

export interface InboxHealth {
  id: string;
  email: string;
  daily_limit: number;
  health_score: number | null;
  warmup_enabled: boolean;
  is_active: boolean;
  sent_today: number;
}

export interface DomainHealth {
  domain: string;
  spf_valid: boolean | null;
  dkim_valid: boolean | null;
  dmarc_valid: boolean | null;
  inbox_count: number;
  bounce_rate: number;
}

export interface VariantPerformance {
  id: string;
  name: string;
  subject_line: string;
  variant_type: string;
  sent: number;
  replied: number;
  reply_rate: number;
}

export interface SequenceStepPerformance {
  step_number: number;
  step_type: string;
  sent: number;
  replied: number;
  reply_rate: number;
}

const initialMetrics = {
  total_sent: 0,
  total_delivered: 0,
  total_replied: 0,
  total_bounced: 0,
  total_positive_replies: 0,
  delivery_rate: 0,
  reply_rate: 0,
  bounce_rate: 0,
  positive_rate: 0,
};

export function useCampaignSummary(campaignId: string | undefined, platform?: string) {
  const { currentWorkspace } = useWorkspace();
  const [data, setData] = useState<CampaignSummaryData>({
    campaign: null,
    metrics: initialMetrics,
    infrastructure: { inboxes: [], domains: [], total_daily_capacity: 0, warmup_count: 0 },
    bounceAnalysis: { hard_bounces: 0, soft_bounces: 0, by_reason: [], by_domain: [], by_inbox: [] },
    leadBreakdown: { total: 0, by_status: [] },
    positiveReplies: { count: 0, rate: 0, samples: [] },
    variants: [],
    sequenceSteps: [],
    dailyData: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaignSummary = useCallback(async () => {
    if (!currentWorkspace?.id || !campaignId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch campaign from unified campaigns table
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaignData) {
        setData(prev => ({ ...prev, campaign: null }));
        setLoading(false);
        return;
      }

      const campaign = {
        id: campaignData.id,
        name: campaignData.name,
        status: campaignData.status || 'unknown',
        platform: campaignData.campaign_type || 'email',
        created_at: campaignData.created_at || '',
        engagement_id: campaignData.engagement_id || null,
      };

      // 2. Fetch all related data in parallel
      const [
        variantsResult,
        dailyMetricsResult,
        emailActivitiesResult,
        contactsResult,
      ] = await Promise.all([
        supabase.from('campaign_variants').select('*').eq('campaign_id', campaignId),
        supabase.from('daily_metrics').select('*').eq('campaign_id', campaignId),
        supabase.from('email_activities').select('id, bounced, bounce_type, replied, reply_category, reply_text, sent_at, contact_id').eq('campaign_id', campaignId).limit(5000),
        supabase.from('contacts').select('id, email').eq('engagement_id', campaignData.engagement_id).limit(5000),
      ]);

      const variantsData = variantsResult.data || [];
      const dailyMetricsData = dailyMetricsResult.data || [];
      const emailActivities = emailActivitiesResult.data || [];
      const contactsData = contactsResult.data || [];

      // 3. Calculate metrics from campaign data or daily metrics
      let total_sent = campaignData.total_sent || 0;
      let total_replied = campaignData.total_replied || 0;
      let total_bounced = campaignData.total_bounced || 0;
      let total_delivered = campaignData.total_delivered || 0;
      let total_meetings = campaignData.total_meetings || 0;

      // If campaign aggregates are 0, sum from daily_metrics
      if (total_sent === 0 && dailyMetricsData.length > 0) {
        total_sent = dailyMetricsData.reduce((s, m) => s + (m.emails_sent || 0), 0);
        total_replied = dailyMetricsData.reduce((s, m) => s + (m.emails_replied || 0), 0);
        total_bounced = dailyMetricsData.reduce((s, m) => s + (m.emails_bounced || 0), 0);
        total_delivered = dailyMetricsData.reduce((s, m) => s + (m.emails_delivered || 0), 0);
        total_meetings = dailyMetricsData.reduce((s, m) => s + (m.meetings_booked || 0), 0);
      }

      // Get positive replies from daily metrics
      const total_positive_replies = dailyMetricsData.reduce((s, m) => s + (m.positive_replies || 0), 0);

      if (total_delivered === 0) {
        total_delivered = total_sent - total_bounced;
      }

      const metrics = {
        total_sent,
        total_delivered,
        total_replied,
        total_bounced,
        total_positive_replies,
        delivery_rate: total_sent > 0 ? (total_delivered / total_sent) * 100 : 0,
        reply_rate: total_sent > 0 ? (total_replied / total_sent) * 100 : 0,
        bounce_rate: total_sent > 0 ? (total_bounced / total_sent) * 100 : 0,
        positive_rate: total_sent > 0 ? (total_positive_replies / total_sent) * 100 : 0,
      };

      // 4. Build infrastructure data (placeholder - would need data_sources info)
      const infrastructure = {
        inboxes: [] as InboxHealth[],
        domains: [] as DomainHealth[],
        total_daily_capacity: 0,
        warmup_count: 0,
      };

      // 5. Build bounce analysis from email_activities
      const bouncedEmails = emailActivities.filter(e => e.bounced);
      const hard_bounces = bouncedEmails.filter(e => e.bounce_type === 'hard').length;
      const soft_bounces = bouncedEmails.filter(e => e.bounce_type === 'soft').length;

      // Group bounces by domain
      const domainCounts: Record<string, number> = {};
      bouncedEmails.forEach(email => {
        const contact = contactsData.find(c => c.id === email.contact_id);
        const domain = contact?.email?.split('@')[1] || 'unknown';
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      });

      const bounceByDomain = Object.entries(domainCounts)
        .map(([domain, count]) => ({ domain, count, rate: total_sent > 0 ? (count / total_sent) * 100 : 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const bounceAnalysis = {
        hard_bounces,
        soft_bounces,
        by_reason: [
          { reason: 'Invalid email address', count: hard_bounces, type: 'hard' as const },
          { reason: 'Temporary failure', count: soft_bounces, type: 'soft' as const },
        ].filter(r => r.count > 0),
        by_domain: bounceByDomain,
        by_inbox: [],
      };

      // 6. Contact breakdown (using contacts as leads)
      const leadBreakdown = {
        total: contactsData.length,
        by_status: [],
      };

      // 7. Positive replies
      // Positive categories: 'meeting_request' and 'interested' (not 'positive' which is never stored)
      const positiveEmails = emailActivities.filter(e => 
        e.reply_category === 'meeting_request' || 
        e.reply_category === 'interested'
      );
      const positiveReplies = {
        count: total_positive_replies || positiveEmails.length,
        rate: metrics.positive_rate,
        samples: positiveEmails.slice(0, 10).map(e => ({
          lead_id: e.contact_id || '',
          snippet: (e.reply_text || '').slice(0, 150),
          timestamp: e.sent_at || '',
        })),
      };

      // 8. Variants with metrics
      const variants: VariantPerformance[] = variantsData.map(v => {
        const sent = v.total_sent || 0;
        const replied = v.total_replied || 0;
        return {
          id: v.id,
          name: v.subject_line || 'Variant',
          subject_line: v.subject_line || '',
          variant_type: 'email',
          sent,
          replied,
          reply_rate: sent > 0 ? (replied / sent) * 100 : 0,
        };
      }).sort((a, b) => b.reply_rate - a.reply_rate);

      // 9. Sequence steps from variants with step_number
      const sequenceSteps: SequenceStepPerformance[] = variantsData
        .filter(v => v.step_number !== null)
        .map(v => {
          const sent = v.total_sent || 0;
          const replied = v.total_replied || 0;
          return {
            step_number: v.step_number || 1,
            step_type: 'email',
            sent,
            replied,
            reply_rate: sent > 0 ? (replied / sent) * 100 : 0,
          };
        })
        .sort((a, b) => a.step_number - b.step_number);

      // 10. Daily data for chart
      const dailyMap = new Map<string, { sent: number; opened: number; replied: number }>();
      dailyMetricsData.forEach(m => {
        const date = m.date;
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { sent: 0, opened: 0, replied: 0 });
        }
        const d = dailyMap.get(date)!;
        d.sent += m.emails_sent || 0;
        d.opened += m.emails_opened || 0;
        d.replied += m.emails_replied || 0;
      });

      const dailyData = Array.from(dailyMap.entries())
        .map(([date, vals]) => ({ date, ...vals }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setData({
        campaign,
        metrics,
        infrastructure,
        bounceAnalysis,
        leadBreakdown,
        positiveReplies,
        variants,
        sequenceSteps,
        dailyData,
      });
    } catch (err) {
      console.error('Error fetching campaign summary:', err);
      setError('Failed to load campaign summary');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, campaignId, platform]);

  useEffect(() => {
    fetchCampaignSummary();
  }, [fetchCampaignSummary]);

  return { data, loading, error, refetch: fetchCampaignSummary };
}
