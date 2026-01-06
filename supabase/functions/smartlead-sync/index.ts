import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';
const RATE_LIMIT_DELAY = 300;
const BATCH_SIZE = 5;

// Personal email domains for classification
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
  'aol.com', 'icloud.com', 'protonmail.com', 'mail.com',
  'live.com', 'msn.com', 'me.com', 'ymail.com', 'googlemail.com',
  'yahoo.co.uk', 'hotmail.co.uk', 'outlook.co.uk', 'btinternet.com',
  'sky.com', 'virgin.net', 'ntlworld.com', 'talktalk.net',
  'gmx.com', 'gmx.net', 'web.de', 'zoho.com', 'fastmail.com',
  'tutanota.com', 'pm.me', 'proton.me'
]);

function classifyEmailType(email: string): 'personal' | 'work' {
  const domain = email.split('@')[1]?.toLowerCase();
  return PERSONAL_DOMAINS.has(domain) ? 'personal' : 'work';
}

function extractEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

interface SmartleadCampaign {
  id: number;
  name: string;
  status: string;
  created_at: string;
}

interface SmartleadSequence {
  seq_number: number;
  seq_delay_details: { delay_in_days: number };
  // Direct fields for non-A/B campaigns
  subject?: string;
  email_body?: string;
  // Array of variants for A/B test campaigns (field name from API is sequence_variants)
  sequence_variants?: Array<{
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
  warmup_details?: { status: string };
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

interface SmartleadLead {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  company?: string;
  linkedin_profile?: string;
  linkedin_url?: string;
  phone_number?: string;
  website?: string;
  lead_status?: string;
  category?: string;
  designation?: string;
  title?: string;
  location?: string;
  city?: string;
  industry?: string;
  company_size?: string;
  source?: string;
}

interface SmartleadLeadMessageHistory {
  id: number;
  type: string;
  time: string;
  email_body?: string;
  email_subject?: string;
  seq_number?: number;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

    const { workspace_id, sync_type = 'full', reset = false } = await req.json();
    if (!workspace_id) throw new Error('workspace_id is required');

    const { data: membership, error: memberError } = await supabase
      .from('workspace_members').select('role')
      .eq('workspace_id', workspace_id).eq('user_id', user.id).single();
    if (memberError || !membership) throw new Error('Access denied to workspace');

    const { data: connection, error: connError } = await supabase
      .from('api_connections').select('id, api_key_encrypted, sync_progress')
      .eq('workspace_id', workspace_id).eq('platform', 'smartlead').eq('is_active', true).single();
    if (connError || !connection) throw new Error('No active Smartlead connection found');

    const apiKey = connection.api_key_encrypted;

    // Handle reset - clear all synced data
    if (reset) {
      console.log('Resetting sync data for workspace:', workspace_id);
      
      // Get campaign IDs first
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('workspace_id', workspace_id);
      
      const campaignIds = campaigns?.map(c => c.id) || [];
      
      if (campaignIds.length > 0) {
        await supabase.from('message_events').delete().eq('workspace_id', workspace_id);
        await supabase.from('daily_metrics').delete().eq('workspace_id', workspace_id);
        await supabase.from('hourly_metrics').delete().eq('workspace_id', workspace_id);
        await supabase.from('leads').delete().eq('workspace_id', workspace_id);
        await supabase.from('campaign_variants').delete().in('campaign_id', campaignIds);
        await supabase.from('sequence_steps').delete().in('campaign_id', campaignIds);
        await supabase.from('campaigns').delete().eq('workspace_id', workspace_id);
      }
      
      await supabase.from('email_accounts').delete().eq('workspace_id', workspace_id);
      
      await supabase.from('api_connections').update({
        sync_status: 'syncing',
        sync_progress: { batch_index: 0, total_campaigns: 0 },
      }).eq('id', connection.id);
      
      console.log('Reset complete');
    }

    // Get sync progress
    let existingProgress = reset ? { batch_index: 0 } : (connection.sync_progress || { batch_index: 0 });
    const resumeFrom = typeof existingProgress.batch_index === 'number' ? existingProgress.batch_index : 0;

    // Update status to syncing
    await supabase.from('api_connections').update({
      sync_status: 'syncing',
    }).eq('id', connection.id);

    const progress = {
      campaigns_synced: 0,
      email_accounts_synced: 0,
      variants_synced: 0,
      metrics_created: 0,
      leads_synced: 0,
      events_created: 0,
      errors: [] as string[],
    };

    try {
      console.log('Fetching campaigns...');
      const campaigns: SmartleadCampaign[] = await smartleadRequest('/campaigns', apiKey);
      console.log(`Found ${campaigns.length} campaigns`);

      const totalCampaigns = campaigns.length;
      const startIndex = resumeFrom * BATCH_SIZE;
      const endIndex = Math.min(startIndex + BATCH_SIZE, campaigns.length);
      const currentBatch = Math.floor(startIndex / BATCH_SIZE);

      console.log(`Processing batch ${currentBatch + 1}/${Math.ceil(totalCampaigns / BATCH_SIZE)} (campaigns ${startIndex + 1}-${endIndex})`);

      await supabase.from('api_connections').update({
        sync_progress: { 
          batch_index: currentBatch, 
          total_campaigns: totalCampaigns,
          step: 'campaigns', 
          progress: Math.round((startIndex / Math.max(1, totalCampaigns)) * 90) + 5 
        },
      }).eq('id', connection.id);

      for (let i = startIndex; i < endIndex; i++) {
        const campaign = campaigns[i];
        console.log(`Processing campaign ${i + 1}/${totalCampaigns}: ${campaign.name}`);

        try {
          // 1. Upsert campaign
          const { data: upsertedCampaign, error: campError } = await supabase
            .from('campaigns')
            .upsert({ 
              workspace_id, 
              platform: 'smartlead', 
              platform_id: String(campaign.id), 
              name: campaign.name, 
              status: campaign.status?.toLowerCase() || 'active',
              updated_at: new Date().toISOString()
            }, { 
              onConflict: 'workspace_id,platform_id,platform' 
            })
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
            const sequences: SmartleadSequence[] = await smartleadRequest(`/campaigns/${campaign.id}/sequences`, apiKey);
            console.log(`Campaign ${campaign.id} has ${sequences?.length || 0} sequences`);
            
            // Log first sequence structure for debugging
            if (sequences?.length > 0) {
              console.log(`  First sequence keys: ${Object.keys(sequences[0]).join(', ')}`);
              console.log(`  First sequence sample:`, JSON.stringify({
                seq_number: sequences[0].seq_number,
                has_sequence_variants: !!sequences[0].sequence_variants,
                sequence_variants_count: sequences[0].sequence_variants?.length || 0,
                has_direct_subject: !!sequences[0].subject,
                has_direct_body: !!sequences[0].email_body,
              }));
            }
            
            for (const seq of sequences) {
              // Use sequence_variants (correct field name from Smartlead API)
              let variants = Array.isArray(seq.sequence_variants) ? seq.sequence_variants : [];
              
              // If no variants array, create one from the sequence's direct subject/body
              // This handles non-A/B tested campaigns where copy is directly on the sequence
              if (variants.length === 0 && (seq.subject || seq.email_body)) {
                console.log(`    Seq ${seq.seq_number}: Creating variant from sequence direct fields`);
                variants = [{
                  id: `seq_${campaign.id}_${seq.seq_number}` as any,
                  variant_label: 'A',
                  subject: seq.subject || '',
                  email_body: seq.email_body || '',
                }];
              }
              
              console.log(`  Seq ${seq.seq_number}: ${variants.length} variant(s)`);
              
              for (const variant of variants) {
                const variantId = variant.id ?? `seq_${campaign.id}_${seq.seq_number}`;
                
                const emailBody = variant.email_body || '';
                const subjectLine = variant.subject || null;
                const wordCount = emailBody.split(/\s+/).filter(Boolean).length;
                const personalizationVars = [...emailBody.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);

                const variantPayload = {
                  campaign_id: campaignDbId,
                  platform_variant_id: String(variantId),
                  name: `Step ${seq.seq_number} - ${variant.variant_label || 'Default'}`,
                  variant_type: variant.variant_label || 'A',
                  subject_line: subjectLine,
                  body_preview: emailBody.substring(0, 500),
                  email_body: emailBody,
                  word_count: wordCount,
                  personalization_vars: personalizationVars,
                  is_control: seq.seq_number === 1 && (variant.variant_label === 'A' || !variant.variant_label),
                };

                console.log(`    Upserting variant ${variantId} (${variant.variant_label || 'Default'}) - subject: ${subjectLine ? 'yes' : 'no'}`);

                const { error: variantError } = await supabase
                  .from('campaign_variants')
                  .upsert(variantPayload, { 
                    onConflict: 'campaign_id,platform_variant_id' 
                  });

                if (variantError) {
                  console.error(`    VARIANT UPSERT FAILED for ${variantId}:`, variantError.message, variantError.details);
                  progress.errors.push(`Variant ${variantId}: ${variantError.message}`);
                } else {
                  console.log(`    Variant ${variantId} upserted successfully`);
                  progress.variants_synced++;
                }
              }

              // Create sequence step - use direct sequence fields
              const { error: stepError } = await supabase
                .from('sequence_steps')
                .upsert({
                  campaign_id: campaignDbId,
                  step_number: seq.seq_number,
                  subject_line: seq.subject || null,
                  body_preview: seq.email_body?.substring(0, 200) || null,
                  delay_days: seq.seq_delay_details?.delay_in_days || 0
                }, { 
                  onConflict: 'campaign_id,step_number' 
                });

              if (stepError) console.error('Step error:', stepError);
            }
          } catch (seqError) {
            console.error(`Failed to fetch sequences for campaign ${campaign.id}:`, seqError);
            progress.errors.push(`Sequences for ${campaign.name}: ${String(seqError)}`);
          }

          // 3. Fetch email accounts
          try {
            const emailAccounts: SmartleadEmailAccount[] = await smartleadRequest(`/campaigns/${campaign.id}/email-accounts`, apiKey);
            
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
                }, { 
                  onConflict: 'workspace_id,platform_id,platform' 
                });
                
              if (!accountError) progress.email_accounts_synced++;
            }
          } catch (emailError) {
            console.error(`Failed to fetch email accounts for campaign ${campaign.id}:`, emailError);
          }

          // 4. Fetch analytics
          try {
            const analytics: SmartleadAnalytics = await smartleadRequest(`/campaigns/${campaign.id}/analytics`, apiKey);
            const today = new Date().toISOString().split('T')[0];

            const metricsPayload = {
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
            };

            // Use manual check and insert/update since partial unique index doesn't work with upsert
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
          } catch (analyticsError) {
            console.error(`Failed to fetch analytics for campaign ${campaign.id}:`, analyticsError);
          }

          // 5. Fetch ALL leads using leads-statistics endpoint (provides richer data with history)
          try {
            let offset = 0;
            const pageSize = 100;
            let hasMore = true;

            while (hasMore) {
              const leadsData = await smartleadRequest(
                `/campaigns/${campaign.id}/leads-statistics?limit=${pageSize}&offset=${offset}`,
                apiKey
              );
              
              // leads-statistics returns { hasMore: boolean, data: [...] }
              const leads = leadsData?.data || [];
              hasMore = leadsData?.hasMore === true;
              
              if (!Array.isArray(leads) || leads.length === 0) {
                console.log(`  No leads returned at offset ${offset}`);
                break;
              }

              console.log(`  Fetched ${leads.length} leads at offset ${offset}`);

              for (const leadStat of leads) {
                // leads-statistics returns: lead_id, from (sender), to (lead email), status, history[]
                const email = leadStat.to?.toLowerCase();
                if (!email) continue;

                // Upsert lead (email_domain and email_type are auto-computed by DB)
                const leadPayload = {
                  workspace_id,
                  campaign_id: campaignDbId,
                  platform: 'smartlead',
                  platform_lead_id: String(leadStat.lead_id || leadStat.email_lead_map_id),
                  email: email,
                  status: leadStat.status?.toLowerCase() || 'active',
                };

                const { data: dbLead, error: leadError } = await supabase
                  .from('leads')
                  .upsert(leadPayload, { 
                    onConflict: 'workspace_id,campaign_id,platform,platform_lead_id' 
                  })
                  .select('id')
                  .single();

                if (leadError) {
                  console.error(`Error upserting lead ${email}:`, leadError);
                  continue;
                }

                progress.leads_synced++;

                // Process history events directly from leads-statistics response (no extra API call needed!)
                const history = leadStat.history || [];
                for (const msg of history) {
                  const msgType = (msg.type || '').toUpperCase();
                  
                  if (['SENT', 'OPEN', 'CLICK', 'REPLY', 'BOUNCE', 'UNSUBSCRIBE'].includes(msgType)) {
                    let eventType = msgType.toLowerCase();
                    let sentiment = 'neutral';
                    
                    if (msgType === 'REPLY') {
                      // Use lead status to determine sentiment
                      const leadStatus = (leadStat.status || '').toLowerCase();
                      if (leadStatus === 'interested' || leadStatus === 'meeting_booked') {
                        sentiment = 'positive';
                        eventType = 'positive_reply';
                      } else if (leadStatus === 'not_interested' || leadStatus === 'wrong_person') {
                        sentiment = 'negative';
                        eventType = 'negative_reply';
                      } else {
                        eventType = 'replied';
                      }
                    }

                    const occurredAt = msg.time ? new Date(msg.time).toISOString() : new Date().toISOString();
                    const platformEventId = msg.stats_id || msg.message_id || `${leadStat.lead_id}-${msgType}-${occurredAt}`;

                    // Check if event exists
                    const { data: existingEvent } = await supabase
                      .from('message_events')
                      .select('id')
                      .eq('workspace_id', workspace_id)
                      .eq('lead_id', dbLead.id)
                      .eq('event_type', eventType)
                      .eq('platform_event_id', platformEventId)
                      .maybeSingle();

                    if (!existingEvent) {
                      const { error: eventError } = await supabase
                        .from('message_events')
                        .insert({
                          workspace_id,
                          campaign_id: campaignDbId,
                          lead_id: dbLead.id,
                          platform: 'smartlead',
                          platform_event_id: platformEventId,
                          event_type: eventType,
                          occurred_at: occurredAt,
                          sent_at: msgType === 'SENT' ? occurredAt : null,
                          lead_email: email,
                          reply_content: msgType === 'REPLY' ? (msg.email_body || null) : null,
                          reply_sentiment: msgType === 'REPLY' ? sentiment : null,
                          sequence_step: parseInt(msg.email_seq_number) || 1,
                        });

                      if (!eventError) {
                        progress.events_created++;

                        // Update hourly metrics for time-of-day analysis
                        if (msgType === 'REPLY') {
                          const replyDate = new Date(occurredAt);
                          const hour = replyDate.getUTCHours();
                          const dayOfWeek = replyDate.getUTCDay();
                          const dateStr = occurredAt.split('T')[0];

                          const { data: existingHourly } = await supabase
                            .from('hourly_metrics')
                            .select('id, replied_count, positive_reply_count')
                            .eq('workspace_id', workspace_id)
                            .eq('campaign_id', campaignDbId)
                            .eq('date', dateStr)
                            .eq('hour', hour)
                            .maybeSingle();

                          if (existingHourly) {
                            await supabase
                              .from('hourly_metrics')
                              .update({
                                replied_count: (existingHourly.replied_count || 0) + 1,
                                positive_reply_count: (existingHourly.positive_reply_count || 0) + (sentiment === 'positive' ? 1 : 0),
                              })
                              .eq('id', existingHourly.id);
                          } else {
                            await supabase
                              .from('hourly_metrics')
                              .insert({
                                workspace_id,
                                campaign_id: campaignDbId,
                                date: dateStr,
                                hour: hour,
                                day_of_week: dayOfWeek,
                                replied_count: 1,
                                positive_reply_count: sentiment === 'positive' ? 1 : 0,
                              });
                          }
                        }
                      }
                    }
                  }
                }
              }

              offset += pageSize;
            }
          } catch (leadsError) {
            console.error(`Failed to fetch leads for campaign ${campaign.id}:`, leadsError);
          }

          // Update progress after each campaign
          await supabase.from('api_connections').update({
            sync_progress: {
              batch_index: currentBatch,
              total_campaigns: totalCampaigns,
              current_campaign: i + 1,
              campaign_name: campaign.name,
              step: 'campaigns',
              progress: Math.round(((i + 1) / Math.max(1, totalCampaigns)) * 90) + 5,
              ...progress,
            },
          }).eq('id', connection.id);
          
        } catch (campaignError) {
          console.error(`Error processing campaign ${campaign.id}:`, campaignError);
          progress.errors.push(`Campaign ${campaign.name}: ${String(campaignError)}`);
        }
      }

      const isComplete = endIndex >= campaigns.length;
      const nextBatchIndex = currentBatch + 1;

      await supabase.from('api_connections').update({
        sync_status: isComplete ? 'success' : 'syncing',
        last_sync_at: isComplete ? new Date().toISOString() : undefined,
        last_full_sync_at: isComplete && sync_type === 'full' ? new Date().toISOString() : undefined,
        sync_progress: {
          batch_index: isComplete ? nextBatchIndex : nextBatchIndex,
          total_campaigns: totalCampaigns,
          step: isComplete ? 'complete' : 'campaigns',
          progress: isComplete ? 100 : Math.round((endIndex / Math.max(1, totalCampaigns)) * 90) + 5,
          completed: isComplete,
          ...progress,
        },
      }).eq('id', connection.id);

      console.log('Batch complete:', { isComplete, processed: endIndex, total: totalCampaigns, ...progress });

      return new Response(JSON.stringify({
        success: true, 
        done: isComplete, 
        next_index: nextBatchIndex, 
        total: totalCampaigns,
        message: isComplete ? 'Sync completed successfully' : 'Batch completed; call again to continue',
        ...progress,
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (syncError) {
      console.error('Sync error:', syncError);
      await supabase.from('api_connections').update({
        sync_status: 'error', 
        sync_progress: { step: 'error', error: String(syncError), ...progress },
      }).eq('id', connection.id);
      throw syncError;
    }
  } catch (error: unknown) {
    console.error('Error in smartlead-sync:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
