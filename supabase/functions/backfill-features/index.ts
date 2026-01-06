import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VariantToBackfill {
  id: string;
  campaign_id: string;
  subject_line: string | null;
  email_body: string | null;
  body_preview: string | null;
  workspace_id: string;
}

// Feature extraction functions (same as sync functions)
function extractSubjectFeatures(subject: string) {
  const words = subject.trim().split(/\s+/).filter(Boolean);
  const chars = subject.length;
  
  // Detect personalization
  const persMatches = subject.match(/\{\{[^}]+\}\}/g) || [];
  const persCount = persMatches.length;
  const firstPersPosition = persMatches.length > 0 && persMatches[0] ? subject.indexOf(persMatches[0]) : null;
  
  // Detect patterns
  const isQuestion = subject.trim().endsWith('?');
  const hasNumber = /\d/.test(subject);
  const hasEmoji = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(subject);
  
  // Capitalization style
  let capStyle = 'normal';
  if (subject === subject.toUpperCase() && subject.length > 3) capStyle = 'all_caps';
  else if (subject === subject.toLowerCase()) capStyle = 'all_lower';
  else if (/^[A-Z][a-z]/.test(subject)) capStyle = 'sentence_case';
  else if (words.every(w => /^[A-Z]/.test(w))) capStyle = 'title_case';
  
  // First word type
  const firstWord = words[0]?.toLowerCase() || '';
  let firstWordType = 'other';
  if (['quick', 'hey', 'hi', 'hello'].includes(firstWord)) firstWordType = 'greeting';
  else if (['re:', 'fwd:'].includes(firstWord)) firstWordType = 're_fwd';
  else if (['how', 'what', 'why', 'when', 'where', 'who', 'can', 'could', 'would', 'do', 'does', 'is', 'are'].includes(firstWord)) firstWordType = 'question_word';
  else if (/^\d/.test(firstWord)) firstWordType = 'number';
  else if (firstWord.startsWith('{{')) firstWordType = 'personalization';
  
  // Simple spam score (0-100)
  let spamScore = 0;
  const spamTriggers = ['free', 'guarantee', 'act now', 'limited time', 'urgent', '!!!', '$$$', 'click here', 'buy now'];
  spamTriggers.forEach(trigger => {
    if (subject.toLowerCase().includes(trigger)) spamScore += 15;
  });
  if (hasEmoji) spamScore += 5;
  if (capStyle === 'all_caps') spamScore += 20;
  spamScore = Math.min(100, spamScore);
  
  return {
    subject_char_count: chars,
    subject_word_count: words.length,
    subject_is_question: isQuestion,
    subject_has_number: hasNumber,
    subject_has_emoji: hasEmoji,
    subject_personalization_count: persCount,
    subject_personalization_position: firstPersPosition,
    subject_capitalization_style: capStyle,
    subject_first_word_type: firstWordType,
    subject_spam_score: spamScore,
  };
}

function extractBodyFeatures(body: string) {
  const cleanBody = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleanBody.split(/\s+/).filter(Boolean);
  const sentences = cleanBody.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = body.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // Personalization analysis
  const persMatches = body.match(/\{\{[^}]+\}\}/g) || [];
  const persTypes = [...new Set(persMatches.map(m => m.replace(/[{}]/g, '').toLowerCase()))];
  const persDensity = words.length > 0 ? persMatches.length / words.length : 0;
  
  // Link detection
  const linkMatches = body.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi) || [];
  const hasLink = linkMatches.length > 0;
  const hasCalendarLink = linkMatches.some(l => 
    /calendly|hubspot.*meetings|cal\.com|acuity|doodle|schedule|booking/i.test(l)
  );
  
  // CTA detection
  const lowerBody = body.toLowerCase();
  let ctaType = 'none';
  let ctaPosition = 'none';
  
  const ctaPatterns = {
    binary: /\b(tuesday|thursday|this week|next week)\b.*\b(or|vs)\b/i,
    calendar: /\b(calendly|cal\.com|book.*time|schedule.*call|grab.*slot)\b/i,
    meeting: /\b(15 min|30 min|quick call|hop on.*call|chat.*briefly|meeting)\b/i,
    permission: /\b(okay if|mind if|would it be okay|open to|interested in)\b/i,
    info: /\b(case study|send.*over|more info|learn more|details)\b/i,
    soft: /\b(thoughts|makes sense|worth|interest|curious)\b/i,
  };
  
  for (const [type, pattern] of Object.entries(ctaPatterns)) {
    if (pattern.test(lowerBody)) {
      ctaType = type;
      const match = lowerBody.match(pattern);
      if (match && match.index !== undefined) {
        const relPos = match.index / lowerBody.length;
        ctaPosition = relPos < 0.33 ? 'early' : relPos < 0.66 ? 'middle' : 'end';
      }
      break;
    }
  }
  
  // Tone detection
  let tone = 'professional';
  if (/\b(hey|awesome|cool|super|love)\b/i.test(lowerBody)) tone = 'casual';
  else if (/\b(dear|sincerely|respectfully|regards)\b/i.test(lowerBody)) tone = 'formal';
  else if (/\b(straight|directly|frankly|honestly|bottom line)\b/i.test(lowerBody)) tone = 'direct';
  
  // Reading grade (simplified Flesch-Kincaid)
  const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgSyllablesPerWord = words.length > 0 ? syllables / words.length : 0;
  const readingGrade = Math.max(0, 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59);
  
  // Social proof detection
  const hasProof = /\b(case study|testimonial|results|achieved|increased|grew|helped.*companies|clients like|similar to)\b/i.test(lowerBody);
  
  // Question count
  const questionCount = (body.match(/\?/g) || []).length;
  
  // Bullet points
  const bulletCount = (body.match(/^[\s]*[-•*]\s/gm) || []).length;
  
  return {
    body_word_count: words.length,
    body_sentence_count: sentences.length,
    body_paragraph_count: paragraphs.length,
    body_avg_sentence_length: avgWordsPerSentence,
    body_question_count: questionCount,
    body_bullet_point_count: bulletCount,
    body_has_link: hasLink,
    body_link_count: linkMatches.length,
    body_has_calendar_link: hasCalendarLink,
    body_cta_type: ctaType,
    body_cta_position: ctaPosition,
    body_tone: tone,
    body_reading_grade: Math.round(readingGrade * 10) / 10,
    body_personalization_density: Math.round(persDensity * 1000) / 1000,
    body_personalization_types: persTypes,
    body_has_proof: hasProof,
  };
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspace_id, batch_size = 100 } = await req.json();
    
    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Backfilling features for workspace: ${workspace_id}, batch_size: ${batch_size}`);

    // Find variants without features
    const { data: existingFeatures, error: featError } = await supabase
      .from('campaign_variant_features')
      .select('variant_id')
      .eq('workspace_id', workspace_id);

    if (featError) throw featError;

    const existingVariantIds = new Set((existingFeatures || []).map(f => f.variant_id));

    // Get variants that need features extracted
    const { data: variants, error: variantsError } = await supabase
      .from('campaign_variants')
      .select(`
        id,
        campaign_id,
        subject_line,
        email_body,
        body_preview,
        campaigns!inner (
          workspace_id
        )
      `)
      .eq('campaigns.workspace_id', workspace_id);

    if (variantsError) throw variantsError;

    // Filter to variants without features
    const variantsToBackfill: VariantToBackfill[] = (variants || [])
      .filter(v => !existingVariantIds.has(v.id))
      .filter(v => v.subject_line || v.email_body || v.body_preview)
      .map(v => ({
        id: v.id,
        campaign_id: v.campaign_id,
        subject_line: v.subject_line,
        email_body: v.email_body,
        body_preview: v.body_preview,
        workspace_id: workspace_id,
      }))
      .slice(0, batch_size);

    console.log(`Found ${variantsToBackfill.length} variants to backfill (of ${variants?.length || 0} total)`);

    if (variantsToBackfill.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All variants already have features extracted',
          backfilled: 0,
          remaining: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract features for each variant
    const featuresToInsert = variantsToBackfill.map(variant => {
      const subjectFeatures = variant.subject_line 
        ? extractSubjectFeatures(variant.subject_line)
        : {};
      
      const body = variant.email_body || variant.body_preview || '';
      const bodyFeatures = body ? extractBodyFeatures(body) : {};
      
      return {
        variant_id: variant.id,
        workspace_id: variant.workspace_id,
        ...subjectFeatures,
        ...bodyFeatures,
        extracted_at: new Date().toISOString(),
      };
    });

    // Insert features
    const { error: insertError } = await supabase
      .from('campaign_variant_features')
      .insert(featuresToInsert);

    if (insertError) {
      console.error('Error inserting features:', insertError);
      throw insertError;
    }

    // Check remaining
    const totalVariants = (variants || []).filter(v => v.subject_line || v.email_body || v.body_preview).length;
    const remaining = totalVariants - existingVariantIds.size - variantsToBackfill.length;

    console.log(`Backfilled ${variantsToBackfill.length} variants, ${remaining} remaining`);

    return new Response(
      JSON.stringify({
        success: true,
        backfilled: variantsToBackfill.length,
        remaining: Math.max(0, remaining),
        message: remaining > 0 
          ? `Backfilled ${variantsToBackfill.length} variants. ${remaining} remaining - call again to continue.`
          : `Backfill complete! Processed ${variantsToBackfill.length} variants.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error backfilling features:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});