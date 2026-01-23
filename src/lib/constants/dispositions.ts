/**
 * Centralized Disposition Mappings
 * 
 * Single source of truth for all disposition, category, and sentiment mappings
 * used across webhooks, sync functions, and frontend components.
 */

// SmartLead category mappings
export const SMARTLEAD_CATEGORY_MAP: Record<string, { 
  category: string; 
  sentiment: string; 
  is_positive: boolean;
}> = {
  'Interested': { category: 'interested', sentiment: 'positive', is_positive: true },
  'Meeting Booked': { category: 'meeting_request', sentiment: 'positive', is_positive: true },
  'Meeting Scheduled': { category: 'meeting_request', sentiment: 'positive', is_positive: true },
  'Positive': { category: 'interested', sentiment: 'positive', is_positive: true },
  'Not Interested': { category: 'not_interested', sentiment: 'negative', is_positive: false },
  'Out of Office': { category: 'out_of_office', sentiment: 'neutral', is_positive: false },
  'OOO': { category: 'out_of_office', sentiment: 'neutral', is_positive: false },
  'Wrong Person': { category: 'referral', sentiment: 'neutral', is_positive: false },
  'Unsubscribed': { category: 'unsubscribe', sentiment: 'negative', is_positive: false },
  'Do Not Contact': { category: 'unsubscribe', sentiment: 'negative', is_positive: false },
  'Neutral': { category: 'neutral', sentiment: 'neutral', is_positive: false },
  'Question': { category: 'question', sentiment: 'neutral', is_positive: false },
  'Not Now': { category: 'not_now', sentiment: 'neutral', is_positive: false },
};

// Reply.io category mappings
export const REPLYIO_CATEGORY_MAP: Record<string, { 
  category: string; 
  sentiment: string; 
  is_positive: boolean;
}> = {
  'Interested': { category: 'interested', sentiment: 'positive', is_positive: true },
  'Meeting Booked': { category: 'meeting_request', sentiment: 'positive', is_positive: true },
  'MeetingBooked': { category: 'meeting_request', sentiment: 'positive', is_positive: true },
  'Positive': { category: 'interested', sentiment: 'positive', is_positive: true },
  'Not Interested': { category: 'not_interested', sentiment: 'negative', is_positive: false },
  'NotInterested': { category: 'not_interested', sentiment: 'negative', is_positive: false },
  'Out of Office': { category: 'out_of_office', sentiment: 'neutral', is_positive: false },
  'OOO': { category: 'out_of_office', sentiment: 'neutral', is_positive: false },
  'Auto-reply': { category: 'out_of_office', sentiment: 'neutral', is_positive: false },
  'Referral': { category: 'referral', sentiment: 'neutral', is_positive: false },
  'Unsubscribed': { category: 'unsubscribe', sentiment: 'negative', is_positive: false },
  'OptedOut': { category: 'unsubscribe', sentiment: 'negative', is_positive: false },
  'Neutral': { category: 'neutral', sentiment: 'neutral', is_positive: false },
  'Question': { category: 'question', sentiment: 'neutral', is_positive: false },
};

// ============================================================================
// PHONEBURNER DISPOSITION MAPPINGS
// Complete mapping from PhoneBurner dispositions to internal metrics
// Reference: public/docs/disposition-metrics-mapping.md
// ============================================================================

export interface DispositionClassification {
  disposition: 'connected' | 'voicemail' | 'no_answer' | 'bad_data' | 'do_not_call';
  outcome: string;
  is_connection: boolean;
  is_conversation: boolean;
  is_dm: boolean;
  is_voicemail: boolean;
  is_meeting: boolean;
  is_bad_data: boolean;
}

/**
 * PhoneBurner disposition mappings
 * Each disposition maps to specific metric classifications
 */
export const PHONEBURNER_DISPOSITION_MAP: Record<string, DispositionClassification> = {
  // ============ CONNECTION DISPOSITIONS ============
  // These count toward totalCalls AND connections
  
  'receptionist': {
    disposition: 'connected',
    outcome: 'gatekeeper',
    is_connection: true,
    is_conversation: false,
    is_dm: false,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'callback requested': {
    disposition: 'connected',
    outcome: 'callback',
    is_connection: true,
    is_conversation: true,
    is_dm: true,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'send email': {
    disposition: 'connected',
    outcome: 'send_email',
    is_connection: true,
    is_conversation: false, // Will be overridden if talk_duration > 60s
    is_dm: false,           // Will be overridden if talk_duration > 60s
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'not qualified': {
    disposition: 'connected',
    outcome: 'not_qualified',
    is_connection: true,
    is_conversation: true,
    is_dm: true,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'positive - blacklist co': {
    disposition: 'connected',
    outcome: 'meeting_interest',
    is_connection: true,
    is_conversation: true,
    is_dm: true,
    is_voicemail: false,
    is_meeting: true, // Meeting-level interest (even if company blacklisted)
    is_bad_data: false,
  },
  'negative - blacklist co': {
    disposition: 'connected',
    outcome: 'not_interested',
    is_connection: true,
    is_conversation: true,
    is_dm: true,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'negative - blacklist contact': {
    disposition: 'connected',
    outcome: 'not_interested',
    is_connection: true,
    is_conversation: true,
    is_dm: true,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'hung up': {
    disposition: 'connected',
    outcome: 'hung_up',
    is_connection: true,
    is_conversation: false,
    is_dm: false,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'meeting booked': {
    disposition: 'connected',
    outcome: 'meeting_booked',
    is_connection: true,
    is_conversation: true,
    is_dm: true,
    is_voicemail: false,
    is_meeting: true, // Actual pursuable meeting
    is_bad_data: false,
  },

  // ============ NON-CONNECTION DISPOSITIONS ============
  // These count toward totalCalls but NOT connections
  
  'voicemail': {
    disposition: 'voicemail',
    outcome: 'voicemail',
    is_connection: false,
    is_conversation: false,
    is_dm: false,
    is_voicemail: true,
    is_meeting: false,
    is_bad_data: false,
  },
  'live voicemail': {
    disposition: 'voicemail',
    outcome: 'voicemail',
    is_connection: false,
    is_conversation: false,
    is_dm: false,
    is_voicemail: true,
    is_meeting: false,
    is_bad_data: false,
  },
  'no answer': {
    disposition: 'no_answer',
    outcome: 'no_answer',
    is_connection: false,
    is_conversation: false,
    is_dm: false,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'bad phone': {
    disposition: 'bad_data',
    outcome: 'bad_phone',
    is_connection: false,
    is_conversation: false,
    is_dm: false,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: true,
  },
  'wrong number': {
    disposition: 'bad_data',
    outcome: 'wrong_number',
    is_connection: false,
    is_conversation: false,
    is_dm: false,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: true,
  },
  'do not call': {
    disposition: 'do_not_call',
    outcome: 'do_not_call',
    is_connection: false,
    is_conversation: false,
    is_dm: false,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false, // Track separately for compliance
  },

  // ============ LEGACY/GENERIC DISPOSITIONS ============
  // For backward compatibility with existing data
  
  'connected': {
    disposition: 'connected',
    outcome: 'connected',
    is_connection: true,
    is_conversation: false,
    is_dm: false,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'conversation': {
    disposition: 'connected',
    outcome: 'connected',
    is_connection: true,
    is_conversation: true,
    is_dm: false,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'dm_conversation': {
    disposition: 'connected',
    outcome: 'dm_conversation',
    is_connection: true,
    is_conversation: true,
    is_dm: true,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'vm': {
    disposition: 'voicemail',
    outcome: 'voicemail',
    is_connection: false,
    is_conversation: false,
    is_dm: false,
    is_voicemail: true,
    is_meeting: false,
    is_bad_data: false,
  },
  'busy': {
    disposition: 'no_answer',
    outcome: 'busy',
    is_connection: false,
    is_conversation: false,
    is_dm: false,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'interested': {
    disposition: 'connected',
    outcome: 'interested',
    is_connection: true,
    is_conversation: true,
    is_dm: true,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'not_interested': {
    disposition: 'connected',
    outcome: 'not_interested',
    is_connection: true,
    is_conversation: true,
    is_dm: true,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'gatekeeper': {
    disposition: 'connected',
    outcome: 'gatekeeper',
    is_connection: true,
    is_conversation: false,
    is_dm: false,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'gk': {
    disposition: 'connected',
    outcome: 'gatekeeper',
    is_connection: true,
    is_conversation: false,
    is_dm: false,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'callback': {
    disposition: 'connected',
    outcome: 'callback',
    is_connection: true,
    is_conversation: true,
    is_dm: true,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: false,
  },
  'disconnected': {
    disposition: 'bad_data',
    outcome: 'disconnected',
    is_connection: false,
    is_conversation: false,
    is_dm: false,
    is_voicemail: false,
    is_meeting: false,
    is_bad_data: true,
  },
};

// Legacy CALL_DISPOSITION_MAP for backward compatibility
export const CALL_DISPOSITION_MAP: Record<string, {
  disposition: string;
  outcome: string;
  is_dm: boolean;
}> = Object.fromEntries(
  Object.entries(PHONEBURNER_DISPOSITION_MAP).map(([key, val]) => [
    key,
    { disposition: val.disposition, outcome: val.outcome, is_dm: val.is_dm }
  ])
);

/**
 * Classify a PhoneBurner disposition with talk_duration context
 * Handles "Send Email" ambiguity using talk_duration > 60s as DM indicator
 * 
 * @param rawDisposition - The raw disposition string from PhoneBurner
 * @param talkDuration - Talk duration in seconds (used for Send Email classification)
 * @returns Complete classification for metric calculations
 */
export function classifyPhoneBurnerDisposition(
  rawDisposition: string | null | undefined,
  talkDuration: number = 0
): {
  disposition: string;
  conversation_outcome: string;
  is_dm_conversation: boolean;
  counts_as_connection: boolean;
  counts_as_conversation: boolean;
  counts_as_voicemail: boolean;
  counts_as_meeting: boolean;
  counts_as_bad_data: boolean;
} {
  if (!rawDisposition) {
    return {
      disposition: 'no_answer',
      conversation_outcome: 'unknown',
      is_dm_conversation: false,
      counts_as_connection: false,
      counts_as_conversation: false,
      counts_as_voicemail: false,
      counts_as_meeting: false,
      counts_as_bad_data: false,
    };
  }

  const normalized = rawDisposition.toLowerCase().trim();
  const mapping = PHONEBURNER_DISPOSITION_MAP[normalized];

  if (mapping) {
    // Special handling for "Send Email" - use talk_duration as proxy for DM vs gatekeeper
    let isDM = mapping.is_dm;
    let isConversation = mapping.is_conversation;
    if (normalized === 'send email' && talkDuration > 60) {
      isDM = true;
      isConversation = true;
    }

    return {
      disposition: mapping.disposition,
      conversation_outcome: mapping.outcome,
      is_dm_conversation: isDM,
      counts_as_connection: mapping.is_connection,
      counts_as_conversation: isConversation,
      counts_as_voicemail: mapping.is_voicemail,
      counts_as_meeting: mapping.is_meeting,
      counts_as_bad_data: mapping.is_bad_data,
    };
  }

  // Fuzzy matching for variations not in the map
  if (normalized.includes('callback')) {
    return {
      disposition: 'connected',
      conversation_outcome: 'callback',
      is_dm_conversation: true,
      counts_as_connection: true,
      counts_as_conversation: true,
      counts_as_voicemail: false,
      counts_as_meeting: false,
      counts_as_bad_data: false,
    };
  }
  if (normalized.includes('positive')) {
    return {
      disposition: 'connected',
      conversation_outcome: 'meeting_interest',
      is_dm_conversation: true,
      counts_as_connection: true,
      counts_as_conversation: true,
      counts_as_voicemail: false,
      counts_as_meeting: true,
      counts_as_bad_data: false,
    };
  }
  if (normalized.includes('negative')) {
    return {
      disposition: 'connected',
      conversation_outcome: 'not_interested',
      is_dm_conversation: true,
      counts_as_connection: true,
      counts_as_conversation: true,
      counts_as_voicemail: false,
      counts_as_meeting: false,
      counts_as_bad_data: false,
    };
  }
  if (normalized.includes('meeting') || normalized.includes('booked')) {
    return {
      disposition: 'connected',
      conversation_outcome: 'meeting_booked',
      is_dm_conversation: true,
      counts_as_connection: true,
      counts_as_conversation: true,
      counts_as_voicemail: false,
      counts_as_meeting: true,
      counts_as_bad_data: false,
    };
  }
  if (normalized.includes('voicemail') || normalized === 'vm') {
    return {
      disposition: 'voicemail',
      conversation_outcome: 'voicemail',
      is_dm_conversation: false,
      counts_as_connection: false,
      counts_as_conversation: false,
      counts_as_voicemail: true,
      counts_as_meeting: false,
      counts_as_bad_data: false,
    };
  }
  if (normalized.includes('no answer')) {
    return {
      disposition: 'no_answer',
      conversation_outcome: 'no_answer',
      is_dm_conversation: false,
      counts_as_connection: false,
      counts_as_conversation: false,
      counts_as_voicemail: false,
      counts_as_meeting: false,
      counts_as_bad_data: false,
    };
  }
  if (normalized.includes('bad') || normalized.includes('wrong') || normalized.includes('disconnect')) {
    return {
      disposition: 'bad_data',
      conversation_outcome: normalized.includes('wrong') ? 'wrong_number' : 'bad_phone',
      is_dm_conversation: false,
      counts_as_connection: false,
      counts_as_conversation: false,
      counts_as_voicemail: false,
      counts_as_meeting: false,
      counts_as_bad_data: true,
    };
  }
  if (normalized.includes('connect') || normalized.includes('answer')) {
    return {
      disposition: 'connected',
      conversation_outcome: 'connected',
      is_dm_conversation: false,
      counts_as_connection: true,
      counts_as_conversation: false,
      counts_as_voicemail: false,
      counts_as_meeting: false,
      counts_as_bad_data: false,
    };
  }

  // Default fallback for unknown dispositions
  console.warn(`Unknown PhoneBurner disposition: "${rawDisposition}"`);
  return {
    disposition: 'no_answer',
    conversation_outcome: 'unknown',
    is_dm_conversation: false,
    counts_as_connection: false,
    counts_as_conversation: false,
    counts_as_voicemail: false,
    counts_as_meeting: false,
    counts_as_bad_data: false,
  };
}

/**
 * Get all PhoneBurner dispositions for reference UI
 */
export function getPhoneBurnerDispositionMatrix(): Array<{
  disposition: string;
  totalCalls: boolean;
  connections: boolean;
  conversations: boolean;
  dmConversations: boolean;
  voicemails: boolean;
  meetings: boolean;
  badData: boolean;
  notes: string;
}> {
  return [
    // Connection dispositions
    { disposition: 'Receptionist', totalCalls: true, connections: true, conversations: false, dmConversations: false, voicemails: false, meetings: false, badData: false, notes: 'Gatekeeper, not DM' },
    { disposition: 'Callback Requested', totalCalls: true, connections: true, conversations: true, dmConversations: true, voicemails: false, meetings: false, badData: false, notes: 'DM requested callback' },
    { disposition: 'Send Email', totalCalls: true, connections: true, conversations: false, dmConversations: false, voicemails: false, meetings: false, badData: false, notes: 'DM if talk > 60s' },
    { disposition: 'Not Qualified', totalCalls: true, connections: true, conversations: true, dmConversations: true, voicemails: false, meetings: false, badData: false, notes: 'Spoke with DM, not a fit' },
    { disposition: 'Positive - Blacklist Co', totalCalls: true, connections: true, conversations: true, dmConversations: true, voicemails: false, meetings: true, badData: false, notes: 'Meeting interest, company blacklisted' },
    { disposition: 'Negative - Blacklist Co', totalCalls: true, connections: true, conversations: true, dmConversations: true, voicemails: false, meetings: false, badData: false, notes: 'Not interested, company blacklisted' },
    { disposition: 'Negative - Blacklist Contact', totalCalls: true, connections: true, conversations: true, dmConversations: true, voicemails: false, meetings: false, badData: false, notes: 'Not interested, contact blacklisted' },
    { disposition: 'Hung Up', totalCalls: true, connections: true, conversations: false, dmConversations: false, voicemails: false, meetings: false, badData: false, notes: 'Connected but hung up' },
    { disposition: 'Meeting Booked', totalCalls: true, connections: true, conversations: true, dmConversations: true, voicemails: false, meetings: true, badData: false, notes: 'Pursuable meeting booked' },
    // Non-connection dispositions
    { disposition: 'Voicemail', totalCalls: true, connections: false, conversations: false, dmConversations: false, voicemails: true, meetings: false, badData: false, notes: 'Standard VM' },
    { disposition: 'Live Voicemail', totalCalls: true, connections: false, conversations: false, dmConversations: false, voicemails: true, meetings: false, badData: false, notes: 'Live VM drop' },
    { disposition: 'No Answer', totalCalls: true, connections: false, conversations: false, dmConversations: false, voicemails: false, meetings: false, badData: false, notes: 'No pickup' },
    { disposition: 'Bad Phone', totalCalls: true, connections: false, conversations: false, dmConversations: false, voicemails: false, meetings: false, badData: true, notes: 'Disconnected' },
    { disposition: 'Wrong Number', totalCalls: true, connections: false, conversations: false, dmConversations: false, voicemails: false, meetings: false, badData: true, notes: 'Wrong person/company' },
    { disposition: 'Do Not Call', totalCalls: true, connections: false, conversations: false, dmConversations: false, voicemails: false, meetings: false, badData: false, notes: 'Legal opt-out' },
  ];
}

// ============================================================================
// COLD CALLS TABLE DISPOSITION MAPPINGS (NocoDB → cold_calls)
// Pre-computed during sync, used for dashboard metrics without runtime calc
// Reference: cold-calls-sync edge function
// ============================================================================

export interface ColdCallDispositionFlags {
  is_connection: boolean;
  is_meeting: boolean;
  is_voicemail: boolean;
  is_bad_data: boolean;
}

/**
 * Cold Call disposition mappings for the cold_calls table
 * These dispositions are normalized (time suffixes stripped) during sync
 */
export const COLD_CALL_DISPOSITIONS: Record<string, ColdCallDispositionFlags> = {
  // CONNECTION DISPOSITIONS (counts toward connections)
  'receptionist': { is_connection: true, is_meeting: false, is_voicemail: false, is_bad_data: false },
  'callback requested': { is_connection: true, is_meeting: true, is_voicemail: false, is_bad_data: false },
  'send email': { is_connection: true, is_meeting: false, is_voicemail: false, is_bad_data: false },
  'not qualified': { is_connection: true, is_meeting: false, is_voicemail: false, is_bad_data: false },
  'positive - blacklist co': { is_connection: true, is_meeting: true, is_voicemail: false, is_bad_data: false },
  'negative - blacklist co': { is_connection: true, is_meeting: false, is_voicemail: false, is_bad_data: false },
  'negative - blacklist contact': { is_connection: true, is_meeting: false, is_voicemail: false, is_bad_data: false },
  'hung up': { is_connection: true, is_meeting: false, is_voicemail: false, is_bad_data: false },
  'meeting booked': { is_connection: true, is_meeting: true, is_voicemail: false, is_bad_data: false },
  
  // VOICEMAIL DISPOSITIONS
  'voicemail': { is_connection: false, is_meeting: false, is_voicemail: true, is_bad_data: false },
  'live voicemail': { is_connection: false, is_meeting: false, is_voicemail: true, is_bad_data: false },
  'voicemail drop': { is_connection: false, is_meeting: false, is_voicemail: true, is_bad_data: false },
  
  // NO ANSWER / NON-CONNECTION
  'no answer': { is_connection: false, is_meeting: false, is_voicemail: false, is_bad_data: false },
  
  // BAD DATA
  'bad phone': { is_connection: false, is_meeting: false, is_voicemail: false, is_bad_data: true },
  'wrong number': { is_connection: false, is_meeting: false, is_voicemail: false, is_bad_data: true },
  'do not call': { is_connection: false, is_meeting: false, is_voicemail: false, is_bad_data: true },
};

/**
 * Get cold call dispositions matrix for Settings reference UI
 */
export function getColdCallDispositionMatrix(): Array<{
  disposition: string;
  displayName: string;
  totalCalls: boolean;
  connections: boolean;
  meetings: boolean;
  voicemails: boolean;
  badData: boolean;
  notes: string;
}> {
  return [
    // Connection dispositions
    { disposition: 'receptionist', displayName: 'Receptionist', totalCalls: true, connections: true, meetings: false, voicemails: false, badData: false, notes: 'Gatekeeper, not DM' },
    { disposition: 'callback requested', displayName: 'Callback Requested', totalCalls: true, connections: true, meetings: true, voicemails: false, badData: false, notes: 'DM requested callback' },
    { disposition: 'send email', displayName: 'Send Email', totalCalls: true, connections: true, meetings: false, voicemails: false, badData: false, notes: 'Connection if duration > 60s' },
    { disposition: 'not qualified', displayName: 'Not Qualified', totalCalls: true, connections: true, meetings: false, voicemails: false, badData: false, notes: 'Spoke with DM, not a fit' },
    { disposition: 'positive - blacklist co', displayName: 'Positive - Blacklist Co', totalCalls: true, connections: true, meetings: true, voicemails: false, badData: false, notes: 'Meeting interest, company blacklisted' },
    { disposition: 'negative - blacklist co', displayName: 'Negative - Blacklist Co', totalCalls: true, connections: true, meetings: false, voicemails: false, badData: false, notes: 'Not interested' },
    { disposition: 'negative - blacklist contact', displayName: 'Negative - Blacklist Contact', totalCalls: true, connections: true, meetings: false, voicemails: false, badData: false, notes: 'Contact blacklisted' },
    { disposition: 'hung up', displayName: 'Hung Up', totalCalls: true, connections: true, meetings: false, voicemails: false, badData: false, notes: 'Connected but hung up' },
    { disposition: 'meeting booked', displayName: 'Meeting Booked', totalCalls: true, connections: true, meetings: true, voicemails: false, badData: false, notes: 'Pursuable meeting booked' },
    // Voicemail dispositions
    { disposition: 'voicemail', displayName: 'Voicemail', totalCalls: true, connections: false, meetings: false, voicemails: true, badData: false, notes: 'Standard VM' },
    { disposition: 'live voicemail', displayName: 'Live Voicemail', totalCalls: true, connections: false, meetings: false, voicemails: true, badData: false, notes: 'Live VM drop' },
    // Non-connection dispositions
    { disposition: 'no answer', displayName: 'No Answer', totalCalls: true, connections: false, meetings: false, voicemails: false, badData: false, notes: 'No pickup' },
    // Bad data dispositions
    { disposition: 'bad phone', displayName: 'Bad Phone', totalCalls: true, connections: false, meetings: false, voicemails: false, badData: true, notes: 'Disconnected' },
    { disposition: 'wrong number', displayName: 'Wrong Number', totalCalls: true, connections: false, meetings: false, voicemails: false, badData: true, notes: 'Wrong person/company' },
    { disposition: 'do not call', displayName: 'Do Not Call', totalCalls: true, connections: false, meetings: false, voicemails: false, badData: true, notes: 'Legal opt-out' },
  ];
}

// Positive reply categories
export const POSITIVE_REPLY_CATEGORIES = ['meeting_request', 'interested'] as const;

// Negative reply categories
export const NEGATIVE_REPLY_CATEGORIES = ['not_interested', 'unsubscribe'] as const;

// Neutral reply categories
export const NEUTRAL_REPLY_CATEGORIES = [
  'out_of_office', 
  'referral', 
  'neutral', 
  'question', 
  'not_now'
] as const;

// All reply categories
export const ALL_REPLY_CATEGORIES = [
  ...POSITIVE_REPLY_CATEGORIES,
  ...NEGATIVE_REPLY_CATEGORIES,
  ...NEUTRAL_REPLY_CATEGORIES,
] as const;

export type ReplyCategory = typeof ALL_REPLY_CATEGORIES[number];
export type ReplySentiment = 'positive' | 'negative' | 'neutral';

/**
 * Map external category to internal category/sentiment
 */
export function mapExternalCategory(
  externalCategory: string | null | undefined,
  platform: 'smartlead' | 'replyio' | 'generic' = 'generic'
): { 
  reply_category: string | null; 
  reply_sentiment: string | null; 
  is_positive: boolean;
} {
  if (!externalCategory) {
    return { reply_category: null, reply_sentiment: null, is_positive: false };
  }

  const categoryMap = platform === 'smartlead' 
    ? SMARTLEAD_CATEGORY_MAP 
    : platform === 'replyio' 
      ? REPLYIO_CATEGORY_MAP 
      : { ...SMARTLEAD_CATEGORY_MAP, ...REPLYIO_CATEGORY_MAP };

  const mapped = categoryMap[externalCategory];
  if (mapped) {
    return {
      reply_category: mapped.category,
      reply_sentiment: mapped.sentiment,
      is_positive: mapped.is_positive,
    };
  }

  // Fallback: try to infer from category name
  const lower = externalCategory.toLowerCase();
  if (lower.includes('interested') && !lower.includes('not')) {
    return { reply_category: 'interested', reply_sentiment: 'positive', is_positive: true };
  }
  if (lower.includes('meeting') || lower.includes('booked') || lower.includes('scheduled')) {
    return { reply_category: 'meeting_request', reply_sentiment: 'positive', is_positive: true };
  }
  if (lower.includes('not interested')) {
    return { reply_category: 'not_interested', reply_sentiment: 'negative', is_positive: false };
  }

  return { reply_category: 'neutral', reply_sentiment: 'neutral', is_positive: false };
}

/**
 * Map call category to disposition/outcome
 */
export function mapCallCategory(category: string | null | undefined): {
  disposition: string;
  conversation_outcome: string;
  is_dm_conversation: boolean;
} {
  if (!category) {
    return { disposition: 'no_answer', conversation_outcome: 'no_answer', is_dm_conversation: false };
  }

  const lower = category.toLowerCase();
  
  // Check direct match first
  const directMatch = CALL_DISPOSITION_MAP[lower];
  if (directMatch) {
    return {
      disposition: directMatch.disposition,
      conversation_outcome: directMatch.outcome,
      is_dm_conversation: directMatch.is_dm,
    };
  }

  // Fuzzy matching
  if (lower.includes('connect') || lower.includes('conversation')) {
    return { disposition: 'connected', conversation_outcome: 'connected', is_dm_conversation: false };
  }
  if (lower.includes('voicemail') || lower.includes('vm')) {
    return { disposition: 'voicemail', conversation_outcome: 'voicemail', is_dm_conversation: false };
  }
  if (lower.includes('meeting') || lower.includes('booked')) {
    return { disposition: 'connected', conversation_outcome: 'meeting_booked', is_dm_conversation: true };
  }
  if (lower.includes('interested') && !lower.includes('not interested')) {
    return { disposition: 'connected', conversation_outcome: 'interested', is_dm_conversation: true };
  }
  if (lower.includes('not interested') || lower.includes('ni')) {
    return { disposition: 'connected', conversation_outcome: 'not_interested', is_dm_conversation: true };
  }
  if (lower.includes('gatekeeper') || lower.includes('gk')) {
    return { disposition: 'connected', conversation_outcome: 'gatekeeper', is_dm_conversation: false };
  }
  if (lower.includes('callback')) {
    return { disposition: 'connected', conversation_outcome: 'callback', is_dm_conversation: false };
  }

  return { disposition: 'no_answer', conversation_outcome: 'no_answer', is_dm_conversation: false };
}

/**
 * Check if a category is considered positive
 */
export function isPositiveCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  return POSITIVE_REPLY_CATEGORIES.includes(category as any);
}

/**
 * Get sentiment from category
 */
export function getSentimentFromCategory(category: string | null | undefined): ReplySentiment {
  if (!category) return 'neutral';
  if (POSITIVE_REPLY_CATEGORIES.includes(category as any)) return 'positive';
  if (NEGATIVE_REPLY_CATEGORIES.includes(category as any)) return 'negative';
  return 'neutral';
}
