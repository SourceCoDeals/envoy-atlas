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

    // Group matches by platform for efficient updates
    const smartleadMatches = matches.filter(m => m.platform === 'smartlead');
    const replyioMatches = matches.filter(m => m.platform === 'replyio');

    let successCount = 0;
    const errors: string[] = [];

    // Update SmartLead campaigns
    for (const match of smartleadMatches) {
      const { error } = await supabase
        .from('smartlead_campaigns')
        .update({ engagement_id: match.engagementId })
        .eq('id', match.campaignId)
        .eq('workspace_id', workspace_id);

      if (error) {
        console.error(`Failed to update smartlead campaign ${match.campaignId}:`, error);
        errors.push(`${match.campaignName}: ${error.message}`);
      } else {
        successCount++;
      }
    }

    // Update Reply.io campaigns
    for (const match of replyioMatches) {
      const { error } = await supabase
        .from('replyio_campaigns')
        .update({ engagement_id: match.engagementId })
        .eq('id', match.campaignId)
        .eq('workspace_id', workspace_id);

      if (error) {
        console.error(`Failed to update replyio campaign ${match.campaignId}:`, error);
        errors.push(`${match.campaignName}: ${error.message}`);
      } else {
        successCount++;
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
