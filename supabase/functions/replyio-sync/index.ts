import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REPLYIO_BASE_URL = 'https://api.reply.io/v3';
const RATE_LIMIT_DELAY = 300;
const TIME_BUDGET_MS = 45000;
const SYNC_LOCK_TIMEOUT_MS = 30000;

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
  'gmx.com', 'live.com', 'msn.com', 'me.com', 'inbox.com'
]);

const SPAM_TRIGGERS = [
  'free', 'guarantee', 'no obligation', 'winner', 'cash', 'urgent',
  'act now', 'limited time', 'exclusive deal', 'click here', 'buy now'
];

function classifyEmailType(email: string): 'personal' | 'work' {
  const domain = email.split('@')[1]?.toLowerCase();
  return PERSONAL_DOMAINS.has(domain) ? 'personal' : 'work';
}

function extractEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

function mapSequenceStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'Active': 'active', 'Paused': 'paused', 'Stopped': 'stopped', 'Draft': 'draft',
  };
  return statusMap[status] || status.toLowerCase();
}

function extractCopyFeatures(subjectLine: string | null, emailBody: string | null) {
  const subject = subjectLine || '';
  const body = emailBody || '';
  
  const subjectWords = subject.split(/\s+/).filter(Boolean);
  const subjectTokens = [...subject.matchAll(/\{\{?(\w+)\}?\}/g)];
  const bodyClean = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const bodyWords = bodyClean.split(/\s+/).filter(Boolean);
  const sentences = bodyClean.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const bodyTokens = [...body.matchAll(/\{\{?(\w+)\}?\}/g)];
  
  const avgSentenceLength = sentences.length > 0 ? bodyWords.length / sentences.length : 0;
  const avgWordLength = bodyWords.length > 0 ? bodyClean.replace(/\s/g, '').length / bodyWords.length : 0;
  const readingGrade = Math.max(0, Math.min(18, 0.39 * avgSentenceLength + 11.8 * (avgWordLength / 5) - 15.59));
  
  return {
    subject_char_count: subject.length,
    subject_word_count: subjectWords.length,
    subject_is_question: subject.trim().endsWith('?'),
    subject_has_number: /\d/.test(subject),
    subject_has_emoji: /[\u{1F300}-\u{1F9FF}]/u.test(subject),
    subject_personalization_count: subjectTokens.length,
    subject_spam_score: Math.min(100, SPAM_TRIGGERS.filter(t => subject.toLowerCase().includes(t)).length * 15),
    body_word_count: bodyWords.length,
    body_sentence_count: sentences.length,
    body_avg_sentence_length: Number(avgSentenceLength.toFixed(2)),
    body_reading_grade: Number(readingGrade.toFixed(2)),
    body_personalization_density: bodyWords.length > 0 ? Number((bodyTokens.length / bodyWords.length).toFixed(4)) : 0,
    body_personalization_types: [...new Set(bodyTokens.map(m => m[1].toLowerCase()))],
    body_has_link: (body.match(/https?:\/\//g) || []).length > 0,
    body_link_count: (body.match(/https?:\/\/[^\s<]+/g) || []).length,
    body_question_count: (body.match(/\?/g) || []).length,
    body_paragraph_count: body.split(/\n\s*\n/).filter(p => p.trim()).length,
  };
}

async function upsertVariantFeatures(supabase: any, variantId: string, workspaceId: string, subjectLine: string | null, emailBody: string | null) {
  const features = extractCopyFeatures(subjectLine, emailBody);
  await supabase.from('replyio_variant_features').upsert({
    variant_id: variantId, workspace_id: workspaceId, ...features, extracted_at: new Date().toISOString(),
  }, { onConflict: 'variant_id' });
}

interface SyncProgress {
  step: 'email_accounts' | 'sequences' | 'contacts' | 'complete';
  sequence_index: number;
  total_sequences: number;
  processed_sequences: number;
  last_heartbeat: string;
  errors: string[];
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function replyioRequest(endpoint: string, apiKey: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await delay(RATE_LIMIT_DELAY);
      const response = await fetch(`${REPLYIO_BASE_URL}${endpoint}`, {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      });
      if (response.status === 429) { await delay(2000 * (attempt + 1)); continue; }
      if (!response.ok) throw new Error(`Reply.io API error ${response.status}`);
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await delay(1000 * (attempt + 1));
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();
  
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, 
      { global: { headers: { Authorization: authHeader } } }).auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { workspace_id, reset = false, force_advance = false } = await req.json();
    if (!workspace_id) return new Response(JSON.stringify({ error: 'Missing workspace_id' }), { status: 400, headers: corsHeaders });

    const { data: connection } = await supabase.from('api_connections').select('*')
      .eq('workspace_id', workspace_id).eq('platform', 'replyio').eq('is_active', true).single();
    if (!connection) return new Response(JSON.stringify({ error: 'No Reply.io connection' }), { status: 404, headers: corsHeaders });

    const apiKey = connection.api_key_encrypted;

    // Handle reset
    if (reset) {
      const { data: campaigns } = await supabase.from('replyio_campaigns').select('id').eq('workspace_id', workspace_id);
      const campaignIds = campaigns?.map(c => c.id) || [];
      if (campaignIds.length > 0) {
        await supabase.from('replyio_daily_metrics').delete().eq('workspace_id', workspace_id);
        await supabase.from('replyio_message_events').delete().eq('workspace_id', workspace_id);
        await supabase.from('replyio_variant_features').delete().eq('workspace_id', workspace_id);
        await supabase.from('replyio_variants').delete().in('campaign_id', campaignIds);
        await supabase.from('replyio_sequence_steps').delete().in('campaign_id', campaignIds);
        await supabase.from('replyio_campaigns').delete().eq('workspace_id', workspace_id);
      }
      await supabase.from('leads').delete().eq('workspace_id', workspace_id).eq('platform', 'replyio');
      await supabase.from('email_accounts').delete().eq('workspace_id', workspace_id).eq('platform', 'replyio');
    }

    let progress: SyncProgress = { step: 'email_accounts', sequence_index: 0, total_sequences: 0, processed_sequences: 0, last_heartbeat: new Date().toISOString(), errors: [] };
    await supabase.from('api_connections').update({ sync_status: 'syncing', sync_progress: progress }).eq('id', connection.id);

    const checkTimeBudget = () => Date.now() - startTime > TIME_BUDGET_MS;

    // Step 1: Email Accounts
    if (progress.step === 'email_accounts') {
      try {
        const emailAccounts = await replyioRequest('/email-accounts', apiKey);
        if (Array.isArray(emailAccounts)) {
          for (const account of emailAccounts) {
            await supabase.from('email_accounts').upsert({
              workspace_id, platform: 'replyio', platform_id: String(account.id),
              email_address: account.email, sender_name: account.senderName || null, is_active: true,
            }, { onConflict: 'workspace_id,platform,platform_id' });
          }
        }
      } catch (e) { progress.errors.push(`Email accounts: ${(e as Error).message}`); }
      progress.step = 'sequences';
    }

    // Step 2: Sequences
    if (progress.step === 'sequences') {
      let allSequences: any[] = [];
      let skip = 0;
      while (true) {
        const response = await replyioRequest(`/sequences?top=100&skip=${skip}`, apiKey);
        const sequences = Array.isArray(response) ? response : (response?.sequences || response?.items || []);
        if (sequences.length === 0) break;
        allSequences = allSequences.concat(sequences);
        skip += sequences.length;
        if (sequences.length < 100 || checkTimeBudget()) break;
      }
      
      allSequences = allSequences.filter(s => !s.isArchived);
      progress.total_sequences = allSequences.length;

      for (let i = progress.sequence_index; i < allSequences.length; i++) {
        if (checkTimeBudget()) {
          progress.sequence_index = i;
          await supabase.from('api_connections').update({ sync_progress: progress }).eq('id', connection.id);
          return new Response(JSON.stringify({ success: true, complete: false, progress }), { headers: corsHeaders });
        }

        const sequence = allSequences[i];
        try {
          const { data: campaign } = await supabase.from('replyio_campaigns').upsert({
            workspace_id, platform_id: String(sequence.id), name: sequence.name,
            status: mapSequenceStatus(sequence.status),
          }, { onConflict: 'workspace_id,platform_id' }).select('id').single();
          
          const campaignId = campaign?.id;
          if (!campaignId) continue;

          // Sync steps and variants
          try {
            const steps = await replyioRequest(`/sequences/${sequence.id}/steps`, apiKey);
            if (Array.isArray(steps)) {
              for (const step of steps) {
                await supabase.from('replyio_sequence_steps').upsert({
                  campaign_id: campaignId, step_number: step.number || 1,
                  delay_days: Math.floor((step.delayInMinutes || 0) / 1440),
                }, { onConflict: 'campaign_id,step_number' });
                
                if (step.templates) {
                  for (let ti = 0; ti < step.templates.length; ti++) {
                    const t = step.templates[ti];
                    const { data: v } = await supabase.from('replyio_variants').upsert({
                      campaign_id: campaignId, platform_variant_id: String(t.id || t.templateId),
                      name: `Step ${step.number} - Var ${String.fromCharCode(65 + ti)}`,
                      variant_type: 'email', subject_line: t.subject, email_body: t.body,
                      body_preview: t.body?.substring(0, 200), is_control: ti === 0,
                    }, { onConflict: 'campaign_id,platform_variant_id' }).select('id').single();
                    if (v?.id) await upsertVariantFeatures(supabase, v.id, workspace_id, t.subject, t.body);
                  }
                }
              }
            }
          } catch (e) { console.error('Steps error:', e); }

          // Sync stats
          try {
            const stats = await replyioRequest(`/statistics/sequences/${sequence.id}`, apiKey);
            if (stats) {
              const today = new Date().toISOString().split('T')[0];
              await supabase.from('replyio_daily_metrics').upsert({
                workspace_id, campaign_id: campaignId, metric_date: today,
                sent_count: stats.deliveredContacts || 0, replied_count: stats.repliedContacts || 0,
                positive_reply_count: stats.interestedContacts || 0,
              }, { onConflict: 'campaign_id,metric_date' });
            }
          } catch (e) { console.error('Stats error:', e); }

          // Sync contacts
          try {
            let contactSkip = 0;
            while (!checkTimeBudget()) {
              let contactsResponse;
              try {
                contactsResponse = await replyioRequest(`/sequences/${sequence.id}/contacts/extended?top=50&skip=${contactSkip}`, apiKey);
              } catch {
                contactsResponse = await replyioRequest(`/sequences/${sequence.id}/contacts?top=50&skip=${contactSkip}`, apiKey);
              }
              const contacts = contactsResponse?.items || contactsResponse || [];
              if (!Array.isArray(contacts) || contacts.length === 0) break;
              
              await supabase.from('leads').upsert(contacts.map((c: any) => ({
                workspace_id, platform: 'replyio', platform_lead_id: c.email,
                email: c.email, first_name: c.firstName, last_name: c.lastName,
                title: c.title, email_domain: extractEmailDomain(c.email),
                email_type: classifyEmailType(c.email),
              })), { onConflict: 'workspace_id,platform,platform_lead_id' });
              
              contactSkip += contacts.length;
              if (contacts.length < 50) break;
            }
          } catch (e) { console.error('Contacts error:', e); }

        } catch (e) { progress.errors.push(`Sequence ${sequence.name}: ${(e as Error).message}`); }
        progress.processed_sequences = i + 1;
      }
      progress.step = 'complete';
    }

    // Complete
    await supabase.from('api_connections').update({
      sync_status: 'completed', sync_progress: progress,
      last_sync_at: new Date().toISOString(), last_full_sync_at: new Date().toISOString(),
    }).eq('id', connection.id);

    return new Response(JSON.stringify({ success: true, complete: true, progress }), { headers: corsHeaders });

  } catch (error) {
    console.error('Reply.io sync error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: corsHeaders });
  }
});
