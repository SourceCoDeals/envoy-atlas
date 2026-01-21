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

// Call disposition mappings
export const CALL_DISPOSITION_MAP: Record<string, {
  disposition: string;
  outcome: string;
  is_dm: boolean;
}> = {
  'connected': { disposition: 'connected', outcome: 'connected', is_dm: false },
  'conversation': { disposition: 'connected', outcome: 'connected', is_dm: false },
  'dm_conversation': { disposition: 'connected', outcome: 'dm_conversation', is_dm: true },
  'voicemail': { disposition: 'voicemail', outcome: 'voicemail', is_dm: false },
  'vm': { disposition: 'voicemail', outcome: 'voicemail', is_dm: false },
  'no_answer': { disposition: 'no_answer', outcome: 'no_answer', is_dm: false },
  'busy': { disposition: 'no_answer', outcome: 'busy', is_dm: false },
  'meeting_booked': { disposition: 'connected', outcome: 'meeting_booked', is_dm: true },
  'interested': { disposition: 'connected', outcome: 'interested', is_dm: true },
  'not_interested': { disposition: 'connected', outcome: 'not_interested', is_dm: true },
  'gatekeeper': { disposition: 'connected', outcome: 'gatekeeper', is_dm: false },
  'gk': { disposition: 'connected', outcome: 'gatekeeper', is_dm: false },
  'callback': { disposition: 'connected', outcome: 'callback', is_dm: false },
  'wrong_number': { disposition: 'no_answer', outcome: 'wrong_number', is_dm: false },
  'disconnected': { disposition: 'no_answer', outcome: 'disconnected', is_dm: false },
};

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
