import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime global for Supabase Edge Functions
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

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
const MAX_BATCHES = 25; // Safety limit to prevent infinite loops

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

interface SmartleadSequence {
  seq_id: number;
  seq_number: number;
  subject: string;
  email_body: string;
  seq_delay_details?: { delay_in_days: number };
  sequence_variants?: Array<{
    variant_id: string;
    subject: string;
    email_body: string;
  }>;
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

// Extract personalization variables from email content
function extractPersonalizationVars(content: string): string[] {
  const varPatterns = [
    /\{\{([^}]+)\}\}/g,  // {{variable}}
    /\{([^}]+)\}/g,       // {variable}
    /\[\[([^\]]+)\]\]/g,  // [[variable]]
  ];
  
  const vars = new Set<string>();
  for (const pattern of varPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      vars.add(match[1].trim());
    }
  }
  return Array.from(vars);
}

// Self-continuation function using EdgeRuntime.waitUntil
async function triggerNextBatch(
  supabaseUrl: string,
  anonKey: string,
  authToken: string,
  workspaceId: string,
  batchNumber: number
) {
  console.log(`Triggering next batch (${batchNumber}) via self-continuation...`);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/smartlead-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        reset: false,
        batch_number: batchNumber,
        auto_continue: true,
      }),
    });
    console.log(`Next batch triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger next batch:', error);
  }
}

// Chain to Reply.io sync when SmartLead completes
async function triggerReplyioSync(
  supabaseUrl: string,
  anonKey: string,
  authToken: string,
  workspaceId: string
) {
  console.log('SmartLead sync complete - triggering Reply.io sync...');
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/replyio-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        reset: false,
        triggered_by: 'smartlead-complete',
        auto_continue: true,
      }),
    });
    console.log(`Reply.io sync triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger Reply.io sync:', error);
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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await createClient(
      supabaseUrl, anonKey,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) throw new Error('Unauthorized');

    const { workspace_id, reset = false, batch_number = 1, auto_continue = false } = await req.json();
    if (!workspace_id) throw new Error('workspace_id is required');

    // Safety check for max batches
    if (batch_number > MAX_BATCHES) {
      console.error(`Max batch limit (${MAX_BATCHES}) reached. Stopping sync.`);
      return new Response(JSON.stringify({ 
        error: 'Max batch limit reached',
        batch_number,
        message: 'Sync stopped after too many batches. Please check for issues.'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Starting batch ${batch_number}, auto_continue=${auto_continue}`);

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

    await supabase.from('api_connections').update({ 
      sync_status: 'syncing',
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id);

    const progress = {
      campaigns_synced: 0,
      email_accounts_synced: 0,
      metrics_created: 0,
      variants_synced: 0,
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
        console.log(`Time budget exceeded at campaign ${i}/${campaigns.length}. Triggering continuation...`);
        
        await supabase.from('api_connections').update({
          sync_progress: { 
            campaign_index: i, 
            total_campaigns: campaigns.length,
            batch_number: batch_number,
          },
          sync_status: 'partial',
          updated_at: new Date().toISOString(),
        }).eq('id', connection.id);

        // Use EdgeRuntime.waitUntil to trigger next batch after response
        const shouldContinue = auto_continue || batch_number === 1;
        if (shouldContinue) {
          EdgeRuntime.waitUntil(
            triggerNextBatch(supabaseUrl, anonKey, authHeader, workspace_id, batch_number + 1)
          );
        }

        return new Response(JSON.stringify({
          success: true,
          complete: false,
          progress,
          current: i,
          total: campaigns.length,
          batch_number,
          message: `Processed ${i}/${campaigns.length} campaigns. ${shouldContinue ? 'Auto-continuing...' : 'Run again to continue.'}`,
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

        // Fetch sequences/variants for this campaign
        try {
          const sequences: SmartleadSequence[] = await smartleadRequest(`/campaigns/${campaign.id}/sequences`, apiKey);
          
          if (sequences && sequences.length > 0) {
            console.log(`  Found ${sequences.length} sequences for campaign`);
            
            for (const seq of sequences) {
              // Store the main sequence as a variant
              const mainSubject = seq.subject || '';
              const mainBody = seq.email_body || '';
              const mainVars = extractPersonalizationVars(mainSubject + ' ' + mainBody);
              const mainWordCount = mainBody.split(/\s+/).filter(Boolean).length;
              
              // Upsert main sequence as variant
              await supabase.from('smartlead_variants').upsert({
                campaign_id: campaignDbId,
                platform_variant_id: `seq-${seq.seq_id}`,
                name: `Step ${seq.seq_number}`,
                subject_line: mainSubject,
                body_preview: mainBody.substring(0, 500),
                email_body: mainBody,
                word_count: mainWordCount,
                personalization_vars: mainVars,
                step_number: seq.seq_number,
                is_control: true,
              }, { onConflict: 'campaign_id,platform_variant_id' });
              
              progress.variants_synced++;

              // Store A/B variants if they exist
              if (seq.sequence_variants && seq.sequence_variants.length > 0) {
                for (const variant of seq.sequence_variants) {
                  const varSubject = variant.subject || mainSubject;
                  const varBody = variant.email_body || mainBody;
                  const varVars = extractPersonalizationVars(varSubject + ' ' + varBody);
                  const varWordCount = varBody.split(/\s+/).filter(Boolean).length;
                  
                  await supabase.from('smartlead_variants').upsert({
                    campaign_id: campaignDbId,
                    platform_variant_id: `var-${variant.variant_id}`,
                    name: `Step ${seq.seq_number} Variant ${variant.variant_id}`,
                    subject_line: varSubject,
                    body_preview: varBody.substring(0, 500),
                    email_body: varBody,
                    word_count: varWordCount,
                    personalization_vars: varVars,
                    step_number: seq.seq_number,
                    is_control: false,
                  }, { onConflict: 'campaign_id,platform_variant_id' });
                  
                  progress.variants_synced++;
                }
              }
            }
            console.log(`  Variants synced: ${progress.variants_synced} total`);
          }
        } catch (e) {
          console.error(`  Sequences error for ${campaign.name}:`, e);
          progress.errors.push(`Sequences ${campaign.name}: ${(e as Error).message}`);
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

    // Check if Reply.io connection exists and trigger its sync
    const { data: replyioConnection } = await supabase
      .from('api_connections')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('platform', 'replyio')
      .eq('is_active', true)
      .single();

    if (replyioConnection && auto_continue) {
      EdgeRuntime.waitUntil(
        triggerReplyioSync(supabaseUrl, anonKey, authHeader, workspace_id)
      );
    }

    return new Response(JSON.stringify({
      success: true,
      complete: true,
      progress,
      message: `Synced ${progress.campaigns_synced} campaigns, ${progress.variants_synced} variants, ${progress.metrics_created} metrics, ${progress.email_accounts_synced} email accounts`,
      next: replyioConnection ? 'Triggering Reply.io sync...' : null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('smartlead-sync error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
