import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';
const REPLYIO_BASE_URL = 'https://api.reply.io/v3';
const RATE_LIMIT_DELAY = 300;

interface SmartleadResult {
  platform: 'smartlead';
  lead: any;
  campaigns: Array<{
    id: number;
    name: string;
    status: string;
    hasReply: boolean;
    messageHistory: Array<{
      id: number;
      type: string;
      time: string;
      email_body?: string;
      email_subject?: string;
      seq_number?: number;
    }>;
    platformUrl: string;
  }>;
}

interface ReplyioResult {
  platform: 'replyio';
  contact: any;
  sequences: Array<{
    id: number;
    name: string;
    status: string;
    hasReply: boolean;
    emails: Array<{
      id: number;
      type: string;
      date: string;
      subject?: string;
      body?: string;
      stepNumber?: number;
    }>;
    platformUrl: string;
  }>;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function smartleadRequest(endpoint: string, apiKey: string): Promise<any> {
  await delay(RATE_LIMIT_DELAY);
  const url = `${SMARTLEAD_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SmartLead API error ${response.status}: ${errorText}`);
  }
  
  return response.json();
}

async function replyioRequest(endpoint: string, apiKey: string): Promise<any> {
  await delay(RATE_LIMIT_DELAY);
  
  const response = await fetch(`${REPLYIO_BASE_URL}${endpoint}`, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Reply.io API error ${response.status}: ${errorText}`);
  }
  
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

async function searchSmartlead(email: string, apiKey: string): Promise<SmartleadResult | null> {
  try {
    // Step 1: Find the lead by email
    const lead = await smartleadRequest(`/leads/?email=${encodeURIComponent(email)}`, apiKey);
    
    if (!lead || !lead.id) {
      console.log('SmartLead: No lead found for email:', email);
      return null;
    }
    
    console.log('SmartLead: Found lead:', lead.id);
    
    // Step 2: Get all campaigns the lead belongs to
    const campaigns = await smartleadRequest(`/leads/${lead.id}/campaigns`, apiKey);
    
    if (!campaigns || !Array.isArray(campaigns) || campaigns.length === 0) {
      return {
        platform: 'smartlead',
        lead,
        campaigns: [],
      };
    }
    
    console.log('SmartLead: Found campaigns:', campaigns.length);
    
    // Step 3: For each campaign, get message history
    const campaignsWithHistory = await Promise.all(
      campaigns.map(async (campaign: any) => {
        try {
          const history = await smartleadRequest(
            `/campaigns/${campaign.id}/leads/${lead.id}/message-history`,
            apiKey
          );
          
          const hasReply = history?.history?.some((msg: any) => msg.type === 'REPLY') || false;
          
          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            hasReply,
            messageHistory: history?.history || [],
            platformUrl: `https://app.smartlead.ai/app/email-campaign/${campaign.id}/leads?leadId=${lead.id}`,
          };
        } catch (error) {
          console.error(`SmartLead: Error fetching history for campaign ${campaign.id}:`, error);
          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            hasReply: false,
            messageHistory: [],
            platformUrl: `https://app.smartlead.ai/app/email-campaign/${campaign.id}/leads?leadId=${lead.id}`,
          };
        }
      })
    );
    
    return {
      platform: 'smartlead',
      lead,
      campaigns: campaignsWithHistory,
    };
  } catch (error) {
    console.error('SmartLead search error:', error);
    return null;
  }
}

async function searchReplyio(email: string, apiKey: string): Promise<ReplyioResult | null> {
  try {
    // Step 1: Search for contact by email
    // Reply.io v3 API: GET /people?email={email}
    const peopleResponse = await replyioRequest(`/people?email=${encodeURIComponent(email)}`, apiKey);
    
    if (!peopleResponse || !Array.isArray(peopleResponse) || peopleResponse.length === 0) {
      console.log('Reply.io: No contact found for email:', email);
      return null;
    }
    
    const contact = peopleResponse[0];
    console.log('Reply.io: Found contact:', contact.id);
    
    // Step 2: Get all sequences
    const sequences = await replyioRequest('/sequences?top=100&skip=0', apiKey);
    
    if (!sequences || !Array.isArray(sequences) || sequences.length === 0) {
      return {
        platform: 'replyio',
        contact,
        sequences: [],
      };
    }
    
    // Step 3: For each sequence, check if contact is part of it and get emails
    const sequencesWithEmails: ReplyioResult['sequences'] = [];
    
    for (const sequence of sequences) {
      try {
        // Get contacts in sequence filtered by email
        const contactsInSeq = await replyioRequest(
          `/sequences/${sequence.id}/people?email=${encodeURIComponent(email)}`,
          apiKey
        );
        
        if (contactsInSeq && Array.isArray(contactsInSeq) && contactsInSeq.length > 0) {
          // Get email activities for this contact in this sequence
          const personInSeq = contactsInSeq[0];
          
          // Get person's email history from the sequence
          const emailActivities = await replyioRequest(
            `/people/${contact.id}/emails`,
            apiKey
          );
          
          // Filter emails for this sequence
          const sequenceEmails = (emailActivities || []).filter(
            (e: any) => e.sequenceId === sequence.id
          );
          
          const hasReply = sequenceEmails.some((e: any) => 
            e.direction === 'in' || e.type === 'reply' || e.isReply
          );
          
          sequencesWithEmails.push({
            id: sequence.id,
            name: sequence.name,
            status: sequence.status,
            hasReply,
            emails: sequenceEmails.map((e: any) => ({
              id: e.id,
              type: e.direction === 'out' ? 'SENT' : 'REPLY',
              date: e.date || e.sentAt || e.receivedAt,
              subject: e.subject,
              body: e.body || e.htmlBody || e.textBody,
              stepNumber: e.stepNumber,
            })),
            platformUrl: `https://app.reply.io/app/sequences/${sequence.id}/contacts?search=${encodeURIComponent(email)}`,
          });
        }
      } catch (error) {
        console.error(`Reply.io: Error checking sequence ${sequence.id}:`, error);
      }
    }
    
    return {
      platform: 'replyio',
      contact,
      sequences: sequencesWithEmails,
    };
  } catch (error) {
    console.error('Reply.io search error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { workspace_id, email } = await req.json();
    
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), {
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

    // Get SmartLead connection
    const { data: smartleadConnection } = await supabase
      .from('api_connections')
      .select('api_key_encrypted')
      .eq('workspace_id', workspace_id)
      .eq('platform', 'smartlead')
      .eq('is_active', true)
      .single();

    // Get Reply.io connection
    const { data: replyioConnection } = await supabase
      .from('api_connections')
      .select('api_key_encrypted')
      .eq('workspace_id', workspace_id)
      .eq('platform', 'replyio')
      .eq('is_active', true)
      .single();

    // Search both platforms in parallel
    const [smartleadResult, replyioResult] = await Promise.all([
      smartleadConnection?.api_key_encrypted 
        ? searchSmartlead(email, smartleadConnection.api_key_encrypted)
        : null,
      replyioConnection?.api_key_encrypted 
        ? searchReplyio(email, replyioConnection.api_key_encrypted)
        : null,
    ]);

    return new Response(JSON.stringify({
      success: true,
      email,
      smartlead: smartleadResult,
      replyio: replyioResult,
      hasSmartleadConnection: !!smartleadConnection,
      hasReplyioConnection: !!replyioConnection,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Contact search error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Search failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
