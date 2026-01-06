// Reply Classification System based on the Strategic Framework

export type ReplyClassification = 
  | 'meeting_request'
  | 'interested'
  | 'question'
  | 'referral'
  | 'not_now'
  | 'not_interested'
  | 'unsubscribe'
  | 'out_of_office'
  | 'negative_hostile'
  | 'neutral';

export type PriorityLevel = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'hold';

export interface ClassificationConfig {
  label: string;
  priority: PriorityLevel;
  targetResponseTime: string;
  color: 'red' | 'orange' | 'yellow' | 'green' | 'gray' | 'blue';
  action: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const CLASSIFICATION_CONFIG: Record<ReplyClassification, ClassificationConfig> = {
  meeting_request: {
    label: 'Meeting Request',
    priority: 'P0',
    targetResponseTime: '< 1 hour',
    color: 'red',
    action: 'Send calendar link immediately',
    bgClass: 'bg-red-500/20',
    textClass: 'text-red-500',
    borderClass: 'border-red-500/30',
  },
  interested: {
    label: 'Interested',
    priority: 'P1',
    targetResponseTime: '< 4 hours',
    color: 'orange',
    action: 'Provide info + soft ask for meeting',
    bgClass: 'bg-orange-500/20',
    textClass: 'text-orange-500',
    borderClass: 'border-orange-500/30',
  },
  question: {
    label: 'Question',
    priority: 'P2',
    targetResponseTime: '< 4 hours',
    color: 'yellow',
    action: 'Answer directly, re-establish value',
    bgClass: 'bg-yellow-500/20',
    textClass: 'text-yellow-500',
    borderClass: 'border-yellow-500/30',
  },
  referral: {
    label: 'Referral',
    priority: 'P2',
    targetResponseTime: '< 24 hours',
    color: 'blue',
    action: 'Thank them, follow up with referral',
    bgClass: 'bg-blue-500/20',
    textClass: 'text-blue-500',
    borderClass: 'border-blue-500/30',
  },
  not_now: {
    label: 'Not Now',
    priority: 'P3',
    targetResponseTime: '< 24 hours',
    color: 'gray',
    action: 'Acknowledge, add to nurture sequence',
    bgClass: 'bg-muted',
    textClass: 'text-muted-foreground',
    borderClass: 'border-border',
  },
  not_interested: {
    label: 'Not Interested',
    priority: 'P4',
    targetResponseTime: '< 48 hours',
    color: 'gray',
    action: 'Remove from sequence, update suppression',
    bgClass: 'bg-muted',
    textClass: 'text-muted-foreground',
    borderClass: 'border-border',
  },
  unsubscribe: {
    label: 'Unsubscribe',
    priority: 'P0',
    targetResponseTime: 'Immediate',
    color: 'red',
    action: 'Remove from all sequences immediately',
    bgClass: 'bg-destructive/20',
    textClass: 'text-destructive',
    borderClass: 'border-destructive/30',
  },
  out_of_office: {
    label: 'Out of Office',
    priority: 'hold',
    targetResponseTime: 'System handles',
    color: 'gray',
    action: 'Pause sequence, auto-resume after return',
    bgClass: 'bg-muted',
    textClass: 'text-muted-foreground',
    borderClass: 'border-border',
  },
  negative_hostile: {
    label: 'Negative',
    priority: 'P3',
    targetResponseTime: '< 24 hours',
    color: 'gray',
    action: 'Archive, remove from sequences',
    bgClass: 'bg-muted',
    textClass: 'text-muted-foreground',
    borderClass: 'border-border',
  },
  neutral: {
    label: 'Neutral',
    priority: 'P2',
    targetResponseTime: '< 24 hours',
    color: 'gray',
    action: 'Review and classify manually',
    bgClass: 'bg-muted',
    textClass: 'text-muted-foreground',
    borderClass: 'border-border',
  },
};

// Signal phrases for classification (used for AI or rule-based classification)
const SIGNAL_PHRASES: Record<ReplyClassification, string[]> = {
  meeting_request: [
    "let's schedule", "schedule a call", "are you free", "set up a meeting",
    "can we do a demo", "when are you available", "book a time", "calendar",
    "let's chat", "quick call", "15 minutes", "30 minutes",
  ],
  interested: [
    "sounds interesting", "tell me more", "what does this cost", "how does this work",
    "send me some information", "i'd like to learn more", "very interesting",
    "this caught my attention", "intrigued", "curious",
  ],
  question: [
    "who are you", "how did you get my email", "what company is this",
    "what exactly do you do", "is this spam", "what is this about",
    "can you explain", "i don't understand",
  ],
  referral: [
    "you should talk to", "i'm not the right person", "let me connect you",
    "i've forwarded this", "cc'ing", "try reaching out to", "contact",
    "the right person would be",
  ],
  not_now: [
    "not a priority right now", "reach out next quarter", "just signed with",
    "not in the budget", "maybe in 6 months", "in the middle of",
    "try again later", "not the right time", "busy right now",
  ],
  not_interested: [
    "not interested", "this isn't for us", "we don't need", "no thanks",
    "we're all set", "don't contact me again", "please remove me",
    "not a fit", "pass",
  ],
  unsubscribe: [
    "unsubscribe", "remove me from your list", "stop emailing",
    "take me off", "don't email me", "opt out", "remove from list",
  ],
  out_of_office: [
    "out of the office", "on vacation", "limited access",
    "away from my desk", "i'll respond when i return", "automatic reply",
    "currently out", "back on",
  ],
  negative_hostile: [
    "stop", "spam", "reported", "lawsuit", "legal action", "harassing",
    "never contact", "blocked",
  ],
  neutral: [],
};

// Classify reply based on content (simple rule-based approach)
export function classifyReply(content: string | null, eventType?: string): ReplyClassification {
  if (!content) {
    // Fallback to event type if no content
    if (eventType === 'positive_reply' || eventType === 'interested') return 'interested';
    if (eventType === 'not_interested' || eventType === 'negative_reply') return 'not_interested';
    if (eventType === 'out_of_office') return 'out_of_office';
    return 'neutral';
  }

  const lowerContent = content.toLowerCase();

  // Check in priority order
  for (const classification of [
    'meeting_request',
    'unsubscribe',
    'out_of_office',
    'referral',
    'interested',
    'question',
    'not_now',
    'not_interested',
    'negative_hostile',
  ] as ReplyClassification[]) {
    const phrases = SIGNAL_PHRASES[classification];
    if (phrases.some(phrase => lowerContent.includes(phrase))) {
      return classification;
    }
  }

  // Additional heuristics
  if (lowerContent.includes('?') && lowerContent.length < 200) {
    return 'question';
  }

  return 'neutral';
}

// Get priority sort order
export function getPrioritySortOrder(priority: PriorityLevel): number {
  const order: Record<PriorityLevel, number> = {
    'P0': 0,
    'P1': 1,
    'P2': 2,
    'P3': 3,
    'P4': 4,
    'hold': 5,
  };
  return order[priority];
}
