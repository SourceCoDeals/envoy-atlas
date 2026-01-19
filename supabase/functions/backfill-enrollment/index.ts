import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';
const REPLYIO_V3_URL = 'https://api.reply.io/v3';
const RATE_LIMIT_DELAY = 300;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface LeadWithDate {
  email: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
}

async function smartleadRequest(endpoint: string, apiKey: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    await delay(RATE_LIMIT_DELAY);
    const url = `${SMARTLEAD_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}`;
    
    try {
      const response = await fetch(url);
      
      if (response.status === 429) {
        console.log(`Rate limited, waiting ${(i + 1) * 2} seconds...`);
        await delay((i + 1) * 2000);
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error ${response.status}: ${errorText}`);
        if (i === retries - 1) throw new Error(`Smartlead API error (${response.status}): ${errorText}`);
        continue;
      }
      
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(1000 * (i + 1));
    }
  }
}

async function replyioRequest(endpoint: string, apiKey: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    await delay(RATE_LIMIT_DELAY * 3); // Reply.io needs slower rate
    const url = `${REPLYIO_V3_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      });
      
      if (response.status === 429) {
        console.log(`Rate limited, waiting ${(i + 1) * 10} seconds...`);
        await delay(10000 * (i + 1));
        continue;
      }
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Reply.io API error ${response.status}: ${errorText}`);
      }
      
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(2000 * (i + 1));
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { engagement_id, campaign_id, data_source_id } = await req.json();

    if (!engagement_id) {
      return new Response(JSON.stringify({ error: 'engagement_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting enrollment backfill for engagement: ${engagement_id}`);

    // Get the data source for API credentials
    let dataSource: any = null;
    if (data_source_id) {
      const { data } = await supabase
        .from('data_sources')
        .select('*')
        .eq('id', data_source_id)
        .single();
      dataSource = data;
    } else {
      // Find any connected data source for this engagement
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('data_source_id')
        .eq('engagement_id', engagement_id)
        .not('data_source_id', 'is', null)
        .limit(1);
      
      if (campaigns?.[0]?.data_source_id) {
        const { data } = await supabase
          .from('data_sources')
          .select('*')
          .eq('id', campaigns[0].data_source_id)
          .single();
        dataSource = data;
      }
    }

    if (!dataSource) {
      return new Response(JSON.stringify({ error: 'No data source found for this engagement' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = dataSource.api_key_encrypted;
    const sourceType = dataSource.source_type;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key configured for data source' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get campaigns to backfill
    let campaignQuery = supabase
      .from('campaigns')
      .select('id, external_id, name')
      .eq('engagement_id', engagement_id)
      .eq('data_source_id', dataSource.id);
    
    if (campaign_id) {
      campaignQuery = campaignQuery.eq('id', campaign_id);
    }

    const { data: campaigns, error: campaignError } = await campaignQuery;

    if (campaignError || !campaigns?.length) {
      return new Response(JSON.stringify({ error: 'No campaigns found to backfill' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${campaigns.length} campaigns to backfill`);

    const progress = {
      campaigns_processed: 0,
      leads_processed: 0,
      contacts_updated: 0,
      snapshots_created: 0,
      errors: [] as string[],
    };

    // Process each campaign
    for (const campaign of campaigns) {
      console.log(`Processing campaign: ${campaign.name} (${campaign.external_id})`);
      
      try {
        const allLeads: LeadWithDate[] = [];

        if (sourceType === 'smartlead') {
          // Fetch all leads from SmartLead with pagination
          let offset = 0;
          const limit = 100;
          let hasMore = true;

          while (hasMore) {
            const response = await smartleadRequest(
              `/campaigns/${campaign.external_id}/leads?offset=${offset}&limit=${limit}`,
              apiKey
            );

            const leads = response?.data || response || [];
            
            if (!Array.isArray(leads) || leads.length === 0) {
              hasMore = false;
              break;
            }

            for (const lead of leads) {
              if (lead.email && lead.created_at) {
                allLeads.push({
                  email: lead.email,
                  created_at: lead.created_at,
                  first_name: lead.first_name,
                  last_name: lead.last_name,
                  company_name: lead.company_name,
                });
              }
            }

            offset += leads.length;
            if (leads.length < limit) hasMore = false;
            
            console.log(`  Fetched ${offset} leads so far...`);
          }
        } else if (sourceType === 'replyio') {
          // Fetch people from Reply.io sequence
          let offset = 0;
          const limit = 100;
          let hasMore = true;

          while (hasMore) {
            const response = await replyioRequest(
              `/sequences/${campaign.external_id}/people?top=${limit}&skip=${offset}`,
              apiKey
            );

            const people = Array.isArray(response) ? response : (response?.people || response?.items || []);

            if (!people || people.length === 0) {
              hasMore = false;
              break;
            }

            for (const person of people) {
              // Reply.io uses addedAt or createdAt
              const enrolledAt = person.addedAt || person.createdAt || person.created || person.added_at;
              if (person.email && enrolledAt) {
                allLeads.push({
                  email: person.email,
                  created_at: enrolledAt,
                  first_name: person.firstName || person.first_name,
                  last_name: person.lastName || person.last_name,
                  company_name: person.company,
                });
              }
            }

            offset += people.length;
            if (people.length < limit) hasMore = false;
            
            console.log(`  Fetched ${offset} people so far...`);
          }
        }

        console.log(`  Total leads with enrollment dates: ${allLeads.length}`);
        progress.leads_processed += allLeads.length;

        // Update contacts with enrolled_at dates
        for (const lead of allLeads) {
          const { error: updateError } = await supabase
            .from('contacts')
            .update({ enrolled_at: lead.created_at })
            .eq('engagement_id', engagement_id)
            .eq('email', lead.email)
            .is('enrolled_at', null); // Only update if not already set

          if (!updateError) {
            progress.contacts_updated++;
          }
        }

        // Group leads by week and create enrollment snapshots
        const weeklyData = new Map<string, { total: number; emails: string[] }>();
        
        for (const lead of allLeads) {
          const date = new Date(lead.created_at);
          // Get Monday of the week
          const day = date.getDay();
          const diff = date.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(date.setDate(diff));
          const weekKey = monday.toISOString().split('T')[0];

          if (!weeklyData.has(weekKey)) {
            weeklyData.set(weekKey, { total: 0, emails: [] });
          }
          const week = weeklyData.get(weekKey)!;
          week.total++;
          week.emails.push(lead.email);
        }

        // Calculate cumulative totals and insert snapshots
        let cumulativeTotal = 0;
        const sortedWeeks = Array.from(weeklyData.keys()).sort();

        for (const weekStart of sortedWeeks) {
          const weekData = weeklyData.get(weekStart)!;
          cumulativeTotal += weekData.total;

          // Insert enrollment snapshot for this week
          const { error: snapshotError } = await supabase
            .from('enrollment_snapshots')
            .upsert({
              campaign_id: campaign.id,
              snapshot_date: weekStart,
              total_leads: cumulativeTotal,
              not_started: 0, // Will be updated by live sync
              in_progress: cumulativeTotal, // Assume all were in progress at that point
              completed: 0,
              blocked: 0,
            }, { onConflict: 'campaign_id,snapshot_date' });

          if (!snapshotError) {
            progress.snapshots_created++;
          }
        }

        progress.campaigns_processed++;

      } catch (error) {
        console.error(`Error processing campaign ${campaign.name}:`, error);
        progress.errors.push(`${campaign.name}: ${(error as Error).message}`);
      }
    }

    // Update data source to indicate backfill completed
    await supabase.from('data_sources').update({
      additional_config: {
        ...(dataSource.additional_config || {}),
        enrollment_backfill_completed: true,
        enrollment_backfill_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }).eq('id', dataSource.id);

    console.log('Enrollment backfill completed:', progress);

    return new Response(JSON.stringify({
      success: true,
      progress,
      message: `Backfilled ${progress.leads_processed} leads across ${progress.campaigns_processed} campaigns`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message,
      stack: (error as Error).stack,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
