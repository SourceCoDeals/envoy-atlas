/**
 * Webhook Payload Validation Schemas
 * 
 * Provides type-safe validation for webhook payloads
 * using a lightweight validation approach (no external deps)
 */

// =============================================================================
// Type definitions
// =============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

// =============================================================================
// SmartLead Webhook Types
// =============================================================================

export interface SmartLeadWebhookEvent {
  event_type: string;
  campaign_id?: number;
  lead_id?: number;
  email?: string;
  event_timestamp?: string;
  sequence_number?: number;
  variant_id?: string;
  link_url?: string;
  reply_text?: string;
  bounce_type?: string;
  bounce_reason?: string;
  category_id?: number;
  category_name?: string;
  event_id?: string;
}

const SMARTLEAD_EVENT_TYPES = [
  'EMAIL_SENT', 'email_sent',
  'EMAIL_OPEN', 'email_opened',
  'EMAIL_LINK_CLICK', 'email_clicked',
  'EMAIL_REPLY', 'email_replied',
  'EMAIL_BOUNCE', 'email_bounced',
  'LEAD_UNSUBSCRIBED', 'lead_unsubscribed',
  'LEAD_CATEGORY_UPDATED', 'lead_category_changed',
] as const;

export function validateSmartLeadWebhook(payload: unknown): ValidationResult<SmartLeadWebhookEvent> {
  const errors: string[] = [];
  
  if (!payload || typeof payload !== 'object') {
    return { success: false, errors: ['Payload must be an object'] };
  }

  const p = payload as Record<string, unknown>;

  // Validate event_type (required)
  if (!p.event_type || typeof p.event_type !== 'string') {
    errors.push('event_type is required and must be a string');
  } else if (!SMARTLEAD_EVENT_TYPES.includes(p.event_type as typeof SMARTLEAD_EVENT_TYPES[number])) {
    // Log warning but don't fail - might be a new event type
    console.warn(`[smartlead-webhook] Unknown event type: ${p.event_type}`);
  }

  // Validate optional fields
  if (p.campaign_id !== undefined && typeof p.campaign_id !== 'number') {
    errors.push('campaign_id must be a number');
  }

  if (p.lead_id !== undefined && typeof p.lead_id !== 'number') {
    errors.push('lead_id must be a number');
  }

  if (p.email !== undefined && typeof p.email !== 'string') {
    errors.push('email must be a string');
  } else if (p.email && !isValidEmail(p.email as string)) {
    errors.push('email must be a valid email address');
  }

  if (p.event_timestamp !== undefined && typeof p.event_timestamp !== 'string') {
    errors.push('event_timestamp must be a string');
  }

  if (p.sequence_number !== undefined && typeof p.sequence_number !== 'number') {
    errors.push('sequence_number must be a number');
  }

  // Sanitize string fields
  const sanitized: SmartLeadWebhookEvent = {
    event_type: String(p.event_type || ''),
    campaign_id: typeof p.campaign_id === 'number' ? p.campaign_id : undefined,
    lead_id: typeof p.lead_id === 'number' ? p.lead_id : undefined,
    email: typeof p.email === 'string' ? sanitizeString(p.email) : undefined,
    event_timestamp: typeof p.event_timestamp === 'string' ? p.event_timestamp : undefined,
    sequence_number: typeof p.sequence_number === 'number' ? p.sequence_number : undefined,
    variant_id: typeof p.variant_id === 'string' ? sanitizeString(p.variant_id) : undefined,
    link_url: typeof p.link_url === 'string' ? sanitizeUrl(p.link_url) : undefined,
    reply_text: typeof p.reply_text === 'string' ? sanitizeString(p.reply_text, 10000) : undefined,
    bounce_type: typeof p.bounce_type === 'string' ? sanitizeString(p.bounce_type) : undefined,
    bounce_reason: typeof p.bounce_reason === 'string' ? sanitizeString(p.bounce_reason, 1000) : undefined,
    category_id: typeof p.category_id === 'number' ? p.category_id : undefined,
    category_name: typeof p.category_name === 'string' ? sanitizeString(p.category_name) : undefined,
    event_id: typeof p.event_id === 'string' ? sanitizeString(p.event_id) : undefined,
  };

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: sanitized };
}

// =============================================================================
// Reply.io Webhook Types
// =============================================================================

export interface ReplyioWebhookEvent {
  eventType: string;
  sequenceId?: number;
  campaignId?: number;
  personId?: number;
  email?: string;
  personEmail?: string;
  timestamp?: string;
  stepNumber?: number;
  replyText?: string;
  bounceType?: string;
  bounceReason?: string;
  clickedUrl?: string;
  finishReason?: string;
  status?: string;
  eventId?: string;
}

const REPLYIO_EVENT_TYPES = [
  'email_sent',
  'email_opened',
  'email_clicked',
  'email_replied',
  'email_bounced',
  'contact_finished',
  'contact_unsubscribed',
] as const;

export function validateReplyioWebhook(payload: unknown): ValidationResult<ReplyioWebhookEvent> {
  const errors: string[] = [];
  
  if (!payload || typeof payload !== 'object') {
    return { success: false, errors: ['Payload must be an object'] };
  }

  const p = payload as Record<string, unknown>;

  // Validate eventType (required)
  if (!p.eventType || typeof p.eventType !== 'string') {
    errors.push('eventType is required and must be a string');
  }

  // Validate optional email fields
  const email = p.email || p.personEmail;
  if (email !== undefined && typeof email !== 'string') {
    errors.push('email must be a string');
  } else if (email && !isValidEmail(email as string)) {
    errors.push('email must be a valid email address');
  }

  // Sanitize
  const sanitized: ReplyioWebhookEvent = {
    eventType: String(p.eventType || ''),
    sequenceId: typeof p.sequenceId === 'number' ? p.sequenceId : undefined,
    campaignId: typeof p.campaignId === 'number' ? p.campaignId : undefined,
    personId: typeof p.personId === 'number' ? p.personId : undefined,
    email: typeof p.email === 'string' ? sanitizeString(p.email) : undefined,
    personEmail: typeof p.personEmail === 'string' ? sanitizeString(p.personEmail) : undefined,
    timestamp: typeof p.timestamp === 'string' ? p.timestamp : undefined,
    stepNumber: typeof p.stepNumber === 'number' ? p.stepNumber : undefined,
    replyText: typeof p.replyText === 'string' ? sanitizeString(p.replyText, 10000) : undefined,
    bounceType: typeof p.bounceType === 'string' ? sanitizeString(p.bounceType) : undefined,
    bounceReason: typeof p.bounceReason === 'string' ? sanitizeString(p.bounceReason, 1000) : undefined,
    clickedUrl: typeof p.clickedUrl === 'string' ? sanitizeUrl(p.clickedUrl) : undefined,
    finishReason: typeof p.finishReason === 'string' ? sanitizeString(p.finishReason) : undefined,
    status: typeof p.status === 'string' ? sanitizeString(p.status) : undefined,
    eventId: typeof p.eventId === 'string' ? sanitizeString(p.eventId) : undefined,
  };

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: sanitized };
}

// =============================================================================
// Helper Functions
// =============================================================================

function isValidEmail(email: string): boolean {
  // Basic email validation - not overly strict
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function sanitizeString(str: string, maxLength = 500): string {
  // Remove null bytes and control characters (except newlines/tabs)
  const sanitized = str
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized.slice(0, maxLength);
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow http/https URLs
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}
