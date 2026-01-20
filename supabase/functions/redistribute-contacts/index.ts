import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RedistributeResult {
  contacts_moved: number;
  companies_moved: number;
  errors: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      campaign_id, 
      new_engagement_id, 
      old_engagement_id,
      dry_run = false 
    } = await req.json();

    if (!campaign_id || !new_engagement_id) {
      return new Response(
        JSON.stringify({ error: 'campaign_id and new_engagement_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Redistributing contacts for campaign ${campaign_id} to engagement ${new_engagement_id}`);

    const result: RedistributeResult = {
      contacts_moved: 0,
      companies_moved: 0,
      errors: [],
    };

    // Get the campaign's external_id and data_source_id
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .select('id, external_id, data_source_id, name')
      .eq('id', campaign_id)
      .single();

    if (campError || !campaign) {
      return new Response(
        JSON.stringify({ error: `Campaign not found: ${campError?.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Campaign: ${campaign.name}, external_id: ${campaign.external_id}`);

    // Find contacts that have external_lead_id from this campaign's leads
    // We need to match via the SmartLead/Reply.io API data
    // Since contacts have external_lead_id, we need to find which leads belong to this campaign

    // For SmartLead, leads are fetched per campaign, so contacts with matching external_lead_ids
    // that were created during this campaign's sync should be moved

    // First, let's find contacts in the old engagement that might belong to this campaign
    // We'll use the email_activities table to identify which contacts received emails from this campaign
    const { data: campaignContacts, error: contactsError } = await supabase
      .from('email_activities')
      .select('contact_id')
      .eq('campaign_id', campaign_id);

    if (contactsError) {
      console.error('Error finding campaign contacts:', contactsError);
      result.errors.push(`Failed to find contacts: ${contactsError.message}`);
    }

    const contactIds = [...new Set((campaignContacts || []).map(c => c.contact_id).filter(Boolean))];
    console.log(`Found ${contactIds.length} contacts with email activities for this campaign`);

    if (contactIds.length > 0 && !dry_run) {
      // Move contacts to new engagement
      for (const contactId of contactIds) {
        // Get contact details including company
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, company_id, email')
          .eq('id', contactId)
          .single();

        if (!contact) continue;

        // Check if contact with same email already exists in new engagement
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('engagement_id', new_engagement_id)
          .eq('email', contact.email)
          .maybeSingle();

        if (existingContact) {
          // Contact already exists in new engagement, skip
          continue;
        }

        // Move the contact
        const { error: moveError } = await supabase
          .from('contacts')
          .update({ engagement_id: new_engagement_id })
          .eq('id', contactId);

        if (moveError) {
          result.errors.push(`Failed to move contact ${contactId}: ${moveError.message}`);
        } else {
          result.contacts_moved++;

          // Also move the company if it exists and isn't already in new engagement
          if (contact.company_id) {
            const { data: company } = await supabase
              .from('companies')
              .select('id, domain, name')
              .eq('id', contact.company_id)
              .single();

            if (company) {
              // Check if company already exists in new engagement
              const { data: existingCompany } = await supabase
                .from('companies')
                .select('id')
                .eq('engagement_id', new_engagement_id)
                .or(`domain.eq.${company.domain || ''},name.eq.${company.name}`)
                .maybeSingle();

              if (!existingCompany) {
                const { error: companyMoveError } = await supabase
                  .from('companies')
                  .update({ engagement_id: new_engagement_id })
                  .eq('id', contact.company_id);

                if (!companyMoveError) {
                  result.companies_moved++;
                }
              }
            }
          }
        }
      }
    }

    // Also update email_activities and daily_metrics engagement_id
    if (!dry_run && contactIds.length > 0) {
      await supabase
        .from('email_activities')
        .update({ engagement_id: new_engagement_id })
        .eq('campaign_id', campaign_id);

      await supabase
        .from('daily_metrics')
        .update({ engagement_id: new_engagement_id })
        .eq('campaign_id', campaign_id);

      // Update enrollment_snapshots
      await supabase
        .from('enrollment_snapshots')
        .update({ engagement_id: new_engagement_id })
        .eq('campaign_id', campaign_id);
    }

    console.log(`Redistribution complete: ${result.contacts_moved} contacts, ${result.companies_moved} companies moved`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        campaign: campaign.name,
        ...result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Redistribution error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
