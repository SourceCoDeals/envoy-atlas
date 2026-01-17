import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Seniority classification
function classifySeniority(title: string | null | undefined): string {
  if (!title) return 'unknown';
  
  const lower = title.toLowerCase().trim();
  
  if (/\b(ceo|cfo|cto|coo|cmo|cio|ciso|cpo|cro|chief|founder|co-founder|cofounder|owner|president|chairman)\b/.test(lower)) {
    return 'c_level';
  }
  if (/\b(vp|v\.p\.|vice\s*president|svp|evp|gvp|avp)\b/.test(lower)) {
    return 'vp';
  }
  if (/\b(director|head\s+of|dir\.|group\s+head)\b/.test(lower)) {
    return 'director';
  }
  if (/\b(manager|mgr|lead|supervisor|team\s+lead|coordinator)\b/.test(lower)) {
    return 'manager';
  }
  if (/\b(senior|sr\.|principal|staff|architect|fellow)\b/.test(lower)) {
    return 'senior_ic';
  }
  if (lower.length > 2) {
    return 'ic';
  }
  return 'unknown';
}

// Department classification
function classifyDepartment(title: string | null | undefined): string {
  if (!title) return 'other';
  
  const lower = title.toLowerCase().trim();
  
  if (/\b(ceo|coo|founder|co-founder|cofounder|owner|president|chairman)\b/.test(lower)) {
    return 'executive';
  }
  if (/\b(sales|account\s+executive|ae|sdr|bdr|business\s+development|revenue|commercial|deals)\b/.test(lower)) {
    return 'sales';
  }
  if (/\b(marketing|growth|demand\s+gen|content|brand|communications|pr|public\s+relations|cmo)\b/.test(lower)) {
    return 'marketing';
  }
  if (/\b(engineer|developer|dev|software|swe|backend|frontend|fullstack|devops|sre|cto|architect|programmer|coding)\b/.test(lower)) {
    return 'engineering';
  }
  if (/\b(product|pm|cpo|product\s+management|ux|ui|design|user\s+experience)\b/.test(lower)) {
    return 'product';
  }
  if (/\b(operations|ops|supply\s+chain|logistics|procurement|coo)\b/.test(lower)) {
    return 'operations';
  }
  if (/\b(hr|human\s+resources|people|talent|recruiting|recruiter|chro)\b/.test(lower)) {
    return 'hr';
  }
  if (/\b(finance|financial|cfo|accounting|accountant|controller|treasury|fp&a)\b/.test(lower)) {
    return 'finance';
  }
  if (/\b(legal|counsel|attorney|lawyer|compliance|regulatory|clo)\b/.test(lower)) {
    return 'legal';
  }
  if (/\b(customer\s+success|cs|csm|client\s+success|customer\s+experience|cx|support)\b/.test(lower)) {
    return 'customer_success';
  }
  return 'other';
}

// Company size classification
function classifyCompanySize(size: string | number | null | undefined): string {
  if (size === null || size === undefined) return 'unknown';
  
  let employees: number | null = null;
  
  if (typeof size === 'number') {
    employees = size;
  } else if (typeof size === 'string') {
    const lower = size.toLowerCase().trim();
    const rangeMatch = lower.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1]);
      const max = parseInt(rangeMatch[2]);
      employees = Math.round((min + max) / 2);
    } else {
      const numMatch = lower.match(/(\d+)/);
      if (numMatch) {
        employees = parseInt(numMatch[1]);
      } else {
        if (/\b(small|startup|micro)\b/.test(lower)) return 'smb';
        if (/\b(mid|medium)\b/.test(lower)) return 'upper_mid';
        if (/\b(enterprise|large)\b/.test(lower)) return 'enterprise';
      }
    }
  }
  
  if (employees === null) return 'unknown';
  
  if (employees <= 50) return 'smb';
  if (employees <= 200) return 'lower_mid';
  if (employees <= 1000) return 'upper_mid';
  if (employees <= 5000) return 'enterprise';
  return 'large_enterprise';
}

// Extract email domain
function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : null;
}

// Classify email type
function classifyEmailType(email: string | null | undefined): string {
  if (!email) return 'unknown';
  
  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return 'unknown';
  
  const personalDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'me.com', 'mac.com', 'live.com', 'msn.com',
    'protonmail.com', 'mail.com', 'ymail.com', 'inbox.com',
    'zoho.com', 'fastmail.com', 'tutanota.com',
  ];
  
  if (personalDomains.includes(domain)) return 'personal';
  return 'work';
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { workspace_id, batch_size = 500, force = false } = await req.json();

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: 'workspace_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting lead enrichment for workspace ${workspace_id}, batch_size: ${batch_size}, force: ${force}`);

    // Get leads that need enrichment - check for email_type being null OR enriched_at being null
    let query = supabase
      .from('leads')
      .select('id, title, email, company_size, email_type, email_domain')
      .eq('workspace_id', workspace_id)
      .limit(batch_size);

    // Only get unenriched leads unless force is true
    // Check for null email_type OR null enriched_at (some leads may have partial enrichment)
    if (!force) {
      query = query.or('enriched_at.is.null,email_type.is.null');
    }

    const { data: leads, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching leads:', fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!leads || leads.length === 0) {
      console.log('No leads to enrich');
      return new Response(
        JSON.stringify({ 
          success: true, 
          enriched: 0, 
          message: 'No leads to enrich' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${leads.length} leads to enrich`);

    // Process leads - always classify email type/domain even if title is null
    const enrichedLeads = leads.map(lead => ({
      id: lead.id,
      seniority_level: lead.title ? classifySeniority(lead.title) : 'unknown',
      department: lead.title ? classifyDepartment(lead.title) : 'other',
      company_size_category: lead.company_size ? classifyCompanySize(lead.company_size) : 'unknown',
      email_type: classifyEmailType(lead.email), // Always classify from email
      email_domain: extractEmailDomain(lead.email), // Always extract domain
      enriched_at: new Date().toISOString(),
    }));

    // Update leads in batches
    let updatedCount = 0;
    const updateBatchSize = 100;
    
    for (let i = 0; i < enrichedLeads.length; i += updateBatchSize) {
      const batch = enrichedLeads.slice(i, i + updateBatchSize);
      
      for (const lead of batch) {
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            seniority_level: lead.seniority_level,
            department: lead.department,
            company_size_category: lead.company_size_category,
            email_type: lead.email_type,
            email_domain: lead.email_domain,
            enriched_at: lead.enriched_at,
          })
          .eq('id', lead.id);

        if (updateError) {
          console.error(`Error updating lead ${lead.id}:`, updateError);
        } else {
          updatedCount++;
        }
      }
    }

    // Get stats
    const { count: totalLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id);

    const { count: enrichedTotal } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id)
      .not('enriched_at', 'is', null);

    // Get breakdown by seniority
    const { data: seniorityBreakdown } = await supabase
      .from('leads')
      .select('seniority_level')
      .eq('workspace_id', workspace_id)
      .not('seniority_level', 'is', null);

    const seniorityStats = seniorityBreakdown?.reduce((acc, lead) => {
      acc[lead.seniority_level] = (acc[lead.seniority_level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    console.log(`Enrichment complete. Updated ${updatedCount} leads`);

    return new Response(
      JSON.stringify({
        success: true,
        enriched: updatedCount,
        total_leads: totalLeads,
        total_enriched: enrichedTotal,
        remaining: (totalLeads || 0) - (enrichedTotal || 0),
        seniority_breakdown: seniorityStats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Enrichment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
