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
const TIME_BUDGET_MS = 55000;
const MAX_BATCHES = 100;

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

interface SmartleadLead {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone_number?: string;
  website?: string;
  linkedin_profile?: string;
  custom_fields?: Record<string, any>;
  lead_status?: string;
  email_status?: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function smartleadRequest(endpoint: string, apiKey: string, method = 'GET', body?: any, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    await delay(RATE_LIMIT_DELAY);
    const url = `${SMARTLEAD_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}`;
    console.log(`Fetching (${method}): ${endpoint}`);
    
    try {
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(url, options);
      
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
    /\{\{([^}]+)\}\}/g,
    /\{([^}]+)\}/g,
    /\[\[([^\]]+)\]\]/g,
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

// Strip HTML and return plain text
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract domain from email
function extractDomain(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1]?.toLowerCase();
  // Exclude common personal email domains
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com'];
  if (personalDomains.includes(domain)) return null;
  return domain;
}

// Self-continuation for next batch
async function triggerNextBatch(
  supabaseUrl: string,
  authToken: string,
  clientId: string,
  engagementId: string,
  dataSourceId: string,
  batchNumber: number,
  phase: string
) {
  console.log(`Triggering next batch (${batchNumber}, phase=${phase}) via self-continuation...`);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/smartlead-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken,
      },
      body: JSON.stringify({
        client_id: clientId,
        engagement_id: engagementId,
        data_source_id: dataSourceId,
        reset: false,
        batch_number: batchNumber,
        auto_continue: true,
        current_phase: phase,
      }),
    });
    console.log(`Next batch triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger next batch:', error);
  }
}

// Trigger post-sync analysis
async function triggerAnalysis(
  supabaseUrl: string,
  serviceKey: string,
  engagementId: string
) {
  console.log('Sync complete - triggering analysis functions...');
  
  try {
    await fetch(`${supabaseUrl}/functions/v1/backfill-features`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ engagement_id: engagementId }),
    });
    console.log('backfill-features triggered');
  } catch (e) {
    console.error('Failed to trigger backfill-features:', e);
  }
  
  try {
    await fetch(`${supabaseUrl}/functions/v1/compute-patterns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ engagement_id: engagementId }),
    });
    console.log('compute-patterns triggered');
  } catch (e) {
    console.error('Failed to trigger compute-patterns:', e);
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

    // Verify user authentication
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl, anonKey,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) throw new Error('Unauthorized');

    const { 
      client_id,
      engagement_id,
      data_source_id,
      reset = false, 
      batch_number = 1, 
      auto_continue = true,
      current_phase = 'campaigns',
      sync_leads = true, // Enable leads sync by default
      sync_email_activities = false, // DISABLED: SmartLead API doesn't support /email-sent endpoint
    } = await req.json();
    
    if (!client_id) throw new Error('client_id is required');
    if (!data_source_id) throw new Error('data_source_id is required');

    // Safety check for max batches
    if (batch_number > MAX_BATCHES) {
      console.error(`Max batch limit (${MAX_BATCHES}) reached. Stopping sync.`);
      await supabase.from('data_sources').update({
        last_sync_status: 'error',
        last_sync_error: `Sync stopped after ${MAX_BATCHES} batches. Some data may be missing.`,
        updated_at: new Date().toISOString(),
      }).eq('id', data_source_id);
      
      return new Response(JSON.stringify({ 
        error: 'Max batch limit reached',
        batch_number,
        message: 'Sync stopped after too many batches.'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Starting batch ${batch_number}, phase=${current_phase}, auto_continue=${auto_continue}`);

    // Verify user has access to this client
    const { data: membership } = await supabase
      .from('client_members').select('role')
      .eq('client_id', client_id).eq('user_id', user.id).single();
    if (!membership) throw new Error('Access denied to client');

    // Get data source (with API key)
    const { data: dataSource, error: dsError } = await supabase
      .from('data_sources').select('id, api_key_encrypted, additional_config, last_sync_status')
      .eq('id', data_source_id).eq('source_type', 'smartlead').single();
    if (dsError || !dataSource) throw new Error('No Smartlead data source found');

    const apiKey = dataSource.api_key_encrypted;
    if (!apiKey) throw new Error('No API key configured for Smartlead');

    // Get or create engagement for this sync
    let activeEngagementId = engagement_id;
    if (!activeEngagementId) {
      const { data: existingEngagement } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', client_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (existingEngagement) {
        activeEngagementId = existingEngagement.id;
      } else {
        const { data: newEngagement, error: engError } = await supabase
          .from('engagements')
          .insert({
            client_id,
            name: 'Default Engagement',
            status: 'active',
          })
          .select('id')
          .single();
        
        if (engError) throw new Error(`Failed to create engagement: ${engError.message}`);
        activeEngagementId = newEngagement.id;
      }
    }

    // Update data source status
    await supabase.from('data_sources').update({ 
      last_sync_status: 'syncing',
      updated_at: new Date().toISOString(),
    }).eq('id', data_source_id);

    const progress = {
      campaigns_synced: 0,
      variants_synced: 0,
      metrics_created: 0,
      leads_synced: 0,
      companies_synced: 0,
      email_activities_synced: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;

    const existingConfig = (dataSource.additional_config as any) || {};

    // Reset if requested
    if (reset) {
      console.log('Resetting synced data for engagement:', activeEngagementId);
      
      const { data: existingCampaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('engagement_id', activeEngagementId)
        .eq('data_source_id', data_source_id);
      
      const campaignIds = existingCampaigns?.map(c => c.id) || [];
      
      if (campaignIds.length > 0) {
        await supabase.from('daily_metrics').delete().in('campaign_id', campaignIds);
        await supabase.from('campaign_variants').delete().in('campaign_id', campaignIds);
        await supabase.from('email_activities').delete().in('campaign_id', campaignIds);
        await supabase.from('campaigns').delete().in('id', campaignIds);
      }
      
      // Also reset contacts/companies for this engagement (optional, be careful)
      // await supabase.from('contacts').delete().eq('engagement_id', activeEngagementId);
      // await supabase.from('companies').delete().eq('engagement_id', activeEngagementId);
      
      console.log('Reset complete');
    }

    // ============================================
    // PHASE 1: Fetch All Campaigns
    // ============================================
    if (current_phase === 'campaigns') {
      console.log('=== PHASE 1: Fetching all campaigns ===');
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

      let startIndex = reset ? 0 : (existingConfig.campaign_index || 0);

      // Process each campaign
      for (let i = startIndex; i < campaigns.length; i++) {
        if (isTimeBudgetExceeded()) {
          console.log(`Time budget exceeded at campaign ${i}/${campaigns.length}. Triggering continuation...`);
          
          await supabase.from('data_sources').update({
            additional_config: { 
              ...existingConfig,
              campaign_index: i, 
              total_campaigns: campaigns.length,
              batch_number,
            },
            last_sync_status: 'partial',
            updated_at: new Date().toISOString(),
          }).eq('id', data_source_id);

          if (auto_continue) {
            EdgeRuntime.waitUntil(
              triggerNextBatch(supabaseUrl, authHeader, client_id, activeEngagementId, data_source_id, batch_number + 1, 'campaigns')
            );
          }

          return new Response(JSON.stringify({
            success: true,
            complete: false,
            progress,
            current: i,
            total: campaigns.length,
            phase: 'campaigns',
            batch_number,
            message: `Processed ${i}/${campaigns.length} campaigns. Auto-continuing...`,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const campaign = campaigns[i];
        console.log(`[${i + 1}/${campaigns.length}] Processing: ${campaign.name} (${campaign.status})`);

        try {
          // Upsert campaign to unified campaigns table
          const { data: upsertedCampaign, error: campError } = await supabase
            .from('campaigns')
            .upsert({
              engagement_id: activeEngagementId,
              data_source_id: data_source_id,
              external_id: String(campaign.id),
              name: campaign.name,
              campaign_type: 'email',
              status: campaign.status?.toLowerCase() || 'unknown',
              started_at: campaign.created_at ? new Date(campaign.created_at).toISOString() : null,
              last_synced_at: new Date().toISOString(),
            }, { onConflict: 'engagement_id,data_source_id,external_id' })
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

            const totalSent = analytics.sent_count || 0;
            const totalOpened = analytics.unique_open_count || 0;
            const totalClicked = analytics.unique_click_count || 0;
            const totalReplied = analytics.reply_count || 0;
            const totalBounced = analytics.bounce_count || 0;
            
            console.log(`  Analytics: sent=${totalSent}, opens=${totalOpened}, replies=${totalReplied}`);

            // Update campaign with totals
            await supabase.from('campaigns').update({
              total_sent: totalSent,
              total_opened: totalOpened,
              total_replied: totalReplied,
              total_bounced: totalBounced,
              reply_rate: totalSent > 0 ? (totalReplied / totalSent) * 100 : null,
              open_rate: totalSent > 0 ? (totalOpened / totalSent) * 100 : null,
              bounce_rate: totalSent > 0 ? (totalBounced / totalSent) * 100 : null,
            }).eq('id', campaignDbId);

            // Store daily metrics
            if (totalSent > 0 || totalOpened > 0 || totalReplied > 0) {
              const metricDate = campaign.created_at 
                ? new Date(campaign.created_at).toISOString().split('T')[0]
                : today;

              await supabase.from('daily_metrics').upsert({
                engagement_id: activeEngagementId,
                campaign_id: campaignDbId,
                data_source_id: data_source_id,
                date: metricDate,
                emails_sent: totalSent,
                emails_opened: totalOpened,
                emails_clicked: totalClicked,
                emails_replied: totalReplied,
                emails_bounced: totalBounced,
              }, { onConflict: 'engagement_id,campaign_id,date' });
              progress.metrics_created++;
            }
          } catch (e) {
            console.error(`  Analytics error for ${campaign.name}:`, e);
            progress.errors.push(`Analytics ${campaign.name}: ${(e as Error).message}`);
          }

          // Fetch sequences/variants
          try {
            const sequencesRaw = await smartleadRequest(`/campaigns/${campaign.id}/sequences`, apiKey);
            
            let sequences: SmartleadSequence[] = [];
            if (Array.isArray(sequencesRaw)) {
              sequences = sequencesRaw;
            } else if (sequencesRaw?.data && Array.isArray(sequencesRaw.data)) {
              sequences = sequencesRaw.data;
            } else if (sequencesRaw?.sequences && Array.isArray(sequencesRaw.sequences)) {
              sequences = sequencesRaw.sequences;
            }
            
            if (sequences.length > 0) {
              console.log(`  Found ${sequences.length} sequences for campaign`);
              
              for (let seqIdx = 0; seqIdx < sequences.length; seqIdx++) {
                const seq = sequences[seqIdx];
                
                const mainSubject = seq.subject || (seq as any).email_subject || '';
                const mainBody = seq.email_body || (seq as any).body || '';
                
                if (!mainSubject && !mainBody) continue;
                
                const mainVars = extractPersonalizationVars(mainSubject + ' ' + mainBody);
                const bodyPlain = stripHtml(mainBody);
                const seqId = seq.seq_id || (seq as any).id || seqIdx;
                const seqNumber = seq.seq_number || (seq as any).step_number || (seqIdx + 1);
                
                const { error: variantError } = await supabase.from('campaign_variants')
                  .upsert({
                    campaign_id: campaignDbId,
                    data_source_id: data_source_id,
                    external_id: `seq-${seqId}`,
                    subject_line: mainSubject,
                    body_html: mainBody,
                    body_plain: bodyPlain,
                    body_preview: bodyPlain.substring(0, 200),
                    personalization_vars: mainVars,
                    step_number: seqNumber,
                    is_control: seqIdx === 0,
                  }, { onConflict: 'campaign_id,external_id' });
                
                if (variantError) {
                  console.error(`  Failed to upsert variant for step ${seqNumber}:`, variantError.message);
                } else {
                  progress.variants_synced++;
                }

                // Store A/B variants if they exist
                if (seq.sequence_variants && seq.sequence_variants.length > 0) {
                  for (const variant of seq.sequence_variants) {
                    const varSubject = variant.subject || mainSubject;
                    const varBody = variant.email_body || mainBody;
                    const varBodyPlain = stripHtml(varBody);
                    const varVars = extractPersonalizationVars(varSubject + ' ' + varBody);
                    
                    const { error: abError } = await supabase.from('campaign_variants').upsert({
                      campaign_id: campaignDbId,
                      data_source_id: data_source_id,
                      external_id: `var-${variant.variant_id}`,
                      subject_line: varSubject,
                      body_html: varBody,
                      body_plain: varBodyPlain,
                      body_preview: varBodyPlain.substring(0, 200),
                      personalization_vars: varVars,
                      step_number: seqNumber,
                      is_control: false,
                    }, { onConflict: 'campaign_id,external_id' });
                    
                    if (!abError) progress.variants_synced++;
                  }
                }
              }
            }
          } catch (e) {
            console.error(`  Sequences error for ${campaign.name}:`, e);
            progress.errors.push(`Sequences ${campaign.name}: ${(e as Error).message}`);
          }

          // ============================================
          // NEW: Fetch Leads for this campaign
          // ============================================
          if (sync_leads) {
            try {
              let offset = 0;
              const limit = 100;
              let hasMoreLeads = true;
              
              while (hasMoreLeads && !isTimeBudgetExceeded()) {
                const leadsUrl = `/campaigns/${campaign.id}/leads?offset=${offset}&limit=${limit}`;
                const leadsResponse = await smartleadRequest(leadsUrl, apiKey);
                
                const leads: SmartleadLead[] = Array.isArray(leadsResponse) 
                  ? leadsResponse 
                  : (leadsResponse?.leads || leadsResponse?.data || []);
                
                if (leads.length === 0) {
                  hasMoreLeads = false;
                  break;
                }
                
                console.log(`  Fetched ${leads.length} leads (offset ${offset})`);
                
                // Process leads in batch
                for (const lead of leads) {
                  try {
                    // First, create/upsert company if we have company info
                    let companyId: string | null = null;
                    const domain = extractDomain(lead.email);
                    
                    if (lead.company_name || domain) {
                      const { data: companyData, error: companyError } = await supabase
                        .from('companies')
                        .upsert({
                          engagement_id: activeEngagementId,
                          name: lead.company_name || domain || 'Unknown',
                          domain: domain,
                          website: lead.website || (domain ? `https://${domain}` : null),
                          source: 'smartlead',
                        }, { onConflict: 'engagement_id,domain', ignoreDuplicates: false })
                        .select('id')
                        .single();
                      
                      if (!companyError && companyData) {
                        companyId = companyData.id;
                        progress.companies_synced++;
                      }
                    }
                    
                    // Create placeholder company if needed
                    if (!companyId) {
                      const { data: placeholderCompany } = await supabase
                        .from('companies')
                        .upsert({
                          engagement_id: activeEngagementId,
                          name: 'Unknown Company',
                          source: 'smartlead',
                        }, { onConflict: 'engagement_id,name', ignoreDuplicates: true })
                        .select('id')
                        .single();
                      companyId = placeholderCompany?.id;
                    }
                    
                    if (!companyId) continue;
                    
                    // Upsert contact
                    const { error: contactError } = await supabase
                      .from('contacts')
                      .upsert({
                        engagement_id: activeEngagementId,
                        company_id: companyId,
                        email: lead.email,
                        first_name: lead.first_name || null,
                        last_name: lead.last_name || null,
                        phone: lead.phone_number || null,
                        linkedin_url: lead.linkedin_profile || null,
                        title: lead.custom_fields?.title || lead.custom_fields?.job_title || null,
                        email_status: lead.email_status || null,
                        source: 'smartlead',
                      }, { onConflict: 'engagement_id,email' });
                    
                    if (!contactError) {
                      progress.leads_synced++;
                    }
                  } catch (leadError) {
                    // Silently continue on individual lead errors
                    console.error(`  Error processing lead ${lead.email}:`, leadError);
                  }
                }
                
                offset += leads.length;
                if (leads.length < limit) hasMoreLeads = false;
              }
            } catch (e) {
              console.error(`  Leads error for ${campaign.name}:`, e);
              progress.errors.push(`Leads ${campaign.name}: ${(e as Error).message}`);
            }
          }

          // ============================================
          // NOTE: Email Activities sync is DISABLED by default
          // SmartLead API does not support /campaigns/{id}/email-sent endpoint
          // Email activity data is derived from campaign analytics instead
          // ============================================
          if (sync_email_activities) {
            // This is disabled by default - the API returns 404 for email-sent endpoint
            console.log(`  Skipping email activities (API not supported)`);
          }

        } catch (e) {
          console.error(`Error processing campaign ${campaign.name}:`, e);
          progress.errors.push(`${campaign.name}: ${(e as Error).message}`);
        }
      }

      // Campaigns phase complete, move to completion
      console.log('=== Campaigns phase complete ===');
    }

    // ============================================
    // PHASE 2: Sync Complete
    // ============================================
    await supabase.from('data_sources').update({
      last_sync_status: 'success',
      last_sync_at: new Date().toISOString(),
      last_sync_records_processed: progress.campaigns_synced,
      additional_config: {
        ...existingConfig,
        campaign_index: 0,
        completed_at: new Date().toISOString(),
        campaigns_synced: progress.campaigns_synced,
        variants_synced: progress.variants_synced,
        leads_synced: progress.leads_synced,
        companies_synced: progress.companies_synced,
        email_activities_synced: progress.email_activities_synced,
      },
    }).eq('id', data_source_id);

    // Trigger analysis functions
    EdgeRuntime.waitUntil(triggerAnalysis(supabaseUrl, supabaseServiceKey, activeEngagementId));

    console.log('SmartLead sync complete:', progress);

    return new Response(JSON.stringify({
      success: true,
      complete: true,
      progress,
      message: `Synced ${progress.campaigns_synced} campaigns, ${progress.variants_synced} variants, ${progress.leads_synced} contacts, ${progress.companies_synced} companies, ${progress.email_activities_synced} email activities`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('smartlead-sync error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
