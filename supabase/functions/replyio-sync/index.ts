import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REPLYIO_BASE_URL = 'https://api.reply.io/v3';
const RATE_LIMIT_DELAY = 300;
const BATCH_SIZE = 50;
const TIME_BUDGET_MS = 45000;
const SYNC_LOCK_TIMEOUT_MS = 30000;

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
  'gmx.com', 'live.com', 'msn.com', 'me.com', 'inbox.com'
]);

function classifyEmailType(email: string): 'personal' | 'work' {
  const domain = email.split('@')[1]?.toLowerCase();
  return PERSONAL_DOMAINS.has(domain) ? 'personal' : 'work';
}

function extractEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

function mapSequenceStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'Active': 'active',
    'Paused': 'paused',
    'Stopped': 'stopped',
    'Draft': 'draft',
  };
  return statusMap[status] || status.toLowerCase();
}

// Reply.io v3 API interfaces
interface ReplyioSequence {
  id: number;
  teamId: number;
  ownerId: number;
  name: string;
  status: string;
  created: string;
  isArchived: boolean;
}

interface ReplyioStep {
  id: number;
  type: string;
  number: number;
  delayInMinutes: number;
  executionMode: string;
  templates: Array<{
    id: number;
    templateId: number;
    subject: string;
    body: string;
  }>;
}

interface ReplyioContact {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  linkedInProfile: string;
  companySize: string;
  industry: string;
  addingDate: string;
}

interface ReplyioEmailAccount {
  id: number;
  email: string;
  senderName: string;
}

interface ReplyioSequenceStats {
  sequenceId: number;
  sequenceName: string;
  deliveredContacts: number;
  repliedContacts: number;
  interestedContacts: number;
  replyRate: number;
  deliveryRate: number;
  interestedRate: number;
}

interface SyncProgress {
  step: 'email_accounts' | 'sequences' | 'contacts' | 'complete';
  sequence_index: number;
  contact_cursor: number | null;
  total_sequences: number;
  processed_sequences: number;
  total_contacts: number;
  processed_contacts: number;
  current_sequence_name: string;
  last_heartbeat: string;
  errors: string[];
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function replyioRequest(endpoint: string, apiKey: string, retries = 3): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await delay(RATE_LIMIT_DELAY);
      
      const response = await fetch(`${REPLYIO_BASE_URL}${endpoint}`, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.status === 429) {
        console.log(`Rate limited on ${endpoint}, waiting...`);
        await delay(2000 * (attempt + 1));
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Reply.io API error ${response.status}: ${errorText}`);
      }
      
      const text = await response.text();
      if (!text) return null;
      return JSON.parse(text);
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt + 1} failed for ${endpoint}:`, error);
      if (attempt < retries - 1) {
        await delay(1000 * (attempt + 1));
      }
    }
  }
  
  throw lastError || new Error(`Failed to fetch ${endpoint}`);
}

async function updateProgress(
  supabase: any,
  connectionId: string,
  progress: Partial<SyncProgress>,
  status?: string
) {
  const updateData: any = {
    sync_progress: progress,
    updated_at: new Date().toISOString(),
  };
  
  if (status) {
    updateData.sync_status = status;
  }
  
  await supabase
    .from('api_connections')
    .update(updateData)
    .eq('id', connectionId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { workspace_id, sync_type = 'full', reset = false, force_advance = false } = await req.json();
    
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a workspace member' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Reply.io connection
    const { data: connection, error: connError } = await supabase
      .from('api_connections')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('platform', 'replyio')
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'No active Reply.io connection found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = connection.api_key_encrypted;

    // The connection may contain legacy sync_progress shapes from older Reply.io sync versions.
    // If so, we must ignore it and start from a clean v3 progress object.
    const rawProgress = (connection.sync_progress as any) || null;
    const isValidV3Progress = (p: any): p is SyncProgress => {
      return !!p &&
        typeof p === 'object' &&
        ['email_accounts', 'sequences', 'contacts', 'complete'].includes(p.step) &&
        typeof p.sequence_index === 'number' &&
        'processed_sequences' in p &&
        'processed_contacts' in p;
    };

    const existingProgress: SyncProgress | null = isValidV3Progress(rawProgress) ? rawProgress : null;

    if (rawProgress && !existingProgress) {
      console.log('Detected legacy Reply.io sync_progress; resetting to v3 progress format');
    }

    // Check sync lock (unless force_advance)
    if (!force_advance && existingProgress?.last_heartbeat) {
      const timeSinceHeartbeat = Date.now() - new Date(existingProgress.last_heartbeat).getTime();
      if (timeSinceHeartbeat < SYNC_LOCK_TIMEOUT_MS) {
        console.log('Another sync is running, skipping...');
        return new Response(JSON.stringify({
          skipped: true,
          message: 'Another sync is in progress',
          progress: existingProgress,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle reset
    if (reset) {
      console.log('Resetting Reply.io data...');

      // Get campaign IDs first
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('platform', 'replyio');

      const campaignIds = campaigns?.map(c => c.id) || [];

      if (campaignIds.length > 0) {
        await supabase.from('daily_metrics').delete()
          .eq('workspace_id', workspace_id)
          .in('campaign_id', campaignIds);
        await supabase.from('message_events').delete()
          .eq('workspace_id', workspace_id)
          .in('campaign_id', campaignIds);
        await supabase.from('campaign_variants').delete()
          .in('campaign_id', campaignIds);
        await supabase.from('sequence_steps').delete()
          .in('campaign_id', campaignIds);
        await supabase.from('leads').delete()
          .eq('workspace_id', workspace_id)
          .eq('platform', 'replyio');
        await supabase.from('campaigns').delete()
          .eq('workspace_id', workspace_id)
          .eq('platform', 'replyio');
      }

      await supabase.from('email_accounts').delete()
        .eq('workspace_id', workspace_id)
        .eq('platform', 'replyio');
    }

    // Initialize or resume progress
    let progress: SyncProgress = reset || !existingProgress ? {
      step: 'email_accounts',
      sequence_index: 0,
      contact_cursor: null,
      total_sequences: 0,
      processed_sequences: 0,
      total_contacts: 0,
      processed_contacts: 0,
      current_sequence_name: '',
      last_heartbeat: new Date().toISOString(),
      errors: [],
    } : {
      ...existingProgress,
      last_heartbeat: new Date().toISOString(),
    };

    // Force advance - skip to next sequence
    if (force_advance && progress.step === 'sequences') {
      progress.sequence_index++;
      progress.errors.push(`Forced skip at sequence ${progress.sequence_index}`);
    }

    await updateProgress(supabase, connection.id, progress, 'syncing');

    const checkTimeBudget = () => Date.now() - startTime > TIME_BUDGET_MS;

    try {
      // Step 1: Sync Email Accounts
      if (progress.step === 'email_accounts') {
        console.log('Syncing email accounts...');
        
        try {
          const emailAccounts: ReplyioEmailAccount[] = await replyioRequest('/email-accounts', apiKey);
          
          if (Array.isArray(emailAccounts)) {
            for (const account of emailAccounts) {
              await supabase.from('email_accounts').upsert({
                workspace_id,
                platform: 'replyio',
                platform_id: String(account.id),
                email_address: account.email,
                sender_name: account.senderName || null,
                is_active: true,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'workspace_id,platform,platform_id' });
            }
            
            console.log(`Synced ${emailAccounts.length} email accounts`);
          }
        } catch (error) {
          console.error('Error syncing email accounts:', error);
          progress.errors.push(`Email accounts: ${(error as Error).message}`);
        }
        
        progress.step = 'sequences';
        progress.last_heartbeat = new Date().toISOString();
        await updateProgress(supabase, connection.id, progress);
      }

      // Step 2: Sync Sequences (Campaigns) + Contacts per sequence
      if (progress.step === 'sequences') {
        console.log('Syncing sequences...');
        
        // Fetch all sequences using v3 API
        let allSequences: ReplyioSequence[] = [];
        let hasMoreSequences = true;
        let skip = 0;
        
        while (hasMoreSequences) {
          const endpoint = `/sequences?top=100&skip=${skip}`;
          
          const response = await replyioRequest(endpoint, apiKey);
          
          // Handle various response formats
          let sequences: ReplyioSequence[] = [];
          if (Array.isArray(response)) {
            sequences = response;
          } else if (response?.sequences && Array.isArray(response.sequences)) {
            sequences = response.sequences;
          } else if (response?.items && Array.isArray(response.items)) {
            sequences = response.items;
          }
          
          console.log(`Fetched ${sequences.length} sequences at skip=${skip}`);
          
          if (sequences.length === 0) {
            hasMoreSequences = false;
          } else {
            allSequences = allSequences.concat(sequences);
            skip += sequences.length;
            
            // Check if we got less than requested (last page)
            if (sequences.length < 100) {
              hasMoreSequences = false;
            }
          }
          
          if (checkTimeBudget()) break;
        }
        
        // Filter out archived sequences
        allSequences = allSequences.filter(s => !s.isArchived);
        progress.total_sequences = allSequences.length;
        
        console.log(`Found ${allSequences.length} sequences to process`);
        
        // If no sequences, check if API returned them differently
        if (allSequences.length === 0) {
          console.log('No sequences found. Checking alternate endpoint...');
          try {
            // Try alternate endpoint format
            const altResponse = await replyioRequest('/sequences', apiKey);
            console.log('Alternate response type:', typeof altResponse, Array.isArray(altResponse) ? 'array' : 'object');
            if (altResponse) {
              console.log('Response keys:', Object.keys(altResponse || {}).join(', '));
            }
          } catch (e) {
            console.log('Alternate check failed:', (e as Error).message);
          }
        }
        
        // Process sequences from where we left off
        for (let i = progress.sequence_index; i < allSequences.length; i++) {
          if (checkTimeBudget()) {
            console.log('Time budget exceeded, saving progress...');
            progress.sequence_index = i;
            await updateProgress(supabase, connection.id, progress);
            
            return new Response(JSON.stringify({
              success: true,
              complete: false,
              progress,
              message: 'Time budget exceeded, will continue on next call',
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          const sequence = allSequences[i];
          progress.current_sequence_name = sequence.name;
          progress.sequence_index = i;
          progress.processed_sequences = i;
          progress.last_heartbeat = new Date().toISOString();
          
          console.log(`Processing sequence ${i + 1}/${allSequences.length}: ${sequence.name}`);
          
          try {
            // Upsert campaign
            const { data: campaign, error: campaignError } = await supabase
              .from('campaigns')
              .upsert({
                workspace_id,
                platform: 'replyio',
                platform_id: String(sequence.id),
                name: sequence.name,
                status: mapSequenceStatus(sequence.status),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'workspace_id,platform,platform_id' })
              .select('id')
              .single();
            
            if (campaignError) throw campaignError;
            const campaignId = campaign.id;
            
            // Fetch and sync steps (templates/variants)
            try {
              const steps: ReplyioStep[] = await replyioRequest(`/sequences/${sequence.id}/steps`, apiKey);
              
              if (Array.isArray(steps)) {
                for (const step of steps) {
                  // Upsert sequence step
                  await supabase.from('sequence_steps').upsert({
                    campaign_id: campaignId,
                    step_number: step.number || 1,
                    delay_days: Math.floor((step.delayInMinutes || 0) / 1440),
                    subject_line: step.templates?.[0]?.subject || null,
                    body_preview: step.templates?.[0]?.body?.substring(0, 200) || null,
                  }, { onConflict: 'campaign_id,step_number' });
                  
                  // Upsert templates as variants
                  if (step.templates && Array.isArray(step.templates)) {
                    for (let ti = 0; ti < step.templates.length; ti++) {
                      const template = step.templates[ti];
                      await supabase.from('campaign_variants').upsert({
                        campaign_id: campaignId,
                        platform_variant_id: String(template.id || template.templateId),
                        name: `Step ${step.number} - Variant ${String.fromCharCode(65 + ti)}`,
                        variant_type: 'email',
                        subject_line: template.subject || null,
                        email_body: template.body || null,
                        body_preview: template.body?.substring(0, 200) || null,
                        is_control: ti === 0,
                      }, { onConflict: 'campaign_id,platform_variant_id' });
                    }
                  }
                }
              }
            } catch (stepError) {
              console.error(`Error fetching steps for sequence ${sequence.id}:`, stepError);
            }
            
            // Fetch and sync statistics
            try {
              const stats: ReplyioSequenceStats = await replyioRequest(`/statistics/sequences/${sequence.id}`, apiKey);
              
              if (stats) {
                const today = new Date().toISOString().split('T')[0];
                await supabase.from('daily_metrics').upsert({
                  workspace_id,
                  campaign_id: campaignId,
                  date: today,
                  sent_count: stats.deliveredContacts || 0,
                  delivered_count: stats.deliveredContacts || 0,
                  replied_count: stats.repliedContacts || 0,
                  positive_reply_count: stats.interestedContacts || 0,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'workspace_id,campaign_id,date,email_account_id,variant_id,segment_id' });
              }
            } catch (statsError) {
              console.error(`Error fetching stats for sequence ${sequence.id}:`, statsError);
            }
            
            // Fetch contacts for this sequence (v3 API requires per-sequence contact fetch)
            try {
              let hasMoreContacts = true;
              let contactSkip = 0;
              
              while (hasMoreContacts && !checkTimeBudget()) {
                const contactsResponse = await replyioRequest(
                  `/sequences/${sequence.id}/contacts/extended?top=50&skip=${contactSkip}`,
                  apiKey
                );
                
                const contacts = contactsResponse?.items || contactsResponse || [];
                
                if (!Array.isArray(contacts) || contacts.length === 0) {
                  hasMoreContacts = false;
                  break;
                }
                
                // Map contacts to leads
                const leadsToUpsert = contacts.map((contact: any) => ({
                  workspace_id,
                  platform: 'replyio',
                  platform_lead_id: contact.email, // Use email as ID since extended doesn't return ID
                  email: contact.email,
                  first_name: contact.firstName || null,
                  last_name: contact.lastName || null,
                  title: contact.title || null,
                  campaign_id: campaignId,
                  status: contact.status?.status || null,
                  email_domain: extractEmailDomain(contact.email),
                  email_type: classifyEmailType(contact.email),
                  updated_at: new Date().toISOString(),
                }));
                
                await supabase.from('leads').upsert(leadsToUpsert, {
                  onConflict: 'workspace_id,platform,platform_lead_id',
                });
                
                progress.processed_contacts += contacts.length;
                contactSkip += contacts.length;
                
                hasMoreContacts = contactsResponse?.info?.hasMore || contacts.length >= 50;
                
                console.log(`  Synced ${contactSkip} contacts for sequence ${sequence.name}`);
              }
            } catch (contactError) {
              console.error(`Error fetching contacts for sequence ${sequence.id}:`, contactError);
              // Don't add to errors array for contact issues - continue with other sequences
            }
            
          } catch (error) {
            console.error(`Error processing sequence ${sequence.id}:`, error);
            progress.errors.push(`Sequence ${sequence.name}: ${(error as Error).message}`);
          }
          
          // Update progress after each sequence
          await updateProgress(supabase, connection.id, progress);
        }
        
        // Sequences step complete - skip to complete (no separate contacts step)
        progress.step = 'complete';
        progress.processed_sequences = progress.total_sequences;
        progress.last_heartbeat = new Date().toISOString();
        await updateProgress(supabase, connection.id, progress);
      }

      // Step 3: Legacy contacts step - now handled per-sequence, just move to complete
      if (progress.step === 'contacts') {
        console.log('Contacts step skipped - contacts are now synced per-sequence');
        progress.step = 'complete';
      }

      // Complete
      if (progress.step === 'complete') {
        await supabase
          .from('api_connections')
          .update({
            sync_status: 'completed',
            sync_progress: progress,
            last_sync_at: new Date().toISOString(),
            last_full_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', connection.id);

        return new Response(JSON.stringify({
          success: true,
          complete: true,
          progress,
          message: 'Sync completed successfully',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Not complete - needs continuation
      return new Response(JSON.stringify({
        success: true,
        complete: false,
        progress,
        message: 'Sync in progress, call again to continue',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (syncError) {
      console.error('Sync error:', syncError);
      progress.errors.push(`Sync error: ${(syncError as Error).message}`);
      
      await supabase
        .from('api_connections')
        .update({
          sync_status: 'error',
          sync_progress: progress,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);

      return new Response(JSON.stringify({
        success: false,
        error: (syncError as Error).message,
        progress,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Request error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
