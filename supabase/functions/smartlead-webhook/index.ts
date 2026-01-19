import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-smartlead-signature',
};

interface SmartleadWebhookEvent {
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
  [key: string]: any;
}

Deno.serve(async (req) => {
  console.log('smartlead-webhook: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const event: SmartleadWebhookEvent = body;

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
  event: SmartleadWebhookEvent
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

  // Update hourly metrics
  const now = new Date(event.event_timestamp || Date.now());
  await supabase.from('hourly_metrics').upsert({
    engagement_id: engagementId,
    campaign_id: campaignId,
    hour_of_day: now.getUTCHours(),
    day_of_week: now.getUTCDay(),
    metric_date: now.toISOString().split('T')[0],
    emails_sent: 1,
  }, { 
    onConflict: 'engagement_id,campaign_id,hour_of_day,day_of_week,metric_date',
    count: 'exact'
  });

  console.log('Processed EMAIL_SENT for', event.email);
}

async function processEmailOpen(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: SmartleadWebhookEvent
) {
  if (!event.email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contactInfo) return;

  await supabase.from('email_activities')
    .update({
      opened: true,
      first_opened_at: event.event_timestamp || new Date().toISOString(),
      open_count: supabase.raw('COALESCE(open_count, 0) + 1'),
    })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId)
    .eq('step_number', event.sequence_number || 1);

  // Update hourly metrics
  const now = new Date(event.event_timestamp || Date.now());
  await supabase.from('hourly_metrics').upsert({
    engagement_id: engagementId,
    campaign_id: campaignId,
    hour_of_day: now.getUTCHours(),
    day_of_week: now.getUTCDay(),
    metric_date: now.toISOString().split('T')[0],
    emails_opened: 1,
  }, { onConflict: 'engagement_id,campaign_id,hour_of_day,day_of_week,metric_date' });

  console.log('Processed EMAIL_OPEN for', event.email);
}

async function processEmailClick(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: SmartleadWebhookEvent
) {
  if (!event.email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contactInfo) return;

  // Get email activity ID
  const { data: activity } = await supabase
    .from('email_activities')
    .select('id')
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId)
    .eq('step_number', event.sequence_number || 1)
    .single();

  await supabase.from('email_activities')
    .update({
      clicked: true,
      first_clicked_at: event.event_timestamp || new Date().toISOString(),
      click_count: supabase.raw('COALESCE(click_count, 0) + 1'),
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

  // Update hourly metrics
  const now = new Date(event.event_timestamp || Date.now());
  await supabase.from('hourly_metrics').upsert({
    engagement_id: engagementId,
    campaign_id: campaignId,
    hour_of_day: now.getUTCHours(),
    day_of_week: now.getUTCDay(),
    metric_date: now.toISOString().split('T')[0],
    emails_clicked: 1,
  }, { onConflict: 'engagement_id,campaign_id,hour_of_day,day_of_week,metric_date' });

  console.log('Processed EMAIL_CLICK for', event.email);
}

async function processEmailReply(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: SmartleadWebhookEvent
) {
  if (!event.email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contactInfo) return;

  await supabase.from('email_activities')
    .update({
      replied: true,
      replied_at: event.event_timestamp || new Date().toISOString(),
      reply_text: event.reply_text || null,
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

  // Update hourly metrics
  const now = new Date(event.event_timestamp || Date.now());
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

  console.log('Processed EMAIL_REPLY for', event.email);
}

async function processEmailBounce(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: SmartleadWebhookEvent
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

  // Update hourly metrics
  const now = new Date(event.event_timestamp || Date.now());
  await supabase.from('hourly_metrics').upsert({
    engagement_id: engagementId,
    campaign_id: campaignId,
    hour_of_day: now.getUTCHours(),
    day_of_week: now.getUTCDay(),
    metric_date: now.toISOString().split('T')[0],
    emails_bounced: 1,
  }, { onConflict: 'engagement_id,campaign_id,hour_of_day,day_of_week,metric_date' });

  console.log('Processed EMAIL_BOUNCE for', event.email);
}

async function processUnsubscribe(
  supabase: any,
  engagementId: string,
  campaignId: string,
  event: SmartleadWebhookEvent
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
  event: SmartleadWebhookEvent
) {
  if (!event.email) return;

  const contactInfo = await getOrCreateContact(supabase, engagementId, event.email);
  if (!contactInfo) return;

  // Update email activity with category
  await supabase.from('email_activities')
    .update({
      lead_category: event.category_name || null,
    })
    .eq('engagement_id', engagementId)
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactInfo.contactId);

  console.log('Processed LEAD_CATEGORY_UPDATED for', event.email);
}
