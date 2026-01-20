/**
 * Centralized metric calculations for data integrity
 * Single source of truth for all rate calculations across the application
 */

// ============================================================================
// RATE CALCULATIONS
// ============================================================================

/**
 * Safe rate calculation with zero-division protection
 * Returns percentage (0-100)
 */
export const calculateRate = (numerator: number | null | undefined, denominator: number | null | undefined): number => {
  const num = numerator ?? 0;
  const den = denominator ?? 0;
  if (den === 0) return 0;
  return (num / den) * 100;
};

/**
 * Safe rate calculation returning decimal (0-1)
 * Useful for database fields that store rates as decimals
 */
export const calculateRateDecimal = (numerator: number | null | undefined, denominator: number | null | undefined): number => {
  const num = numerator ?? 0;
  const den = denominator ?? 0;
  if (den === 0) return 0;
  return num / den;
};

/**
 * Standard metric calculations - all return percentages (0-100)
 */
export const calculateReplyRate = (sent: number | null | undefined, replied: number | null | undefined): number => 
  calculateRate(replied, sent);

export const calculateBounceRate = (sent: number | null | undefined, bounced: number | null | undefined): number => 
  calculateRate(bounced, sent);

export const calculateOpenRate = (sent: number | null | undefined, opened: number | null | undefined): number => 
  calculateRate(opened, sent);

export const calculateClickRate = (sent: number | null | undefined, clicked: number | null | undefined): number => 
  calculateRate(clicked, sent);

export const calculateDeliveryRate = (sent: number | null | undefined, delivered: number | null | undefined): number => 
  calculateRate(delivered, sent);

export const calculatePositiveRate = (sent: number | null | undefined, positive: number | null | undefined): number => 
  calculateRate(positive, sent);

export const calculatePositiveReplyRate = (replied: number | null | undefined, positive: number | null | undefined): number => 
  calculateRate(positive, replied);

export const calculateConnectRate = (calls: number | null | undefined, connects: number | null | undefined): number => 
  calculateRate(connects, calls);

export const calculateMeetingRate = (sent: number | null | undefined, meetings: number | null | undefined): number => 
  calculateRate(meetings, sent);

// ============================================================================
// REPLY CLASSIFICATION
// ============================================================================

/**
 * Positive reply categories as defined in the system
 */
export const POSITIVE_REPLY_CATEGORIES = ['meeting_request', 'interested'] as const;

/**
 * All reply categories
 */
export const REPLY_CATEGORIES = [
  'meeting_request',
  'interested', 
  'not_interested',
  'timing',
  'referral',
  'out_of_office',
  'unsubscribe',
  'bounce',
  'auto_reply',
  'unknown'
] as const;

export type ReplyCategory = typeof REPLY_CATEGORIES[number];

/**
 * Check if a reply category is positive (interested/meeting_request)
 */
export const isPositiveReply = (category: string | null | undefined): boolean => {
  if (!category) return false;
  return POSITIVE_REPLY_CATEGORIES.includes(category as typeof POSITIVE_REPLY_CATEGORIES[number]);
};

/**
 * Check if a reply category indicates interest (broader than positive)
 */
export const isInterestedReply = (category: string | null | undefined): boolean => {
  if (!category) return false;
  return ['meeting_request', 'interested', 'referral'].includes(category);
};

/**
 * Check if a reply category is negative
 */
export const isNegativeReply = (category: string | null | undefined): boolean => {
  if (!category) return false;
  return ['not_interested', 'unsubscribe'].includes(category);
};

/**
 * Check if a reply is auto-generated (OOO, auto-reply, bounce)
 */
export const isAutoReply = (category: string | null | undefined): boolean => {
  if (!category) return false;
  return ['out_of_office', 'auto_reply', 'bounce'].includes(category);
};

// ============================================================================
// DATA QUALITY
// ============================================================================

export type DataQuality = 'good' | 'warning' | 'stale' | 'critical';

export interface DataQualityCheck {
  quality: DataQuality;
  message: string;
  details?: string;
}

/**
 * Determine data quality based on sync freshness and volume
 */
export const getDataQuality = (data: { 
  sent?: number | null; 
  synced_at?: string | Date | null;
  last_sync_at?: string | Date | null;
}): DataQualityCheck => {
  const syncTime = data.synced_at || data.last_sync_at;
  
  if (!syncTime) {
    return { 
      quality: 'warning', 
      message: 'Never synced',
      details: 'Data has not been synced from the source platform'
    };
  }
  
  const syncDate = typeof syncTime === 'string' ? new Date(syncTime) : syncTime;
  const hoursSinceSync = (Date.now() - syncDate.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceSync > 72) {
    return { 
      quality: 'stale', 
      message: 'Sync stale',
      details: `Last synced ${Math.floor(hoursSinceSync / 24)} days ago`
    };
  }
  
  if (hoursSinceSync > 24) {
    return { 
      quality: 'warning', 
      message: 'Sync delayed',
      details: `Last synced ${Math.floor(hoursSinceSync)} hours ago`
    };
  }
  
  if ((data.sent ?? 0) === 0) {
    return { 
      quality: 'warning', 
      message: 'No activity',
      details: 'No emails sent in this period'
    };
  }
  
  return { 
    quality: 'good', 
    message: 'Data fresh',
    details: `Synced ${Math.floor(hoursSinceSync)} hours ago`
  };
};

/**
 * Check if metrics seem consistent (no obvious data issues)
 */
export const validateMetricsConsistency = (metrics: {
  sent?: number | null;
  delivered?: number | null;
  opened?: number | null;
  replied?: number | null;
  bounced?: number | null;
}): { valid: boolean; issues: string[] } => {
  const issues: string[] = [];
  const sent = metrics.sent ?? 0;
  const delivered = metrics.delivered ?? 0;
  const opened = metrics.opened ?? 0;
  const replied = metrics.replied ?? 0;
  const bounced = metrics.bounced ?? 0;
  
  // Delivered + bounced should not exceed sent
  if (delivered + bounced > sent * 1.05) { // 5% tolerance for timing
    issues.push('Delivered + bounced exceeds sent count');
  }
  
  // Opened should not exceed delivered
  if (opened > delivered * 1.1) { // 10% tolerance for tracking
    issues.push('Opened count exceeds delivered count');
  }
  
  // Replied should not exceed opened (typically)
  if (replied > opened * 1.5 && opened > 0) { // Some tolerance for tracking issues
    issues.push('Reply count seems high relative to opens');
  }
  
  // Bounce rate over 10% is concerning
  if (sent > 100 && calculateBounceRate(sent, bounced) > 10) {
    issues.push('Bounce rate exceeds 10% threshold');
  }
  
  return { valid: issues.length === 0, issues };
};

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format a rate for display (e.g., "12.5%")
 */
export const formatRate = (rate: number | null | undefined, decimals = 1): string => {
  if (rate === null || rate === undefined) return '0%';
  return `${rate.toFixed(decimals)}%`;
};

/**
 * Format a large number with K/M suffix
 */
export const formatNumber = (num: number | null | undefined): string => {
  const n = num ?? 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
};

/**
 * Format a rate with color class based on benchmark
 */
export const getRateColorClass = (
  rate: number, 
  type: 'reply' | 'bounce' | 'open' | 'positive'
): string => {
  switch (type) {
    case 'reply':
      if (rate >= 5) return 'text-green-600';
      if (rate >= 2) return 'text-yellow-600';
      return 'text-red-600';
    case 'positive':
      if (rate >= 2) return 'text-green-600';
      if (rate >= 1) return 'text-yellow-600';
      return 'text-red-600';
    case 'bounce':
      if (rate <= 2) return 'text-green-600';
      if (rate <= 5) return 'text-yellow-600';
      return 'text-red-600';
    case 'open':
      if (rate >= 50) return 'text-green-600';
      if (rate >= 30) return 'text-yellow-600';
      return 'text-red-600';
    default:
      return '';
  }
};

// ============================================================================
// AGGREGATION UTILITIES
// ============================================================================

/**
 * Aggregate metrics from an array of objects
 */
export const aggregateMetrics = <T extends Record<string, number | null | undefined>>(
  items: T[],
  keys: (keyof T)[]
): Record<string, number> => {
  const result: Record<string, number> = {};
  
  for (const key of keys) {
    result[key as string] = items.reduce((sum, item) => {
      const value = item[key];
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
  }
  
  return result;
};

/**
 * Calculate derived metrics from raw totals
 */
export const calculateDerivedMetrics = (totals: {
  sent: number;
  delivered?: number;
  opened?: number;
  replied?: number;
  bounced?: number;
  positive?: number;
  meetings?: number;
}) => {
  return {
    ...totals,
    reply_rate: calculateReplyRate(totals.sent, totals.replied),
    bounce_rate: calculateBounceRate(totals.sent, totals.bounced),
    open_rate: calculateOpenRate(totals.sent, totals.opened),
    delivery_rate: calculateDeliveryRate(totals.sent, totals.delivered),
    positive_rate: calculatePositiveRate(totals.sent, totals.positive),
    positive_reply_rate: calculatePositiveReplyRate(totals.replied, totals.positive),
    meeting_rate: calculateMeetingRate(totals.sent, totals.meetings),
  };
};
