# ENVOY ATLAS - TECHNICAL FIXES REFERENCE GUIDE

**For:** Engineering Team  
**Purpose:** Quick reference for implementing fixes  
**Format:** Copy-paste ready code examples

---

## FIX #1: Webhook Signature Validation

### Problem
SmartLead and Reply.io webhooks accept any request without verification.

### Solution Location
- `supabase/functions/smartlead-webhook/index.ts` (modify)
- `supabase/functions/replyio-webhook/index.ts` (modify)
- `supabase/functions/shared/webhook-validation.ts` (create new)

### Implementation

**File: `supabase/functions/shared/webhook-validation.ts`** (NEW FILE)

```typescript
import { createHmac, timingSafeEqual } from 'https://esm.sh/@deno-std/crypto';

export interface WebhookValidationConfig {
  headerName: string;
  algorithm: string; // 'sha256'
  encoding: string; // 'hex' or 'base64'
}

export const validateWebhookSignature = async (
  payload: string,
  signature: string,
  secret: string,
  config: WebhookValidationConfig
): Promise<boolean> => {
  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(secret);
  const messageBuffer = encoder.encode(payload);

  // Create HMAC
  const algorithm =
    config.algorithm === 'sha256'
      ? { name: 'HMAC', hash: 'SHA-256' }
      : { name: 'HMAC', hash: 'SHA-1' };

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    algorithm,
    false,
    ['sign']
  );

  const hashBuffer = await globalThis.crypto.subtle.sign(
    algorithm,
    cryptoKey,
    messageBuffer
  );

  // Convert to hex or base64
  let expectedSignature: string;
  if (config.encoding === 'hex') {
    expectedSignature = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } else {
    expectedSignature = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  }

  // Constant-time comparison
  return constantTimeCompare(signature, expectedSignature);
};

const constantTimeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};
```

**File: `supabase/functions/smartlead-webhook/index.ts`** (MODIFY)

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateWebhookSignature } from '../shared/webhook-validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-smartlead-signature',
};

Deno.serve(async (req) => {
  console.log('smartlead-webhook: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ✅ NEW: Validate signature
    const signature = req.headers.get('x-smartlead-signature');
    const webhookSecret = Deno.env.get('SMARTLEAD_WEBHOOK_SECRET');

    if (!signature || !webhookSecret) {
      console.error('Missing signature or secret');
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Get raw body for signature verification
    const bodyText = await req.text();

    // Validate signature
    const isValid = await validateWebhookSignature(
      bodyText,
      signature,
      webhookSecret,
      {
        headerName: 'x-smartlead-signature',
        algorithm: 'sha256',
        encoding: 'hex',
      }
    );

    if (!isValid) {
      console.error('Invalid signature', { signature, bodyText: bodyText.substring(0, 100) });
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Parse body (we already read it for signature validation)
    const body = JSON.parse(bodyText);

    // ... rest of existing code ...
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**Environment Setup:**
```bash
# Add to Supabase env variables (not .env file):
SMARTLEAD_WEBHOOK_SECRET=your_actual_secret_from_smartlead
REPLYIO_WEBHOOK_SECRET=your_actual_secret_from_replyio
```

### Testing

```typescript
// Test with valid signature
const payload = '{"event_type":"EMAIL_SENT","campaign_id":123}';
const secret = 'test-secret';

// Generate valid signature
const crypto = await import('crypto');
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payload);
const validSignature = hmac.digest('hex');

// Should pass
const result = await validateWebhookSignature(payload, validSignature, secret, {
  headerName: 'x-smartlead-signature',
  algorithm: 'sha256',
  encoding: 'hex',
});

console.assert(result === true, 'Valid signature should return true');

// Test with invalid signature - should fail
const result2 = await validateWebhookSignature(payload, 'invalid', secret, {...});
console.assert(result2 === false, 'Invalid signature should return false');
```

---

## FIX #2: Metric Updates - Race Condition Fix

### Problem
Non-atomic metric updates cause duplicate/missed counts.

### Solution Location
- `supabase/functions/smartlead-webhook/index.ts` (refactor)
- `supabase/migrations/[timestamp]_add_metric_functions.sql` (create)

### Implementation

**Step 1: Create Atomic Functions in Database**

**File: `supabase/migrations/20260121000000_add_atomic_metric_functions.sql`** (NEW)

```sql
-- Function to atomically increment campaign metrics
CREATE OR REPLACE FUNCTION increment_campaign_metric(
  p_campaign_id UUID,
  p_metric_name TEXT,
  p_value INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
  UPDATE campaigns
  SET
    positive_replies = CASE 
      WHEN p_metric_name = 'positive_replies' THEN positive_replies + p_value
      ELSE positive_replies 
    END,
    emails_opened = CASE 
      WHEN p_metric_name = 'emails_opened' THEN emails_opened + p_value
      ELSE emails_opened 
    END,
    emails_clicked = CASE 
      WHEN p_metric_name = 'emails_clicked' THEN emails_clicked + p_value
      ELSE emails_clicked 
    END,
    emails_sent = CASE 
      WHEN p_metric_name = 'emails_sent' THEN emails_sent + p_value
      ELSE emails_sent 
    END,
    emails_bounced = CASE 
      WHEN p_metric_name = 'emails_bounced' THEN emails_bounced + p_value
      ELSE emails_bounced 
    END,
    updated_at = NOW()
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Function to atomically upsert hourly metrics
CREATE OR REPLACE FUNCTION upsert_hourly_metric(
  p_engagement_id UUID,
  p_campaign_id UUID,
  p_hour TEXT,
  p_metric_name TEXT,
  p_value INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
  INSERT INTO hourly_metrics (
    engagement_id,
    campaign_id,
    hour,
    metric_name,
    value,
    created_at,
    updated_at
  )
  VALUES (
    p_engagement_id,
    p_campaign_id,
    p_hour,
    p_metric_name,
    p_value,
    NOW(),
    NOW()
  )
  ON CONFLICT (engagement_id, campaign_id, hour, metric_name)
  DO UPDATE SET 
    value = hourly_metrics.value + EXCLUDED.value,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION increment_campaign_metric TO authenticated, anon;
GRANT EXECUTE ON FUNCTION upsert_hourly_metric TO authenticated, anon;
```

**Step 2: Update Webhook Handler**

**File: `supabase/functions/smartlead-webhook/index.ts`** (REFACTOR)

Replace:
```typescript
// ❌ OLD CODE (remove this):
async function updatePositiveReplyCounts(...) {
  const { count: positiveCount } = await supabase
    .from('email_activities')
    .select('*', { count: 'exact', head: true })
    .in('reply_category', ['meeting_request', 'interested']);
    
  await supabase.from('campaigns')
    .update({ positive_replies: positiveCount || 0 })
    .eq('id', campaignId);
}

async function incrementHourlyMetric(...) {
  // Complex application-level code here - remove it
}
```

With:
```typescript
// ✅ NEW CODE (use database functions):
async function incrementMetric(
  supabase: any,
  campaignId: string,
  metricName: string,
  value: number = 1
) {
  const { error } = await supabase.rpc('increment_campaign_metric', {
    p_campaign_id: campaignId,
    p_metric_name: metricName,
    p_value: value,
  });

  if (error) {
    console.error('Error incrementing metric:', error);
    throw error;
  }
}

async function recordHourlyMetric(
  supabase: any,
  engagementId: string,
  campaignId: string,
  eventTimestamp: string | undefined,
  metricName: string
) {
  const hour = (eventTimestamp || new Date().toISOString())
    .split(':')
    .slice(0, 2)
    .join(':');

  const { error } = await supabase.rpc('upsert_hourly_metric', {
    p_engagement_id: engagementId,
    p_campaign_id: campaignId,
    p_hour: hour,
    p_metric_name: metricName,
    p_value: 1,
  });

  if (error) {
    console.error('Error recording hourly metric:', error);
    throw error;
  }
}
```

Replace metric update calls:
```typescript
// ❌ OLD:
await updatePositiveReplyCounts(supabase, ...);
await incrementHourlyMetric(supabase, ...);

// ✅ NEW:
if (mapped.reply_sentiment === 'positive') {
  await incrementMetric(supabase, campaignId, 'positive_replies', 1);
  await recordHourlyMetric(supabase, engagementId, campaignId, event.event_timestamp, 'positive_replies');
}
```

### Testing Race Conditions

```typescript
// Load test: spin up 100 simultaneous webhook calls
const webhooks = Array(100).fill(null).map((_, i) => ({
  event_type: 'EMAIL_REPLY',
  campaign_id: 'test-campaign-id',
  email: `test${i}@example.com`,
  reply_text: 'Interested',
  category_name: 'Interested',
  event_timestamp: new Date().toISOString(),
}));

// Send all simultaneously
const results = await Promise.all(
  webhooks.map(w => sendWebhook('https://...smartlead-webhook', w))
);

// Verify: count should be exactly 100
const { data: campaign } = await supabase
  .from('campaigns')
  .select('positive_replies')
  .eq('id', 'test-campaign-id')
  .single();

console.assert(campaign.positive_replies === 100, 'Should have exactly 100, not 99 or 101');
```

---

## FIX #3: Complete Reply.io Webhook Integration

### Problem
Reply.io webhook exists but event handlers not implemented.

### Solution Location
- `supabase/functions/replyio-webhook/index.ts` (complete)
- `supabase/functions/shared/replyio-mappings.ts` (create)

### Implementation

**File: `supabase/functions/shared/replyio-mappings.ts`** (NEW)

```typescript
// Map Reply.io event fields to internal schema
export const REPLYIO_EVENT_MAPPINGS: Record<string, string> = {
  'email_opened': 'EMAIL_OPEN',
  'email_clicked': 'EMAIL_LINK_CLICK',
  'email_replied': 'EMAIL_REPLY',
  'email_bounced': 'EMAIL_BOUNCE',
  'lead_unsubscribed': 'LEAD_UNSUBSCRIBED',
  'lead_category_changed': 'LEAD_CATEGORY_UPDATED',
};

export const REPLYIO_CATEGORY_MAP: Record<string, { category: string; sentiment: string }> = {
  'Interested': { category: 'interested', sentiment: 'positive' },
  'Meeting Booked': { category: 'meeting_request', sentiment: 'positive' },
  'Positive Response': { category: 'interested', sentiment: 'positive' },
  'Not Interested': { category: 'not_interested', sentiment: 'negative' },
  'Out of Office': { category: 'out_of_office', sentiment: 'neutral' },
  'Wrong Person': { category: 'referral', sentiment: 'neutral' },
  'Unsubscribed': { category: 'unsubscribe', sentiment: 'negative' },
  'Neutral': { category: 'neutral', sentiment: 'neutral' },
};

export interface ReplyioWebhookEvent {
  type: string; // email_opened, email_replied, etc.
  lead_id?: number;
  email?: string;
  timestamp?: string;
  sequence_id?: string;
  campaign_id?: number;
  category?: string;
  message_id?: string;
  [key: string]: any;
}
```

**File: `supabase/functions/replyio-webhook/index.ts`** (COMPLETE)

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  REPLYIO_EVENT_MAPPINGS, 
  REPLYIO_CATEGORY_MAP,
  ReplyioWebhookEvent 
} from '../shared/replyio-mappings.ts';
import { validateWebhookSignature } from '../shared/webhook-validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-replyio-signature',
};

Deno.serve(async (req) => {
  console.log('replyio-webhook: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate signature
    const signature = req.headers.get('x-replyio-signature');
    const webhookSecret = Deno.env.get('REPLYIO_WEBHOOK_SECRET');

    if (!signature || !webhookSecret) {
      console.error('Missing signature or secret');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const bodyText = await req.text();

    const isValid = await validateWebhookSignature(
      bodyText,
      signature,
      webhookSecret,
      {
        headerName: 'x-replyio-signature',
        algorithm: 'sha256',
        encoding: 'hex',
      }
    );

    if (!isValid) {
      console.error('Invalid signature');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = JSON.parse(bodyText);
    const event: ReplyioWebhookEvent = body;

    console.log('Webhook event:', event.type, 'campaign:', event.campaign_id);

    // Find engagement via campaign
    let engagementId: string | null = null;
    let campaignId: string | null = null;

    if (event.campaign_id) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, engagement_id')
        .eq('external_id', String(event.campaign_id))
        .eq('platform', 'replyio')
        .single();

      if (campaign) {
        engagementId = campaign.engagement_id;
        campaignId = campaign.id;
      }
    }

    // Store raw webhook event
    await supabase.from('webhook_events').insert({
      engagement_id: engagementId,
      source_type: 'replyio',
      event_type: event.type,
      event_id: event.message_id || `rio-${Date.now()}`,
      payload: body,
      processed: false,
    });

    if (!engagementId || !campaignId) {
      console.log('Campaign not found, event stored for later processing');
      return new Response(JSON.stringify({ status: 'stored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process event
    switch (event.type) {
      case 'email_opened':
        await processEmailOpen(supabase, engagementId, campaignId, event);
        break;

      case 'email_clicked':
        await processEmailClick(supabase, engagementId, campaignId, event);
        break;

      case 'email_replied':
        await processEmailReply(supabase, engagementId, campaignId, event);
        break;

      case 'email_bounced':
        await processEmailBounce(supabase, engagementId, campaignId, event);
        break;

      case 'lead_unsubscribed':
        await processUnsubscribe(supabase, engagementId, campaignId, event);
        break;

      case 'lead_category_changed':
        await processCategoryUpdate(supabase, engagementId, campaignId, event);
        break;

      default:
        console.log('Unknown event type:', event.type);
    }

    // Mark as processed
    await supabase
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('event_id', event.message_id || `rio-${Date.now()}`)
      .eq('source_type', 'replyio');

    return new Response(JSON.stringify({ status: 'processed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getOrCreateContact(
  supabase: any,
  engagementId: string,
  email: string
): Promise<{ contactId: string; companyId: string } | null> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, company_id')
    .eq('engagement_id', engagementId)
    .eq('email', email)
    .single();

  if (contact) {
    return { contactId: contact.id, companyId: contact.company_id };
  }

  // Create company
  const domain = email.split('@')[1]?.toLowerCase();
  let companyId: string | null = null;

  if (domain) {
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('engagement_id', engagementId)
      .eq('domain', domain)
      .maybeSingle();

    if (existingCompany) {
      companyId = existingCompany.id;
    }
  }

  if (!companyId) {
    const { data: newCompany } = await supabase
      .from('companies')
      .insert({
        engagement_id: engagementId,
        name: domain || 'Unknown',
        domain,
        source: 'webhook',
      })
      .select('id')
      .single();
    companyId = newCompany?.id;
  }

  if (!companyId) return null;

  // Create contact
  const { data: newContact } = await supabase
    .from('contacts')
    .insert({
      engagement_id: engagementId,
      company_id: companyId,
      email,
      first_name: email.split('@')[0] || 'Unknown',
      source: 'webhook',
    })
    .select('id')
    .single();

  return newContact ? { contactId: newContact.id, companyId } : null;
}

async function processEmailOpen(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: ReplyioWebhookEvent
) {
  if (!event.email) return;

  const contact = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contact) return;

  await supabase.from('email_activities').update({
    opened: true,
    opened_at: event.timestamp || new Date().toISOString(),
  })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contact.contactId)
    .eq('step_number', event.sequence_id || 1);

  // Increment metric
  await supabase.rpc('increment_campaign_metric', {
    p_campaign_id: campaignId,
    p_metric_name: 'emails_opened',
    p_value: 1,
  });

  console.log('Processed email_opened for', event.email);
}

async function processEmailClick(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: ReplyioWebhookEvent
) {
  if (!event.email) return;

  const contact = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contact) return;

  await supabase.from('email_activities').update({
    clicked: true,
    clicked_at: event.timestamp || new Date().toISOString(),
  })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contact.contactId)
    .eq('step_number', event.sequence_id || 1);

  // Increment metric
  await supabase.rpc('increment_campaign_metric', {
    p_campaign_id: campaignId,
    p_metric_name: 'emails_clicked',
    p_value: 1,
  });

  console.log('Processed email_clicked for', event.email);
}

async function processEmailReply(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: ReplyioWebhookEvent
) {
  if (!event.email) return;

  const contact = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contact) return;

  const mapped = event.category
    ? REPLYIO_CATEGORY_MAP[event.category] || {
        category: 'neutral',
        sentiment: 'neutral',
      }
    : { category: 'neutral', sentiment: 'neutral' };

  await supabase.from('email_activities').update({
    replied: true,
    replied_at: event.timestamp || new Date().toISOString(),
    lead_category: event.category || null,
    reply_category: mapped.category,
    reply_sentiment: mapped.sentiment,
  })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contact.contactId)
    .eq('step_number', event.sequence_id || 1);

  // Increment metric
  await supabase.rpc('increment_campaign_metric', {
    p_campaign_id: campaignId,
    p_metric_name: 'emails_replied',
    p_value: 1,
  });

  // If positive, increment positive_replies
  if (mapped.sentiment === 'positive') {
    await supabase.rpc('increment_campaign_metric', {
      p_campaign_id: campaignId,
      p_metric_name: 'positive_replies',
      p_value: 1,
    });
  }

  console.log('Processed email_replied for', event.email);
}

async function processEmailBounce(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: ReplyioWebhookEvent
) {
  if (!event.email) return;

  const contact = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contact) return;

  await supabase.from('email_activities').update({
    bounced: true,
    bounced_at: event.timestamp || new Date().toISOString(),
  })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contact.contactId)
    .eq('step_number', event.sequence_id || 1);

  // Increment metric
  await supabase.rpc('increment_campaign_metric', {
    p_campaign_id: campaignId,
    p_metric_name: 'emails_bounced',
    p_value: 1,
  });

  console.log('Processed email_bounced for', event.email);
}

async function processUnsubscribe(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: ReplyioWebhookEvent
) {
  if (!event.email) return;

  const contact = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contact) return;

  await supabase.from('contacts')
    .update({
      is_unsubscribed: true,
      unsubscribed_at: event.timestamp || new Date().toISOString(),
      do_not_email: true,
    })
    .eq('id', contact.contactId);

  console.log('Processed lead_unsubscribed for', event.email);
}

async function processCategoryUpdate(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: ReplyioWebhookEvent
) {
  if (!event.email) return;

  const contact = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contact) return;

  const mapped = event.category
    ? REPLYIO_CATEGORY_MAP[event.category] || {
        category: 'neutral',
        sentiment: 'neutral',
      }
    : { category: 'neutral', sentiment: 'neutral' };

  await supabase.from('email_activities').update({
    lead_category: event.category || null,
    reply_category: mapped.category,
    reply_sentiment: mapped.sentiment,
    is_interested: mapped.sentiment === 'positive',
  })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contact.contactId);

  if (mapped.sentiment === 'positive') {
    await supabase.from('contacts')
      .update({ is_interested: true })
      .eq('id', contact.contactId);
  }

  console.log('Processed lead_category_changed for', event.email);
}
```

---

## FIX #4: Database Connection Pooling

### Problem
No connection pooling causes crashes at scale.

### Solution

**Supabase Dashboard Configuration:**

1. Go to https://app.supabase.com/project/[YOUR_PROJECT]/settings/database
2. Under "Connection Pooling", set:
   - Mode: `Transaction`
   - Pool Size: `25` (for standard tier)

**Frontend Client Update:**

**File: `src/integrations/supabase/client.ts`** (MODIFY)

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Use pool endpoint (connections through PgBouncer)
const POOL_URL = `${SUPABASE_URL}/rest/v1`;

// Singleton pattern - reuse connection across app
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

export const getSupabaseClient = (): ReturnType<typeof createClient<Database>> => {
  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          // Enable persistent connections
          Connection: 'keep-alive',
        },
      },
      db: {
        schema: 'public',
      },
    });
  }
  return supabaseInstance;
};

// Export for compatibility
export const supabase = getSupabaseClient();
```

**Edge Function Connection:**

**File: `supabase/functions/smart lead-webhook/index.ts`** (and all other functions)

```typescript
// ✅ Use pooling endpoint
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Already uses pooling by default - no changes needed
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

---

## FIX #5: Authorization Checks on Admin Endpoints

### Problem
Admin functions don't verify user owns the data.

### Solution

**Create Helper Function:**

**File: `supabase/functions/shared/auth-helpers.ts`** (NEW)

```typescript
export const requireAuth = async (supabase: any) => {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (!user || error) {
    throw new Error('Unauthorized');
  }
  
  return user;
};

export const verifyEngagementOwnership = async (
  supabase: any,
  userId: string,
  engagementId: string
): Promise<boolean> => {
  const { data: engagement } = await supabase
    .from('engagements')
    .select('user_id')
    .eq('id', engagementId)
    .single();

  if (!engagement) return false;
  return engagement.user_id === userId;
};
```

**Update Admin Endpoint:**

**File: `supabase/functions/sync-reset/index.ts`** (MODIFY)

```typescript
import { requireAuth, verifyEngagementOwnership } from '../shared/auth-helpers.ts';

Deno.serve(async (req) => {
  try {
    // ✅ NEW: Require authentication
    const user = await requireAuth(supabase);

    const { engagement_id } = await req.json();

    // ✅ NEW: Verify ownership
    const isOwner = await verifyEngagementOwnership(
      supabase,
      user.id,
      engagement_id
    );

    if (!isOwner) {
      return new Response('Forbidden', { status: 403 });
    }

    // ... rest of function ...
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return new Response('Unauthorized', { status: 401 });
    }
    throw error;
  }
});
```

---

## FIX #6: Input Validation on Webhooks

### Problem
Unvalidated webhook payloads can cause crashes or injection attacks.

### Solution

**File: `supabase/functions/shared/webhook-schemas.ts`** (NEW)

```typescript
import { z } from 'https://esm.sh/zod';

export const SmartleadEventSchema = z.object({
  event_type: z.enum([
    'EMAIL_SENT',
    'EMAIL_OPEN',
    'EMAIL_LINK_CLICK',
    'EMAIL_REPLY',
    'EMAIL_BOUNCE',
    'LEAD_UNSUBSCRIBED',
    'LEAD_CATEGORY_UPDATED',
  ]),
  campaign_id: z.number().positive().optional(),
  lead_id: z.number().optional(),
  email: z.string().email().optional(),
  event_timestamp: z.string().datetime().optional(),
  sequence_number: z.number().optional(),
  variant_id: z.string().optional(),
  reply_text: z.string().max(10000).nullable().optional(),
  category_name: z.string().max(100).nullable().optional(),
  bounce_type: z.string().max(50).optional(),
  bounce_reason: z.string().max(500).optional(),
  event_id: z.string().optional(),
});

export type SmartleadEvent = z.infer<typeof SmartleadEventSchema>;

export const validateSmartleadEvent = (event: unknown): SmartleadEvent => {
  return SmartleadEventSchema.parse(event);
};
```

**Use in Webhook:**

```typescript
const validatedEvent = validateSmartleadEvent(event);
// Now use validatedEvent - all fields are type-safe and validated
```

---

## DEPLOYMENT CHECKLIST

Before deploying any fix:

```
[ ] Code reviewed by 2 engineers
[ ] Unit tests pass (if applicable)
[ ] Integration tests pass
[ ] Staging environment tested
[ ] No hardcoded secrets
[ ] Error handling added
[ ] Logging added
[ ] Performance tested (if relevant)
[ ] Database migrations tested
[ ] Rollback plan documented
[ ] Feature flags in place (if applicable)
```

---

## QUICK START FOR ENGINEERS

1. **Start with Fix #1** - Webhook signature validation (lowest risk, highest impact)
2. **Test thoroughly** - Use provided test code
3. **Deploy to staging** - Verify against real SmartLead/Reply.io webhooks
4. **Move to Fix #2** - Metric race conditions
5. **Then Fix #3-5** - Complete Reply.io, then DB pooling, then auth checks

**Total time estimate:** 40-50 hours across team

---

**Questions?** Reference main audit report for context on each issue.
