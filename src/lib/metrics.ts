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
 * 
 * IMPORTANT: Reply Rate Standard
 * The industry-standard formula for email reply rate uses DELIVERED as denominator:
 *   Reply Rate = (Replies / Delivered) × 100
 *   Where: Delivered = Sent - Bounced
 * 
 * This is because bounced emails can never receive replies, so using "sent" 
 * unfairly penalizes campaigns with high bounce rates. Use calculateReplyRateFromDelivered()
 * for accurate reply rate calculations.
 */

/**
 * @deprecated Use calculateReplyRateFromDelivered for accurate reply rates
 * Legacy function that uses sent as denominator
 */
export const calculateReplyRate = (sent: number | null | undefined, replied: number | null | undefined): number => 
  calculateRate(replied, sent);

/**
 * Calculate reply rate using delivered as denominator (industry standard)
 * Formula: (Replies / Delivered) × 100
 * @param delivered - Number of emails successfully delivered (sent - bounced)
 * @param replied - Number of replies received
 */
export const calculateReplyRateFromDelivered = (delivered: number | null | undefined, replied: number | null | undefined): number => 
  calculateRate(replied, delivered);

/**
 * Calculate delivered count from sent and bounced
 * Delivered = Sent - Bounced
 */
export const calculateDelivered = (sent: number | null | undefined, bounced: number | null | undefined): number => {
  const s = sent ?? 0;
  const b = bounced ?? 0;
  return Math.max(0, s - b);
};

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

// ============================================================================
// COLD CALLING METRICS
// ============================================================================
// Key difference from email: Cold calling uses totalCalls as denominator
// (no "bounce" equivalent), while email uses delivered = sent - bounced

/**
 * Dispositions that count as a connection
 */
export const CONNECTED_DISPOSITIONS = ['connected', 'conversation', 'dm_conversation'] as const;

/**
 * Dispositions that count as voicemail
 */
export const VOICEMAIL_DISPOSITIONS = ['voicemail', 'vm', 'left_voicemail'] as const;

/**
 * Call outcomes that are positive
 */
export const POSITIVE_CALL_OUTCOMES = ['meeting_booked', 'interested', 'qualified', 'callback'] as const;

/**
 * Call outcomes that count as a meeting
 */
export const MEETING_CALL_OUTCOMES = ['meeting_booked'] as const;

/**
 * Check if a call disposition counts as a connection
 * A connection is: disposition = connected/conversation OR talk_duration > 30s
 */
export const isConnection = (disposition: string | null | undefined): boolean => {
  if (!disposition) return false;
  const lower = disposition.toLowerCase();
  return CONNECTED_DISPOSITIONS.some(d => lower.includes(d));
};

/**
 * Check if a call disposition is a voicemail
 */
export const isVoicemail = (disposition: string | null | undefined): boolean => {
  if (!disposition) return false;
  const lower = disposition.toLowerCase();
  return VOICEMAIL_DISPOSITIONS.some(d => lower.includes(d));
};

/**
 * Check if a call outcome resulted in a meeting
 */
export const isMeetingBooked = (outcome: string | null | undefined): boolean => {
  if (!outcome) return false;
  return outcome.toLowerCase() === 'meeting_booked';
};

/**
 * Check if a call outcome is positive (interested, meeting, qualified)
 */
export const isPositiveCallOutcome = (outcome: string | null | undefined): boolean => {
  if (!outcome) return false;
  const lower = outcome.toLowerCase();
  return POSITIVE_CALL_OUTCOMES.some(o => lower === o);
};

// ============================================================================
// COLD CALLING RATE CALCULATIONS
// All use totalCalls as denominator (unlike email which uses delivered)
// ============================================================================

/**
 * Connect Rate - % of calls that resulted in a connection
 * Formula: (connections / totalCalls) × 100
 * Benchmark: 25-35% (below 20% = data quality problem)
 */
export const calculateCallConnectRate = (
  totalCalls: number | null | undefined,
  connections: number | null | undefined
): number => calculateRate(connections, totalCalls);

/**
 * Conversation Rate - % of calls that became quality conversations
 * Formula: (conversations / totalCalls) × 100
 */
export const calculateConversationRate = (
  totalCalls: number | null | undefined,
  conversations: number | null | undefined
): number => calculateRate(conversations, totalCalls);

/**
 * Meeting Rate from Calls - % of calls that resulted in meetings booked
 * Formula: (meetings / totalCalls) × 100
 */
export const calculateCallMeetingRate = (
  totalCalls: number | null | undefined,
  meetings: number | null | undefined
): number => calculateRate(meetings, totalCalls);

/**
 * Voicemail Rate - % of calls that went to voicemail
 * Formula: (voicemails / totalCalls) × 100
 */
export const calculateVoicemailRate = (
  totalCalls: number | null | undefined,
  voicemails: number | null | undefined
): number => calculateRate(voicemails, totalCalls);

/**
 * Meeting Conversion Rate - % of conversations that became meetings
 * Formula: (meetings / conversations) × 100
 * This measures how well reps convert conversations to meetings
 */
export const calculateMeetingConversion = (
  conversations: number | null | undefined,
  meetings: number | null | undefined
): number => calculateRate(meetings, conversations);

/**
 * DM Conversation Rate - % of connections that were with decision makers
 * Formula: (dmConversations / connections) × 100
 */
export const calculateDMConversationRate = (
  connections: number | null | undefined,
  dmConversations: number | null | undefined
): number => calculateRate(dmConversations, connections);

// ============================================================================
// COLD CALLING DURATION CALCULATIONS
// ============================================================================

/**
 * Average call duration (only for connected calls)
 * Formula: totalTalkTimeSeconds / totalConnections
 * Returns seconds
 */
export const calculateAvgCallDuration = (
  totalTalkTimeSeconds: number | null | undefined,
  totalConnections: number | null | undefined
): number => {
  const time = totalTalkTimeSeconds ?? 0;
  const connections = totalConnections ?? 0;
  if (connections === 0) return 0;
  return Math.round(time / connections);
};

/**
 * Format call duration in human-readable format
 * < 60s: "45s"
 * 1-59m: "3m 25s"
 * 60m+: "1h 15m"
 */
export const formatCallDuration = (seconds: number | null | undefined): string => {
  const secs = seconds ?? 0;
  if (secs < 60) return `${Math.round(secs)}s`;
  const mins = Math.floor(secs / 60);
  const remainingSecs = Math.round(secs % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return remainingSecs > 0 ? `${mins}m ${remainingSecs}s` : `${mins}m`;
};

// ============================================================================
// COLD CALLING BENCHMARKS
// ============================================================================

export const CALLING_BENCHMARKS = {
  connectRate: { min: 25, max: 35, warning: 20 },
  conversationRate: { min: 4, max: 8, warning: 2 },
  dmConversationRate: { min: 70, max: 90 },
  meetingRate: { min: 0.5, max: 2 },
  meetingConversion: { min: 25, max: 33 }, // Newer reps: 25%, experienced: 33%
  voicemailRate: { max: 60 }, // Above 60% might indicate timing issues
  badDataRate: { max: 5, warning: 3 }, // Bad phones + wrong numbers
  avgCallDuration: { min: 180, max: 300 }, // 3-5 minutes optimal
  dialsPerDay: { min: 60, max: 100 },
  meetingsPerMonth: { avg: 15, top: 21 },
} as const;

export type CallingBenchmarkStatus = 'excellent' | 'good' | 'average' | 'below' | 'warning';

/**
 * Get benchmark status for a calling metric
 */
export const getCallingBenchmarkStatus = (
  metric: keyof typeof CALLING_BENCHMARKS,
  value: number
): CallingBenchmarkStatus => {
  const benchmark = CALLING_BENCHMARKS[metric];

  if ('warning' in benchmark && value < benchmark.warning) return 'warning';
  if ('min' in benchmark && 'max' in benchmark) {
    if (value >= benchmark.max * 1.2) return 'excellent';
    if (value >= benchmark.max) return 'good';
    if (value >= benchmark.min) return 'average';
    return 'below';
  }
  if ('max' in benchmark && !('min' in benchmark)) {
    if (value <= benchmark.max * 0.5) return 'excellent';
    if (value <= benchmark.max) return 'good';
    return 'warning';
  }
  return 'average';
};

/**
 * Get color class for calling benchmark status
 */
export const getCallingBenchmarkColorClass = (status: CallingBenchmarkStatus): string => {
  switch (status) {
    case 'excellent': return 'text-green-600';
    case 'good': return 'text-green-500';
    case 'average': return 'text-yellow-600';
    case 'below': return 'text-orange-500';
    case 'warning': return 'text-red-600';
    default: return '';
  }
};

// ============================================================================
// COLD CALLING AGGREGATE CALCULATIONS
// ============================================================================

export interface CallActivityRecord {
  disposition?: string | null;
  conversation_outcome?: string | null;
  is_dm_conversation?: boolean | null;
  talk_duration?: number | null;
  duration_seconds?: number | null;
  voicemail_left?: boolean | null;
  callback_scheduled?: boolean | null;
  started_at?: string | null;
  caller_name?: string | null;
  // Pre-computed classification fields (from sync)
  counts_as_connection?: boolean | null;
  counts_as_conversation?: boolean | null;
  counts_as_meeting?: boolean | null;
  counts_as_bad_data?: boolean | null;
}

export interface CallingMetrics {
  totalCalls: number;
  connections: number;
  conversations: number;
  dmConversations: number;
  meetings: number;
  voicemails: number;
  badData: number;
  totalTalkTimeSeconds: number;
  connectRate: number;
  conversationRate: number;
  dmConversationRate: number;
  meetingRate: number;
  meetingConversion: number;
  voicemailRate: number;
  badDataRate: number;
  avgCallDuration: number;
}

/**
 * Aggregate calling metrics from an array of call activity records
 * This is the SINGLE source of truth for calculating calling metrics
 */
export const aggregateCallingMetrics = (calls: CallActivityRecord[]): CallingMetrics => {
  const totalCalls = calls.length;

  // Use pre-computed fields if available, otherwise fallback to inference
  const connections = calls.filter(c =>
    c.counts_as_connection === true || 
    (c.counts_as_connection == null && (isConnection(c.disposition) || (c.talk_duration && c.talk_duration > 30)))
  ).length;

  const conversations = calls.filter(c =>
    c.counts_as_conversation === true ||
    (c.counts_as_conversation == null && c.conversation_outcome &&
      !['no_answer', 'voicemail', 'busy', 'wrong_number', 'unknown'].includes(c.conversation_outcome.toLowerCase()))
  ).length;

  const dmConversations = calls.filter(c => c.is_dm_conversation).length;

  const meetings = calls.filter(c =>
    c.counts_as_meeting === true ||
    (c.counts_as_meeting == null && (isMeetingBooked(c.conversation_outcome) || c.callback_scheduled))
  ).length;

  const voicemails = calls.filter(c =>
    c.voicemail_left || isVoicemail(c.disposition)
  ).length;

  const badData = calls.filter(c =>
    c.counts_as_bad_data === true ||
    (c.counts_as_bad_data == null && c.disposition?.toLowerCase().includes('bad'))
  ).length;

  const totalTalkTimeSeconds = calls.reduce((sum, c) =>
    sum + (c.talk_duration || 0), 0
  );

  return {
    totalCalls,
    connections,
    conversations,
    dmConversations,
    meetings,
    voicemails,
    badData,
    totalTalkTimeSeconds,
    connectRate: calculateCallConnectRate(totalCalls, connections),
    conversationRate: calculateConversationRate(totalCalls, conversations),
    dmConversationRate: calculateDMConversationRate(connections, dmConversations),
    meetingRate: calculateCallMeetingRate(totalCalls, meetings),
    voicemailRate: calculateVoicemailRate(totalCalls, voicemails),
    badDataRate: calculateRate(badData, totalCalls),
    meetingConversion: calculateMeetingConversion(conversations, meetings),
    avgCallDuration: calculateAvgCallDuration(totalTalkTimeSeconds, connections),
  };
};

// ============================================================================
// REP PERFORMANCE AGGREGATION
// ============================================================================

export interface RepPerformance {
  name: string;
  totalCalls: number;
  connections: number;
  meetings: number;
  connectRate: number;
  meetingRate: number;
  totalTalkTimeSeconds: number;
  avgCallDuration: number;
}

/**
 * Aggregate calling metrics by rep/caller
 * Returns array sorted by connect rate (highest first)
 */
export const aggregateCallingByRep = (calls: CallActivityRecord[]): RepPerformance[] => {
  const repMap = new Map<string, CallActivityRecord[]>();

  calls.forEach(call => {
    const rep = call.caller_name || 'Unknown';
    if (!repMap.has(rep)) repMap.set(rep, []);
    repMap.get(rep)!.push(call);
  });

  return Array.from(repMap.entries())
    .map(([name, repCalls]) => {
      const metrics = aggregateCallingMetrics(repCalls);
      return {
        name,
        totalCalls: metrics.totalCalls,
        connections: metrics.connections,
        meetings: metrics.meetings,
        connectRate: metrics.connectRate,
        meetingRate: metrics.meetingRate,
        totalTalkTimeSeconds: metrics.totalTalkTimeSeconds,
        avgCallDuration: metrics.avgCallDuration,
      };
    })
    .sort((a, b) => b.connectRate - a.connectRate);
};

/**
 * Calculate derived calling metrics from raw totals
 */
export const calculateDerivedCallingMetrics = (totals: {
  totalCalls: number;
  connections?: number;
  conversations?: number;
  dmConversations?: number;
  meetings?: number;
  voicemails?: number;
  totalTalkTimeSeconds?: number;
}) => {
  const connections = totals.connections ?? 0;
  const conversations = totals.conversations ?? 0;
  
  return {
    ...totals,
    connect_rate: calculateCallConnectRate(totals.totalCalls, connections),
    conversation_rate: calculateConversationRate(totals.totalCalls, conversations),
    meeting_rate: calculateCallMeetingRate(totals.totalCalls, totals.meetings),
    voicemail_rate: calculateVoicemailRate(totals.totalCalls, totals.voicemails),
    meeting_conversion: calculateMeetingConversion(conversations, totals.meetings),
    dm_conversation_rate: calculateDMConversationRate(connections, totals.dmConversations),
    avg_call_duration: calculateAvgCallDuration(totals.totalTalkTimeSeconds, connections),
  };
};

// ============================================================================
// COLD CALLING DATA VALIDATION
// ============================================================================

/**
 * Validate calling metrics consistency
 */
export const validateCallingMetricsConsistency = (metrics: {
  totalCalls?: number | null;
  connections?: number | null;
  conversations?: number | null;
  meetings?: number | null;
  voicemails?: number | null;
}): { valid: boolean; issues: string[] } => {
  const issues: string[] = [];
  const totalCalls = metrics.totalCalls ?? 0;
  const connections = metrics.connections ?? 0;
  const conversations = metrics.conversations ?? 0;
  const meetings = metrics.meetings ?? 0;
  const voicemails = metrics.voicemails ?? 0;

  // Connections should not exceed total calls
  if (connections > totalCalls) {
    issues.push('Connections exceed total calls');
  }

  // Conversations should not exceed connections
  if (conversations > connections * 1.05) { // 5% tolerance
    issues.push('Conversations exceed connections');
  }

  // Meetings should not exceed conversations
  if (meetings > conversations * 1.1) { // 10% tolerance
    issues.push('Meetings exceed conversations');
  }

  // Connect rate below 20% is a data quality warning
  if (totalCalls > 50 && calculateCallConnectRate(totalCalls, connections) < 20) {
    issues.push('Connect rate below 20% threshold - check data quality');
  }

  // Voicemails + connections should roughly equal total calls (with tolerance)
  if (totalCalls > 50 && (voicemails + connections) > totalCalls * 1.2) {
    issues.push('Voicemails + connections significantly exceed total calls');
  }

  return { valid: issues.length === 0, issues };
};
