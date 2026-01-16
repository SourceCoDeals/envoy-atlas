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
  platform: string;
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
        // Fetch variants from both platform-specific tables
        const [smartleadVariants, replyioVariants] = await Promise.all([
          supabase.from('smartlead_variants').select(`
            id,
            name,
            subject_line,
            body_preview,
            email_body,
            campaign_id,
            word_count,
            personalization_vars,
            smartlead_campaigns!inner (
              id,
              name,
              workspace_id
            )
          `).eq('smartlead_campaigns.workspace_id', currentWorkspace.id),
          supabase.from('replyio_variants').select(`
            id,
            name,
            subject_line,
            body_preview,
            email_body,
            campaign_id,
            word_count,
            personalization_vars,
            replyio_campaigns!inner (
              id,
              name,
              workspace_id
            )
          `).eq('replyio_campaigns.workspace_id', currentWorkspace.id)
        ]);

        // Define a unified variant type for processing
        interface UnifiedVariant {
          id: string;
          name: string;
          subject_line: string | null;
          body_preview: string | null;
          email_body: string | null;
          campaign_id: string;
          word_count: number | null;
          personalization_vars: any;
          platform: string;
          campaigns: { id: string; name: string };
        }

        let variants: UnifiedVariant[] = [
          ...(smartleadVariants.data || []).map(v => ({ 
            id: v.id,
            name: v.name,
            subject_line: v.subject_line,
            body_preview: v.body_preview,
            email_body: v.email_body,
            campaign_id: v.campaign_id,
            word_count: v.word_count,
            personalization_vars: v.personalization_vars,
            platform: 'smartlead', 
            campaigns: v.smartlead_campaigns 
          })),
          ...(replyioVariants.data || []).map(v => ({ 
            id: v.id,
            name: v.name,
            subject_line: v.subject_line,
            body_preview: v.body_preview,
            email_body: v.email_body,
            campaign_id: v.campaign_id,
            word_count: v.word_count,
            personalization_vars: v.personalization_vars,
            platform: 'replyio', 
            campaigns: v.replyio_campaigns 
          }))
        ];

        // If no variants in new platform tables, fall back to legacy campaign_variants
        if (variants.length === 0) {
          console.log('No variants in platform tables, falling back to legacy campaign_variants...');
          
          const { data: legacyVariants, error: legacyError } = await supabase
            .from('campaign_variants')
            .select(`
              id,
              name,
              subject_line,
              body_preview,
              email_body,
              campaign_id,
              word_count,
              personalization_vars,
              campaigns!inner (
                id,
                name,
                platform,
                workspace_id
              )
            `)
            .eq('campaigns.workspace_id', currentWorkspace.id);
          
          if (!legacyError && legacyVariants && legacyVariants.length > 0) {
            console.log(`Found ${legacyVariants.length} legacy variants`);
            variants = legacyVariants.map(v => {
              const camp = v.campaigns as unknown as { id: string; name: string; platform: string };
              return {
                id: v.id,
                name: v.name,
                subject_line: v.subject_line,
                body_preview: v.body_preview,
                email_body: v.email_body,
                campaign_id: v.campaign_id,
                word_count: v.word_count,
                personalization_vars: v.personalization_vars,
                platform: camp.platform || 'unknown',
                campaigns: { id: camp.id, name: camp.name },
              };
            });
          }
        }

        // Get variant IDs by platform
        const smartleadVariantIds = (smartleadVariants.data || []).map(v => v.id);
        const replyioVariantIds = (replyioVariants.data || []).map(v => v.id);

        // Fetch daily metrics for variants from both tables
        const [smartleadMetrics, replyioMetrics] = await Promise.all([
          smartleadVariantIds.length > 0
            ? supabase.from('smartlead_daily_metrics').select('variant_id, sent_count, opened_count, clicked_count, replied_count, positive_reply_count')
                .eq('workspace_id', currentWorkspace.id)
                .not('variant_id', 'is', null)
            : Promise.resolve({ data: [], error: null }),
          replyioVariantIds.length > 0
            ? supabase.from('replyio_daily_metrics').select('variant_id, sent_count, opened_count, clicked_count, replied_count, positive_reply_count')
                .eq('workspace_id', currentWorkspace.id)
                .not('variant_id', 'is', null)
            : Promise.resolve({ data: [], error: null })
        ]);

        const allMetrics = [
          ...(smartleadMetrics.data || []),
          ...(replyioMetrics.data || [])
        ];

        // Get campaign IDs from all variants
        const allCampaignIds = variants.map(v => v.campaign_id);
        const smartleadCampIds = (smartleadVariants.data || []).map(v => v.campaign_id);
        const replyioCampIds = (replyioVariants.data || []).map(v => v.campaign_id);

        // Get campaign-level metrics for variants without specific metrics
        const [smartleadCampMetrics, replyioCampMetrics, legacyCampMetrics] = await Promise.all([
          smartleadCampIds.length > 0
            ? supabase.from('smartlead_daily_metrics').select('campaign_id, sent_count, opened_count, clicked_count, replied_count, positive_reply_count')
                .eq('workspace_id', currentWorkspace.id)
                .is('variant_id', null)
            : Promise.resolve({ data: [], error: null }),
          replyioCampIds.length > 0
            ? supabase.from('replyio_daily_metrics').select('campaign_id, sent_count, opened_count, clicked_count, replied_count, positive_reply_count')
                .eq('workspace_id', currentWorkspace.id)
                .is('variant_id', null)
            : Promise.resolve({ data: [], error: null }),
          // Also try to get metrics from unified campaigns table for legacy variants
          allCampaignIds.length > 0 && smartleadVariantIds.length === 0 && replyioVariantIds.length === 0
            ? supabase.from('campaigns').select('id, platform').in('id', allCampaignIds)
            : Promise.resolve({ data: [], error: null })
        ]);

        const allCampaignMetrics = [
          ...(smartleadCampMetrics.data || []),
          ...(replyioCampMetrics.data || [])
        ];

        // Aggregate metrics by variant
        const variantMetrics: Record<string, {
          sent: number;
          opened: number;
          clicked: number;
          replied: number;
          positive: number;
        }> = {};

        allMetrics.forEach(m => {
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

        allCampaignMetrics.forEach(m => {
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
            
            // Try variant-level metrics first
            let vMetrics = variantMetrics[v.id];
            
            // Fallback to campaign-level metrics if no variant metrics
            if (!vMetrics || vMetrics.sent === 0) {
              vMetrics = campaignAggMetrics[v.campaign_id] || { 
                sent: 0, opened: 0, clicked: 0, replied: 0, positive: 0 
              };
            }

            const sent = vMetrics.sent;
            const body = v.body_preview || v.email_body || '';
            const wordCount = v.word_count || body.split(/\s+/).filter(Boolean).length;
            const persVars = Array.isArray(v.personalization_vars) 
              ? v.personalization_vars 
              : (typeof v.personalization_vars === 'object' && v.personalization_vars !== null)
                ? Object.values(v.personalization_vars)
                : [];

            return {
              subject_line: v.subject_line || '',
              body_preview: v.body_preview || v.email_body?.substring(0, 500) || null,
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
              platform: v.platform,
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
