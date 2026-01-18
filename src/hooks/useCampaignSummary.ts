import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface CampaignSummaryData {
  campaign: {
    id: string;
    name: string;
    status: string;
    platform: 'smartlead' | 'replyio';
    created_at: string;
    engagement_id?: string | null;
  } | null;
  
  metrics: {
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_clicked: number;
    total_replied: number;
    total_bounced: number;
    total_positive_replies: number;
    delivery_rate: number;
    open_rate: number;
    click_rate: number;
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
  opened: number;
  clicked: number;
  replied: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
}

export interface SequenceStepPerformance {
  step_number: number;
  step_type: string;
  sent: number;
  opened: number;
  replied: number;
  open_rate: number;
  reply_rate: number;
}

const initialMetrics = {
  total_sent: 0,
  total_delivered: 0,
  total_opened: 0,
  total_clicked: 0,
  total_replied: 0,
  total_bounced: 0,
  total_positive_replies: 0,
  delivery_rate: 0,
  open_rate: 0,
  click_rate: 0,
  reply_rate: 0,
  bounce_rate: 0,
  positive_rate: 0,
};

export function useCampaignSummary(campaignId: string | undefined, platform?: 'smartlead' | 'replyio') {
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
      // 1. Find campaign based on platform hint or fallback to searching both
      let campaignData = null;
      let detectedPlatform: 'smartlead' | 'replyio' = platform || 'smartlead';

      if (platform === 'smartlead' || !platform) {
        const { data: slCampaign } = await supabase
          .from('smartlead_campaigns')
          .select('*')
          .eq('id', campaignId)
          .eq('workspace_id', currentWorkspace.id)
          .single();

        if (slCampaign) {
          campaignData = slCampaign;
          detectedPlatform = 'smartlead';
        }
      }

      if (!campaignData && (platform === 'replyio' || !platform)) {
        const { data: rioCampaign } = await supabase
          .from('replyio_campaigns')
          .select('*')
          .eq('id', campaignId)
          .eq('workspace_id', currentWorkspace.id)
          .single();

        if (rioCampaign) {
          campaignData = rioCampaign;
          detectedPlatform = 'replyio';
        }
      }

      if (!campaignData) {
        setData(prev => ({ ...prev, campaign: null }));
        setLoading(false);
        return;
      }

      const campaign = {
        id: campaignData.id,
        name: campaignData.name,
        status: campaignData.status || 'unknown',
        platform: detectedPlatform,
        created_at: campaignData.created_at,
        engagement_id: campaignData.engagement_id || null,
      };

      // 2. Fetch all data in parallel
      const metricsTable = detectedPlatform === 'smartlead' ? 'smartlead_daily_metrics' : 'replyio_daily_metrics';
      const variantsTable = detectedPlatform === 'smartlead' ? 'smartlead_variants' : 'replyio_variants';
      const eventsTable = detectedPlatform === 'smartlead' ? 'smartlead_message_events' : 'replyio_message_events';
      const stepsTable = detectedPlatform === 'smartlead' ? 'smartlead_sequence_steps' : 'replyio_sequence_steps';

      const [
        metricsResult,
        variantsResult,
        bounceEventsResult,
        positiveEventsResult,
        emailAccountsResult,
        sendingDomainsResult,
        leadsResult,
        stepsResult,
      ] = await Promise.all([
        supabase.from(metricsTable).select('*').eq('campaign_id', campaignId),
        supabase.from(variantsTable).select('*').eq('campaign_id', campaignId),
        supabase.from(eventsTable).select('*').eq('campaign_id', campaignId).in('event_type', ['bounce', 'hard_bounce', 'soft_bounce']),
        supabase.from(eventsTable).select('*').eq('campaign_id', campaignId).eq('event_type', 'positive_reply').limit(10),
        supabase.from('email_accounts').select('*').eq('workspace_id', currentWorkspace.id),
        supabase.from('sending_domains').select('*').eq('workspace_id', currentWorkspace.id),
        supabase.from('leads').select('id, status, email').eq('campaign_id', campaignId).limit(5000),
        supabase.from(stepsTable).select('*').eq('campaign_id', campaignId).order('step_number'),
      ]);

      const metricsData = metricsResult.data || [];
      const variantsData = variantsResult.data || [];
      const bounceEvents = bounceEventsResult.data || [];
      const positiveEvents = positiveEventsResult.data || [];
      const emailAccounts = emailAccountsResult.data || [];
      const sendingDomains = sendingDomainsResult.data || [];
      const leadsData = leadsResult.data || [];
      const stepsData = stepsResult.data || [];

      // 3. Calculate metrics from daily_metrics
      let total_sent = metricsData.reduce((s, m) => s + (m.sent_count || 0), 0);
      let total_opened = metricsData.reduce((s, m) => s + (m.opened_count || 0), 0);
      let total_clicked = metricsData.reduce((s, m) => s + (m.clicked_count || 0), 0);
      let total_replied = metricsData.reduce((s, m) => s + (m.replied_count || 0), 0);
      let total_bounced = metricsData.reduce((s, m) => s + (m.bounced_count || 0), 0);
      let total_positive_replies = metricsData.reduce((s, m) => s + (m.positive_reply_count || 0), 0);

      // ==============================================================
      // FALLBACK: If daily metrics have 0 sent, check cumulative table
      // ==============================================================
      if (total_sent === 0) {
        const cumulativeTable = detectedPlatform === 'smartlead' ? 'smartlead_campaign_cumulative' : 'replyio_campaign_cumulative';
        const { data: cumulative } = await supabase
          .from(cumulativeTable)
          .select('*')
          .eq('campaign_id', campaignId)
          .single();
        
        if (cumulative && (cumulative.total_sent || 0) > 0) {
          console.log(`CampaignSummary: Using cumulative fallback for campaign ${campaignId}`);
          total_sent = cumulative.total_sent || 0;
          total_opened = cumulative.total_opened || 0;
          total_clicked = cumulative.total_clicked || 0;
          total_replied = cumulative.total_replied || 0;
          total_bounced = cumulative.total_bounced || 0;
          total_positive_replies = cumulative.total_interested || 0;
        }
      }
      
      // ==============================================================
      // FALLBACK #2: If still 0, use lead count as sent proxy
      // ==============================================================
      if (total_sent === 0 && leadsData.length > 0) {
        console.log(`CampaignSummary: Using lead count (${leadsData.length}) as sent proxy`);
        total_sent = leadsData.length;
      }

      const total_delivered = total_sent - total_bounced;

      const metrics = {
        total_sent,
        total_delivered,
        total_opened,
        total_clicked,
        total_replied,
        total_bounced,
        total_positive_replies,
        delivery_rate: total_sent > 0 ? (total_delivered / total_sent) * 100 : 0,
        open_rate: total_sent > 0 ? (total_opened / total_sent) * 100 : 0,
        click_rate: total_sent > 0 ? (total_clicked / total_sent) * 100 : 0,
        reply_rate: total_sent > 0 ? (total_replied / total_sent) * 100 : 0,
        bounce_rate: total_sent > 0 ? (total_bounced / total_sent) * 100 : 0,
        positive_rate: total_sent > 0 ? (total_positive_replies / total_sent) * 100 : 0,
      };

      // 4. Build infrastructure data from email_accounts
      const inboxes: InboxHealth[] = emailAccounts.slice(0, 50).map(acc => ({
        id: acc.id,
        email: acc.email_address,
        daily_limit: acc.daily_limit || 50,
        health_score: acc.health_score,
        warmup_enabled: acc.warmup_enabled || false,
        is_active: acc.is_active,
        sent_today: 0,
      }));

      // Extract domains and map to sending_domains
      const domainMap = new Map<string, DomainHealth>();
      inboxes.forEach(inbox => {
        const domain = inbox.email.split('@')[1];
        if (domain && !domainMap.has(domain)) {
          const domainRecord = sendingDomains.find(d => d.domain === domain);
          domainMap.set(domain, {
            domain,
            spf_valid: domainRecord?.spf_valid ?? null,
            dkim_valid: domainRecord?.dkim_valid ?? null,
            dmarc_valid: domainRecord?.dmarc_valid ?? null,
            inbox_count: 0,
            bounce_rate: 0,
          });
        }
        if (domain) {
          const existing = domainMap.get(domain)!;
          existing.inbox_count++;
        }
      });

      const infrastructure = {
        inboxes,
        domains: Array.from(domainMap.values()),
        total_daily_capacity: inboxes.reduce((s, i) => s + i.daily_limit, 0),
        warmup_count: inboxes.filter(i => i.warmup_enabled).length,
      };

      // 5. Build bounce analysis from events (using available fields)
      let hard_bounces = 0;
      let soft_bounces = 0;

      bounceEvents.forEach(evt => {
        const isHard = evt.event_type === 'hard_bounce' || evt.event_type === 'bounce';
        if (isHard) hard_bounces++;
        else soft_bounces++;
      });

      // Group bounces by lead to get domain distribution
      const leadIds = bounceEvents.map(e => e.lead_id).filter(Boolean) as string[];
      let bounceByDomain: { domain: string; count: number; rate: number }[] = [];
      
      if (leadIds.length > 0) {
        // Get lead emails to extract domains
        const { data: bouncedLeads } = await supabase
          .from('leads')
          .select('id, email')
          .in('id', leadIds.slice(0, 100));
        
        if (bouncedLeads) {
          const domainCounts: Record<string, number> = {};
          bouncedLeads.forEach(lead => {
            const domain = lead.email?.split('@')[1] || 'unknown';
            domainCounts[domain] = (domainCounts[domain] || 0) + 1;
          });
          bounceByDomain = Object.entries(domainCounts)
            .map(([domain, count]) => ({ domain, count, rate: total_sent > 0 ? (count / total_sent) * 100 : 0 }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        }
      }

      const bounceAnalysis = {
        hard_bounces,
        soft_bounces,
        by_reason: [
          { reason: 'Invalid email address', count: hard_bounces, type: 'hard' as const },
          { reason: 'Temporary failure', count: soft_bounces, type: 'soft' as const },
        ].filter(r => r.count > 0),
        by_domain: bounceByDomain,
        by_inbox: [], // Not available without email_account_id in events
      };

      // 6. Lead breakdown
      const statusCounts: Record<string, number> = {};
      leadsData.forEach(lead => {
        const status = lead.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const leadBreakdown = {
        total: leadsData.length,
        by_status: Object.entries(statusCounts)
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count),
      };

      // 7. Positive replies (using reply_text from events)
      const positiveReplies = {
        count: total_positive_replies,
        rate: metrics.positive_rate,
        samples: positiveEvents.map(evt => ({
          lead_id: evt.lead_id || '',
          snippet: (evt.reply_text || '').slice(0, 150),
          timestamp: evt.event_timestamp || evt.created_at,
        })),
      };

      // 8. Variants with metrics
      const variants: VariantPerformance[] = variantsData.map(v => {
        const vMetrics = metricsData.filter(m => m.variant_id === v.id);
        const sent = vMetrics.reduce((s, m) => s + (m.sent_count || 0), 0);
        const opened = vMetrics.reduce((s, m) => s + (m.opened_count || 0), 0);
        const clicked = vMetrics.reduce((s, m) => s + (m.clicked_count || 0), 0);
        const replied = vMetrics.reduce((s, m) => s + (m.replied_count || 0), 0);

        return {
          id: v.id,
          name: v.name,
          subject_line: v.subject_line || '',
          variant_type: v.variant_type || 'email',
          sent,
          opened,
          clicked,
          replied,
          open_rate: sent > 0 ? (opened / sent) * 100 : 0,
          click_rate: sent > 0 ? (clicked / sent) * 100 : 0,
          reply_rate: sent > 0 ? (replied / sent) * 100 : 0,
        };
      }).sort((a, b) => b.reply_rate - a.reply_rate);

      // 9. Sequence steps
      const sequenceSteps: SequenceStepPerformance[] = stepsData.map(step => {
        // Get metrics for this step via variant_id
        const stepVariantId = step.variant_id;
        const stepMetrics = stepVariantId 
          ? metricsData.filter(m => m.variant_id === stepVariantId)
          : [];
        const sent = stepMetrics.reduce((s, m) => s + (m.sent_count || 0), 0);
        const opened = stepMetrics.reduce((s, m) => s + (m.opened_count || 0), 0);
        const replied = stepMetrics.reduce((s, m) => s + (m.replied_count || 0), 0);

        return {
          step_number: step.step_number,
          step_type: step.step_type || 'email',
          sent,
          opened,
          replied,
          open_rate: sent > 0 ? (opened / sent) * 100 : 0,
          reply_rate: sent > 0 ? (replied / sent) * 100 : 0,
        };
      });

      // 10. Daily data for chart
      const dailyMap = new Map<string, { sent: number; opened: number; replied: number }>();
      metricsData.forEach(m => {
        const date = m.metric_date;
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { sent: 0, opened: 0, replied: 0 });
        }
        const d = dailyMap.get(date)!;
        d.sent += m.sent_count || 0;
        d.opened += m.opened_count || 0;
        d.replied += m.replied_count || 0;
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
