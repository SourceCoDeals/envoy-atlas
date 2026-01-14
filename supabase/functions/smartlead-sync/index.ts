import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';
// SmartLead Rate Limit: 10 requests per 2 seconds = 5 req/s
// Using 250ms delay = 4 req/s to stay safely within limits
const RATE_LIMIT_DELAY = 250;
const BATCH_SIZE = 20;
const TIME_BUDGET_MS = 55000;

interface SmartleadCampaign {
  id: number;
  name: string;
  status: string;
  created_at: string;
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

interface SmartleadEmailAccount {
  id: number;
  from_email: string;
  from_name: string;
  message_per_day: number;
  warmup_details?: { status: string };
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function smartleadRequest(endpoint: string, apiKey: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    await delay(RATE_LIMIT_DELAY);
    const url = `${SMARTLEAD_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}`;
    console.log(`Fetching: ${endpoint}`);
    
    try {
      const response = await fetch(url);
      
      if (response.status === 429) {
        console.log(`Rate limited, waiting ${(i + 1) * 2} seconds...`);
        await delay((i + 1) * 2000);
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error ${response.status}: ${errorText}`);
        if (i === retries - 1) throw new Error(`Smartlead API error (${response.status}): ${errorText}`);
        continue;
      }
      
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retry ${i + 1}/${retries} after error:`, error);
      await delay(1000 * (i + 1));
    }
  }
}

serve(async (req) => {
  console.log('smartlead-sync: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('smartlead-sync: Missing authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await createClient(
      supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) throw new Error('Unauthorized');

    const { workspace_id, reset = false } = await req.json();
    if (!workspace_id) throw new Error('workspace_id is required');

    const { data: membership } = await supabase
      .from('workspace_members').select('role')
      .eq('workspace_id', workspace_id).eq('user_id', user.id).single();
    if (!membership) throw new Error('Access denied to workspace');

    const { data: connection, error: connError } = await supabase
      .from('api_connections').select('id, api_key_encrypted, sync_progress, sync_status')
      .eq('workspace_id', workspace_id).eq('platform', 'smartlead').eq('is_active', true).single();
    if (connError || !connection) throw new Error('No active Smartlead connection found');

    const apiKey = connection.api_key_encrypted;

    // Handle reset - clear all synced data
    if (reset) {
      console.log('Resetting SmartLead sync data for workspace:', workspace_id);
      const { data: campaigns } = await supabase.from('smartlead_campaigns').select('id').eq('workspace_id', workspace_id);
      const campaignIds = campaigns?.map(c => c.id) || [];
      
      if (campaignIds.length > 0) {
        await supabase.from('smartlead_daily_metrics').delete().eq('workspace_id', workspace_id);
        await supabase.from('smartlead_variants').delete().in('campaign_id', campaignIds);
        await supabase.from('smartlead_sequence_steps').delete().in('campaign_id', campaignIds);
        await supabase.from('smartlead_campaigns').delete().eq('workspace_id', workspace_id);
      }
      await supabase.from('email_accounts').delete().eq('workspace_id', workspace_id).eq('platform', 'smartlead');
      console.log('Reset complete');
    }

    await supabase.from('api_connections').update({ sync_status: 'syncing' }).eq('id', connection.id);

    const progress = {
      campaigns_synced: 0,
      email_accounts_synced: 0,
      metrics_created: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;

    // Step 1: Fetch all campaigns
    console.log('Fetching all campaigns...');
    const campaigns: SmartleadCampaign[] = await smartleadRequest('/campaigns', apiKey);
    console.log(`Found ${campaigns.length} total campaigns`);

    // Sort: active first, then by created_at
    campaigns.sort((a, b) => {
      const statusOrder = { active: 0, paused: 1, drafted: 2, completed: 3 };
      const aOrder = statusOrder[a.status?.toLowerCase() as keyof typeof statusOrder] ?? 4;
      const bOrder = statusOrder[b.status?.toLowerCase() as keyof typeof statusOrder] ?? 4;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const existingProgress = (connection.sync_progress as any) || {};
    let startIndex = reset ? 0 : (existingProgress.campaign_index || 0);

    // Step 2: Process campaigns in batches
    for (let i = startIndex; i < campaigns.length; i++) {
      if (isTimeBudgetExceeded()) {
        console.log(`Time budget exceeded at campaign ${i}/${campaigns.length}. Will continue next run.`);
        await supabase.from('api_connections').update({
          sync_progress: { campaign_index: i, total_campaigns: campaigns.length },
          sync_status: 'partial',
        }).eq('id', connection.id);

        // Note: Sync will auto-resume on next trigger or scheduled run

        return new Response(JSON.stringify({
          success: true,
          complete: false,
          progress,
          message: `Processed ${i}/${campaigns.length} campaigns. Continuing...`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const campaign = campaigns[i];
      console.log(`[${i + 1}/${campaigns.length}] Processing: ${campaign.name} (${campaign.status})`);

      try {
        // Upsert campaign
        const { data: upsertedCampaign, error: campError } = await supabase
          .from('smartlead_campaigns')
          .upsert({
            workspace_id,
            platform_id: String(campaign.id),
            name: campaign.name,
            status: campaign.status?.toLowerCase() || 'unknown',
          }, { onConflict: 'workspace_id,platform_id' })
          .select('id')
          .single();

        if (campError) {
          console.error(`Failed to upsert campaign ${campaign.name}:`, campError.message);
          progress.errors.push(`Campaign ${campaign.name}: ${campError.message}`);
          continue;
        }

        const campaignDbId = upsertedCampaign.id;
        progress.campaigns_synced++;

        // Fetch analytics
        try {
          const analytics: SmartleadAnalytics = await smartleadRequest(`/campaigns/${campaign.id}/analytics`, apiKey);
          const today = new Date().toISOString().split('T')[0];

          await supabase.from('smartlead_daily_metrics').upsert({
            workspace_id,
            campaign_id: campaignDbId,
            metric_date: today,
            sent_count: analytics.sent_count || 0,
            opened_count: analytics.unique_open_count || 0,
            clicked_count: analytics.unique_click_count || 0,
            replied_count: analytics.reply_count || 0,
            bounced_count: analytics.bounce_count || 0,
          }, { onConflict: 'campaign_id,metric_date' });

          progress.metrics_created++;
          console.log(`  Analytics synced: sent=${analytics.sent_count}, opens=${analytics.unique_open_count}, replies=${analytics.reply_count}`);
        } catch (e) {
          console.error(`  Analytics error for ${campaign.name}:`, e);
          progress.errors.push(`Analytics ${campaign.name}: ${(e as Error).message}`);
        }

        // Fetch email accounts for this campaign
        try {
          const emailAccounts: SmartleadEmailAccount[] = await smartleadRequest(`/campaigns/${campaign.id}/email-accounts`, apiKey);
          
          for (const account of emailAccounts || []) {
            await supabase.from('email_accounts').upsert({
              workspace_id,
              platform: 'smartlead',
              platform_id: String(account.id),
              email_address: account.from_email,
              sender_name: account.from_name || null,
              daily_limit: account.message_per_day || null,
              warmup_enabled: account.warmup_details?.status === 'enabled',
              is_active: true,
            }, { onConflict: 'workspace_id,platform,platform_id' });
            progress.email_accounts_synced++;
          }
          console.log(`  Email accounts synced: ${emailAccounts?.length || 0}`);
        } catch (e) {
          console.error(`  Email accounts error for ${campaign.name}:`, e);
        }

      } catch (e) {
        console.error(`Error processing campaign ${campaign.name}:`, e);
        progress.errors.push(`${campaign.name}: ${(e as Error).message}`);
      }
    }

    // Sync complete
    await supabase.from('api_connections').update({
      sync_status: 'success',
      sync_progress: { completed: true, total_campaigns: campaigns.length },
      last_sync_at: new Date().toISOString(),
      last_full_sync_at: new Date().toISOString(),
    }).eq('id', connection.id);

    console.log('SmartLead sync complete:', progress);

    return new Response(JSON.stringify({
      success: true,
      complete: true,
      progress,
      message: `Synced ${progress.campaigns_synced} campaigns, ${progress.metrics_created} metrics, ${progress.email_accounts_synced} email accounts`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('smartlead-sync error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
