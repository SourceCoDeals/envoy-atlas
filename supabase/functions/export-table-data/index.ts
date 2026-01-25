import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// All tables in the database
const ALL_TABLES = [
  'alert_configs',
  'alerts',
  'api_connections',
  'audience_segments',
  'audit_logs',
  'call_activities',
  'call_ai_scores',
  'call_objections',
  'call_transcripts',
  'calling_metrics_config',
  'campaign_alerts',
  'campaign_email_accounts',
  'campaign_platform_mappings',
  'campaign_variant_features',
  'campaign_variants',
  'campaigns',
  'client_members',
  'clients',
  'cold_calls',
  'companies',
  'contacts',
  'copy_library',
  'daily_metrics',
  'data_sources',
  'deliverability_alerts',
  'disposition_mappings',
  'email_accounts',
  'email_activities',
  'engagements',
  'experiment_variants',
  'experiments',
  'external_call_intel',
  'external_calls',
  'function_logs',
  'hourly_metrics',
  'inbox_messages',
  'lead_categories',
  'leads',
  'message_events',
  'nocodb_replyio_campaigns',
  'nocodb_smartlead_campaigns',
  'pattern_performance',
  'playbook_entries',
  'profiles',
  'reply_classifications',
  'reps',
  'sending_domains',
  'sequence_steps',
  'sequences',
  'smartlead_inbox_webhooks',
  'sync_state',
  'team_invitations',
  'team_members',
  'training_assignments',
  'training_modules',
  'user_roles',
  'workspace_members',
  'workspaces',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const table = url.searchParams.get('table');
    const action = url.searchParams.get('action') || 'data';
    const limit = parseInt(url.searchParams.get('limit') || '1000');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // List all tables with row counts
    if (action === 'list') {
      const tableCounts: Record<string, number> = {};
      
      for (const tableName of ALL_TABLES) {
        try {
          const { count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          tableCounts[tableName] = count || 0;
        } catch {
          tableCounts[tableName] = -1; // Error fetching
        }
      }

      return new Response(JSON.stringify({
        tables: tableCounts,
        totalTables: ALL_TABLES.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Export data from a specific table
    if (!table) {
      return new Response(JSON.stringify({
        error: 'Missing table parameter',
        usage: {
          listTables: '?action=list',
          exportData: '?table=TABLE_NAME&limit=1000&offset=0',
        },
        availableTables: ALL_TABLES,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!ALL_TABLES.includes(table)) {
      return new Response(JSON.stringify({
        error: `Unknown table: ${table}`,
        availableTables: ALL_TABLES,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get total count first
    const { count: totalCount } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    // Fetch the data
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    const hasMore = (offset + limit) < (totalCount || 0);
    const nextOffset = hasMore ? offset + limit : null;

    return new Response(JSON.stringify({
      table,
      data,
      pagination: {
        limit,
        offset,
        count: data?.length || 0,
        totalCount,
        hasMore,
        nextOffset,
        nextUrl: hasMore 
          ? `?table=${table}&limit=${limit}&offset=${nextOffset}`
          : null,
      },
    }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Total-Count': String(totalCount || 0),
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[export-table-data] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
