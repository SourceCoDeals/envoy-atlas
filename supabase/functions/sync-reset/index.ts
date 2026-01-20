import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const {
      data_source_id,
      source_types = ['smartlead', 'replyio'],
      stale_threshold_minutes = 5,
    } = body;

    const staleThreshold = new Date(Date.now() - stale_threshold_minutes * 60 * 1000).toISOString();
    
    console.log(`Resetting stuck syncs older than ${stale_threshold_minutes} minutes (before ${staleThreshold})`);

    // Find running sync_progress rows that haven't updated in threshold time
    let query = supabase
      .from('sync_progress')
      .select('id, data_source_id, status, updated_at, processed_campaigns, total_campaigns')
      .eq('status', 'running')
      .lt('updated_at', staleThreshold);

    if (data_source_id) {
      query = query.eq('data_source_id', data_source_id);
    }

    const { data: staleSyncs, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch stale syncs: ${fetchError.message}`);
    }

    if (!staleSyncs || staleSyncs.length === 0) {
      console.log('No stale syncs found');
      return new Response(
        JSON.stringify({ success: true, reset_count: 0, message: 'No stale syncs to reset' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${staleSyncs.length} stale sync(s) to reset`);

    const resetIds = staleSyncs.map(s => s.id);
    const dataSourceIds = [...new Set(staleSyncs.map(s => s.data_source_id).filter(Boolean))];

    // Mark sync_progress rows as 'failed'
    const { error: updateProgressError } = await supabase
      .from('sync_progress')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        errors: ['Marked as stale by sync-reset - no updates for ' + stale_threshold_minutes + ' minutes'],
      })
      .in('id', resetIds);

    if (updateProgressError) {
      throw new Error(`Failed to update sync_progress: ${updateProgressError.message}`);
    }

    // Reset data_sources last_sync_status for affected sources
    if (dataSourceIds.length > 0) {
      const { error: updateDsError } = await supabase
        .from('data_sources')
        .update({
          last_sync_status: 'idle',
          updated_at: new Date().toISOString(),
        })
        .in('id', dataSourceIds);

      if (updateDsError) {
        console.warn(`Warning: Failed to reset data_sources status: ${updateDsError.message}`);
      }
    }

    // Also cancel any pending retry queue items for these sources
    if (dataSourceIds.length > 0) {
      const { error: cancelRetryError } = await supabase
        .from('sync_retry_queue')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .in('data_source_id', dataSourceIds)
        .eq('status', 'pending');

      if (cancelRetryError) {
        console.warn(`Warning: Failed to cancel pending retries: ${cancelRetryError.message}`);
      }
    }

    console.log(`Successfully reset ${staleSyncs.length} stale sync(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        reset_count: staleSyncs.length,
        reset_syncs: staleSyncs.map(s => ({
          id: s.id,
          data_source_id: s.data_source_id,
          processed: s.processed_campaigns,
          total: s.total_campaigns,
          last_updated: s.updated_at,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('sync-reset error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
