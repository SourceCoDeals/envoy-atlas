/**
 * Atomic Metric Update Helpers
 * 
 * Uses database functions to ensure race-condition-safe metric updates
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Atomically increment a campaign metric
 */
export async function incrementCampaignMetric(
  supabase: SupabaseClient,
  campaignId: string,
  metricName: 'total_sent' | 'total_opened' | 'total_replied' | 'total_bounced' | 'total_delivered' | 'positive_replies',
  value: number = 1
): Promise<void> {
  const { error } = await supabase.rpc('increment_campaign_metric', {
    p_campaign_id: campaignId,
    p_metric_name: metricName,
    p_value: value,
  });

  if (error) {
    console.error(`[atomic-metrics] Error incrementing campaign metric ${metricName}:`, error);
    throw error;
  }
}

/**
 * Atomically increment a variant metric
 */
export async function incrementVariantMetric(
  supabase: SupabaseClient,
  variantId: string,
  metricName: 'total_sent' | 'total_opened' | 'total_replied' | 'total_bounced' | 'total_delivered' | 'positive_replies',
  value: number = 1
): Promise<void> {
  const { error } = await supabase.rpc('increment_variant_metric', {
    p_variant_id: variantId,
    p_metric_name: metricName,
    p_value: value,
  });

  if (error) {
    console.error(`[atomic-metrics] Error incrementing variant metric ${metricName}:`, error);
    throw error;
  }
}

/**
 * Atomically upsert hourly metrics
 */
export async function recordHourlyMetric(
  supabase: SupabaseClient,
  engagementId: string,
  campaignId: string,
  eventTimestamp: string | undefined,
  metricName: 'emails_sent' | 'emails_opened' | 'emails_clicked' | 'emails_replied' | 'emails_bounced',
  value: number = 1
): Promise<void> {
  const now = new Date(eventTimestamp || Date.now());
  
  const { error } = await supabase.rpc('upsert_hourly_metric', {
    p_engagement_id: engagementId,
    p_campaign_id: campaignId,
    p_hour_of_day: now.getUTCHours(),
    p_day_of_week: now.getUTCDay(),
    p_metric_date: now.toISOString().split('T')[0],
    p_metric_name: metricName,
    p_value: value,
  });

  if (error) {
    console.error(`[atomic-metrics] Error recording hourly metric ${metricName}:`, error);
    throw error;
  }
}

/**
 * Atomically upsert daily metrics
 */
export async function recordDailyMetric(
  supabase: SupabaseClient,
  engagementId: string,
  campaignId: string,
  eventTimestamp: string | undefined,
  metricName: 'emails_sent' | 'emails_delivered' | 'emails_opened' | 'emails_replied' | 'emails_bounced' | 'positive_replies',
  value: number = 1,
  variantId?: string
): Promise<void> {
  const now = new Date(eventTimestamp || Date.now());
  
  const { error } = await supabase.rpc('upsert_daily_metric', {
    p_engagement_id: engagementId,
    p_campaign_id: campaignId,
    p_date: now.toISOString().split('T')[0],
    p_metric_name: metricName,
    p_value: value,
    p_variant_id: variantId || null,
  });

  if (error) {
    console.error(`[atomic-metrics] Error recording daily metric ${metricName}:`, error);
    throw error;
  }
}

/**
 * Helper to update positive reply counts atomically
 */
export async function updatePositiveReplyCounts(
  supabase: SupabaseClient,
  engagementId: string,
  campaignId: string,
  eventTimestamp: string | undefined,
  variantId?: string
): Promise<void> {
  // Update campaign-level positive replies
  await incrementCampaignMetric(supabase, campaignId, 'positive_replies', 1);
  
  // Update variant-level positive replies if applicable
  if (variantId) {
    await incrementVariantMetric(supabase, variantId, 'positive_replies', 1);
  }
  
  // Update daily metrics
  await recordDailyMetric(supabase, engagementId, campaignId, eventTimestamp, 'positive_replies', 1, variantId);
}
