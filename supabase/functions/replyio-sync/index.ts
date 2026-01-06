import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REPLYIO_BASE_URL = 'https://api.reply.io';
const RATE_LIMIT_DELAY = 500; // Reply.io has 10-second throttle on some endpoints
const BATCH_SIZE = 5;
const TIME_BUDGET_MS = 45000;

// Personal email domains for classification
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
  'aol.com', 'icloud.com', 'protonmail.com', 'mail.com',
  'live.com', 'msn.com', 'me.com', 'ymail.com', 'googlemail.com',
  'yahoo.co.uk', 'hotmail.co.uk', 'outlook.co.uk', 'btinternet.com',
  'gmx.com', 'gmx.net', 'web.de', 'zoho.com', 'fastmail.com',
]);

function classifyEmailType(email: string): 'personal' | 'work' {
  const domain = email.split('@')[1]?.toLowerCase();
  return PERSONAL_DOMAINS.has(domain) ? 'personal' : 'work';
}

function extractEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

// Map Reply.io status codes to readable strings
function mapCampaignStatus(status: number): string {
  switch (status) {
    case 0: return 'new';
    case 2: return 'active';
    case 4: return 'paused';
    default: return 'unknown';
  }
}

// Map Reply.io stage IDs to sentiment
function mapStageToSentiment(stageId: number): { sentiment: string; eventType: string } {
  switch (stageId) {
    case 3: // Replied
      return { sentiment: 'neutral', eventType: 'replied' };
    case 4: // Interested
      return { sentiment: 'positive', eventType: 'positive_reply' };
    case 5: // Not interested
      return { sentiment: 'negative', eventType: 'negative_reply' };
    case 7: // Do not contact
      return { sentiment: 'negative', eventType: 'negative_reply' };
    case 8: // Bad contact info
      return { sentiment: 'neutral', eventType: 'bounce' };
    default:
      return { sentiment: 'neutral', eventType: 'replied' };
  }
}

interface ReplyioCampaign {
  id: number;
  name: string;
  created: string;
  status: number;
  emailAccounts: string[];
  ownerEmail: string;
  deliveriesCount: number;
  opensCount: number;
  repliesCount: number;
  bouncesCount: number;
  optOutsCount: number;
  outOfOfficeCount: number;
  peopleCount: number;
  peopleFinished: number;
  peopleActive: number;
  peoplePaused: number;
}

interface ReplyioContact {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  city?: string;
  state?: string;
  country?: string;
  title?: string;
  phone?: string;
  linkedInProfile?: string;
  addingDate?: string;
  companySize?: string;
  industry?: string;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function replyioRequest(endpoint: string, apiKey: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    await delay(RATE_LIMIT_DELAY);
    const url = `${REPLYIO_BASE_URL}${endpoint}`;
    console.log(`Fetching: ${endpoint}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.status === 429) {
        console.log(`Rate limited, waiting ${(i + 1) * 10} seconds...`);
        await delay((i + 1) * 10000);
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error ${response.status}: ${errorText}`);
        if (i === retries - 1) throw new Error(`Reply.io API error (${response.status}): ${errorText}`);
        continue;
      }
      
      const text = await response.text();
      if (!text) return null;
      return JSON.parse(text);
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retry ${i + 1}/${retries} after error:`, error);
      await delay(1000 * (i + 1));
    }
  }
}

serve(async (req) => {
  console.log('replyio-sync: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('replyio-sync: Missing authorization header');
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

    const { workspace_id, sync_type = 'full', reset = false } = await req.json();
    if (!workspace_id) throw new Error('workspace_id is required');

    const { data: membership, error: memberError } = await supabase
      .from('workspace_members').select('role')
      .eq('workspace_id', workspace_id).eq('user_id', user.id).single();
    if (memberError || !membership) throw new Error('Access denied to workspace');

    const { data: connection, error: connError } = await supabase
      .from('api_connections').select('id, api_key_encrypted, sync_progress, sync_status')
      .eq('workspace_id', workspace_id).eq('platform', 'replyio').eq('is_active', true).single();
    if (connError || !connection) throw new Error('No active Reply.io connection found');

    const apiKey = connection.api_key_encrypted;
    const existingSyncProgress = connection.sync_progress as any || {};

    // Handle reset
    if (reset) {
      console.log('Resetting sync data for workspace:', workspace_id);
      
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('platform', 'replyio');
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      
      if (campaignIds.length > 0) {
        await supabase.from('message_events').delete().eq('workspace_id', workspace_id).eq('platform', 'replyio');
        await supabase.from('daily_metrics').delete().in('campaign_id', campaignIds);
        await supabase.from('hourly_metrics').delete().in('campaign_id', campaignIds);
        await supabase.from('leads').delete().eq('workspace_id', workspace_id).eq('platform', 'replyio');
        await supabase.from('campaign_variants').delete().in('campaign_id', campaignIds);
        await supabase.from('sequence_steps').delete().in('campaign_id', campaignIds);
        await supabase.from('campaigns').delete().eq('workspace_id', workspace_id).eq('platform', 'replyio');
      }
      
      await supabase.from('email_accounts').delete().eq('workspace_id', workspace_id).eq('platform', 'replyio');
      
      await supabase.from('api_connections').update({
        sync_status: 'syncing',
        sync_progress: { campaign_index: 0 },
      }).eq('id', connection.id);
    }

    // Get sync progress
    let resumeFromCampaign = reset ? 0 : (existingSyncProgress.campaign_index || 0);

    await supabase.from('api_connections').update({
      sync_status: 'syncing',
      sync_progress: {
        ...existingSyncProgress,
        last_heartbeat: new Date().toISOString(),
      },
    }).eq('id', connection.id);

    const progress = {
      campaigns_synced: 0,
      email_accounts_synced: 0,
      leads_synced: 0,
      metrics_created: 0,
      events_created: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;

    try {
      // Reply.io doesn't have a "list all campaigns" endpoint directly
      // We need to fetch campaigns by ID or use v2 sequences endpoint
      // Let's try using v2 sequences which acts as campaigns
      console.log('Fetching campaigns/sequences...');
      
      // First, let's get all email accounts to determine what campaigns exist
      // Reply.io structure: campaigns contain email accounts and contacts
      // We'll fetch campaigns by querying contacts first or use a known approach
      
      // Try v2 sequences endpoint
      let campaigns: ReplyioCampaign[] = [];
      
      try {
        const schedulesData = await replyioRequest('/v2/schedules', apiKey);
        console.log('Schedules data:', schedulesData ? 'found' : 'empty');
      } catch (e) {
        console.log('Could not fetch schedules:', e);
      }

      // Since Reply.io API requires specific campaign IDs or names,
      // we need to discover campaigns through contacts or use a different approach
      // Let's try to fetch existing campaigns from our DB first, then update them
      
      // For new syncs, we'll need the user to provide campaign IDs or we iterate
      // Reply.io API documentation shows we need campaign IDs
      
      // Alternative: Get contacts and their campaign associations
      // Using v1/people endpoint to get all contacts, then their campaigns
      
      console.log('Fetching contacts to discover campaigns...');
      
      const contactsPageSize = 100;
      let contactsPage = 1;
      let hasMoreContacts = true;
      const discoveredCampaignIds = new Set<number>();
      const allContacts: ReplyioContact[] = [];
      
      // First, get all people lists to enumerate contacts
      try {
        const listsData = await replyioRequest('/v1/people/lists', apiKey);
        console.log(`Found ${listsData?.length || 0} contact lists`);
        
        if (Array.isArray(listsData) && listsData.length > 0) {
          for (const list of listsData) {
            console.log(`Fetching contacts from list: ${list.name} (ID: ${list.id})`);
            
            let page = 1;
            let hasMore = true;
            
            while (hasMore && !isTimeBudgetExceeded()) {
              const listContacts = await replyioRequest(`/v1/people/list/${list.id}?page=${page}&limit=100`, apiKey);
              
              if (listContacts?.people && Array.isArray(listContacts.people)) {
                allContacts.push(...listContacts.people);
                
                // Get campaigns for each contact
                for (const contact of listContacts.people) {
                  try {
                    const contactCampaigns = await replyioRequest(`/v1/people/${contact.id}/sequences`, apiKey);
                    if (Array.isArray(contactCampaigns)) {
                      for (const seq of contactCampaigns) {
                        discoveredCampaignIds.add(seq.sequenceId);
                      }
                    }
                  } catch (e) {
                    console.log(`Could not fetch campaigns for contact ${contact.id}:`, e);
                  }
                }
                
                hasMore = listContacts.pagesCount > page;
                page++;
              } else {
                hasMore = false;
              }
            }
          }
        }
      } catch (e) {
        console.error('Error fetching contact lists:', e);
        progress.errors.push(`Contact lists: ${String(e)}`);
      }

      console.log(`Discovered ${discoveredCampaignIds.size} unique campaigns`);
      console.log(`Found ${allContacts.length} contacts`);

      // Fetch campaign details for each discovered campaign
      const campaignIds = Array.from(discoveredCampaignIds);
      
      for (let i = resumeFromCampaign; i < campaignIds.length && !isTimeBudgetExceeded(); i++) {
        const campaignId = campaignIds[i];
        console.log(`Fetching campaign details for ID: ${campaignId}`);
        
        try {
          const campaignData: ReplyioCampaign = await replyioRequest(`/v1/campaigns?id=${campaignId}`, apiKey);
          
          if (!campaignData) {
            console.log(`Campaign ${campaignId} returned no data`);
            continue;
          }

          // Upsert campaign
          const { data: upsertedCampaign, error: campError } = await supabase
            .from('campaigns')
            .upsert({ 
              workspace_id, 
              platform: 'replyio', 
              platform_id: String(campaignData.id), 
              name: campaignData.name, 
              status: mapCampaignStatus(campaignData.status),
              updated_at: new Date().toISOString()
            }, { 
              onConflict: 'workspace_id,platform_id,platform' 
            })
            .select('id')
            .single();

          if (campError) {
            console.error(`Failed to upsert campaign ${campaignId}:`, campError);
            progress.errors.push(`Campaign ${campaignData.name}: ${campError.message}`);
            continue;
          }

          const campaignDbId = upsertedCampaign.id;
          progress.campaigns_synced++;

          // Process email accounts from campaign
          if (campaignData.emailAccounts && Array.isArray(campaignData.emailAccounts)) {
            for (const emailAccount of campaignData.emailAccounts) {
              const { error: accountError } = await supabase
                .from('email_accounts')
                .upsert({
                  workspace_id, 
                  platform: 'replyio', 
                  platform_id: `replyio-${emailAccount}`,
                  email_address: emailAccount, 
                  sender_name: emailAccount.split('@')[0],
                  is_active: true,
                }, { 
                  onConflict: 'workspace_id,platform_id,platform' 
                });
                
              if (!accountError) progress.email_accounts_synced++;
            }
          }

          // Create daily metrics from campaign stats
          const today = new Date().toISOString().split('T')[0];
          
          const metricsPayload = {
            workspace_id, 
            campaign_id: campaignDbId, 
            date: today,
            sent_count: campaignData.deliveriesCount || 0,
            delivered_count: campaignData.deliveriesCount || 0,
            opened_count: campaignData.opensCount || 0,
            replied_count: campaignData.repliesCount || 0,
            bounced_count: campaignData.bouncesCount || 0,
            unsubscribed_count: campaignData.optOutsCount || 0,
          };

          const { data: existingMetric } = await supabase
            .from('daily_metrics')
            .select('id')
            .eq('workspace_id', workspace_id)
            .eq('campaign_id', campaignDbId)
            .eq('date', today)
            .is('variant_id', null)
            .is('email_account_id', null)
            .is('segment_id', null)
            .maybeSingle();

          const { error: metricsError } = existingMetric?.id
            ? await supabase.from('daily_metrics').update(metricsPayload).eq('id', existingMetric.id)
            : await supabase.from('daily_metrics').insert(metricsPayload);

          if (!metricsError) progress.metrics_created++;

          // Update progress
          await supabase.from('api_connections').update({
            sync_progress: {
              campaign_index: i + 1,
              total_campaigns: campaignIds.length,
              current_campaign: i + 1,
              campaign_name: campaignData.name,
              step: 'campaigns',
              progress: Math.round(((i + 1) / Math.max(1, campaignIds.length)) * 90) + 5,
              ...progress,
            },
          }).eq('id', connection.id);

        } catch (campaignError) {
          console.error(`Error processing campaign ${campaignId}:`, campaignError);
          progress.errors.push(`Campaign ${campaignId}: ${String(campaignError)}`);
        }
      }

      // Now sync contacts as leads
      console.log(`Processing ${allContacts.length} contacts as leads...`);
      
      for (const contact of allContacts) {
        if (isTimeBudgetExceeded()) break;
        
        const email = contact.email?.toLowerCase();
        if (!email) continue;

        const leadPayload = {
          workspace_id,
          platform: 'replyio',
          platform_lead_id: String(contact.id),
          email: email,
          first_name: contact.firstName || null,
          last_name: contact.lastName || null,
          company: contact.company || null,
          title: contact.title || null,
          phone_number: contact.phone || null,
          linkedin_url: contact.linkedInProfile || null,
          location: [contact.city, contact.state, contact.country].filter(Boolean).join(', ') || null,
          industry: contact.industry || null,
          company_size: contact.companySize || null,
          email_type: classifyEmailType(email),
          email_domain: extractEmailDomain(email),
          status: 'active',
        };

        const { error: leadError } = await supabase
          .from('leads')
          .upsert(leadPayload, { 
            onConflict: 'workspace_id,platform,platform_lead_id' 
          });

        if (!leadError) progress.leads_synced++;
      }

      const isComplete = !isTimeBudgetExceeded() && 
        (campaignIds.length === 0 || resumeFromCampaign + BATCH_SIZE >= campaignIds.length);

      await supabase.from('api_connections').update({
        sync_status: isComplete ? 'success' : 'syncing',
        last_sync_at: isComplete ? new Date().toISOString() : undefined,
        last_full_sync_at: isComplete && sync_type === 'full' ? new Date().toISOString() : undefined,
        sync_progress: {
          campaign_index: Math.min(resumeFromCampaign + BATCH_SIZE, campaignIds.length),
          total_campaigns: campaignIds.length,
          step: isComplete ? 'complete' : 'campaigns',
          progress: isComplete ? 100 : Math.round((resumeFromCampaign / Math.max(1, campaignIds.length)) * 90) + 5,
          completed: isComplete,
          ...progress,
        },
      }).eq('id', connection.id);

      console.log('Progress:', { isComplete, ...progress });

      return new Response(JSON.stringify({
        success: true, 
        done: isComplete, 
        campaign_index: resumeFromCampaign,
        total: campaignIds.length,
        message: isComplete ? 'Sync completed successfully' : `Processed campaigns; call again to continue`,
        ...progress,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (syncError) {
      console.error('Sync error:', syncError);
      progress.errors.push(String(syncError));

      await supabase.from('api_connections').update({
        sync_status: 'error',
        sync_progress: {
          ...existingSyncProgress,
          error: String(syncError),
          ...progress,
        },
      }).eq('id', connection.id);

      return new Response(JSON.stringify({
        success: false,
        error: String(syncError),
        ...progress,
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

  } catch (error) {
    console.error('replyio-sync error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: String(error) 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
