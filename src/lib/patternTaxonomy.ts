// Standardized pattern taxonomy for consistent labeling across the app

// Personalization Types
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

// Format Types
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

// Length Categories
export const LENGTH_LABELS: Record<string, string> = {
  very_short: 'Very Short (1-20 chars)',
  short: 'Short (21-40 chars)',
  medium: 'Medium (41-60 chars)',
  long: 'Long (61+ chars)',
};

// CTA Types
export const CTA_LABELS: Record<string, string> = {
  soft: 'Soft Ask',
  meeting: 'Meeting Request',
  calendar: 'Calendar Link',
  permission: 'Permission-Based',
  info: 'Information Offer',
  binary: 'Binary Choice',
  none: 'No CTA',
};

export const CTA_DESCRIPTIONS: Record<string, string> = {
  soft: 'Low-pressure ask like "thoughts?" or "interested?"',
  meeting: 'Requests a call or meeting directly',
  calendar: 'Includes calendar/scheduling link',
  permission: 'Asks for permission first ("Would it be okay if...")',
  info: 'Offers to send more information',
  binary: 'Offers specific time choices ("Tuesday or Thursday?")',
  none: 'No clear call-to-action detected',
};

// Confidence Levels
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

// Pattern type mapping (for pattern discovery)
export const PATTERN_TYPE_LABELS: Record<string, string> = {
  personalization: 'Personalization',
  format: 'Subject Format',
  length: 'Subject Length',
  cta: 'CTA Type',
  body_length: 'Body Length',
  tone: 'Tone',
  structure: 'Structure',
};

// Helper to get consistent label
export function getPersonalizationLabel(type: string): string {
  return PERSONALIZATION_LABELS[type] || type.replace('_', ' ');
}

export function getFormatLabel(type: string): string {
  return FORMAT_LABELS[type] || type.replace('_', ' ');
}

export function getLengthLabel(category: string): string {
  return LENGTH_LABELS[category] || category.replace('_', ' ');
}

export function getCTALabel(type: string): string {
  return CTA_LABELS[type] || type.replace('_', ' ');
}
