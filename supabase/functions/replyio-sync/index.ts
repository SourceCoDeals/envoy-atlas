import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Declare EdgeRuntime global for Supabase Edge Functions
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REPLYIO_V1_URL = 'https://api.reply.io/v1';
const REPLYIO_V3_URL = 'https://api.reply.io/v3';

// Reply.io Rate Limit: 10 seconds between API calls (strict!), 15,000 requests/month
const RATE_LIMIT_DELAY_LIST = 3000;
const RATE_LIMIT_DELAY_STATS = 10500;
const TIME_BUDGET_MS = 50000;
const MAX_BATCHES = 250;

function mapSequenceStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'Active': 'active',
    'Paused': 'paused',
    'Stopped': 'stopped',
    'Draft': 'draft',
    'Archived': 'archived',
    'New': 'draft',
  };
  return statusMap[status] || status?.toLowerCase() || 'unknown';
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

// Extract domain from email
function extractDomain(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1]?.toLowerCase();
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com'];
  if (personalDomains.includes(domain)) return null;
  return domain;
}

async function replyioRequest(
  endpoint: string, 
  apiKey: string, 
  options: { retries?: number; allow404?: boolean; delayMs?: number; useV1?: boolean; method?: string; body?: any } = {}
): Promise<any> {
  const { retries = 3, allow404 = false, delayMs = RATE_LIMIT_DELAY_LIST, useV1 = false, method = 'GET', body } = options;
  const baseUrl = useV1 ? REPLYIO_V1_URL : REPLYIO_V3_URL;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await delay(delayMs);
      const url = `${baseUrl}${endpoint}`;
      console.log(`Fetching: ${url}`);
      
      const fetchOptions: RequestInit = {
        method,
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      };
      if (body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(body);
      }
      
      const response = await fetch(url, fetchOptions);
      
      if (response.status === 429) {
        console.log(`Rate limited, waiting ${(attempt + 1) * 10} seconds...`);
        await delay(10000 * (attempt + 1));
        continue;
      }
      
      if (response.status === 404 && allow404) {
        console.log(`  404 - no data available for ${endpoint}`);
        return null;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Reply.io API error ${response.status}: ${errorText}`);
      }
      
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      console.log(`Retry ${attempt + 1}/${retries}:`, error);
      await delay(2000 * (attempt + 1));
    }
  }
}

async function triggerNextBatch(
  supabaseUrl: string,
  serviceKey: string,
  clientId: string,
  engagementId: string,
  dataSourceId: string,
  batchNumber: number,
  phase: string
) {
  console.log(`Triggering next Reply.io batch (${batchNumber}, phase=${phase}) via self-continuation...`);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/replyio-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        client_id: clientId,
        engagement_id: engagementId,
        data_source_id: dataSourceId,
        reset: false,
        batch_number: batchNumber,
        auto_continue: true,
        internal_continuation: true,
        current_phase: phase,
      }),
    });
    console.log(`Next batch triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger next batch:', error);
  }
}

async function triggerAnalysis(
  supabaseUrl: string,
  serviceKey: string,
  engagementId: string
) {
  console.log('Sync complete - triggering analysis functions...');
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/backfill-features`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ engagement_id: engagementId }),
    });
    console.log(`backfill-features triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger backfill-features:', error);
  }
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/compute-patterns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ engagement_id: engagementId }),
    });
    console.log(`compute-patterns triggered, status: ${response.status}`);
  } catch (error) {
    console.error('Failed to trigger compute-patterns:', error);
  }
}

Deno.serve(async (req) => {
  console.log('replyio-sync: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { 
      client_id,
      engagement_id,
      data_source_id,
      reset = false, 
      batch_number = 1, 
      auto_continue = false,
      internal_continuation = false,
      current_phase = 'sequences',
      sync_people = false, // DISABLED: Reply.io rate limits are too strict (10s/call)
      sync_email_activities = false, // DISABLED: Reply.io rate limits are too strict
    } = body;

    // Auth check for initial requests (skip for internal continuations)
    const authHeader = req.headers.get('Authorization');
    
    if (!internal_continuation) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing authorization header' }), 
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: { user } } = await createClient(
        supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      ).auth.getUser();
      
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), 
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
      console.log(`Internal continuation batch ${batch_number} - using service role auth`);
    }
    
    if (!client_id || !engagement_id || !data_source_id) {
      return new Response(JSON.stringify({ error: 'Missing client_id, engagement_id, or data_source_id' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (batch_number > MAX_BATCHES) {
      console.error(`Max batch limit (${MAX_BATCHES}) reached. Stopping sync.`);
      
      await supabase.from('data_sources').update({
        last_sync_status: 'error',
        last_sync_error: `Sync stopped after ${MAX_BATCHES} batches`,
        updated_at: new Date().toISOString(),
      }).eq('id', data_source_id);
      
      return new Response(JSON.stringify({ 
        error: 'Max batch limit reached',
        batch_number,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Starting batch ${batch_number}, phase=${current_phase}, engagement=${engagement_id}`);

    // Get data source with API key
    const { data: dataSource, error: dsError } = await supabase
      .from('data_sources')
      .select('*')
      .eq('id', data_source_id)
      .eq('source_type', 'replyio')
      .single();
    
    if (dsError || !dataSource) {
      return new Response(JSON.stringify({ error: 'No Reply.io data source found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = dataSource.api_key_encrypted;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key configured' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const existingConfig = (dataSource.additional_config as any) || {};

    // Handle reset
    if (reset) {
      console.log('Resetting Reply.io sync data for engagement:', engagement_id);
      
      await supabase.from('daily_metrics').delete().eq('data_source_id', data_source_id);
      await supabase.from('campaign_variants').delete().eq('data_source_id', data_source_id);
      await supabase.from('sequences').delete().eq('data_source_id', data_source_id);
      await supabase.from('email_activities').delete().eq('data_source_id', data_source_id);
      await supabase.from('campaigns').delete().eq('data_source_id', data_source_id);
      
      console.log('Reset complete');
    }

    // Update sync status
    await supabase.from('data_sources').update({ 
      last_sync_status: 'syncing',
      updated_at: new Date().toISOString(),
    }).eq('id', data_source_id);

    const progress = {
      sequences_synced: 0,
      metrics_created: 0,
      variants_synced: 0,
      people_synced: 0,
      companies_synced: 0,
      email_activities_synced: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;

    // ============================================
    // PHASE 1: Sync Sequences/Campaigns
    // ============================================
    if (current_phase === 'sequences') {
      // Use cached sequence list if available and not reset
      let allSequences: any[] = existingConfig.cached_sequences || [];
      
      if (allSequences.length === 0 || reset) {
        console.log('Fetching all sequences...');
        allSequences = [];
        let skip = 0;
        
        while (!isTimeBudgetExceeded()) {
          const response = await replyioRequest(
            `/sequences?top=100&skip=${skip}`, 
            apiKey, 
            { delayMs: RATE_LIMIT_DELAY_LIST }
          );
          const sequences = Array.isArray(response) ? response : (response?.sequences || response?.items || []);
          
          if (sequences.length === 0) break;
          
          allSequences = allSequences.concat(sequences);
          skip += sequences.length;
          console.log(`Fetched ${allSequences.length} sequences so far...`);
          
          if (sequences.length < 100) break;
        }
        
        console.log(`Found ${allSequences.length} total sequences`);
        
        // Cache sequences in data source config
        await supabase.from('data_sources').update({
          additional_config: { 
            ...existingConfig,
            cached_sequences: allSequences.map((s: any) => ({ id: s.id, name: s.name, status: s.status })),
            sequence_index: 0,
            total_sequences: allSequences.length,
            batch_number: batch_number,
          },
        }).eq('id', data_source_id);
      } else {
        console.log(`Using cached sequence list: ${allSequences.length} sequences`);
      }

      let startIndex = reset ? 0 : (existingConfig.sequence_index || 0);

      for (let i = startIndex; i < allSequences.length; i++) {
        // Heartbeat every 5 sequences
        if (i > 0 && i % 5 === 0) {
          await supabase.from('data_sources').update({
            additional_config: { 
              ...existingConfig,
              cached_sequences: allSequences,
              sequence_index: i, 
              total_sequences: allSequences.length,
              batch_number: batch_number,
              heartbeat: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          }).eq('id', data_source_id);
        }
        
        if (isTimeBudgetExceeded()) {
          console.log(`Time budget exceeded at sequence ${i}/${allSequences.length}. Triggering continuation...`);
          
          await supabase.from('data_sources').update({
            additional_config: { 
              ...existingConfig,
              cached_sequences: allSequences,
              sequence_index: i, 
              total_sequences: allSequences.length,
              batch_number: batch_number,
            },
            last_sync_status: 'partial',
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', data_source_id);

          const shouldContinue = auto_continue || batch_number === 1;
          if (shouldContinue) {
            EdgeRuntime.waitUntil(
              triggerNextBatch(supabaseUrl, supabaseServiceKey, client_id, engagement_id, data_source_id, batch_number + 1, 'sequences')
            );
          }

          return new Response(JSON.stringify({
            success: true,
            complete: false,
            progress,
            current: i,
            total: allSequences.length,
            phase: 'sequences',
            batch_number,
            message: `Processed ${i}/${allSequences.length} sequences. ${shouldContinue ? 'Auto-continuing...' : 'Run again to continue.'}`,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const sequence = allSequences[i];
        console.log(`[${i + 1}/${allSequences.length}] Processing: ${sequence.name} (${sequence.status})`);

        try {
          // 1. Upsert campaign (using unified 'campaigns' table)
          const { data: campaign, error: campError } = await supabase
            .from('campaigns')
            .upsert({
              engagement_id,
              data_source_id,
              external_id: String(sequence.id),
              name: sequence.name,
              status: mapSequenceStatus(sequence.status),
              campaign_type: 'email',
            }, { onConflict: 'engagement_id,data_source_id,external_id' })
            .select('id')
            .single();

          if (campError) {
            console.error(`Failed to upsert campaign ${sequence.name}:`, campError.message);
            progress.errors.push(`Campaign ${sequence.name}: ${campError.message}`);
            continue;
          }

          const campaignId = campaign.id;
          progress.sequences_synced++;

          // 2. Upsert sequence details
          await supabase.from('sequences').upsert({
            campaign_id: campaignId,
            data_source_id,
            external_id: String(sequence.id),
            name: sequence.name,
            status: mapSequenceStatus(sequence.status),
            step_count: sequence.stepsCount || sequence.steps?.length || 0,
          }, { onConflict: 'campaign_id,external_id' });

          // 3. Fetch and store variants (email templates)
          const extractSteps = (resp: any): any[] => {
            if (!resp) return [];
            if (Array.isArray(resp)) return resp;
            if (Array.isArray(resp.steps)) return resp.steps;
            if (Array.isArray(resp.emails)) return resp.emails;
            if (Array.isArray(resp.items)) return resp.items;
            if (resp.sequence?.emails) return resp.sequence.emails;
            return [];
          };

          const upsertVariants = async (steps: any[], source: string) => {
            console.log(`  ${source} Found ${steps.length} step(s)`);
            
            for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
              const step = steps[stepIdx];
              
              const stepType = (step.type || step.stepType || '').toLowerCase();
              if (stepType && !['email', 'e-mail', 'manual_email', ''].includes(stepType)) {
                continue;
              }
              
              let templates: any[] = [];
              if (step.templates?.length > 0) {
                templates = step.templates;
              } else if (step.emails?.length > 0) {
                templates = step.emails;
              } else if (step.subject || step.body) {
                templates = [step];
              } else {
                continue;
              }
              
              for (let tplIdx = 0; tplIdx < templates.length; tplIdx++) {
                const tpl = templates[tplIdx];
                if (!tpl) continue;
                
                const subject = tpl.subject || tpl.emailSubject || tpl.title || '';
                const bodyContent = tpl.body || tpl.emailBody || tpl.text || tpl.content || '';
                
                if (!subject && !bodyContent) continue;

                const vars = extractPersonalizationVars(`${subject} ${bodyContent}`);
                const templateId = tpl.id || tpl.templateId;
                const externalId = templateId ? `tpl-${templateId}` : `step-${stepIdx + 1}-tpl-${tplIdx + 1}`;

                const { error: varErr } = await supabase
                  .from('campaign_variants')
                  .upsert({
                    campaign_id: campaignId,
                    data_source_id,
                    external_id: externalId,
                    subject_line: String(subject).substring(0, 500),
                    body_preview: String(bodyContent).substring(0, 500),
                    body_plain: String(bodyContent),
                    step_number: stepIdx + 1,
                    is_control: tplIdx === 0,
                    personalization_vars: vars,
                  }, { onConflict: 'campaign_id,external_id' });

                if (!varErr) {
                  progress.variants_synced++;
                }
              }
            }
          };

          // Try v3 API first
          try {
            const resp = await replyioRequest(
              `/sequences/${sequence.id}/steps`,
              apiKey,
              { retries: 1, allow404: true, delayMs: RATE_LIMIT_DELAY_LIST }
            );
            const steps = extractSteps(resp);
            if (steps.length) {
              await upsertVariants(steps, 'v3');
            }
          } catch (e) {
            console.log(`  v3 steps failed:`, (e as Error).message);
          }

          // 4. Fetch metrics using v1 API (lifetime totals)
          try {
            const seqDetailsRaw = await replyioRequest(
              `/campaigns?id=${sequence.id}`,
              apiKey,
              { retries: 2, allow404: true, delayMs: RATE_LIMIT_DELAY_STATS, useV1: true }
            );
            
            const seqDetails = Array.isArray(seqDetailsRaw) ? seqDetailsRaw[0] : seqDetailsRaw;
            
            if (seqDetails) {
              const today = new Date().toISOString().split('T')[0];
              const stats = seqDetails.stats || seqDetails.statistics || {};
              
              const totalSent = Number(
                seqDetails.deliveriesCount ?? stats.deliveriesCount ??
                stats.peopleContacted ?? stats.sent ?? 0
              );
              const totalOpened = Number(seqDetails.opensCount ?? stats.opensCount ?? stats.opened ?? 0);
              const totalClicked = Number(seqDetails.clicksCount ?? stats.clicksCount ?? stats.clicked ?? 0);
              const totalReplied = Number(seqDetails.repliesCount ?? stats.repliesCount ?? stats.replied ?? 0);
              const totalBounced = Number(seqDetails.bouncesCount ?? stats.bouncesCount ?? stats.bounced ?? 0);
              const totalPositive = Number(stats.interestedContacts ?? stats.interested ?? 0);
              
              console.log(`  Metrics: sent=${totalSent}, opens=${totalOpened}, replies=${totalReplied}`);
              
              // Update campaign totals
              await supabase.from('campaigns').update({
                total_sent: totalSent,
                total_opened: totalOpened,
                total_replied: totalReplied,
                total_bounced: totalBounced,
                total_meetings: totalPositive,
                open_rate: totalSent > 0 ? (totalOpened / totalSent) * 100 : null,
                reply_rate: totalSent > 0 ? (totalReplied / totalSent) * 100 : null,
                bounce_rate: totalSent > 0 ? (totalBounced / totalSent) * 100 : null,
                last_synced_at: new Date().toISOString(),
              }).eq('id', campaignId);
              
              // Store daily metrics
              if (totalSent > 0 || totalReplied > 0) {
                const { error: metricsErr } = await supabase.from('daily_metrics').upsert({
                  engagement_id,
                  campaign_id: campaignId,
                  data_source_id,
                  date: today,
                  emails_sent: totalSent,
                  emails_opened: totalOpened,
                  emails_clicked: totalClicked,
                  emails_replied: totalReplied,
                  emails_bounced: totalBounced,
                  positive_replies: totalPositive,
                  open_rate: totalSent > 0 ? (totalOpened / totalSent) * 100 : null,
                  reply_rate: totalSent > 0 ? (totalReplied / totalSent) * 100 : null,
                  bounce_rate: totalSent > 0 ? (totalBounced / totalSent) * 100 : null,
                }, { onConflict: 'engagement_id,campaign_id,date' });

                if (!metricsErr) {
                  progress.metrics_created++;
                }
              }
            }
          } catch (e) {
            console.error(`  v1 API error:`, (e as Error).message);
          }

          // ============================================
          // NEW: Fetch People for this sequence
          // ============================================
          if (sync_people) {
            try {
              let offset = 0;
              const limit = 100;
              let hasMorePeople = true;
              
              while (hasMorePeople && !isTimeBudgetExceeded()) {
                const peopleUrl = `/sequences/${sequence.id}/people?top=${limit}&skip=${offset}`;
                const peopleResponse = await replyioRequest(peopleUrl, apiKey, { 
                  delayMs: RATE_LIMIT_DELAY_LIST,
                  allow404: true 
                });
                
                const people = Array.isArray(peopleResponse) 
                  ? peopleResponse 
                  : (peopleResponse?.people || peopleResponse?.items || []);
                
                if (!people || people.length === 0) {
                  hasMorePeople = false;
                  break;
                }
                
                console.log(`  Fetched ${people.length} people (offset ${offset})`);
                
                for (const person of people) {
                  try {
                    // Create/upsert company
                    let companyId: string | null = null;
                    const domain = extractDomain(person.email);
                    
                    if (person.company || domain) {
                      const { data: companyData, error: companyError } = await supabase
                        .from('companies')
                        .upsert({
                          engagement_id,
                          name: person.company || domain || 'Unknown',
                          domain: domain,
                          website: domain ? `https://${domain}` : null,
                          source: 'replyio',
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
                          engagement_id,
                          name: 'Unknown Company',
                          source: 'replyio',
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
                        engagement_id,
                        company_id: companyId,
                        email: person.email,
                        first_name: person.firstName || person.first_name || null,
                        last_name: person.lastName || person.last_name || null,
                        phone: person.phone || person.phoneNumber || null,
                        linkedin_url: person.linkedInUrl || person.linkedin || null,
                        title: person.title || person.jobTitle || person.job_title || null,
                        source: 'replyio',
                      }, { onConflict: 'engagement_id,email' });
                    
                    if (!contactError) {
                      progress.people_synced++;
                    }
                  } catch (personError) {
                    console.error(`  Error processing person ${person.email}:`, personError);
                  }
                }
                
                offset += people.length;
                if (people.length < limit) hasMorePeople = false;
              }
            } catch (e) {
              console.log(`  People fetch not available for ${sequence.name}:`, (e as Error).message);
            }
          }

          // ============================================
          // NEW: Fetch Email Activities for this sequence
          // ============================================
          if (sync_email_activities) {
            try {
              // Fetch email events for this sequence
              const eventsUrl = `/sequences/${sequence.id}/emailEvents`;
              const eventsResponse = await replyioRequest(eventsUrl, apiKey, { 
                delayMs: RATE_LIMIT_DELAY_LIST,
                allow404: true 
              });
              
              const events = Array.isArray(eventsResponse)
                ? eventsResponse
                : (eventsResponse?.events || eventsResponse?.items || []);
              
              if (events && events.length > 0) {
                console.log(`  Found ${events.length} email events`);
                
                for (const event of events) {
                  try {
                    const email = event.email || event.to || event.personEmail;
                    if (!email) continue;
                    
                    // Get contact for this email
                    const { data: contact } = await supabase
                      .from('contacts')
                      .select('id, company_id')
                      .eq('engagement_id', engagement_id)
                      .eq('email', email)
                      .single();
                    
                    if (!contact) continue;
                    
                    const { error: activityError } = await supabase
                      .from('email_activities')
                      .upsert({
                        engagement_id,
                        campaign_id: campaignId,
                        data_source_id,
                        contact_id: contact.id,
                        company_id: contact.company_id,
                        external_id: event.id ? String(event.id) : null,
                        to_email: email,
                        subject: event.subject || null,
                        sent: event.sent ?? event.eventType === 'sent',
                        sent_at: event.sentAt || event.sent_at ? new Date(event.sentAt || event.sent_at).toISOString() : null,
                        delivered: event.delivered ?? null,
                        opened: event.opened ?? event.eventType === 'opened',
                        first_opened_at: event.openedAt || event.opened_at ? new Date(event.openedAt || event.opened_at).toISOString() : null,
                        clicked: event.clicked ?? event.eventType === 'clicked',
                        replied: event.replied ?? event.eventType === 'replied',
                        replied_at: event.repliedAt || event.replied_at ? new Date(event.repliedAt || event.replied_at).toISOString() : null,
                        reply_text: event.replyText || event.reply || null,
                        reply_sentiment: event.sentiment || null,
                        bounced: event.bounced ?? event.eventType === 'bounced',
                        bounced_at: event.bouncedAt || event.bounced_at ? new Date(event.bouncedAt || event.bounced_at).toISOString() : null,
                        unsubscribed: event.unsubscribed ?? event.eventType === 'unsubscribed',
                        step_number: event.stepNumber || event.step_number || null,
                      }, { onConflict: 'engagement_id,campaign_id,contact_id,step_number' });
                    
                    if (!activityError) {
                      progress.email_activities_synced++;
                    }
                  } catch (e) {
                    // Continue on individual event errors
                  }
                }
              }
            } catch (e) {
              console.log(`  Email events not available for ${sequence.name}`);
            }
          }

        } catch (e) {
          console.error(`Error processing sequence ${sequence.name}:`, e);
          progress.errors.push(`Sequence ${sequence.name}: ${(e as Error).message}`);
        }
      }
    }

    // ============================================
    // Sync Complete
    // ============================================
    console.log('=== Reply.io sync complete ===');
    console.log(`Final: ${progress.sequences_synced} sequences, ${progress.metrics_created} metrics, ${progress.variants_synced} variants, ${progress.people_synced} people, ${progress.companies_synced} companies`);
    
    await supabase.from('data_sources').update({
      last_sync_status: 'success',
      last_sync_at: new Date().toISOString(),
      last_sync_records_processed: progress.sequences_synced,
      additional_config: {
        ...existingConfig,
        cached_sequences: null, // Clear cache
        sequence_index: 0,
        completed_at: new Date().toISOString(),
        sequences_synced: progress.sequences_synced,
        variants_synced: progress.variants_synced,
        people_synced: progress.people_synced,
        companies_synced: progress.companies_synced,
        email_activities_synced: progress.email_activities_synced,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', data_source_id);

    // Trigger analysis
    EdgeRuntime.waitUntil(triggerAnalysis(supabaseUrl, supabaseServiceKey, engagement_id));

    return new Response(JSON.stringify({
      success: true,
      complete: true,
      progress,
      message: `Synced ${progress.sequences_synced} sequences, ${progress.variants_synced} variants, ${progress.people_synced} contacts, ${progress.companies_synced} companies, ${progress.email_activities_synced} email activities`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('replyio-sync error:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message,
      stack: (error as Error).stack,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
