import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// DNS lookup via public DNS-over-HTTPS (DoH) services
async function lookupDNS(domain: string, type: 'TXT' | 'CNAME' | 'A'): Promise<string[]> {
  try {
    // Using Google's DNS-over-HTTPS API
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' },
    });
    
    if (!response.ok) {
      console.log(`DNS lookup failed for ${domain} (${type}): ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    if (!data.Answer) return [];
    
    return data.Answer.map((a: any) => a.data?.replace(/^"|"$/g, '') || '');
  } catch (error) {
    console.error(`DNS lookup error for ${domain}:`, error);
    return [];
  }
}

// Check SPF record
async function checkSPF(domain: string): Promise<{ valid: boolean; record: string | null }> {
  const records = await lookupDNS(domain, 'TXT');
  const spfRecord = records.find(r => r.toLowerCase().startsWith('v=spf1'));
  
  if (!spfRecord) {
    return { valid: false, record: null };
  }
  
  // Basic SPF validation - must have v=spf1 and end with -all, ~all, or ?all
  const hasValidEnding = /-all|~all|\?all/i.test(spfRecord);
  return { valid: !!spfRecord && hasValidEnding, record: spfRecord };
}

// Check DKIM record - try common selectors
async function checkDKIM(domain: string): Promise<{ valid: boolean; selector: string | null }> {
  // Common DKIM selectors used by email platforms
  const commonSelectors = [
    'google', 'selector1', 'selector2', 'k1', 'k2', 's1', 's2',
    'dkim', 'default', 'mail', 'smtp', 'email', 'mx', 'mta',
    'smartlead', 'replyio', 'sendgrid', 'mailgun', 'amazonses',
    'mandrill', 'postmark', 'sparkpost', 'mailchimp'
  ];
  
  for (const selector of commonSelectors) {
    const dkimDomain = `${selector}._domainkey.${domain}`;
    const records = await lookupDNS(dkimDomain, 'TXT');
    
    if (records.length > 0 && records.some(r => r.includes('v=DKIM1') || r.includes('k=rsa'))) {
      return { valid: true, selector };
    }
    
    // Also check CNAME records (some providers use CNAME for DKIM)
    const cnameRecords = await lookupDNS(dkimDomain, 'CNAME');
    if (cnameRecords.length > 0) {
      return { valid: true, selector };
    }
  }
  
  return { valid: false, selector: null };
}

// Check DMARC record
async function checkDMARC(domain: string): Promise<{ valid: boolean; record: string | null; policy: string | null }> {
  const dmarcDomain = `_dmarc.${domain}`;
  const records = await lookupDNS(dmarcDomain, 'TXT');
  const dmarcRecord = records.find(r => r.toLowerCase().startsWith('v=dmarc1'));
  
  if (!dmarcRecord) {
    return { valid: false, record: null, policy: null };
  }
  
  // Extract policy
  const policyMatch = dmarcRecord.match(/p=(\w+)/i);
  const policy = policyMatch ? policyMatch[1].toLowerCase() : null;
  
  // DMARC is valid if it has v=DMARC1 and a policy
  return { 
    valid: !!policy, 
    record: dmarcRecord,
    policy,
  };
}

// Calculate domain health score
function calculateDomainHealthScore(spfValid: boolean, dkimValid: boolean, dmarcValid: boolean, dmarcPolicy: string | null): number {
  let score = 0;
  
  // SPF: 30 points
  if (spfValid) score += 30;
  
  // DKIM: 35 points
  if (dkimValid) score += 35;
  
  // DMARC: 35 points (varies by policy)
  if (dmarcValid) {
    if (dmarcPolicy === 'reject') score += 35;
    else if (dmarcPolicy === 'quarantine') score += 30;
    else if (dmarcPolicy === 'none') score += 15;
    else score += 10;
  }
  
  return score;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify user auth
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl, 
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { workspace_id, domain, batch_size = 20 } = await req.json();
    
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: any[] = [];

    // If specific domain provided, check just that one
    if (domain) {
      console.log(`Checking single domain: ${domain}`);
      
      const spf = await checkSPF(domain);
      const dkim = await checkDKIM(domain);
      const dmarc = await checkDMARC(domain);
      const healthScore = calculateDomainHealthScore(spf.valid, dkim.valid, dmarc.valid, dmarc.policy);

      const { error: updateError } = await supabase
        .from('sending_domains')
        .upsert({
          workspace_id,
          domain,
          spf_valid: spf.valid,
          dkim_valid: dkim.valid,
          dmarc_valid: dmarc.valid,
          health_score: healthScore,
          last_checked_at: new Date().toISOString(),
        }, { onConflict: 'workspace_id,domain' });

      if (updateError) {
        console.error('Error updating domain:', updateError);
      }

      results.push({
        domain,
        spf: spf.valid,
        dkim: dkim.valid,
        dmarc: dmarc.valid,
        dmarc_policy: dmarc.policy,
        health_score: healthScore,
      });
    } else {
      // Batch check all domains that haven't been checked recently (or ever)
      console.log(`Batch checking domains for workspace ${workspace_id}`);
      
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: domains, error: fetchError } = await supabase
        .from('sending_domains')
        .select('domain')
        .eq('workspace_id', workspace_id)
        .or(`last_checked_at.is.null,last_checked_at.lt.${oneDayAgo}`)
        .limit(batch_size);

      if (fetchError) {
        throw new Error(`Error fetching domains: ${fetchError.message}`);
      }

      console.log(`Found ${domains?.length || 0} domains to check`);

      for (const d of domains || []) {
        try {
          console.log(`Checking: ${d.domain}`);
          
          const spf = await checkSPF(d.domain);
          await new Promise(r => setTimeout(r, 100)); // Rate limit
          
          const dkim = await checkDKIM(d.domain);
          await new Promise(r => setTimeout(r, 100));
          
          const dmarc = await checkDMARC(d.domain);
          const healthScore = calculateDomainHealthScore(spf.valid, dkim.valid, dmarc.valid, dmarc.policy);

          const { error: updateError } = await supabase
            .from('sending_domains')
            .update({
              spf_valid: spf.valid,
              dkim_valid: dkim.valid,
              dmarc_valid: dmarc.valid,
              health_score: healthScore,
              last_checked_at: new Date().toISOString(),
            })
            .eq('workspace_id', workspace_id)
            .eq('domain', d.domain);

          if (updateError) {
            console.error(`Error updating ${d.domain}:`, updateError);
          }

          results.push({
            domain: d.domain,
            spf: spf.valid,
            dkim: dkim.valid,
            dmarc: dmarc.valid,
            dmarc_policy: dmarc.policy,
            health_score: healthScore,
          });
        } catch (e) {
          console.error(`Error checking ${d.domain}:`, e);
          results.push({
            domain: d.domain,
            error: (e as Error).message,
          });
        }
      }
    }

    // Calculate summary stats
    const checked = results.filter(r => !r.error);
    const summary = {
      total_checked: checked.length,
      spf_valid: checked.filter(r => r.spf).length,
      dkim_valid: checked.filter(r => r.dkim).length,
      dmarc_valid: checked.filter(r => r.dmarc).length,
      avg_health_score: checked.length > 0 
        ? Math.round(checked.reduce((sum, r) => sum + (r.health_score || 0), 0) / checked.length)
        : 0,
    };

    return new Response(JSON.stringify({
      success: true,
      results,
      summary,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in check-domain-auth:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
