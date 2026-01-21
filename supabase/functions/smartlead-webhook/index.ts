import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateWebhookRequest, WEBHOOK_CONFIGS } from '../_shared/webhook-validation.ts';
import { validateSmartLeadWebhook, SmartLeadWebhookEvent } from '../_shared/webhook-schemas.ts';
import { 
  incrementCampaignMetric, 
  recordHourlyMetric, 
  recordDailyMetric,
  updatePositiveReplyCounts 
} from '../_shared/atomic-metrics.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-smartlead-signature',
};

// SmartLead category to standardized reply_category/sentiment mapping
const SMARTLEAD_CATEGORY_MAP: Record<string, { category: string; sentiment: string }> = {
  'Interested': { category: 'interested', sentiment: 'positive' },
  'Meeting Booked': { category: 'meeting_request', sentiment: 'positive' },
  'Meeting Scheduled': { category: 'meeting_request', sentiment: 'positive' },
  'Positive': { category: 'interested', sentiment: 'positive' },
  'Not Interested': { category: 'not_interested', sentiment: 'negative' },
  'Out of Office': { category: 'out_of_office', sentiment: 'neutral' },
  'OOO': { category: 'out_of_office', sentiment: 'neutral' },
  'Wrong Person': { category: 'referral', sentiment: 'neutral' },
  'Unsubscribed': { category: 'unsubscribe', sentiment: 'negative' },
  'Do Not Contact': { category: 'unsubscribe', sentiment: 'negative' },
  'Neutral': { category: 'neutral', sentiment: 'neutral' },
  'Question': { category: 'question', sentiment: 'neutral' },
  'Not Now': { category: 'not_now', sentiment: 'neutral' },
  'Bad Timing': { category: 'not_now', sentiment: 'neutral' },
  'Referral': { category: 'referral', sentiment: 'positive' },
  'Auto Reply': { category: 'auto_reply', sentiment: 'neutral' },
};

function mapSmartleadCategory(name: string | null | undefined): { reply_category: string | null; reply_sentiment: string | null } {
  if (!name) return { reply_category: null, reply_sentiment: null };
  
  const mapped = SMARTLEAD_CATEGORY_MAP[name];
  if (mapped) {
    return { reply_category: mapped.category, reply_sentiment: mapped.sentiment };
  }
  
  // Fallback inference for unknown categories
  const lower = name.toLowerCase();
  if (lower.includes('interested') && !lower.includes('not')) {
    return { reply_category: 'interested', reply_sentiment: 'positive' };
  }
  if (lower.includes('meeting') || lower.includes('booked') || lower.includes('call')) {
    return { reply_category: 'meeting_request', reply_sentiment: 'positive' };
  }
  if (lower.includes('not interested') || lower.includes('pass') || lower.includes('decline')) {
    return { reply_category: 'not_interested', reply_sentiment: 'negative' };
  }
  if (lower.includes('ooo') || lower.includes('out of office') || lower.includes('vacation')) {
    return { reply_category: 'out_of_office', reply_sentiment: 'neutral' };
  }
  if (lower.includes('unsubscribe') || lower.includes('remove') || lower.includes('stop')) {
    return { reply_category: 'unsubscribe', reply_sentiment: 'negative' };
  }
  
  return { reply_category: 'neutral', reply_sentiment: 'neutral' };
}

Deno.serve(async (req) => {
  console.log('smartlead-webhook: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('SMARTLEAD_WEBHOOK_SECRET');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ✅ SECURITY: Validate webhook signature
    const validation = await validateWebhookRequest(req, webhookSecret, WEBHOOK_CONFIGS.smartlead);
    if (!validation.valid) {
      console.error('Webhook validation failed:', validation.error);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (validation.error) {
      console.warn('Webhook warning:', validation.error);
    }

    // ✅ SECURITY: Validate and sanitize payload
    const rawBody = JSON.parse(validation.body);
    const payloadValidation = validateSmartLeadWebhook(rawBody);
    
    if (!payloadValidation.success) {
      console.error('Payload validation failed:', payloadValidation.errors);
      return new Response(JSON.stringify({ error: 'Invalid payload', details: payloadValidation.errors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const event = payloadValidation.data!;
    console.log('Webhook event:', event.event_type, 'campaign:', event.campaign_id);

    // Find the engagement based on campaign external_id
    let engagementId: string | null = null;
    let campaignId: string | null = null;

    if (event.campaign_id) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, engagement_id')
        .eq('external_id', String(event.campaign_id))
        .single();
      
      if (campaign) {
        engagementId = campaign.engagement_id;
        campaignId = campaign.id;
      }
    }

    // Store raw webhook event
    await supabase.from('webhook_events').insert({
      engagement_id: engagementId,
      source_type: 'smartlead',
      event_type: event.event_type,
      event_id: event.event_id || `sl-${Date.now()}`,
      payload: rawBody,
      processed: false,
    });

    if (!engagementId || !campaignId) {
      console.log('Campaign not found, event stored for later processing');
      return new Response(JSON.stringify({ status: 'stored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process event based on type
    switch (event.event_type) {
      case 'EMAIL_SENT':
      case 'email_sent':
        await processEmailSent(supabase, engagementId, campaignId, event);
        break;

      case 'EMAIL_OPEN':
      case 'email_opened':
        await processEmailOpen(supabase, engagementId, campaignId, event);
        break;

      case 'EMAIL_LINK_CLICK':
      case 'email_clicked':
        await processEmailClick(supabase, engagementId, campaignId, event);
        break;

      case 'EMAIL_REPLY':
      case 'email_replied':
        await processEmailReply(supabase, engagementId, campaignId, event);
        break;

      case 'EMAIL_BOUNCE':
      case 'email_bounced':
        await processEmailBounce(supabase, engagementId, campaignId, event);
        break;

      case 'LEAD_UNSUBSCRIBED':
      case 'lead_unsubscribed':
        await processUnsubscribe(supabase, engagementId, campaignId, event);
        break;

      case 'LEAD_CATEGORY_UPDATED':
      case 'lead_category_changed':
        await processCategoryUpdate(supabase, engagementId, campaignId, event);
        break;

      default:
        console.log('Unknown event type:', event.event_type);
    }

    // Mark event as processed
    await supabase
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('event_id', event.event_id || `sl-${Date.now()}`)
      .eq('source_type', 'smartlead');

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
  // Try to find existing contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, company_id')
    .eq('engagement_id', engagementId)
    .eq('email', email)
    .single();

  if (contact) {
    return { contactId: contact.id, companyId: contact.company_id };
  }

  // Create company first - use select-then-insert pattern for NULL domain handling
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
    .upsert({
      engagement_id: engagementId,
      company_id: companyId,
      email,
      source: 'webhook',
    }, { onConflict: 'engagement_id,email' })
    .select('id, company_id')
    .single();

  if (!newContact) return null;
  return { contactId: newContact.id, companyId: newContact.company_id };
}

async function processEmailSent(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: SmartLeadWebhookEvent
) {
  if (!event.email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contactInfo) return;

  await supabase.from('email_activities').upsert({
    engagement_id: engagementId,
    campaign_id: campaignId,
    contact_id: contactInfo.contactId,
    company_id: contactInfo.companyId,
    to_email: event.email,
    sent: true,
    sent_at: event.event_timestamp || new Date().toISOString(),
    step_number: event.sequence_number || 1,
  }, { onConflict: 'engagement_id,campaign_id,contact_id,step_number' });

  // ✅ ATOMIC: Use database functions for race-safe metric updates
  try {
    await incrementCampaignMetric(supabase, campaignId, 'total_sent', 1);
    await recordHourlyMetric(supabase, engagementId, campaignId, event.event_timestamp, 'emails_sent');
    await recordDailyMetric(supabase, engagementId, campaignId, event.event_timestamp, 'emails_sent');
  } catch (metricError) {
    console.error('Error updating metrics:', metricError);
    // Don't fail the webhook for metric errors
  }

  console.log('Processed EMAIL_SENT for', event.email);
}

async function processEmailOpen(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: SmartLeadWebhookEvent
) {
  if (!event.email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contactInfo) return;

  // Get current open count for increment
  const { data: currentActivity } = await supabase
    .from('email_activities')
    .select('open_count')
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId)
    .eq('step_number', event.sequence_number || 1)
    .single();

  await supabase.from('email_activities')
    .update({
      opened: true,
      first_opened_at: event.event_timestamp || new Date().toISOString(),
      open_count: (currentActivity?.open_count || 0) + 1,
    })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId)
    .eq('step_number', event.sequence_number || 1);

  // ✅ ATOMIC: Use database functions for race-safe metric updates
  try {
    await incrementCampaignMetric(supabase, campaignId, 'total_opened', 1);
    await recordHourlyMetric(supabase, engagementId, campaignId, event.event_timestamp, 'emails_opened');
    await recordDailyMetric(supabase, engagementId, campaignId, event.event_timestamp, 'emails_opened');
  } catch (metricError) {
    console.error('Error updating metrics:', metricError);
  }

  console.log('Processed EMAIL_OPEN for', event.email);
}

async function processEmailClick(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: SmartLeadWebhookEvent
) {
  if (!event.email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contactInfo) return;

  // Get email activity ID and current click count
  const { data: activity } = await supabase
    .from('email_activities')
    .select('id, click_count')
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId)
    .eq('step_number', event.sequence_number || 1)
    .single();

  await supabase.from('email_activities')
    .update({
      clicked: true,
      first_clicked_at: event.event_timestamp || new Date().toISOString(),
      click_count: (activity?.click_count || 0) + 1,
    })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId)
    .eq('step_number', event.sequence_number || 1);

  // Track individual click
  if (event.link_url) {
    await supabase.from('link_click_tracking').insert({
      engagement_id: engagementId,
      campaign_id: campaignId,
      email_activity_id: activity?.id || null,
      contact_id: contactInfo.contactId,
      clicked_url: event.link_url,
      click_timestamp: event.event_timestamp || new Date().toISOString(),
    });
  }

  // ✅ ATOMIC: Use database functions for race-safe metric updates
  try {
    await recordHourlyMetric(supabase, engagementId, campaignId, event.event_timestamp, 'emails_clicked');
  } catch (metricError) {
    console.error('Error updating metrics:', metricError);
  }

  console.log('Processed EMAIL_CLICK for', event.email);
}

async function processEmailReply(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: SmartLeadWebhookEvent
) {
  if (!event.email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contactInfo) return;

  // Map category if provided in the reply event
  const mapped = mapSmartleadCategory(event.category_name);

  await supabase.from('email_activities')
    .update({
      replied: true,
      replied_at: event.event_timestamp || new Date().toISOString(),
      reply_text: event.reply_text || null,
      lead_category: event.category_name || null,
      reply_category: mapped.reply_category,
      reply_sentiment: mapped.reply_sentiment,
    })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId)
    .eq('step_number', event.sequence_number || 1);

  // Store in message threads if we have reply text
  if (event.reply_text) {
    await supabase.from('message_threads').insert({
      engagement_id: engagementId,
      campaign_id: campaignId,
      contact_id: contactInfo.contactId,
      external_stats_id: event.event_id || `reply-${Date.now()}`,
      message_type: 'reply',
      body_plain: event.reply_text,
      body_preview: event.reply_text.substring(0, 200),
      from_email: event.email,
      sent_at: event.event_timestamp || new Date().toISOString(),
      is_automated: false,
    });
  }

  // ✅ ATOMIC: Use database functions for race-safe metric updates
  try {
    await incrementCampaignMetric(supabase, campaignId, 'total_replied', 1);
    await recordHourlyMetric(supabase, engagementId, campaignId, event.event_timestamp, 'emails_replied');
    await recordDailyMetric(supabase, engagementId, campaignId, event.event_timestamp, 'emails_replied');
    
    // Update positive reply counts if this is a positive category
    if (mapped.reply_sentiment === 'positive') {
      await updatePositiveReplyCounts(supabase, engagementId, campaignId, event.event_timestamp);
    }
  } catch (metricError) {
    console.error('Error updating metrics:', metricError);
  }

  // Trigger reply classification (for AI analysis of reply text if category not provided)
  if (!event.category_name && event.reply_text) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    try {
      await fetch(`${supabaseUrl}/functions/v1/classify-replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ engagement_id: engagementId, batch_size: 10 }),
      });
    } catch (e) {
      console.log('Failed to trigger classify-replies:', e);
    }
  }

  console.log('Processed EMAIL_REPLY for', event.email, '→ category:', mapped.reply_category);
}

async function processEmailBounce(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: SmartLeadWebhookEvent
) {
  if (!event.email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contactInfo) return;

  await supabase.from('email_activities')
    .update({
      bounced: true,
      bounced_at: event.event_timestamp || new Date().toISOString(),
      bounce_type: event.bounce_type || 'unknown',
      bounce_reason: event.bounce_reason || null,
    })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId)
    .eq('step_number', event.sequence_number || 1);

  // Update contact bounce status
  await supabase.from('contacts')
    .update({
      email_status: 'bounced',
      bounced_at: event.event_timestamp || new Date().toISOString(),
      bounce_type: event.bounce_type || 'unknown',
    })
    .eq('id', contactInfo.contactId);

  // ✅ ATOMIC: Use database functions for race-safe metric updates
  try {
    await incrementCampaignMetric(supabase, campaignId, 'total_bounced', 1);
    await recordHourlyMetric(supabase, engagementId, campaignId, event.event_timestamp, 'emails_bounced');
    await recordDailyMetric(supabase, engagementId, campaignId, event.event_timestamp, 'emails_bounced');
  } catch (metricError) {
    console.error('Error updating metrics:', metricError);
  }

  console.log('Processed EMAIL_BOUNCE for', event.email);
}

async function processUnsubscribe(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: SmartLeadWebhookEvent
) {
  if (!event.email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contactInfo) return;

  await supabase.from('email_activities')
    .update({
      unsubscribed: true,
      unsubscribed_at: event.event_timestamp || new Date().toISOString(),
    })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId);

  await supabase.from('contacts')
    .update({
      is_unsubscribed: true,
      unsubscribed_at: event.event_timestamp || new Date().toISOString(),
      do_not_email: true,
    })
    .eq('id', contactInfo.contactId);

  console.log('Processed LEAD_UNSUBSCRIBED for', event.email);
}

async function processCategoryUpdate(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: SmartLeadWebhookEvent
) {
  if (!event.email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contactInfo) return;

  // Map the category to standardized reply_category/sentiment
  const mapped = mapSmartleadCategory(event.category_name);
  const wasPositive = mapped.reply_sentiment === 'positive';

  // Update email activity with category and sentiment
  await supabase.from('email_activities')
    .update({
      lead_category: event.category_name || null,
      reply_category: mapped.reply_category,
      reply_sentiment: mapped.reply_sentiment,
      is_interested: wasPositive,
    })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId);

  // Update contact interest status
  if (wasPositive) {
    await supabase.from('contacts')
      .update({ is_interested: true })
      .eq('id', contactInfo.contactId);
  }

  // ✅ ATOMIC: Update positive reply counts if this is a positive category
  if (wasPositive) {
    try {
      await updatePositiveReplyCounts(supabase, engagementId, campaignId, event.event_timestamp);
    } catch (metricError) {
      console.error('Error updating positive reply counts:', metricError);
    }
  }

  console.log('Processed LEAD_CATEGORY_UPDATED for', event.email, '→', mapped.reply_category, '(positive:', wasPositive, ')');
}
