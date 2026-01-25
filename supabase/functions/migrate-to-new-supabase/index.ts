import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action = 'status' } = await req.json().catch(() => ({}));

    // Source (Lovable Cloud)
    const sourceUrl = Deno.env.get('SUPABASE_URL')!;
    const sourceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Target (New personal Supabase)
    const targetUrl = Deno.env.get('NEW_SUPABASE_URL');
    const targetKey = Deno.env.get('NEW_SUPABASE_SERVICE_ROLE_KEY');
    const targetProjectId = Deno.env.get('NEW_SUPABASE_PROJECT_ID');

    if (!targetUrl || !targetKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing NEW_SUPABASE_URL or NEW_SUPABASE_SERVICE_ROLE_KEY secrets',
          configured: {
            NEW_SUPABASE_URL: !!targetUrl,
            NEW_SUPABASE_SERVICE_ROLE_KEY: !!targetKey,
            NEW_SUPABASE_PROJECT_ID: !!targetProjectId,
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sourceClient = createClient(sourceUrl, sourceKey);
    const targetClient = createClient(targetUrl, targetKey);

    if (action === 'status') {
      // Test connections to both databases
      const sourceTest = await sourceClient.from('clients').select('id').limit(1);
      
      let targetTest: { data: unknown; error: { message: string } | null };
      try {
        const result = await targetClient.from('clients').select('id').limit(1);
        targetTest = { data: result.data, error: result.error };
      } catch {
        targetTest = { data: null, error: { message: 'Connection failed or table does not exist' } };
      }

      return new Response(
        JSON.stringify({
          source: {
            url: sourceUrl.replace(/https:\/\/([^.]+)\..*/, 'https://$1...'),
            connected: !sourceTest.error,
            error: sourceTest.error?.message,
          },
          target: {
            url: targetUrl.replace(/https:\/\/([^.]+)\..*/, 'https://$1...'),
            connected: !targetTest.error,
            error: targetTest.error?.message,
            needsSchema: targetTest.error?.message?.includes('does not exist'),
          },
          projectId: targetProjectId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list-tables') {
      // Get all tables with row counts from source
      const tables = [
        'clients', 'profiles', 'workspaces', 'workspace_members', 'client_members',
        'engagements', 'data_sources', 'campaigns', 'campaign_variants', 'campaign_variant_features',
        'campaign_platform_mappings', 'campaign_email_accounts', 'campaign_alerts',
        'contacts', 'companies', 'email_activities', 'email_accounts',
        'daily_metrics', 'hourly_metrics', 'sequences',
        'cold_calls', 'call_activities', 'call_objections', 'call_transcripts', 'call_ai_scores',
        'reps', 'deals', 'calling_metrics_config', 'disposition_mappings',
        'copy_library', 'copy_patterns', 'copy_recommendations',
        'deliverability_alerts', 'domain_authentication',
        'nocodb_smartlead_campaigns', 'external_call_intelligence',
        'user_roles', 'api_connections', 'sync_progress', 'sync_retry_queue',
        'alerts', 'function_logs', 'data_health_snapshots', 'industry_documents',
        'training_assignments', 'phoneburner_tokens', 'engagement_targets'
      ];

      const counts: Record<string, number> = {};
      
      for (const table of tables) {
        const { count, error } = await sourceClient
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (!error && count !== null) {
          counts[table] = count;
        }
      }

      return new Response(
        JSON.stringify({ tables: counts, total: Object.values(counts).reduce((a, b) => a + b, 0) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'migrate-table') {
      const { table, limit = 500, offset = 0 } = await req.json();
      
      if (!table) {
        return new Response(
          JSON.stringify({ error: 'Table name required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch from source
      const { data: rows, error: fetchError, count } = await sourceClient
        .from(table)
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1);

      if (fetchError) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch from ${table}: ${fetchError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!rows || rows.length === 0) {
        return new Response(
          JSON.stringify({ 
            table, 
            migrated: 0, 
            total: count || 0,
            hasMore: false,
            message: 'No rows to migrate' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert to target (upsert to handle re-runs)
      const { error: insertError } = await targetClient
        .from(table)
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });

      if (insertError) {
        return new Response(
          JSON.stringify({ 
            error: `Failed to insert into ${table}: ${insertError.message}`,
            hint: insertError.hint || 'Schema may not exist yet. Run schema migration first.',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          table,
          migrated: rows.length,
          total: count || 0,
          offset,
          hasMore: (offset + rows.length) < (count || 0),
          nextOffset: offset + rows.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'generate-schema-sql') {
      // Generate the full schema SQL by reading from information_schema
      // This is a simplified version - for full migration use supabase db dump
      const schemaNote = `
-- SCHEMA MIGRATION INSTRUCTIONS
-- ==============================
-- 
-- Option 1: Use Supabase CLI (Recommended)
--   supabase link --project-ref ${targetProjectId || 'YOUR_PROJECT_ID'}
--   supabase db push
--
-- Option 2: Run migrations manually
--   Copy the SQL from each file in supabase/migrations/ 
--   and run them in order in your SQL Editor
--
-- The migrations folder contains 127 migration files that create:
--   - 62 tables
--   - All RLS policies
--   - Database functions and triggers
--   - Indexes and constraints
`;

      return new Response(
        JSON.stringify({
          instructions: schemaNote,
          migrationCount: 127,
          recommendation: 'Use supabase db push via CLI for reliable schema migration',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: 'Unknown action',
        validActions: ['status', 'list-tables', 'migrate-table', 'generate-schema-sql']
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
