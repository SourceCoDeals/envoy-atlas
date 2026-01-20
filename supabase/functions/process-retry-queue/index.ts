import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Processing retry queue...");

  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Find pending retries that are due
    const { data: pendingRetries, error: fetchError } = await supabase
      .from('sync_retry_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .order('next_retry_at', { ascending: true })
      .limit(5); // Process max 5 at a time

    if (fetchError) {
      throw new Error(`Failed to fetch retry queue: ${fetchError.message}`);
    }

    if (!pendingRetries || pendingRetries.length === 0) {
      console.log("No pending retries to process");
      return new Response(JSON.stringify({ message: "No pending retries", results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${pendingRetries.length} pending retries`);

    for (const retry of pendingRetries) {
      results.processed++;

      try {
        // Mark as processing
        await supabase
          .from('sync_retry_queue')
          .update({ status: 'processing' })
          .eq('id', retry.id);

        // Get data source info
        const { data: dataSource, error: dsError } = await supabase
          .from('data_sources')
          .select('source_type, api_key_encrypted')
          .eq('id', retry.data_source_id)
          .single();

        if (dsError || !dataSource) {
          throw new Error(`Data source not found: ${retry.data_source_id}`);
        }

        // Determine sync function
        const syncFunction = dataSource.source_type === 'smartlead' 
          ? 'smartlead-sync' 
          : dataSource.source_type === 'replyio' 
          ? 'replyio-sync' 
          : null;

        if (!syncFunction) {
          throw new Error(`Unknown source type: ${dataSource.source_type}`);
        }

        console.log(`Retrying sync for ${dataSource.source_type} (attempt ${retry.retry_count + 1}/${retry.max_retries})`);

        // Trigger the sync
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/${syncFunction}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data_source_id: retry.data_source_id,
            engagement_id: retry.engagement_id,
            is_retry: true,
          }),
        });

        if (syncResponse.ok) {
          // Success - mark as completed
          await supabase
            .from('sync_retry_queue')
            .update({ status: 'completed' })
            .eq('id', retry.id);
          
          results.succeeded++;
          console.log(`Retry succeeded for ${dataSource.source_type}`);
        } else {
          const errorText = await syncResponse.text();
          throw new Error(`Sync failed: ${errorText}`);
        }

      } catch (retryError) {
        const errorMessage = (retryError as Error).message;
        console.error(`Retry failed:`, errorMessage);
        results.failed++;
        results.errors.push(errorMessage);

        const newRetryCount = retry.retry_count + 1;

        if (newRetryCount >= retry.max_retries) {
          // Max retries reached - mark as permanently failed
          await supabase
            .from('sync_retry_queue')
            .update({ 
              status: 'failed',
              last_error: errorMessage,
              retry_count: newRetryCount,
            })
            .eq('id', retry.id);
          
          console.log(`Retry ${retry.id} permanently failed after ${newRetryCount} attempts`);
        } else {
          // Schedule next retry with exponential backoff
          // 10min, 30min, 1hr, 2hr, 4hr
          const backoffMinutes = Math.pow(3, newRetryCount) * 10;
          const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await supabase
            .from('sync_retry_queue')
            .update({ 
              status: 'pending',
              last_error: errorMessage,
              retry_count: newRetryCount,
              next_retry_at: nextRetryAt.toISOString(),
            })
            .eq('id', retry.id);
          
          console.log(`Retry ${retry.id} rescheduled for ${nextRetryAt.toISOString()}`);
        }
      }
    }

    console.log("Retry queue processing complete:", results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Retry queue processing error:", error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message,
      results 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
