import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VariantToBackfill {
  id: string;
  campaign_id: string;
  subject_line: string | null;
  body_plain: string | null;
  body_html: string | null;
  body_preview: string | null;
  engagement_id: string;
}

// Feature extraction functions
function extractSubjectFeatures(subject: string) {
  const words = subject.trim().split(/\s+/).filter(Boolean);
  const chars = subject.length;
  
  // Detect personalization
  const persMatches = subject.match(/\{\{[^}]+\}\}/g) || [];
  const persCount = persMatches.length;
  
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
  
  // Subject format detection
  let subjectFormat = 'statement';
  if (isQuestion) subjectFormat = 'question';
  else if (firstWord === 're:' || firstWord === 'fwd:') subjectFormat = 're_fwd';
  else if (persCount > 0) subjectFormat = 'personalized';
  
  // Punctuation analysis
  let punctuation = 'none';
  const lastChar = subject.trim().slice(-1);
  if (lastChar === '?') punctuation = 'question';
  else if (lastChar === '!') punctuation = 'exclamation';
  else if (lastChar === '.') punctuation = 'period';
  else if (lastChar === '...') punctuation = 'ellipsis';
  
  // Personalization type
  let persType = null;
  if (persCount > 0) {
    if (subject.toLowerCase().includes('{{first_name') || subject.toLowerCase().includes('{{name')) {
      persType = 'first_name';
    } else if (subject.toLowerCase().includes('{{company')) {
      persType = 'company';
    } else {
      persType = 'other';
    }
  }
  
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
    subject_length: chars,
    subject_word_count: words.length,
    subject_format: subjectFormat,
    subject_punctuation: punctuation,
    subject_has_personalization: persCount > 0,
    subject_personalization_type: persType,
    subject_has_number: hasNumber,
    subject_has_emoji: hasEmoji,
    subject_capitalization: capStyle,
    subject_first_word_type: firstWordType,
    subject_spam_word_count: spamScore > 0 ? Math.floor(spamScore / 15) : 0,
    subject_urgency_score: spamScore,
  };
}

function extractBodyFeatures(body: string) {
  const cleanBody = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleanBody.split(/\s+/).filter(Boolean);
  const sentences = cleanBody.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = body.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // Personalization analysis
  const persMatches = body.match(/\{\{[^}]+\}\}/g) || [];
  const persDensity = words.length > 0 ? persMatches.length / words.length : 0;
  
  // Link detection
  const linkMatches = body.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi) || [];
  const hasLink = linkMatches.length > 0;
  const hasCalendarLink = linkMatches.some(l => 
    /calendly|hubspot.*meetings|cal\.com|acuity|doodle|schedule|booking/i.test(l)
  );
  
  // Bullet detection
  const bulletCount = (body.match(/^[\s]*[-•*]\s/gm) || []).length;
  const hasBullets = bulletCount > 0;
  
  // CTA detection
  const lowerBody = body.toLowerCase();
  let ctaType = 'none';
  let ctaPosition = 'none';
  let ctaStrength = 'none';
  
  const ctaPatterns = {
    choice: /\b(tuesday|thursday|this week|next week)\b.*\b(or|vs)\b/i,
    direct: /\b(calendly|cal\.com|book.*time|schedule.*call|grab.*slot)\b/i,
    meeting: /\b(15 min|30 min|quick call|hop on.*call|chat.*briefly|meeting)\b/i,
    soft: /\b(okay if|mind if|would it be okay|open to|interested in|thoughts|makes sense|worth|interest|curious)\b/i,
    value_first: /\b(case study|send.*over|more info|learn more|details)\b/i,
  };
  
  for (const [type, pattern] of Object.entries(ctaPatterns)) {
    if (pattern.test(lowerBody)) {
      ctaType = type;
      const match = lowerBody.match(pattern);
      if (match && match.index !== undefined) {
        const relPos = match.index / lowerBody.length;
        ctaPosition = relPos < 0.33 ? 'early' : relPos < 0.66 ? 'middle' : 'end';
      }
      // Determine CTA strength
      if (type === 'direct' || type === 'choice') ctaStrength = 'strong';
      else if (type === 'meeting') ctaStrength = 'medium';
      else ctaStrength = 'soft';
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
  
  // Value proposition detection
  const valuePropCount = (lowerBody.match(/\b(save|increase|reduce|improve|boost|grow|streamline|automate)\b/gi) || []).length;
  
  // You:I ratio
  const youCount = (lowerBody.match(/\b(you|your|you're|yours)\b/gi) || []).length;
  const iCount = (lowerBody.match(/\b(i|me|my|we|our|us)\b/gi) || []).length;
  const youIRatio = iCount > 0 ? youCount / iCount : youCount;
  
  // Opening line extraction and classification
  const firstSentence = sentences[0]?.trim() || '';
  let openingLineType = 'other';
  const openingLower = firstSentence.toLowerCase();
  
  if (/^(hey|hi|hello|greetings)/i.test(openingLower)) openingLineType = 'greeting';
  else if (/\?$/.test(firstSentence)) openingLineType = 'question';
  else if (/\b(noticed|saw|read|found|came across)\b/i.test(openingLower)) openingLineType = 'observation';
  else if (/\b(congrat|excited|impressed)\b/i.test(openingLower)) openingLineType = 'compliment';
  else if (/\b(reaching out|writing to|contacting)\b/i.test(openingLower)) openingLineType = 'direct_intro';
  else if (/\{\{/i.test(firstSentence)) openingLineType = 'personalized';
  
  return {
    body_word_count: words.length,
    body_sentence_count: sentences.length,
    body_paragraph_count: paragraphs.length,
    body_length: cleanBody.length,
    body_question_count: questionCount,
    body_has_bullets: hasBullets,
    body_bullet_count: bulletCount,
    body_link_count: linkMatches.length,
    body_has_calendar_link: hasCalendarLink,
    body_has_personalization: persMatches.length > 0,
    body_personalization_count: persMatches.length,
    body_cta_type: ctaType,
    body_cta_position: ctaPosition,
    body_cta_strength: ctaStrength,
    tone: tone,
    body_reading_grade: Math.round(readingGrade * 10) / 10,
    body_you_i_ratio: Math.round(youIRatio * 100) / 100,
    body_value_proposition_count: valuePropCount,
    opening_line_type: openingLineType,
    opening_line_text: firstSentence.substring(0, 200),
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

    const { engagement_id, batch_size = 100 } = await req.json();
    
    if (!engagement_id) {
      return new Response(
        JSON.stringify({ error: "engagement_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Backfilling features for engagement: ${engagement_id}, batch_size: ${batch_size}`);

    // Get existing features to avoid re-processing
    const { data: existingFeatures, error: existingError } = await supabase
      .from('campaign_variant_features')
      .select('variant_id')
      .eq('engagement_id', engagement_id);
    
    if (existingError) {
      console.error('Error fetching existing features:', existingError);
    }
    
    const existingVariantIds = new Set((existingFeatures || []).map(f => f.variant_id));
    console.log(`Found ${existingVariantIds.size} variants with existing features`);

    // Fetch variants from unified campaign_variants table via campaigns
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('engagement_id', engagement_id);
    
    if (campaignError) {
      console.error('Error fetching campaigns:', campaignError);
      throw new Error(`Failed to fetch campaigns: ${campaignError.message}`);
    }
    
    const campaignIds = (campaigns || []).map(c => c.id);
    console.log(`Found ${campaignIds.length} campaigns for engagement`);
    
    if (campaignIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No campaigns found for this engagement',
          backfilled: 0,
          remaining: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all variants for these campaigns
    const { data: variants, error: variantError } = await supabase
      .from('campaign_variants')
      .select('id, campaign_id, subject_line, body_plain, body_html, body_preview')
      .in('campaign_id', campaignIds);
    
    if (variantError) {
      console.error('Error fetching variants:', variantError);
      throw new Error(`Failed to fetch variants: ${variantError.message}`);
    }
    
    console.log(`Found ${variants?.length || 0} total variants`);

    // Filter to variants that need processing
    const variantsToBackfill = (variants || [])
      .filter(v => !existingVariantIds.has(v.id))
      .filter(v => v.subject_line || v.body_plain || v.body_html || v.body_preview)
      .map(v => ({
        ...v,
        engagement_id,
      }));

    console.log(`${variantsToBackfill.length} variants need feature extraction`);

    // Limit to batch size
    const batch = variantsToBackfill.slice(0, batch_size);
    
    if (batch.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All variants already have features extracted',
          backfilled: 0,
          remaining: 0,
          total_variants: variants?.length || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract features for each variant
    const featuresToInsert = batch.map(variant => {
      const subjectFeatures = variant.subject_line 
        ? extractSubjectFeatures(variant.subject_line)
        : {};
      
      const body = variant.body_plain || variant.body_html || variant.body_preview || '';
      const bodyFeatures = body ? extractBodyFeatures(body) : {};
      
      return {
        variant_id: variant.id,
        engagement_id: engagement_id,
        analyzed_at: new Date().toISOString(),
        ...subjectFeatures,
        ...bodyFeatures,
      };
    });

    // Upsert features into unified table
    const { error: insertError } = await supabase
      .from('campaign_variant_features')
      .upsert(featuresToInsert, { onConflict: 'variant_id' });

    if (insertError) {
      console.error('Error inserting features:', insertError);
      throw new Error(`Failed to insert features: ${insertError.message}`);
    }

    const remaining = variantsToBackfill.length - batch.length;
    console.log(`Backfilled ${batch.length} variants, ${remaining} remaining`);

    return new Response(
      JSON.stringify({
        success: true,
        backfilled: batch.length,
        remaining: Math.max(0, remaining),
        total_variants: variants?.length || 0,
        message: remaining > 0 
          ? `Backfilled ${batch.length} variants. ${remaining} remaining - call again to continue.`
          : `Backfill complete! Processed ${batch.length} variants.`,
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
