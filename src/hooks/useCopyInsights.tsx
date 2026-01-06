import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface CopyPerformance {
  subject_line: string;
  body_preview: string | null;
  variant_name: string;
  campaign_name: string;
  campaign_id: string;
  variant_id: string;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  positive_reply_count: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  positive_rate: number;
  word_count: number;
  personalization_vars: string[];
}

export function useCopyInsights() {
  const { currentWorkspace } = useWorkspace();
  const [data, setData] = useState<CopyPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;

    async function fetchCopyInsights() {
      setLoading(true);
      setError(null);

      try {
        // Fetch campaign variants with their metrics
        const { data: variants, error: variantsError } = await supabase
          .from('campaign_variants')
          .select(`
            id,
            name,
            subject_line,
            body_preview,
            campaign_id,
            word_count,
            personalization_vars,
            campaigns!inner (
              id,
              name,
              workspace_id
            )
          `)
          .eq('campaigns.workspace_id', currentWorkspace.id);

        if (variantsError) throw variantsError;

        // Fetch daily metrics for these variants
        const { data: metrics, error: metricsError } = await supabase
          .from('daily_metrics')
          .select('variant_id, sent_count, opened_count, clicked_count, replied_count, positive_reply_count')
          .eq('workspace_id', currentWorkspace.id)
          .not('variant_id', 'is', null);

        if (metricsError) throw metricsError;

        // Also get campaign-level metrics for variants without specific metrics
        const { data: campaignMetrics, error: campMetricsError } = await supabase
          .from('daily_metrics')
          .select('campaign_id, sent_count, opened_count, clicked_count, replied_count, positive_reply_count')
          .eq('workspace_id', currentWorkspace.id)
          .is('variant_id', null);

        if (campMetricsError) throw campMetricsError;

        // Aggregate metrics by variant
        const variantMetrics: Record<string, {
          sent: number;
          opened: number;
          clicked: number;
          replied: number;
          positive: number;
        }> = {};

        metrics?.forEach(m => {
          if (!m.variant_id) return;
          if (!variantMetrics[m.variant_id]) {
            variantMetrics[m.variant_id] = { sent: 0, opened: 0, clicked: 0, replied: 0, positive: 0 };
          }
          variantMetrics[m.variant_id].sent += m.sent_count || 0;
          variantMetrics[m.variant_id].opened += m.opened_count || 0;
          variantMetrics[m.variant_id].clicked += m.clicked_count || 0;
          variantMetrics[m.variant_id].replied += m.replied_count || 0;
          variantMetrics[m.variant_id].positive += m.positive_reply_count || 0;
        });

        // Aggregate campaign-level metrics
        const campaignAggMetrics: Record<string, {
          sent: number;
          opened: number;
          clicked: number;
          replied: number;
          positive: number;
        }> = {};

        campaignMetrics?.forEach(m => {
          if (!m.campaign_id) return;
          if (!campaignAggMetrics[m.campaign_id]) {
            campaignAggMetrics[m.campaign_id] = { sent: 0, opened: 0, clicked: 0, replied: 0, positive: 0 };
          }
          campaignAggMetrics[m.campaign_id].sent += m.sent_count || 0;
          campaignAggMetrics[m.campaign_id].opened += m.opened_count || 0;
          campaignAggMetrics[m.campaign_id].clicked += m.clicked_count || 0;
          campaignAggMetrics[m.campaign_id].replied += m.replied_count || 0;
          campaignAggMetrics[m.campaign_id].positive += m.positive_reply_count || 0;
        });

        // Build performance data
        const performanceData: CopyPerformance[] = (variants || [])
          .filter(v => v.subject_line)
          .map(v => {
            const campaign = v.campaigns as unknown as { id: string; name: string };
            const vMetrics = variantMetrics[v.id] || campaignAggMetrics[v.campaign_id] || { 
              sent: 0, opened: 0, clicked: 0, replied: 0, positive: 0 
            };

            const sent = vMetrics.sent;
            const body = v.body_preview || '';
            const wordCount = v.word_count || body.split(/\s+/).filter(Boolean).length;
            const persVars = Array.isArray(v.personalization_vars) 
              ? v.personalization_vars 
              : (typeof v.personalization_vars === 'object' && v.personalization_vars !== null)
                ? Object.values(v.personalization_vars)
                : [];

            return {
              subject_line: v.subject_line || '',
              body_preview: v.body_preview,
              variant_name: v.name,
              campaign_name: campaign.name,
              campaign_id: v.campaign_id,
              variant_id: v.id,
              sent_count: sent,
              opened_count: vMetrics.opened,
              clicked_count: vMetrics.clicked,
              replied_count: vMetrics.replied,
              positive_reply_count: vMetrics.positive,
              open_rate: sent > 0 ? (vMetrics.opened / sent) * 100 : 0,
              click_rate: sent > 0 ? (vMetrics.clicked / sent) * 100 : 0,
              reply_rate: sent > 0 ? (vMetrics.replied / sent) * 100 : 0,
              positive_rate: sent > 0 ? (vMetrics.positive / sent) * 100 : 0,
              word_count: wordCount,
              personalization_vars: persVars as string[],
            };
          })
          .sort((a, b) => b.reply_rate - a.reply_rate);

        setData(performanceData);
      } catch (err: any) {
        console.error('Error fetching copy insights:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCopyInsights();
  }, [currentWorkspace]);

  return { data, loading, error, refetch: () => {} };
}
