import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignMatch {
  campaignId: string;
  campaignName: string;
  engagementId: string;
  engagementName: string;
  matchType: string;
  platform: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { matches, workspace_id } = await req.json() as { 
      matches: CampaignMatch[];
      workspace_id: string;
    };

    if (!matches || !workspace_id) {
      return new Response(
        JSON.stringify({ error: 'Missing matches or workspace_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Auto-linking ${matches.length} campaigns for workspace ${workspace_id}`);

    let successCount = 0;
    const errors: string[] = [];

    // Update campaigns in unified table - all platforms use the same table now
    for (const match of matches) {
      const { error } = await supabase
        .from('campaigns')
        .update({ engagement_id: match.engagementId })
        .eq('id', match.campaignId);

      if (error) {
        console.error(`Failed to update campaign ${match.campaignId} (${match.platform}):`, error);
        errors.push(`${match.campaignName}: ${error.message}`);
      } else {
        successCount++;
        console.log(`Linked ${match.platform} campaign "${match.campaignName}" to engagement "${match.engagementName}"`);
      }
    }

    console.log(`Successfully linked ${successCount} campaigns, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        linked: successCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in auto-link-campaigns:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
