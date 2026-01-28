import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { calculateRate } from '@/lib/metrics';
import { logger } from '@/lib/logger';

export interface SequenceStepData {
  step_number: number;
  sent: number;
  replies: number;
  opens: number;
  positive_replies: number;
  reply_rate: number;
  open_rate: number;
}

export interface SequenceAnalytics {
  sequenceData: SequenceStepData[];
  loading: boolean;
  error: string | null;
  totalSteps: number;
  totalSent: number;
  totalReplies: number;
  step1ReplyShare: number;
  optimalLength: number | null;
  hasData: boolean;
}

export function useSequenceAnalytics(): SequenceAnalytics {
  const { currentWorkspace } = useWorkspace();
  const [sequenceData, setSequenceData] = useState<SequenceStepData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchSequenceData();
    }
  }, [currentWorkspace?.id]);

  const fetchSequenceData = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    setError(null);

    try {
      // Get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);
      if (engagementIds.length === 0) {
        setSequenceData([]);
        setLoading(false);
        return;
      }

      // First try: Get step-level data from campaign_variants
      const { data: variantsData } = await supabase
        .from('campaign_variants')
        .select(`
          step_number,
          total_sent,
          total_opened,
          total_replied,
          positive_replies,
          campaign_id,
          campaigns!inner(engagement_id)
        `)
        .in('campaigns.engagement_id', engagementIds)
        .not('step_number', 'is', null)
        .order('step_number');

      if (variantsData && variantsData.length > 0) {
        // Aggregate by step_number
        const stepMap = new Map<number, { sent: number; opens: number; replies: number; positive: number }>();
        
        variantsData.forEach((v: any) => {
          const step = v.step_number || 1;
          const existing = stepMap.get(step) || { sent: 0, opens: 0, replies: 0, positive: 0 };
          stepMap.set(step, {
            sent: existing.sent + (v.total_sent || 0),
            opens: existing.opens + (v.total_opened || 0),
            replies: existing.replies + (v.total_replied || 0),
            positive: existing.positive + (v.positive_replies || 0),
          });
        });

        const result: SequenceStepData[] = Array.from(stepMap.entries())
          .map(([step, data]) => ({
            step_number: step,
            sent: data.sent,
            opens: data.opens,
            replies: data.replies,
            positive_replies: data.positive,
            reply_rate: calculateRate(data.replies, data.sent),
            open_rate: calculateRate(data.opens, data.sent),
          }))
          .sort((a, b) => a.step_number - b.step_number);

        setSequenceData(result);
      } else {
        // Fallback: Try email_activities with step_number
        const { data: activitiesData } = await supabase
          .from('email_activities')
          .select('step_number, opened, replied, reply_category')
          .in('engagement_id', engagementIds)
          .not('step_number', 'is', null);

        if (activitiesData && activitiesData.length > 0) {
          const stepMap = new Map<number, { sent: number; opens: number; replies: number; positive: number }>();
          
          activitiesData.forEach((a: any) => {
            const step = a.step_number || 1;
            const existing = stepMap.get(step) || { sent: 0, opens: 0, replies: 0, positive: 0 };
            stepMap.set(step, {
              sent: existing.sent + 1,
              opens: existing.opens + (a.opened ? 1 : 0),
              replies: existing.replies + (a.replied ? 1 : 0),
              positive: existing.positive + (
                a.reply_category === 'interested' || a.reply_category === 'meeting_request' ? 1 : 0
              ),
            });
          });

          const result: SequenceStepData[] = Array.from(stepMap.entries())
            .map(([step, data]) => ({
              step_number: step,
              sent: data.sent,
              opens: data.opens,
              replies: data.replies,
              positive_replies: data.positive,
              reply_rate: calculateRate(data.replies, data.sent),
              open_rate: calculateRate(data.opens, data.sent),
            }))
            .sort((a, b) => a.step_number - b.step_number);

          setSequenceData(result);
        } else {
          setSequenceData([]);
        }
      }
    } catch (err) {
      logger.error('Error fetching sequence data', err);
      setError(err instanceof Error ? err.message : 'Failed to load sequence data');
    } finally {
      setLoading(false);
    }
  };

  // Compute derived metrics
  const totalSteps = sequenceData.length;
  const totalSent = sequenceData.reduce((sum, s) => sum + s.sent, 0);
  const totalReplies = sequenceData.reduce((sum, s) => sum + s.replies, 0);
  const step1Replies = sequenceData.find(s => s.step_number === 1)?.replies || 0;
  const step1ReplyShare = calculateRate(step1Replies, totalReplies);

  // Calculate optimal length (step with best marginal return)
  let optimalLength: number | null = null;
  if (sequenceData.length >= 2) {
    // Find where reply rate starts declining significantly
    let maxRate = 0;
    let bestStep = 1;
    sequenceData.forEach(step => {
      if (step.reply_rate > maxRate) {
        maxRate = step.reply_rate;
        bestStep = step.step_number;
      }
    });
    optimalLength = bestStep;
  }

  return {
    sequenceData,
    loading,
    error,
    totalSteps,
    totalSent,
    totalReplies,
    step1ReplyShare,
    optimalLength,
    hasData: sequenceData.length > 0,
  };
}
