import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FeatureWithMetrics {
  variant_id: string;
  workspace_id: string;
  // Subject features
  subject_is_question: boolean | null;
  subject_has_number: boolean | null;
  subject_has_emoji: boolean | null;
  subject_char_count: number | null;
  subject_word_count: number | null;
  subject_personalization_count: number | null;
  subject_capitalization_style: string | null;
  subject_first_word_type: string | null;
  // Body features
  body_word_count: number | null;
  body_cta_type: string | null;
  body_cta_position: string | null;
  body_tone: string | null;
  body_has_link: boolean | null;
  body_has_calendar_link: boolean | null;
  body_has_proof: boolean | null;
  body_question_count: number | null;
  body_personalization_density: number | null;
  // Metrics
  sent_count: number;
  replied_count: number;
  positive_count: number;
  opened_count: number;
}

interface PatternGroup {
  pattern_name: string;
  pattern_type: string;
  pattern_description: string;
  pattern_criteria: Record<string, any>;
  variants: FeatureWithMetrics[];
}

interface ComputedPattern {
  pattern_name: string;
  pattern_type: string;
  pattern_description: string;
  pattern_criteria: Record<string, any>;
  sample_size: number;
  reply_rate: number;
  positive_rate: number;
  open_rate: number;
  reply_rate_lift: number;
  positive_rate_lift: number;
  confidence_level: 'low' | 'medium' | 'high';
  p_value: number | null;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  is_validated: boolean;
}

// Calculate two-proportion z-test p-value
function calculatePValue(
  rate1: number, n1: number,
  rate2: number, n2: number
): number {
  if (n1 === 0 || n2 === 0) return 1;
  
  const p1 = rate1 / 100;
  const p2 = rate2 / 100;
  const pooled = (p1 * n1 + p2 * n2) / (n1 + n2);
  
  if (pooled === 0 || pooled === 1) return 1;
  
  const se = Math.sqrt(pooled * (1 - pooled) * (1/n1 + 1/n2));
  if (se === 0) return 1;
  
  const z = Math.abs(p1 - p2) / se;
  
  // Approximate p-value from z-score (two-tailed)
  const pValue = 2 * (1 - normalCDF(z));
  return Math.max(0, Math.min(1, pValue));
}

// Standard normal CDF approximation
function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  
  return 0.5 * (1.0 + sign * y);
}

// Calculate Wilson score confidence interval
function wilsonConfidenceInterval(
  successes: number, 
  total: number, 
  confidence: number = 0.95
): { lower: number; upper: number } {
  if (total === 0) return { lower: 0, upper: 0 };
  
  const z = confidence === 0.95 ? 1.96 : 1.645;
  const p = successes / total;
  const n = total;
  
  const denominator = 1 + z * z / n;
  const center = p + z * z / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n);
  
  return {
    lower: Math.max(0, (center - spread) / denominator) * 100,
    upper: Math.min(1, (center + spread) / denominator) * 100,
  };
}

function getConfidenceLevel(sampleSize: number): 'low' | 'medium' | 'high' {
  if (sampleSize < 200) return 'low';
  if (sampleSize < 500) return 'medium';
  return 'high';
}

function computePatterns(
  features: FeatureWithMetrics[],
  baselineReplyRate: number,
  baselinePositiveRate: number,
  totalSampleSize: number
): ComputedPattern[] {
  const patterns: ComputedPattern[] = [];
  
  // Helper to compute pattern stats
  const computePatternStats = (
    name: string,
    type: string,
    description: string,
    criteria: Record<string, any>,
    matchingVariants: FeatureWithMetrics[]
  ) => {
    const sampleSize = matchingVariants.reduce((sum, v) => sum + v.sent_count, 0);
    if (sampleSize < 50) return null; // Skip patterns with very small samples
    
    const totalReplies = matchingVariants.reduce((sum, v) => sum + v.replied_count, 0);
    const totalPositive = matchingVariants.reduce((sum, v) => sum + v.positive_count, 0);
    const totalOpened = matchingVariants.reduce((sum, v) => sum + v.opened_count, 0);
    
    const replyRate = sampleSize > 0 ? (totalReplies / sampleSize) * 100 : 0;
    const positiveRate = sampleSize > 0 ? (totalPositive / sampleSize) * 100 : 0;
    const openRate = sampleSize > 0 ? (totalOpened / sampleSize) * 100 : 0;
    
    const replyLift = baselineReplyRate > 0 
      ? ((replyRate - baselineReplyRate) / baselineReplyRate) * 100 
      : 0;
    const positiveLift = baselinePositiveRate > 0
      ? ((positiveRate - baselinePositiveRate) / baselinePositiveRate) * 100
      : 0;
    
    // Calculate p-value comparing this pattern to baseline
    const pValue = calculatePValue(
      replyRate, sampleSize,
      baselineReplyRate, totalSampleSize
    );
    
    // Calculate confidence interval
    const ci = wilsonConfidenceInterval(totalReplies, sampleSize);
    
    // Pattern is validated if p < 0.05 and meaningful sample size
    const isValidated = pValue < 0.05 && sampleSize >= 200;
    
    return {
      pattern_name: name,
      pattern_type: type,
      pattern_description: description,
      pattern_criteria: criteria,
      sample_size: sampleSize,
      reply_rate: replyRate,
      positive_rate: positiveRate,
      open_rate: openRate,
      reply_rate_lift: replyLift,
      positive_rate_lift: positiveLift,
      confidence_level: getConfidenceLevel(sampleSize),
      p_value: pValue,
      confidence_interval_lower: ci.lower,
      confidence_interval_upper: ci.upper,
      is_validated: isValidated,
    };
  };
  
  // --- Subject Line Patterns ---
  
  // Question format
  const questionVariants = features.filter(f => f.subject_is_question === true);
  const questionPattern = computePatternStats(
    'Question Subject Lines',
    'subject_format',
    'Subject lines ending with a question mark',
    { subject_is_question: true },
    questionVariants
  );
  if (questionPattern) patterns.push(questionPattern);
  
  // Non-question (statement) format
  const statementVariants = features.filter(f => f.subject_is_question === false);
  const statementPattern = computePatternStats(
    'Statement Subject Lines',
    'subject_format',
    'Subject lines without question marks',
    { subject_is_question: false },
    statementVariants
  );
  if (statementPattern) patterns.push(statementPattern);
  
  // Has number in subject
  const numberVariants = features.filter(f => f.subject_has_number === true);
  const numberPattern = computePatternStats(
    'Numbers in Subject',
    'subject_element',
    'Subject lines containing numeric digits',
    { subject_has_number: true },
    numberVariants
  );
  if (numberPattern) patterns.push(numberPattern);
  
  // Has emoji in subject
  const emojiVariants = features.filter(f => f.subject_has_emoji === true);
  const emojiPattern = computePatternStats(
    'Emoji in Subject',
    'subject_element',
    'Subject lines containing emoji characters',
    { subject_has_emoji: true },
    emojiVariants
  );
  if (emojiPattern) patterns.push(emojiPattern);
  
  // Subject length patterns
  const shortSubjectVariants = features.filter(f => f.subject_char_count && f.subject_char_count <= 30);
  const shortPattern = computePatternStats(
    'Short Subject (≤30 chars)',
    'subject_length',
    'Very short subject lines under 30 characters',
    { subject_char_count_max: 30 },
    shortSubjectVariants
  );
  if (shortPattern) patterns.push(shortPattern);
  
  const mediumSubjectVariants = features.filter(f => 
    f.subject_char_count && f.subject_char_count > 30 && f.subject_char_count <= 50
  );
  const mediumPattern = computePatternStats(
    'Medium Subject (31-50 chars)',
    'subject_length',
    'Medium-length subject lines between 31-50 characters',
    { subject_char_count_min: 31, subject_char_count_max: 50 },
    mediumSubjectVariants
  );
  if (mediumPattern) patterns.push(mediumPattern);
  
  const longSubjectVariants = features.filter(f => f.subject_char_count && f.subject_char_count > 50);
  const longPattern = computePatternStats(
    'Long Subject (>50 chars)',
    'subject_length',
    'Longer subject lines over 50 characters',
    { subject_char_count_min: 51 },
    longSubjectVariants
  );
  if (longPattern) patterns.push(longPattern);
  
  // Personalization in subject
  const personalizedSubjectVariants = features.filter(f => 
    f.subject_personalization_count && f.subject_personalization_count > 0
  );
  const persSubjectPattern = computePatternStats(
    'Personalized Subject',
    'subject_personalization',
    'Subject lines with merge tags ({{first_name}}, {{company}}, etc.)',
    { subject_personalization_count_min: 1 },
    personalizedSubjectVariants
  );
  if (persSubjectPattern) patterns.push(persSubjectPattern);
  
  // --- Body Copy Patterns ---
  
  // Body length patterns
  const shortBodyVariants = features.filter(f => f.body_word_count && f.body_word_count < 50);
  const shortBodyPattern = computePatternStats(
    'Short Body (<50 words)',
    'body_length',
    'Very concise email body under 50 words',
    { body_word_count_max: 49 },
    shortBodyVariants
  );
  if (shortBodyPattern) patterns.push(shortBodyPattern);
  
  const optimalBodyVariants = features.filter(f => 
    f.body_word_count && f.body_word_count >= 50 && f.body_word_count <= 100
  );
  const optimalBodyPattern = computePatternStats(
    'Optimal Body (50-100 words)',
    'body_length',
    'Email body in the recommended 50-100 word range',
    { body_word_count_min: 50, body_word_count_max: 100 },
    optimalBodyVariants
  );
  if (optimalBodyPattern) patterns.push(optimalBodyPattern);
  
  const longBodyVariants = features.filter(f => f.body_word_count && f.body_word_count > 100);
  const longBodyPattern = computePatternStats(
    'Long Body (>100 words)',
    'body_length',
    'Longer email body over 100 words',
    { body_word_count_min: 101 },
    longBodyVariants
  );
  if (longBodyPattern) patterns.push(longBodyPattern);
  
  // CTA type patterns
  const ctaTypes = ['soft', 'meeting', 'calendar', 'permission', 'binary'];
  for (const ctaType of ctaTypes) {
    const ctaVariants = features.filter(f => f.body_cta_type === ctaType);
    const ctaPattern = computePatternStats(
      `CTA: ${ctaType.charAt(0).toUpperCase() + ctaType.slice(1)}`,
      'body_cta',
      `Emails using "${ctaType}" call-to-action style`,
      { body_cta_type: ctaType },
      ctaVariants
    );
    if (ctaPattern) patterns.push(ctaPattern);
  }
  
  // Has link in body
  const linkVariants = features.filter(f => f.body_has_link === true);
  const linkPattern = computePatternStats(
    'Contains Link',
    'body_element',
    'Emails containing hyperlinks in the body',
    { body_has_link: true },
    linkVariants
  );
  if (linkPattern) patterns.push(linkPattern);
  
  const noLinkVariants = features.filter(f => f.body_has_link === false);
  const noLinkPattern = computePatternStats(
    'No Links',
    'body_element',
    'Emails without any hyperlinks in the body',
    { body_has_link: false },
    noLinkVariants
  );
  if (noLinkPattern) patterns.push(noLinkPattern);
  
  // Calendar link
  const calendarVariants = features.filter(f => f.body_has_calendar_link === true);
  const calendarPattern = computePatternStats(
    'Has Calendar Link',
    'body_element',
    'Emails with embedded calendar/booking links',
    { body_has_calendar_link: true },
    calendarVariants
  );
  if (calendarPattern) patterns.push(calendarPattern);
  
  // Social proof
  const proofVariants = features.filter(f => f.body_has_proof === true);
  const proofPattern = computePatternStats(
    'Contains Social Proof',
    'body_element',
    'Emails mentioning case studies, testimonials, or results',
    { body_has_proof: true },
    proofVariants
  );
  if (proofPattern) patterns.push(proofPattern);
  
  // Questions in body
  const questionBodyVariants = features.filter(f => f.body_question_count && f.body_question_count >= 2);
  const questionBodyPattern = computePatternStats(
    'Multiple Questions in Body',
    'body_engagement',
    'Emails with 2+ questions in the body copy',
    { body_question_count_min: 2 },
    questionBodyVariants
  );
  if (questionBodyPattern) patterns.push(questionBodyPattern);
  
  // High personalization density
  const highPersVariants = features.filter(f => f.body_personalization_density && f.body_personalization_density >= 0.1);
  const highPersPattern = computePatternStats(
    'High Personalization Density',
    'body_personalization',
    'Emails with 10%+ of content being personalized',
    { body_personalization_density_min: 0.1 },
    highPersVariants
  );
  if (highPersPattern) patterns.push(highPersPattern);
  
  // Tone patterns
  const tones = ['professional', 'casual', 'formal', 'direct'];
  for (const tone of tones) {
    const toneVariants = features.filter(f => f.body_tone === tone);
    const tonePattern = computePatternStats(
      `Tone: ${tone.charAt(0).toUpperCase() + tone.slice(1)}`,
      'body_tone',
      `Emails with ${tone} writing tone`,
      { body_tone: tone },
      toneVariants
    );
    if (tonePattern) patterns.push(tonePattern);
  }
  
  return patterns.sort((a, b) => b.reply_rate - a.reply_rate);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspace_id } = await req.json();
    
    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Computing patterns for workspace: ${workspace_id}`);

    // Fetch all features with metrics for this workspace
    const { data: features, error: featuresError } = await supabase
      .from('campaign_variant_features')
      .select('*')
      .eq('workspace_id', workspace_id);

    if (featuresError) {
      console.error('Error fetching features:', featuresError);
      throw featuresError;
    }

    if (!features || features.length === 0) {
      console.log('No features found for workspace');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No variant features to analyze',
          patterns_computed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch metrics for all variants
    const variantIds = features.map(f => f.variant_id);
    const { data: metrics, error: metricsError } = await supabase
      .from('daily_metrics')
      .select('variant_id, sent_count, opened_count, replied_count, positive_reply_count')
      .eq('workspace_id', workspace_id)
      .in('variant_id', variantIds);

    if (metricsError) {
      console.error('Error fetching metrics:', metricsError);
      throw metricsError;
    }

    // Aggregate metrics by variant
    const metricsMap = new Map<string, { sent: number; opened: number; replied: number; positive: number }>();
    (metrics || []).forEach(m => {
      if (!m.variant_id) return;
      const existing = metricsMap.get(m.variant_id) || { sent: 0, opened: 0, replied: 0, positive: 0 };
      metricsMap.set(m.variant_id, {
        sent: existing.sent + (m.sent_count || 0),
        opened: existing.opened + (m.opened_count || 0),
        replied: existing.replied + (m.replied_count || 0),
        positive: existing.positive + (m.positive_reply_count || 0),
      });
    });

    // Combine features with metrics
    const featuresWithMetrics: FeatureWithMetrics[] = features
      .map(f => {
        const m = metricsMap.get(f.variant_id) || { sent: 0, opened: 0, replied: 0, positive: 0 };
        return {
          variant_id: f.variant_id,
          workspace_id: f.workspace_id,
          subject_is_question: f.subject_is_question,
          subject_has_number: f.subject_has_number,
          subject_has_emoji: f.subject_has_emoji,
          subject_char_count: f.subject_char_count,
          subject_word_count: f.subject_word_count,
          subject_personalization_count: f.subject_personalization_count,
          subject_capitalization_style: f.subject_capitalization_style,
          subject_first_word_type: f.subject_first_word_type,
          body_word_count: f.body_word_count,
          body_cta_type: f.body_cta_type,
          body_cta_position: f.body_cta_position,
          body_tone: f.body_tone,
          body_has_link: f.body_has_link,
          body_has_calendar_link: f.body_has_calendar_link,
          body_has_proof: f.body_has_proof,
          body_question_count: f.body_question_count,
          body_personalization_density: f.body_personalization_density,
          sent_count: m.sent,
          replied_count: m.replied,
          positive_count: m.positive,
          opened_count: m.opened,
        };
      })
      .filter(f => f.sent_count > 0); // Only include variants with data

    if (featuresWithMetrics.length === 0) {
      console.log('No variants with metrics found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No variants with send data to analyze',
          patterns_computed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate baseline rates
    const totalSent = featuresWithMetrics.reduce((sum, f) => sum + f.sent_count, 0);
    const totalReplied = featuresWithMetrics.reduce((sum, f) => sum + f.replied_count, 0);
    const totalPositive = featuresWithMetrics.reduce((sum, f) => sum + f.positive_count, 0);
    
    const baselineReplyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;
    const baselinePositiveRate = totalSent > 0 ? (totalPositive / totalSent) * 100 : 0;

    console.log(`Baseline rates - Reply: ${baselineReplyRate.toFixed(2)}%, Positive: ${baselinePositiveRate.toFixed(2)}%`);
    console.log(`Analyzing ${featuresWithMetrics.length} variants with ${totalSent} total sends`);

    // Compute patterns
    const computedPatterns = computePatterns(
      featuresWithMetrics, 
      baselineReplyRate, 
      baselinePositiveRate,
      totalSent
    );

    console.log(`Computed ${computedPatterns.length} patterns`);

    // Delete existing patterns for this workspace
    const { error: deleteError } = await supabase
      .from('copy_patterns')
      .delete()
      .eq('workspace_id', workspace_id);

    if (deleteError) {
      console.error('Error deleting old patterns:', deleteError);
      throw deleteError;
    }

    // Insert new patterns
    if (computedPatterns.length > 0) {
      const patternsToInsert = computedPatterns.map(p => ({
        workspace_id,
        pattern_name: p.pattern_name,
        pattern_type: p.pattern_type,
        pattern_description: p.pattern_description,
        pattern_criteria: p.pattern_criteria,
        sample_size: p.sample_size,
        reply_rate: p.reply_rate,
        positive_rate: p.positive_rate,
        open_rate: p.open_rate,
        reply_rate_lift: p.reply_rate_lift,
        positive_rate_lift: p.positive_rate_lift,
        confidence_level: p.confidence_level,
        p_value: p.p_value,
        confidence_interval_lower: p.confidence_interval_lower,
        confidence_interval_upper: p.confidence_interval_upper,
        is_validated: p.is_validated,
        last_computed: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from('copy_patterns')
        .insert(patternsToInsert);

      if (insertError) {
        console.error('Error inserting patterns:', insertError);
        throw insertError;
      }
    }

    // Log validated patterns
    const validatedPatterns = computedPatterns.filter(p => p.is_validated);
    console.log(`Found ${validatedPatterns.length} statistically validated patterns`);
    validatedPatterns.forEach(p => {
      console.log(`  ✓ ${p.pattern_name}: ${p.reply_rate.toFixed(2)}% reply rate (p=${p.p_value?.toFixed(4)})`);
    });

    return new Response(
      JSON.stringify({
        success: true,
        patterns_computed: computedPatterns.length,
        validated_patterns: validatedPatterns.length,
        baseline_reply_rate: baselineReplyRate,
        baseline_positive_rate: baselinePositiveRate,
        total_variants_analyzed: featuresWithMetrics.length,
        total_sends_analyzed: totalSent,
        top_patterns: computedPatterns.slice(0, 5).map(p => ({
          name: p.pattern_name,
          reply_rate: p.reply_rate,
          lift: p.reply_rate_lift,
          is_validated: p.is_validated,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error computing patterns:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});