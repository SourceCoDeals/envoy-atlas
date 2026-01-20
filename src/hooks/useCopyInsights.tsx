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
        // Get engagements for this client
        const { data: engagements, error: engError } = await supabase
          .from('engagements')
          .select('id')
          .eq('client_id', currentWorkspace.id);

        if (engError) throw engError;
        
        const engagementIds = (engagements || []).map(e => e.id);
        
        if (engagementIds.length === 0) {
          setData([]);
          setLoading(false);
          return;
        }

        // Fetch campaigns for these engagements
        const { data: campaigns, error: campError } = await supabase
          .from('campaigns')
          .select('id, name, campaign_type, engagement_id')
          .in('engagement_id', engagementIds);

        if (campError) throw campError;

        const campaignIds = (campaigns || []).map(c => c.id);
        const campaignMap = new Map((campaigns || []).map(c => [c.id, c]));

        if (campaignIds.length === 0) {
          setData([]);
          setLoading(false);
          return;
        }

        // Fetch variants for these campaigns
        const { data: variants, error: varError } = await supabase
          .from('campaign_variants')
          .select(`
            id,
            subject_line,
            body_preview,
            body_plain,
            body_html,
            campaign_id,
            step_number,
            personalization_vars,
            total_sent,
            total_opened,
            total_clicked,
            total_replied,
            positive_replies,
            open_rate,
            click_rate,
            reply_rate,
            positive_reply_rate
          `)
          .in('campaign_id', campaignIds);

        if (varError) throw varError;

        // Fetch variant features for word count and other analysis
        const variantIds = (variants || []).map(v => v.id);
        
        let features: any[] = [];
        if (variantIds.length > 0) {
          const { data: featData } = await supabase
            .from('campaign_variant_features')
            .select(`
              variant_id,
              subject_word_count,
              subject_length,
              subject_has_personalization,
              subject_first_word_type,
              subject_format,
              body_word_count,
              body_paragraph_count,
              body_cta_type,
              body_cta_strength,
              body_has_personalization,
              body_personalization_count,
              body_question_count,
              tone,
              opening_line_type,
              opening_line_text,
              you_we_ratio,
              personalization_level,
              hook_type
            `)
            .in('variant_id', variantIds);
          features = featData || [];
        }

        const featureMap = new Map(features.map(f => [f.variant_id, f]));

        // Build performance data
        const performanceData: CopyPerformance[] = (variants || [])
          .filter(v => v.subject_line)
          .map(v => {
            const campaign = campaignMap.get(v.campaign_id);
            const feature = featureMap.get(v.id);
            
            const sent = v.total_sent || 0;
            const body = v.body_preview || v.body_plain || v.body_html || '';
            const wordCount = feature?.body_word_count || body.split(/\s+/).filter(Boolean).length;
            
            const persVars = Array.isArray(v.personalization_vars)
              ? v.personalization_vars
              : (typeof v.personalization_vars === 'object' && v.personalization_vars !== null)
                ? Object.values(v.personalization_vars)
                : [];

            return {
              subject_line: v.subject_line || '',
              body_preview: v.body_preview || (v.body_plain || v.body_html || '').substring(0, 500) || null,
              variant_name: `Step ${v.step_number || 1}`,
              campaign_name: campaign?.name || 'Unknown Campaign',
              campaign_id: v.campaign_id,
              variant_id: v.id,
              sent_count: sent,
              opened_count: v.total_opened || 0,
              clicked_count: v.total_clicked || 0,
              replied_count: v.total_replied || 0,
              positive_reply_count: v.positive_replies || 0,
              open_rate: v.open_rate || (sent > 0 ? ((v.total_opened || 0) / sent) * 100 : 0),
              click_rate: v.click_rate || (sent > 0 ? ((v.total_clicked || 0) / sent) * 100 : 0),
              reply_rate: v.reply_rate || (sent > 0 ? ((v.total_replied || 0) / sent) * 100 : 0),
              positive_rate: v.positive_reply_rate || (sent > 0 ? ((v.positive_replies || 0) / sent) * 100 : 0),
              word_count: wordCount,
              personalization_vars: persVars as string[],
              platform: campaign?.campaign_type || 'email',
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
