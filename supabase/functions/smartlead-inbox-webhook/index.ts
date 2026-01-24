import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    
    console.log('[smartlead-inbox-webhook] Received webhook payload');

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract fields from the body - this comes from n8n forwarding SmartLead webhook
    const record = {
      // Campaign info
      campaign_status: body.campaign_status || null,
      campaign_name: body.campaign_name || null,
      campaign_id: body.campaign_id || null,
      
      // Lead identifiers
      stats_id: body.stats_id || null,
      sl_email_lead_id: body.sl_email_lead_id || null,
      sl_email_lead_map_id: body.sl_email_lead_map_id || null,
      sl_lead_email: body.sl_lead_email || null,
      
      // Email details
      from_email: body.from_email || null,
      to_email: body.to_email || null,
      to_name: body.to_name || null,
      cc_emails: body.cc_emails || [],
      subject: body.subject || null,
      message_id: body.message_id || null,
      
      // Sent message
      sent_message_body: body.sent_message_body || null,
      sent_message: body.sent_message || null,
      
      // Reply details
      time_replied: body.time_replied || null,
      event_timestamp: body.event_timestamp || null,
      reply_message: body.reply_message || null,
      reply_body: body.reply_body || null,
      preview_text: body.preview_text || null,
      
      // Sequence info
      sequence_number: body.sequence_number || null,
      
      // Links and metadata
      secret_key: body.secret_key || null,
      app_url: body.app_url || null,
      ui_master_inbox_link: body.ui_master_inbox_link || null,
      description: body.description || null,
      metadata: body.metadata || null,
      lead_correspondence: body.leadCorrespondence || null,
      
      // Webhook info
      webhook_url: body.webhook_url || null,
      webhook_id: body.webhook_id || null,
      webhook_name: body.webhook_name || null,
      event_type: body.event_type || null,
      
      // Client reference
      client_id: body.client_id || null,
      
      // Store raw payload for debugging
      raw_payload: body,
    };

    console.log('[smartlead-inbox-webhook] Inserting record for lead:', record.sl_lead_email);

    const { data, error } = await supabase
      .from('smartlead_inbox_webhooks')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('[smartlead-inbox-webhook] Insert error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[smartlead-inbox-webhook] Successfully stored webhook:', data.id);

    return new Response(JSON.stringify({ 
      success: true, 
      id: data.id,
      message: 'Webhook received and stored' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[smartlead-inbox-webhook] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
