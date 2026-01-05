import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';
const RATE_LIMIT_DELAY = 250; // 250ms between requests (safe margin for 10 req/2sec)

interface SmartleadCampaign {
  id: number;
  name: string;
  status: string;
  created_at: string;
}

interface SmartleadSequence {
  seq_number: number;
  seq_delay_details: {
    delay_in_days: number;
  };
  seq_variants: Array<{
    id: number;
    variant_label: string;
    subject: string;
    email_body: string;
  }>;
}

interface SmartleadEmailAccount {
  id: number;
  from_email: string;
  from_name: string;
  message_per_day: number;
  warmup_details?: {
    status: string;
  };
}

interface SmartleadAnalytics {
  sent_count: number;
  unique_sent_count: number;
  open_count: number;
  unique_open_count: number;
  click_count: number;
  unique_click_count: number;
  reply_count: number;
  bounce_count: number;
  unsubscribe_count: number;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function smartleadRequest(endpoint: string, apiKey: string) {
  await delay(RATE_LIMIT_DELAY);
  
  const url = `${SMARTLEAD_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}`;
  console.log(`Fetching: ${endpoint}`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Smartlead API error (${response.status}): ${errorText}`);
  }
  
  return response.json();
}

serve(async (req) => {
  console.log('smartlead-sync: Request received', { 
    method: req.method, 
    hasAuth: !!req.headers.get('Authorization'),
  });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log('smartlead-sync: Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('smartlead-sync: Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { workspace_id, sync_type = 'full' } = await req.json();

    if (!workspace_id) {
      throw new Error('workspace_id is required');
    }

    // Verify user has access to workspace
    const { data: membership, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (memberError || !membership) {
      throw new Error('Access denied to workspace');
    }

    // Get Smartlead API connection
    const { data: connection, error: connError } = await supabase
      .from('api_connections')
      .select('id, api_key_encrypted')
      .eq('workspace_id', workspace_id)
      .eq('platform', 'smartlead')
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      throw new Error('No active Smartlead connection found');
    }

    const apiKey = connection.api_key_encrypted;

    // Update sync status to 'syncing'
    await supabase
      .from('api_connections')
      .update({ 
        sync_status: 'syncing',
        sync_progress: { step: 'starting', progress: 0 }
      })
      .eq('id', connection.id);

    const progress = {
      campaigns_synced: 0,
      email_accounts_synced: 0,
      variants_synced: 0,
      metrics_created: 0,
      errors: [] as string[],
    };

    try {
      // 1. Fetch all campaigns
      console.log('Fetching campaigns...');
      const campaigns: SmartleadCampaign[] = await smartleadRequest('/campaigns', apiKey);
      console.log(`Found ${campaigns.length} campaigns`);

      // Update progress
      await supabase
        .from('api_connections')
        .update({ 
          sync_progress: { 
            step: 'campaigns', 
            total: campaigns.length, 
            current: 0,
            progress: 5 
          }
        })
        .eq('id', connection.id);

      for (let i = 0; i < campaigns.length; i++) {
        const campaign = campaigns[i];
        console.log(`Processing campaign ${i + 1}/${campaigns.length}: ${campaign.name}`);

        try {
          // Upsert campaign
          const { data: upsertedCampaign, error: campError } = await supabase
            .from('campaigns')
            .upsert({
              workspace_id,
              platform: 'smartlead',
              platform_id: String(campaign.id),
              name: campaign.name,
              status: campaign.status?.toLowerCase() || 'active',
            }, { onConflict: 'workspace_id,platform_id,platform' })
            .select('id')
            .single();

          if (campError) {
            console.error(`Failed to upsert campaign ${campaign.id}:`, campError);
            progress.errors.push(`Campaign ${campaign.name}: ${campError.message}`);
            continue;
          }

          const campaignDbId = upsertedCampaign.id;
          progress.campaigns_synced++;

          // 2. Fetch sequences (email copy variants)
          try {
            const sequences: SmartleadSequence[] = await smartleadRequest(
              `/campaigns/${campaign.id}/sequences`, 
              apiKey
            );

            for (const seq of sequences) {
              for (const variant of seq.seq_variants) {
                const { error: variantError } = await supabase
                  .from('campaign_variants')
                  .upsert({
                    campaign_id: campaignDbId,
                    platform_variant_id: String(variant.id),
                    name: `Step ${seq.seq_number} - ${variant.variant_label}`,
                    variant_type: variant.variant_label || 'A',
                    subject_line: variant.subject,
                    body_preview: variant.email_body?.substring(0, 500),
                  }, { onConflict: 'campaign_id,platform_variant_id' });

                if (!variantError) {
                  progress.variants_synced++;
                }
              }
            }
          } catch (seqError) {
            console.error(`Failed to fetch sequences for campaign ${campaign.id}:`, seqError);
          }

          // 3. Fetch email accounts
          try {
            const emailAccounts: SmartleadEmailAccount[] = await smartleadRequest(
              `/campaigns/${campaign.id}/email-accounts`,
              apiKey
            );

            for (const account of emailAccounts) {
              const { error: accountError } = await supabase
                .from('email_accounts')
                .upsert({
                  workspace_id,
                  platform: 'smartlead',
                  platform_id: String(account.id),
                  email_address: account.from_email,
                  sender_name: account.from_name,
                  daily_limit: account.message_per_day,
                  warmup_enabled: account.warmup_details?.status === 'ACTIVE',
                  is_active: true,
                }, { onConflict: 'workspace_id,platform_id,platform' });

              if (!accountError) {
                progress.email_accounts_synced++;
              }
            }
          } catch (emailError) {
            console.error(`Failed to fetch email accounts for campaign ${campaign.id}:`, emailError);
          }

          // 4. Fetch analytics
          try {
            const analytics: SmartleadAnalytics = await smartleadRequest(
              `/campaigns/${campaign.id}/analytics`,
              apiKey
            );

            // Get today's date for the metrics
            const today = new Date().toISOString().split('T')[0];

            const { error: metricsError } = await supabase
              .from('daily_metrics')
              .upsert({
                workspace_id,
                campaign_id: campaignDbId,
                date: today,
                sent_count: analytics.sent_count || 0,
                delivered_count: analytics.unique_sent_count || 0,
                opened_count: analytics.unique_open_count || 0,
                clicked_count: analytics.unique_click_count || 0,
                replied_count: analytics.reply_count || 0,
                bounced_count: analytics.bounce_count || 0,
                unsubscribed_count: analytics.unsubscribe_count || 0,
              }, { onConflict: 'workspace_id,campaign_id,date' });

            if (!metricsError) {
              progress.metrics_created++;
            }
          } catch (analyticsError) {
            console.error(`Failed to fetch analytics for campaign ${campaign.id}:`, analyticsError);
          }

          // Update progress
          await supabase
            .from('api_connections')
            .update({ 
              sync_progress: { 
                step: 'campaigns', 
                total: campaigns.length, 
                current: i + 1,
                campaign_name: campaign.name,
                progress: Math.round(((i + 1) / campaigns.length) * 90) + 5
              }
            })
            .eq('id', connection.id);

        } catch (campaignError) {
          console.error(`Error processing campaign ${campaign.id}:`, campaignError);
          progress.errors.push(`Campaign ${campaign.name}: ${String(campaignError)}`);
        }
      }

      // Mark sync as complete
      await supabase
        .from('api_connections')
        .update({ 
          sync_status: 'success',
          last_sync_at: new Date().toISOString(),
          last_full_sync_at: sync_type === 'full' ? new Date().toISOString() : undefined,
          sync_progress: { 
            step: 'complete', 
            progress: 100,
            ...progress
          }
        })
        .eq('id', connection.id);

      return new Response(JSON.stringify({
        success: true,
        message: 'Sync completed successfully',
        ...progress,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (syncError) {
      console.error('Sync error:', syncError);
      
      await supabase
        .from('api_connections')
        .update({ 
          sync_status: 'error',
          sync_progress: { 
            step: 'error', 
            error: String(syncError),
            ...progress
          }
        })
        .eq('id', connection.id);

      throw syncError;
    }

  } catch (error: unknown) {
    console.error('Error in smartlead-sync:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
