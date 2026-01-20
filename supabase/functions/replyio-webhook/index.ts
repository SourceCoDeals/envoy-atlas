import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-replyio-signature',
};

interface ReplyioWebhookEvent {
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
  [key: string]: any;
}

// Category mapping for Reply.io - maps finish reasons/statuses to standardized categories
const REPLYIO_CATEGORY_MAP: Record<string, { category: string; sentiment: string }> = {
  'interested': { category: 'interested', sentiment: 'positive' },
  'meeting_booked': { category: 'meeting_request', sentiment: 'positive' },
  'meeting booked': { category: 'meeting_request', sentiment: 'positive' },
  'not_interested': { category: 'not_interested', sentiment: 'negative' },
  'not interested': { category: 'not_interested', sentiment: 'negative' },
  'out_of_office': { category: 'out_of_office', sentiment: 'neutral' },
  'ooo': { category: 'out_of_office', sentiment: 'neutral' },
  'unsubscribed': { category: 'unsubscribe', sentiment: 'negative' },
  'autoreplied': { category: 'auto_reply', sentiment: 'neutral' },
  'bounced': { category: 'bounce', sentiment: 'neutral' },
  'wrong_person': { category: 'wrong_person', sentiment: 'neutral' },
  'referral': { category: 'referral', sentiment: 'positive' },
};

function mapReplyioCategory(status: string | null | undefined): { 
  reply_category: string | null; 
  reply_sentiment: string | null 
} {
  if (!status) return { reply_category: null, reply_sentiment: null };
  const mapped = REPLYIO_CATEGORY_MAP[status.toLowerCase()];
  if (mapped) return { reply_category: mapped.category, reply_sentiment: mapped.sentiment };
  
  // Fallback inference based on keywords
  const lower = status.toLowerCase();
  if (lower.includes('interested') && !lower.includes('not')) {
    return { reply_category: 'interested', reply_sentiment: 'positive' };
  }
  if (lower.includes('meeting') || lower.includes('booked') || lower.includes('schedule')) {
    return { reply_category: 'meeting_request', reply_sentiment: 'positive' };
  }
  if (lower.includes('not interested') || lower.includes('unsubscribe') || lower.includes('remove')) {
    return { reply_category: 'not_interested', reply_sentiment: 'negative' };
  }
  if (lower.includes('ooo') || lower.includes('out of office') || lower.includes('vacation')) {
    return { reply_category: 'out_of_office', reply_sentiment: 'neutral' };
  }
  return { reply_category: 'neutral', reply_sentiment: 'neutral' };
}

Deno.serve(async (req) => {
  console.log('replyio-webhook: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const event: ReplyioWebhookEvent = body;
    const email = event.email || event.personEmail;

    console.log('Webhook event:', event.eventType, 'sequence:', event.sequenceId);

    // Find the engagement based on campaign external_id
    let engagementId: string | null = null;
    let campaignId: string | null = null;

    const sequenceId = event.sequenceId || event.campaignId;
    if (sequenceId) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, engagement_id')
        .eq('external_id', String(sequenceId))
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
      event_type: event.eventType,
      event_id: event.eventId || `rio-${Date.now()}`,
      payload: body,
      processed: false,
    });

    if (!engagementId || !campaignId) {
      console.log('Campaign not found, event stored for later processing');
      return new Response(JSON.stringify({ status: 'stored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process event based on type
    switch (event.eventType) {
      case 'email_sent':
        await processEmailSent(supabase, engagementId, campaignId, event, email);
        break;

      case 'email_opened':
        await processEmailOpen(supabase, engagementId, campaignId, event, email);
        break;

      case 'email_clicked':
        await processEmailClick(supabase, engagementId, campaignId, event, email);
        break;

      case 'email_replied':
        await processEmailReply(supabase, engagementId, campaignId, event, email);
        break;

      case 'email_bounced':
        await processEmailBounce(supabase, engagementId, campaignId, event, email);
        break;

      case 'contact_finished':
        await processContactFinished(supabase, engagementId, campaignId, event, email);
        break;

      case 'contact_unsubscribed':
        await processUnsubscribe(supabase, engagementId, campaignId, event, email);
        break;

      default:
        console.log('Unknown event type:', event.eventType);
    }

    // Mark event as processed
    await supabase
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('event_id', event.eventId || `rio-${Date.now()}`)
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
  email: string | undefined
): Promise<{ contactId: string; companyId: string } | null> {
  if (!email) return null;

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

  // Create company first
  const domain = email.split('@')[1]?.toLowerCase();
  const { data: company } = await supabase
    .from('companies')
    .upsert({
      engagement_id: engagementId,
      name: domain || 'Unknown',
      domain,
      source: 'webhook',
    }, { onConflict: 'engagement_id,domain' })
    .select('id')
    .single();

  if (!company) return null;

  // Create contact
  const { data: newContact } = await supabase
    .from('contacts')
    .upsert({
      engagement_id: engagementId,
      company_id: company.id,
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
  event: ReplyioWebhookEvent,
  email: string | undefined
) {
  if (!email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, email);
  if (!contactInfo) return;

  await supabase.from('email_activities').upsert({
    engagement_id: engagementId,
    campaign_id: campaignId,
    contact_id: contactInfo.contactId,
    company_id: contactInfo.companyId,
    to_email: email,
    sent: true,
    sent_at: event.timestamp || new Date().toISOString(),
    step_number: event.stepNumber || 1,
  }, { onConflict: 'engagement_id,campaign_id,contact_id,step_number' });

  // Update hourly metrics
  const now = new Date(event.timestamp || Date.now());
  await supabase.from('hourly_metrics').upsert({
    engagement_id: engagementId,
    campaign_id: campaignId,
    hour_of_day: now.getUTCHours(),
    day_of_week: now.getUTCDay(),
    metric_date: now.toISOString().split('T')[0],
    emails_sent: 1,
  }, { onConflict: 'engagement_id,campaign_id,hour_of_day,day_of_week,metric_date' });

  console.log('Processed email_sent for', email);
}

async function processEmailOpen(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: ReplyioWebhookEvent,
  email: string | undefined
) {
  if (!email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, email);
  if (!contactInfo) return;

  await supabase.from('email_activities')
    .update({
      opened: true,
      first_opened_at: event.timestamp || new Date().toISOString(),
    })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId)
    .eq('step_number', event.stepNumber || 1);

  // Update hourly metrics
  const now = new Date(event.timestamp || Date.now());
  await supabase.from('hourly_metrics').upsert({
    engagement_id: engagementId,
    campaign_id: campaignId,
    hour_of_day: now.getUTCHours(),
    day_of_week: now.getUTCDay(),
    metric_date: now.toISOString().split('T')[0],
    emails_opened: 1,
  }, { onConflict: 'engagement_id,campaign_id,hour_of_day,day_of_week,metric_date' });

  console.log('Processed email_opened for', email);
}

async function processEmailClick(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: ReplyioWebhookEvent,
  email: string | undefined
) {
  if (!email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, email);
  if (!contactInfo) return;

  // Get email activity ID
  const { data: activity } = await supabase
    .from('email_activities')
    .select('id')
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId)
    .eq('step_number', event.stepNumber || 1)
    .single();

  await supabase.from('email_activities')
    .update({
      clicked: true,
      first_clicked_at: event.timestamp || new Date().toISOString(),
    })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId)
    .eq('step_number', event.stepNumber || 1);

  // Track individual click
  if (event.clickedUrl) {
    await supabase.from('link_click_tracking').insert({
      engagement_id: engagementId,
      campaign_id: campaignId,
      email_activity_id: activity?.id || null,
      contact_id: contactInfo.contactId,
      clicked_url: event.clickedUrl,
      click_timestamp: event.timestamp || new Date().toISOString(),
    });
  }

  // Update hourly metrics
  const now = new Date(event.timestamp || Date.now());
  await supabase.from('hourly_metrics').upsert({
    engagement_id: engagementId,
    campaign_id: campaignId,
    hour_of_day: now.getUTCHours(),
    day_of_week: now.getUTCDay(),
    metric_date: now.toISOString().split('T')[0],
    emails_clicked: 1,
  }, { onConflict: 'engagement_id,campaign_id,hour_of_day,day_of_week,metric_date' });

  console.log('Processed email_clicked for', email);
}

async function processEmailReply(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: ReplyioWebhookEvent,
  email: string | undefined
) {
  if (!email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, email);
  if (!contactInfo) return;

  // Map category from finish reason or status
  const mapped = mapReplyioCategory(event.finishReason || event.status);

  await supabase.from('email_activities')
    .update({
      replied: true,
      replied_at: event.timestamp || new Date().toISOString(),
      reply_text: event.replyText || null,
      reply_category: mapped.reply_category,
      reply_sentiment: mapped.reply_sentiment,
    })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId)
    .eq('step_number', event.stepNumber || 1);

  // Store in message threads if we have reply text
  if (event.replyText) {
    await supabase.from('message_threads').insert({
      engagement_id: engagementId,
      campaign_id: campaignId,
      contact_id: contactInfo.contactId,
      external_stats_id: event.eventId || `reply-${Date.now()}`,
      message_type: 'reply',
      body_plain: event.replyText,
      body_preview: event.replyText.substring(0, 200),
      from_email: email,
      sent_at: event.timestamp || new Date().toISOString(),
      is_automated: false,
    });
  }

  // Update hourly metrics
  const now = new Date(event.timestamp || Date.now());
  await supabase.from('hourly_metrics').upsert({
    engagement_id: engagementId,
    campaign_id: campaignId,
    hour_of_day: now.getUTCHours(),
    day_of_week: now.getUTCDay(),
    metric_date: now.toISOString().split('T')[0],
    emails_replied: 1,
  }, { onConflict: 'engagement_id,campaign_id,hour_of_day,day_of_week,metric_date' });

  // Trigger reply classification
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

  console.log('Processed email_replied for', email);
}

async function processEmailBounce(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: ReplyioWebhookEvent,
  email: string | undefined
) {
  if (!email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, email);
  if (!contactInfo) return;

  await supabase.from('email_activities')
    .update({
      bounced: true,
      bounced_at: event.timestamp || new Date().toISOString(),
      bounce_type: event.bounceType || 'unknown',
      bounce_reason: event.bounceReason || null,
    })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId)
    .eq('step_number', event.stepNumber || 1);

  // Update contact bounce status
  await supabase.from('contacts')
    .update({
      email_status: 'bounced',
      bounced_at: event.timestamp || new Date().toISOString(),
      bounce_type: event.bounceType || 'unknown',
    })
    .eq('id', contactInfo.contactId);

  // Update hourly metrics
  const now = new Date(event.timestamp || Date.now());
  await supabase.from('hourly_metrics').upsert({
    engagement_id: engagementId,
    campaign_id: campaignId,
    hour_of_day: now.getUTCHours(),
    day_of_week: now.getUTCDay(),
    metric_date: now.toISOString().split('T')[0],
    emails_bounced: 1,
  }, { onConflict: 'engagement_id,campaign_id,hour_of_day,day_of_week,metric_date' });

  console.log('Processed email_bounced for', email);
}

async function processContactFinished(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: ReplyioWebhookEvent,
  email: string | undefined
) {
  if (!email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, email);
  if (!contactInfo) return;

  await supabase.from('contacts')
    .update({
      sequence_status: 'completed',
      finish_reason: event.finishReason || 'finished',
    })
    .eq('id', contactInfo.contactId);

  console.log('Processed contact_finished for', email);
}

async function processUnsubscribe(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: ReplyioWebhookEvent,
  email: string | undefined
) {
  if (!email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, email);
  if (!contactInfo) return;

  await supabase.from('email_activities')
    .update({
      unsubscribed: true,
      unsubscribed_at: event.timestamp || new Date().toISOString(),
    })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId);

  await supabase.from('contacts')
    .update({
      is_unsubscribed: true,
      unsubscribed_at: event.timestamp || new Date().toISOString(),
      do_not_email: true,
    })
    .eq('id', contactInfo.contactId);

  console.log('Processed contact_unsubscribed for', email);
}
