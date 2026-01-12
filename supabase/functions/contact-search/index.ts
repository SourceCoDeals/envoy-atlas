import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMARTLEAD_BASE_URL = 'https://server.smartlead.ai/api/v1';
const REPLYIO_BASE_URL_V1 = 'https://api.reply.io/v1';
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
    isSequenceOwner: boolean;
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

async function replyioRequestV1(endpoint: string, apiKey: string): Promise<any> {
  // No rate limit delay for v1 people endpoints - they have no throttling
  const response = await fetch(`${REPLYIO_BASE_URL_V1}${endpoint}`, {
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
          
          const historyArray = history?.history || [];
          
          // Check for replies - SmartLead uses 'REPLY' or 'reply' type
          const hasReply = historyArray.some((msg: any) => 
            msg.type?.toUpperCase() === 'REPLY' || 
            msg.type?.toLowerCase() === 'received' ||
            msg.type?.toLowerCase() === 'inbound'
          );
          
          console.log(`SmartLead: Campaign ${campaign.name} - ${historyArray.length} messages, hasReply: ${hasReply}`);
          
          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status || 'unknown',
            hasReply,
            messageHistory: historyArray.map((msg: any) => ({
              id: msg.id || Math.random(),
              type: msg.type?.toUpperCase() === 'REPLY' || 
                    msg.type?.toLowerCase() === 'received' || 
                    msg.type?.toLowerCase() === 'inbound' 
                    ? 'REPLY' : 'SENT',
              time: msg.time || msg.created_at || msg.timestamp,
              email_body: msg.email_body || msg.body || msg.content || msg.message,
              email_subject: msg.email_subject || msg.subject,
              seq_number: msg.seq_number || msg.step_number || msg.sequence_number,
            })),
            // Updated URL format for SmartLead
            platformUrl: `https://app.smartlead.ai/app/email-campaign/${campaign.id}/leads/${lead.id}`,
          };
        } catch (error) {
          console.error(`SmartLead: Error fetching history for campaign ${campaign.id}:`, error);
          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status || 'unknown',
            hasReply: false,
            messageHistory: [],
            platformUrl: `https://app.smartlead.ai/app/email-campaign/${campaign.id}/leads/${lead.id}`,
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
    console.log('Reply.io: Starting search for email:', email);
    
    // Step 1: Get contact by email using v1 API (no throttling)
    // Endpoint: GET https://api.reply.io/v1/people?email={email}
    let contact: any;
    try {
      contact = await replyioRequestV1(`/people?email=${encodeURIComponent(email)}`, apiKey);
    } catch (error) {
      const msg = (error as Error).message || '';
      if (msg.includes('404')) {
        console.log('Reply.io: No contact found for email:', email);
        return null;
      }
      throw error;
    }
    
    if (!contact || !contact.id) {
      console.log('Reply.io: No contact found for email:', email);
      return null;
    }
    
    console.log('Reply.io: Found contact with ID:', contact.id);
    
    const contactInfo = {
      id: contact.id,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      company: contact.company,
      title: contact.title,
      phone: contact.phone,
    };
    
    // Step 2: Get list of campaigns/sequences for this contact using v1 API (no throttling)
    // Endpoint: GET https://api.reply.io/v1/people/{contactId}/sequences
    let sequences: any[] = [];
    try {
      const sequencesResponse = await replyioRequestV1(`/people/${contact.id}/sequences`, apiKey);
      sequences = Array.isArray(sequencesResponse) ? sequencesResponse : [];
      console.log(`Reply.io: Contact is in ${sequences.length} sequences`);
    } catch (error) {
      console.error('Reply.io: Error fetching sequences for contact:', error);
      sequences = [];
    }
    
    if (sequences.length === 0) {
      return {
        platform: 'replyio',
        contact: contactInfo,
        sequences: [],
      };
    }
    
    // Step 3: For each sequence, check for reply status and get details
    const sequencesWithDetails: ReplyioResult['sequences'] = [];
    
    for (const seq of sequences) {
      try {
        // The sequence response includes: sequenceId, sequenceName, status, isSequenceOwner
        const hasReply = seq.status?.toLowerCase() === 'replied';
        
        // Try to get contact status in campaign for more details (10-second throttle but useful)
        // We'll use the status field from sequences response instead to avoid throttling
        
        const emails: any[] = [];
        
        // Add placeholder for sent emails based on status
        if (seq.status) {
          emails.push({
            id: 1,
            type: 'SENT',
            date: new Date().toISOString(),
            subject: 'Email sent in sequence',
            body: '[View full conversation on Reply.io platform]',
            stepNumber: 1,
          });
        }
        
        // Add reply indicator if they replied
        if (hasReply) {
          emails.push({
            id: 2,
            type: 'REPLY',
            date: new Date().toISOString(),
            subject: 'Contact replied',
            body: '[View reply content on Reply.io platform]',
            stepNumber: 1,
          });
        }
        
        sequencesWithDetails.push({
          id: seq.sequenceId,
          name: seq.sequenceName,
          status: seq.status || 'unknown',
          hasReply,
          isSequenceOwner: seq.isSequenceOwner || false,
          emails,
          platformUrl: `https://run.reply.io/app/sequences/${seq.sequenceId}/contacts?search=${encodeURIComponent(email)}`,
        });
        
        console.log(`Reply.io: Sequence "${seq.sequenceName}" - status: ${seq.status}, hasReply: ${hasReply}`);
      } catch (seqError) {
        console.error(`Reply.io: Error processing sequence ${seq.sequenceId}:`, seqError);
        sequencesWithDetails.push({
          id: seq.sequenceId,
          name: seq.sequenceName,
          status: seq.status || 'unknown',
          hasReply: false,
          isSequenceOwner: seq.isSequenceOwner || false,
          emails: [],
          platformUrl: `https://run.reply.io/app/sequences/${seq.sequenceId}/contacts?search=${encodeURIComponent(email)}`,
        });
      }
    }
    
    return {
      platform: 'replyio',
      contact: contactInfo,
      sequences: sequencesWithDetails,
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

    console.log(`Searching for email: ${email}`);
    console.log(`SmartLead connected: ${!!smartleadConnection}`);
    console.log(`Reply.io connected: ${!!replyioConnection}`);

    // Search both platforms in parallel
    const [smartleadResult, replyioResult] = await Promise.all([
      smartleadConnection?.api_key_encrypted 
        ? searchSmartlead(email, smartleadConnection.api_key_encrypted)
        : null,
      replyioConnection?.api_key_encrypted 
        ? searchReplyio(email, replyioConnection.api_key_encrypted)
        : null,
    ]);

    console.log(`SmartLead result: ${smartleadResult ? 'found' : 'not found'}`);
    console.log(`Reply.io result: ${replyioResult ? 'found' : 'not found'}`);

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
