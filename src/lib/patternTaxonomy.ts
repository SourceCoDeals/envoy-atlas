// Standardized pattern taxonomy for consistent labeling across the app

// ========== PERSONALIZATION TYPES ==========
export const PERSONALIZATION_LABELS: Record<string, string> = {
  none: 'No Personalization',
  first_name: 'First Name',
  company: 'Company Name',
  title: 'Job Title',
  industry: 'Industry',
  trigger: 'Trigger Event',
};

export const PERSONALIZATION_DESCRIPTIONS: Record<string, string> = {
  none: 'No personalization tokens used',
  first_name: 'Uses {{first_name}} or similar',
  company: 'Uses {{company}} to reference recipient company',
  title: 'Uses {{title}} or {{role}} personalization',
  industry: 'Uses {{industry}} personalization',
  trigger: 'References a trigger event (news, achievement, etc.)',
};

// ========== SUBJECT FORMAT TYPES ==========
export const FORMAT_LABELS: Record<string, string> = {
  question: 'Question',
  statement: 'Statement',
  how_to: 'How-To',
  number: 'Number/List',
  intrigue: 'Intrigue',
  re_thread: 'Re: Thread',
  social_proof: 'Social Proof',
};

export const FORMAT_DESCRIPTIONS: Record<string, string> = {
  question: 'Subject line ends with a question mark',
  statement: 'Direct statement format',
  how_to: 'Starts with "How" or contains "how to"',
  number: 'Includes numbers or lists (e.g., "3 ways...")',
  intrigue: 'Creates curiosity with words like "thought", "quick", "idea"',
  re_thread: 'Mimics reply thread with "Re:" or "Following up"',
  social_proof: 'References achievements or others\' success',
};

// ========== LENGTH CATEGORIES ==========
export const LENGTH_LABELS: Record<string, string> = {
  very_short: 'Very Short (1-20 chars)',
  short: 'Short (21-40 chars)',
  medium: 'Medium (41-60 chars)',
  long: 'Long (61+ chars)',
};

// ========== CTA TAXONOMY (EXPANDED) ==========
export const CTA_LABELS: Record<string, string> = {
  soft_open: 'Open-ended Soft',
  soft_permission: 'Permission Soft',
  soft_interest: 'Interest Check',
  direct_time: 'Time-specific',
  direct_action: 'Action-specific',
  direct_calendar: 'Calendar Link',
  choice_time: 'Time Choice',
  choice_option: 'Option Choice',
  choice_multiple: 'Multiple Choice',
  value_resource: 'Resource Offer',
  value_audit: 'Audit Offer',
  value_content: 'Content Offer',
  referral_direct: 'Direct Referral',
  referral_indirect: 'Indirect Referral',
  question_problem: 'Problem Question',
  question_priority: 'Priority Question',
  // Backward compatibility
  soft: 'Soft Ask',
  meeting: 'Meeting Request',
  calendar: 'Calendar Link',
  permission: 'Permission-Based',
  info: 'Information Offer',
  binary: 'Binary Choice',
  none: 'No CTA',
};

export const CTA_DESCRIPTIONS: Record<string, string> = {
  soft_open: '"Would you be open to..." - Low-pressure first touch',
  soft_permission: '"Mind if I send over..." - Asks before delivering',
  soft_interest: '"Is this something you\'re exploring?" - Gauges interest',
  direct_time: '"Do you have 15 minutes this week?" - Specific time ask',
  direct_action: '"Let\'s schedule a quick call" - Clear action request',
  direct_calendar: '"Here\'s my calendar: [link]" - Booking link included',
  choice_time: '"Tuesday or Thursday?" - Binary time options',
  choice_option: '"Call or email?" - Format preference',
  choice_multiple: '"Which resonates: A, B, or C?" - Multiple options',
  value_resource: '"Want me to send the benchmark?" - Offers data/insight',
  value_audit: '"Happy to do a free analysis" - Offers service',
  value_content: '"Can I share our case study?" - Offers content',
  referral_direct: '"Who handles this on your team?" - Direct referral ask',
  referral_indirect: '"Am I reaching the right person?" - Soft referral',
  question_problem: '"How are you currently handling X?" - Problem-focused',
  question_priority: '"Is X a priority this quarter?" - Priority check',
  // Backward compatibility
  soft: 'Low-pressure ask like "thoughts?" or "interested?"',
  meeting: 'Requests a call or meeting directly',
  calendar: 'Includes calendar/scheduling link',
  permission: 'Asks for permission first ("Would it be okay if...")',
  info: 'Offers to send more information',
  binary: 'Offers specific time choices ("Tuesday or Thursday?")',
  none: 'No clear call-to-action detected',
};

export const CTA_CATEGORIES = {
  soft: ['soft_open', 'soft_permission', 'soft_interest', 'soft', 'permission'],
  direct: ['direct_time', 'direct_action', 'direct_calendar', 'meeting', 'calendar'],
  choice: ['choice_time', 'choice_option', 'choice_multiple', 'binary'],
  value: ['value_resource', 'value_audit', 'value_content', 'info'],
  referral: ['referral_direct', 'referral_indirect'],
  question: ['question_problem', 'question_priority'],
  none: ['none'],
};

// ========== OPENING LINE TYPES ==========
export const OPENING_LABELS: Record<string, string> = {
  personalized_observation: 'Personalized Observation',
  trigger_event: 'Trigger Event',
  mutual_connection: 'Mutual Connection',
  compliment: 'Compliment',
  direct_problem: 'Direct Problem',
  question_hook: 'Question Hook',
  pattern_interrupt: 'Pattern Interrupt',
  social_proof_lead: 'Social Proof Lead',
  statistic_lead: 'Statistic/Data',
  generic: 'Generic',
};

export const OPENING_DESCRIPTIONS: Record<string, string> = {
  personalized_observation: '"Noticed {company} just expanded into Europe..." - Shows research',
  trigger_event: '"Congrats on the Series B..." - References recent event',
  mutual_connection: '"Sarah Chen suggested I reach out..." - Leverages network',
  compliment: '"Loved your recent post about..." - Flattery-based opener',
  direct_problem: '"Most VPs of Sales waste 10 hours/week on..." - Problem statement',
  question_hook: '"Quick question about how {company} handles..." - Engaging question',
  pattern_interrupt: '"This isn\'t another sales pitch..." - Unexpected opener',
  social_proof_lead: '"We just helped {similar_company} achieve..." - Credibility',
  statistic_lead: '"67% of companies like {company} struggle with..." - Data-driven',
  generic: '"Hope this email finds you well..." - Generic/weak opener',
};

// ========== FIRST WORD TYPES ==========
export const FIRST_WORD_LABELS: Record<string, string> = {
  name: 'Name',
  company: 'Company',
  question: 'Question Word',
  verb: 'Verb',
  number: 'Number',
  pronoun: 'Pronoun',
  adjective: 'Adjective',
  other: 'Other',
};

export const FIRST_WORD_DESCRIPTIONS: Record<string, string> = {
  name: 'Starts with recipient name (e.g., "Sarah,")',
  company: 'Starts with company name',
  question: 'Starts with question word (What, Why, How, etc.)',
  verb: 'Starts with action verb (Grow, Save, Stop, etc.)',
  number: 'Starts with a number (3 ways, 5 ideas)',
  pronoun: 'Starts with pronoun (Your, We, I)',
  adjective: 'Starts with adjective (Quick, New, Amazing)',
  other: 'Other word type',
};

// ========== CAPITALIZATION STYLES ==========
export const CAPITALIZATION_LABELS: Record<string, string> = {
  title_case: 'Title Case',
  sentence_case: 'Sentence Case',
  lowercase: 'Lowercase',
  uppercase: 'UPPERCASE',
  mixed: 'Mixed',
};

// ========== PUNCTUATION TYPES ==========
export const PUNCTUATION_LABELS: Record<string, string> = {
  question: 'Question Mark',
  ellipsis: 'Ellipsis',
  exclamation: 'Exclamation',
  emoji: 'Emoji',
  none: 'No Special Punctuation',
};

// ========== TONE TYPES ==========
export const TONE_LABELS: Record<string, string> = {
  formal: 'Formal',
  professional: 'Professional',
  casual: 'Casual',
  direct: 'Direct',
  intriguing: 'Intriguing',
  friendly: 'Friendly',
  urgent: 'Urgent',
};

// ========== CONFIDENCE LEVELS ==========
export const CONFIDENCE_LABELS: Record<string, string> = {
  low: 'Low Confidence',
  medium: 'Medium Confidence', 
  high: 'High Confidence',
};

export const CONFIDENCE_THRESHOLDS = {
  low: { min: 0, max: 199, description: 'Need 200+ sends for medium confidence' },
  medium: { min: 200, max: 499, description: 'Need 500+ sends for high confidence' },
  high: { min: 500, max: Infinity, description: 'Statistically reliable' },
};

// ========== PATTERN TYPES ==========
export const PATTERN_TYPE_LABELS: Record<string, string> = {
  personalization: 'Personalization',
  format: 'Subject Format',
  length: 'Subject Length',
  cta: 'CTA Type',
  opening: 'Opening Type',
  body_length: 'Body Length',
  tone: 'Tone',
  structure: 'Structure',
  first_word: 'First Word',
  punctuation: 'Punctuation',
};

// ========== SPAM TRIGGER WORDS ==========
export const SPAM_TRIGGER_WORDS = [
  'free', 'guaranteed', 'act now', 'limited time', 'urgent', 'winner',
  'congratulations', 'prize', 'click here', 'buy now', 'order now',
  'special offer', 'risk free', 'no obligation', 'apply now', 'discount',
  'offer expires', 'last chance', 'deal', 'save big', 'lowest price',
];

// ========== URGENCY WORDS ==========
export const URGENCY_WORDS = [
  'quick', 'brief', 'short', 'fast', '15 min', '10 min', '5 min',
  'this week', 'today', 'tomorrow', 'asap', 'urgent', 'priority',
];

// ========== RISK REVERSAL WORDS ==========
export const RISK_REVERSAL_WORDS = [
  'no commitment', 'no obligation', 'see for yourself', 'no strings',
  'free trial', 'money back', 'cancel anytime', 'risk free',
];

// ========== HELPER FUNCTIONS ==========
export function getPersonalizationLabel(type: string): string {
  return PERSONALIZATION_LABELS[type] || type.replace(/_/g, ' ');
}

export function getFormatLabel(type: string): string {
  return FORMAT_LABELS[type] || type.replace(/_/g, ' ');
}

export function getLengthLabel(category: string): string {
  return LENGTH_LABELS[category] || category.replace(/_/g, ' ');
}

export function getCTALabel(type: string): string {
  return CTA_LABELS[type] || type.replace(/_/g, ' ');
}

export function getCTACategory(type: string): string {
  for (const [category, types] of Object.entries(CTA_CATEGORIES)) {
    if (types.includes(type)) return category;
  }
  return 'other';
}

export function getOpeningLabel(type: string): string {
  return OPENING_LABELS[type] || type.replace(/_/g, ' ');
}

export function getFirstWordLabel(type: string): string {
  return FIRST_WORD_LABELS[type] || type.replace(/_/g, ' ');
}

export function getToneLabel(type: string): string {
  return TONE_LABELS[type] || type.replace(/_/g, ' ');
}

// ========== ANALYSIS HELPERS ==========
export function detectSpamScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  SPAM_TRIGGER_WORDS.forEach(word => {
    if (lower.includes(word)) score += 10;
  });
  return Math.min(score, 100);
}

export function detectUrgencyScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  URGENCY_WORDS.forEach(word => {
    if (lower.includes(word)) score += 15;
  });
  return Math.min(score, 100);
}

export function detectFirstWordType(text: string): string {
  const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase() || '';
  
  // Question words
  if (/^(what|why|how|when|where|who|which|can|could|would|should|is|are|do|does)$/i.test(firstWord)) {
    return 'question';
  }
  
  // Numbers
  if (/^\d+/.test(firstWord)) return 'number';
  
  // Common verbs
  if (/^(grow|save|stop|start|boost|improve|increase|reduce|get|find|discover|learn|see|try|join)$/i.test(firstWord)) {
    return 'verb';
  }
  
  // Pronouns
  if (/^(your|you|we|i|our|my)$/i.test(firstWord)) return 'pronoun';
  
  // Adjectives
  if (/^(quick|new|amazing|exclusive|important|urgent|special|free|easy|simple)$/i.test(firstWord)) {
    return 'adjective';
  }
  
  return 'other';
}

export function detectCapitalizationStyle(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return 'other';
  
  const isAllLower = words.every(w => w === w.toLowerCase());
  const isAllUpper = words.every(w => w === w.toUpperCase());
  const isTitleCase = words.every(w => w[0] === w[0].toUpperCase());
  const isSentenceCase = words[0][0] === words[0][0].toUpperCase() && 
    words.slice(1).every(w => w === w.toLowerCase() || /^[A-Z]{2,}$/.test(w));
  
  if (isAllUpper) return 'uppercase';
  if (isAllLower) return 'lowercase';
  if (isSentenceCase) return 'sentence_case';
  if (isTitleCase) return 'title_case';
  return 'mixed';
}

export function detectOpeningType(text: string): string {
  const lower = text.toLowerCase().trim();
  
  // Pattern interrupt
  if (lower.includes("isn't another") || lower.includes("not another") || lower.includes("won't bore")) {
    return 'pattern_interrupt';
  }
  
  // Mutual connection
  if (lower.includes('suggested') || lower.includes('recommended') || lower.includes('mentioned your name')) {
    return 'mutual_connection';
  }
  
  // Trigger event
  if (lower.includes('congrats') || lower.includes('saw your') || lower.includes('noticed you') || 
      lower.includes('just raised') || lower.includes('recently')) {
    return 'trigger_event';
  }
  
  // Compliment
  if (lower.includes('loved your') || lower.includes('impressed by') || lower.includes('great job') ||
      lower.includes('fan of')) {
    return 'compliment';
  }
  
  // Question hook
  if (lower.includes('quick question') || (lower.endsWith('?') && lower.split(' ').length < 15)) {
    return 'question_hook';
  }
  
  // Direct problem
  if (lower.includes('most ') && (lower.includes('struggle') || lower.includes('waste') || lower.includes('spend'))) {
    return 'direct_problem';
  }
  
  // Social proof lead
  if (lower.includes('just helped') || lower.includes('we helped') || lower.includes('worked with')) {
    return 'social_proof_lead';
  }
  
  // Statistic lead
  if (/\d+%/.test(lower) || lower.includes('study shows') || lower.includes('research shows')) {
    return 'statistic_lead';
  }
  
  // Personalized observation
  if (lower.includes('noticed {{') || lower.includes('saw that {{') || lower.includes('{{company}}')) {
    return 'personalized_observation';
  }
  
  // Generic
  if (lower.includes('hope this') || lower.includes('reaching out') || lower.includes('my name is') ||
      lower.includes('i am writing') || lower.includes('i wanted to')) {
    return 'generic';
  }
  
  return 'other';
}

export function calculateYouIRatio(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  const youCount = words.filter(w => /^(you|your|yours|yourself)$/.test(w)).length;
  const iCount = words.filter(w => /^(i|me|my|mine|myself|we|our|ours|ourselves)$/.test(w)).length;
  
  if (iCount === 0) return youCount > 0 ? 10 : 1; // High ratio if all "you", neutral if neither
  return youCount / iCount;
}

export function detectPunctuationType(text: string): string[] {
  const types: string[] = [];
  if (text.includes('?')) types.push('question');
  if (text.includes('...') || text.includes('…')) types.push('ellipsis');
  if (text.includes('!')) types.push('exclamation');
  if (/[\u{1F600}-\u{1F64F}]/u.test(text)) types.push('emoji');
  if (types.length === 0) types.push('none');
  return types;
}
