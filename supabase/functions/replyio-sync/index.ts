import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REPLYIO_BASE_URL = 'https://api.reply.io/v3';
const RATE_LIMIT_DELAY = 300;
const TIME_BUDGET_MS = 50000;

function mapSequenceStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'Active': 'active',
    'Paused': 'paused',
    'Stopped': 'stopped',
    'Draft': 'draft',
    'Archived': 'archived',
  };
  return statusMap[status] || status.toLowerCase();
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function replyioRequest(endpoint: string, apiKey: string, retries = 3, allow404 = false): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await delay(RATE_LIMIT_DELAY);
      console.log(`Fetching: ${endpoint}`);
      const response = await fetch(`${REPLYIO_BASE_URL}${endpoint}`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      });
      
      if (response.status === 429) {
        console.log(`Rate limited, waiting ${(attempt + 1) * 2} seconds...`);
        await delay(2000 * (attempt + 1));
        continue;
      }
      
      // Allow 404 for stats endpoints (archived sequences may not have stats)
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
      await delay(1000 * (attempt + 1));
    }
  }
}

Deno.serve(async (req) => {
  console.log('replyio-sync: Request received', { method: req.method });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await createClient(
      supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { workspace_id, reset = false } = await req.json();
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: connection } = await supabase.from('api_connections').select('*')
      .eq('workspace_id', workspace_id).eq('platform', 'replyio').eq('is_active', true).single();
    
    if (!connection) {
      return new Response(JSON.stringify({ error: 'No Reply.io connection found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = connection.api_key_encrypted;

    // Handle reset
    if (reset) {
      console.log('Resetting Reply.io sync data for workspace:', workspace_id);
      const { data: campaigns } = await supabase.from('replyio_campaigns').select('id').eq('workspace_id', workspace_id);
      const campaignIds = campaigns?.map(c => c.id) || [];
      
      if (campaignIds.length > 0) {
        await supabase.from('replyio_daily_metrics').delete().eq('workspace_id', workspace_id);
        await supabase.from('replyio_variants').delete().in('campaign_id', campaignIds);
        await supabase.from('replyio_sequence_steps').delete().in('campaign_id', campaignIds);
        await supabase.from('replyio_campaigns').delete().eq('workspace_id', workspace_id);
      }
      console.log('Reset complete');
    }

    await supabase.from('api_connections').update({ sync_status: 'syncing' }).eq('id', connection.id);

    const progress = {
      sequences_synced: 0,
      metrics_created: 0,
      errors: [] as string[],
    };

    const startTime = Date.now();
    const isTimeBudgetExceeded = () => (Date.now() - startTime) > TIME_BUDGET_MS;

    // Step 1: Fetch all sequences (paginated)
    console.log('Fetching all sequences...');
    let allSequences: any[] = [];
    let skip = 0;
    
    while (!isTimeBudgetExceeded()) {
      const response = await replyioRequest(`/sequences?top=100&skip=${skip}`, apiKey);
      const sequences = Array.isArray(response) ? response : (response?.sequences || response?.items || []);
      
      if (sequences.length === 0) break;
      
      allSequences = allSequences.concat(sequences);
      skip += sequences.length;
      console.log(`Fetched ${allSequences.length} sequences so far...`);
      
      if (sequences.length < 100) break;
    }
    
    console.log(`Found ${allSequences.length} total sequences`);

    // Step 2: Process each sequence
    const existingProgress = (connection.sync_progress as any) || {};
    let startIndex = reset ? 0 : (existingProgress.sequence_index || 0);

    for (let i = startIndex; i < allSequences.length; i++) {
      if (isTimeBudgetExceeded()) {
        console.log(`Time budget exceeded at sequence ${i}/${allSequences.length}. Will continue next run.`);
        await supabase.from('api_connections').update({
          sync_progress: { sequence_index: i, total_sequences: allSequences.length },
          sync_status: 'partial',
        }).eq('id', connection.id);

        return new Response(JSON.stringify({
          success: true,
          complete: false,
          progress,
          message: `Processed ${i}/${allSequences.length} sequences. Run again to continue.`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const sequence = allSequences[i];
      console.log(`[${i + 1}/${allSequences.length}] Processing: ${sequence.name} (${sequence.status})`);

      try {
        // Upsert sequence as campaign
        const { data: campaign, error: campError } = await supabase
          .from('replyio_campaigns')
          .upsert({
            workspace_id,
            platform_id: String(sequence.id),
            name: sequence.name,
            status: mapSequenceStatus(sequence.status),
          }, { onConflict: 'workspace_id,platform_id' })
          .select('id')
          .single();

        if (campError) {
          console.error(`Failed to upsert sequence ${sequence.name}:`, campError.message);
          progress.errors.push(`Sequence ${sequence.name}: ${campError.message}`);
          continue;
        }

        const campaignId = campaign.id;
        progress.sequences_synced++;

        // Fetch statistics
        try {
          const stats = await replyioRequest(`/statistics/sequences/${sequence.id}`, apiKey, 1, true);
          
          if (stats) {
            const today = new Date().toISOString().split('T')[0];
            
            await supabase.from('replyio_daily_metrics').upsert({
              workspace_id,
              campaign_id: campaignId,
              metric_date: today,
              sent_count: stats.deliveredContacts || stats.delivered || 0,
              opened_count: stats.openedContacts || stats.opened || 0,
              clicked_count: stats.clickedContacts || stats.clicked || 0,
              replied_count: stats.repliedContacts || stats.replied || 0,
              positive_reply_count: stats.interestedContacts || stats.interested || 0,
              bounced_count: stats.bouncedContacts || stats.bounced || 0,
            }, { onConflict: 'campaign_id,metric_date' });

            progress.metrics_created++;
            console.log(`  Stats synced: sent=${stats.deliveredContacts || 0}, replies=${stats.repliedContacts || 0}`);
          }
        } catch (e) {
          console.error(`  Stats error for ${sequence.name}:`, e);
          progress.errors.push(`Stats ${sequence.name}: ${(e as Error).message}`);
        }

      } catch (e) {
        console.error(`Error processing sequence ${sequence.name}:`, e);
        progress.errors.push(`${sequence.name}: ${(e as Error).message}`);
      }
    }

    // Sync complete
    await supabase.from('api_connections').update({
      sync_status: 'success',
      sync_progress: { completed: true, total_sequences: allSequences.length },
      last_sync_at: new Date().toISOString(),
      last_full_sync_at: new Date().toISOString(),
    }).eq('id', connection.id);

    console.log('Reply.io sync complete:', progress);

    return new Response(JSON.stringify({
      success: true,
      complete: true,
      progress,
      message: `Synced ${progress.sequences_synced} sequences, ${progress.metrics_created} metrics`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('replyio-sync error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
