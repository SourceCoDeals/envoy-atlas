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
    
    // Step 1: Fetch all sequences
    let allSequences: any[] = [];
    let hasMoreSequences = true;
    let skip = 0;
    
    while (hasMoreSequences) {
      const response = await replyioRequest(`/sequences?top=100&skip=${skip}`, apiKey);
      
      // Handle various response formats
      let sequences: any[] = [];
      const normalized = response?.response ?? response;
      if (Array.isArray(normalized)) {
        sequences = normalized;
      } else if (normalized?.sequences && Array.isArray(normalized.sequences)) {
        sequences = normalized.sequences;
      } else if (normalized?.items && Array.isArray(normalized.items)) {
        sequences = normalized.items;
      }
      
      if (sequences.length === 0) {
        hasMoreSequences = false;
      } else {
        allSequences = allSequences.concat(sequences);
        skip += sequences.length;
        hasMoreSequences = sequences.length >= 100;
      }
    }
    
    console.log(`Reply.io: Found ${allSequences.length} sequences to search`);
    
    if (allSequences.length === 0) {
      return null;
    }
    
    // Step 2: Search each sequence for the contact
    const foundSequences: ReplyioResult['sequences'] = [];
    let contactInfo: any = null;
    
    for (const sequence of allSequences) {
      try {
        // Try extended endpoint first, fallback to regular
        let contactsResponse: any;
        try {
          contactsResponse = await replyioRequest(
            `/sequences/${sequence.id}/contacts/extended?email=${encodeURIComponent(email)}`,
            apiKey
          );
        } catch (e) {
          const msg = (e as Error).message || '';
          if (msg.includes('API error 404') || msg.includes('API error 400')) {
            // Try without extended and search through results
            contactsResponse = await replyioRequest(
              `/sequences/${sequence.id}/contacts?top=100&skip=0`,
              apiKey
            );
          } else {
            throw e;
          }
        }
        
        const normalizedContacts = contactsResponse?.response ?? contactsResponse;
        let contacts = normalizedContacts?.items || normalizedContacts || [];
        
        if (!Array.isArray(contacts)) {
          contacts = [];
        }
        
        // Find contact by email
        const matchingContact = contacts.find((c: any) => 
          c.email?.toLowerCase() === email.toLowerCase()
        );
        
        if (matchingContact) {
          console.log(`Reply.io: Found contact in sequence: ${sequence.name}`);
          
          if (!contactInfo) {
            contactInfo = {
              id: matchingContact.id || matchingContact.personId,
              email: matchingContact.email,
              firstName: matchingContact.firstName,
              lastName: matchingContact.lastName,
              company: matchingContact.company,
            };
          }
          
          // Get email activities for this contact in this sequence
          let emailActivities: any[] = [];
          try {
            // Try to get emails from the contact status/activities
            const contactStatus = matchingContact.status || {};
            const sent = contactStatus.sent || 0;
            const replied = contactStatus.replied || contactStatus.repliedContacts > 0;
            
            // The contact data from sequence often includes lastEmailSent, lastEmailOpened, etc.
            const messages: any[] = [];
            
            // Add sent emails info if available
            if (matchingContact.lastEmailSent) {
              messages.push({
                id: 1,
                type: 'SENT',
                date: matchingContact.lastEmailSent,
                subject: matchingContact.lastEmailSubject || 'Email sent',
                body: matchingContact.lastEmailBody || '',
                stepNumber: matchingContact.currentStep || 1,
              });
            }
            
            // Check if replied
            const hasReplied = replied || 
                             matchingContact.replied === true || 
                             contactStatus.status === 'Replied' ||
                             matchingContact.status?.status === 'Replied';
            
            if (hasReplied && matchingContact.lastReplyDate) {
              messages.push({
                id: 2,
                type: 'REPLY',
                date: matchingContact.lastReplyDate,
                subject: 'Re: ' + (matchingContact.lastEmailSubject || ''),
                body: matchingContact.lastReplyBody || matchingContact.replyBody || '[Reply content not available via API]',
                stepNumber: matchingContact.currentStep || 1,
              });
            }
            
            emailActivities = messages;
            
            foundSequences.push({
              id: sequence.id,
              name: sequence.name,
              status: sequence.status || 'active',
              hasReply: hasReplied,
              emails: emailActivities,
              platformUrl: `https://run.reply.io/app/sequences/${sequence.id}/contacts?search=${encodeURIComponent(email)}`,
            });
          } catch (emailError) {
            console.error(`Reply.io: Error fetching emails for contact in sequence ${sequence.id}:`, emailError);
            foundSequences.push({
              id: sequence.id,
              name: sequence.name,
              status: sequence.status || 'active',
              hasReply: false,
              emails: [],
              platformUrl: `https://run.reply.io/app/sequences/${sequence.id}/contacts?search=${encodeURIComponent(email)}`,
            });
          }
        }
      } catch (seqError) {
        console.error(`Reply.io: Error searching sequence ${sequence.id}:`, seqError);
        // Continue to next sequence
      }
    }
    
    if (!contactInfo) {
      console.log('Reply.io: No contact found in any sequence for email:', email);
      return null;
    }
    
    console.log(`Reply.io: Contact found in ${foundSequences.length} sequences`);
    
    return {
      platform: 'replyio',
      contact: contactInfo,
      sequences: foundSequences,
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
