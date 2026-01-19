import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FeatureWithMetrics {
  variant_id: string;
  // Subject features
  subject_format: string | null;
  subject_punctuation: string | null;
  subject_has_personalization: boolean | null;
  subject_has_number: boolean | null;
  subject_has_emoji: boolean | null;
  subject_word_count: number | null;
  subject_length: number | null;
  subject_capitalization: string | null;
  subject_first_word_type: string | null;
  // Body features
  body_word_count: number | null;
  body_cta_type: string | null;
  body_cta_position: string | null;
  body_cta_strength: string | null;
  tone: string | null;
  body_has_calendar_link: boolean | null;
  body_has_bullets: boolean | null;
  body_question_count: number | null;
  body_you_i_ratio: number | null;
  opening_line_type: string | null;
  // Metrics
  sent_count: number;
  replied_count: number;
  positive_count: number;
  opened_count: number;
}

interface ComputedPattern {
  pattern_type: string;
  pattern_value: string;
  total_sent: number;
  total_replied: number;
  total_variants: number;
  avg_reply_rate: number;
  baseline_reply_rate: number;
  lift_vs_baseline: number;
  p_value: number | null;
  reply_rate_ci_lower: number;
  reply_rate_ci_upper: number;
  is_significant: boolean;
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
  const pHat = successes / total;
  const n = total;
  
  const denominator = 1 + z * z / n;
  const center = pHat + z * z / (2 * n);
  const spread = z * Math.sqrt((pHat * (1 - pHat) + z * z / (4 * n)) / n);
  
  return {
    lower: Math.max(0, (center - spread) / denominator) * 100,
    upper: Math.min(1, (center + spread) / denominator) * 100,
  };
}

function computePatterns(
  features: FeatureWithMetrics[],
  baselineReplyRate: number,
  totalSampleSize: number
): ComputedPattern[] {
  const patterns: ComputedPattern[] = [];
  
  // Helper to compute pattern stats
  const computePatternStats = (
    patternType: string,
    patternValue: string,
    matchingVariants: FeatureWithMetrics[]
  ): ComputedPattern | null => {
    const sampleSize = matchingVariants.reduce((sum, v) => sum + v.sent_count, 0);
    if (sampleSize < 50) return null; // Skip patterns with very small samples
    
    const totalReplies = matchingVariants.reduce((sum, v) => sum + v.replied_count, 0);
    
    const replyRate = sampleSize > 0 ? (totalReplies / sampleSize) * 100 : 0;
    
    const lift = baselineReplyRate > 0 
      ? ((replyRate - baselineReplyRate) / baselineReplyRate) * 100 
      : 0;
    
    // Calculate p-value comparing this pattern to baseline
    const pValue = calculatePValue(
      replyRate, sampleSize,
      baselineReplyRate, totalSampleSize
    );
    
    // Calculate confidence interval
    const ci = wilsonConfidenceInterval(totalReplies, sampleSize);
    
    // Pattern is significant if p < 0.05 and meaningful sample size
    const isSignificant = pValue < 0.05 && sampleSize >= 200;
    
    return {
      pattern_type: patternType,
      pattern_value: patternValue,
      total_sent: sampleSize,
      total_replied: totalReplies,
      total_variants: matchingVariants.length,
      avg_reply_rate: Math.round(replyRate * 100) / 100,
      baseline_reply_rate: Math.round(baselineReplyRate * 100) / 100,
      lift_vs_baseline: Math.round(lift * 100) / 100,
      p_value: Math.round(pValue * 10000) / 10000,
      reply_rate_ci_lower: Math.round(ci.lower * 100) / 100,
      reply_rate_ci_upper: Math.round(ci.upper * 100) / 100,
      is_significant: isSignificant,
    };
  };
  
  // --- Subject Line Patterns ---
  
  // Subject format patterns
  const subjectFormats = ['question', 'statement', 're_fwd', 'personalized'];
  for (const format of subjectFormats) {
    const variants = features.filter(f => f.subject_format === format);
    const pattern = computePatternStats('subject_format', format, variants);
    if (pattern) patterns.push(pattern);
  }
  
  // Subject punctuation
  const punctuations = ['question', 'exclamation', 'period', 'none'];
  for (const punct of punctuations) {
    const variants = features.filter(f => f.subject_punctuation === punct);
    const pattern = computePatternStats('subject_punctuation', punct, variants);
    if (pattern) patterns.push(pattern);
  }
  
  // Subject personalization
  const persVariants = features.filter(f => f.subject_has_personalization === true);
  const persPattern = computePatternStats('subject_personalization', 'personalized', persVariants);
  if (persPattern) patterns.push(persPattern);
  
  const noPersVariants = features.filter(f => f.subject_has_personalization === false);
  const noPersPattern = computePatternStats('subject_personalization', 'not_personalized', noPersVariants);
  if (noPersPattern) patterns.push(noPersPattern);
  
  // Subject has number
  const numberVariants = features.filter(f => f.subject_has_number === true);
  const numberPattern = computePatternStats('subject_element', 'has_number', numberVariants);
  if (numberPattern) patterns.push(numberPattern);
  
  // Subject has emoji
  const emojiVariants = features.filter(f => f.subject_has_emoji === true);
  const emojiPattern = computePatternStats('subject_element', 'has_emoji', emojiVariants);
  if (emojiPattern) patterns.push(emojiPattern);
  
  // Subject length buckets
  const shortSubjectVariants = features.filter(f => f.subject_length && f.subject_length <= 30);
  const shortPattern = computePatternStats('subject_length', 'short_<=30', shortSubjectVariants);
  if (shortPattern) patterns.push(shortPattern);
  
  const medSubjectVariants = features.filter(f => f.subject_length && f.subject_length > 30 && f.subject_length <= 50);
  const medPattern = computePatternStats('subject_length', 'medium_31-50', medSubjectVariants);
  if (medPattern) patterns.push(medPattern);
  
  const longSubjectVariants = features.filter(f => f.subject_length && f.subject_length > 50);
  const longPattern = computePatternStats('subject_length', 'long_>50', longSubjectVariants);
  if (longPattern) patterns.push(longPattern);
  
  // First word type
  const firstWordTypes = ['greeting', 're_fwd', 'question_word', 'number', 'personalization', 'other'];
  for (const fwt of firstWordTypes) {
    const variants = features.filter(f => f.subject_first_word_type === fwt);
    const pattern = computePatternStats('subject_first_word', fwt, variants);
    if (pattern) patterns.push(pattern);
  }
  
  // Capitalization style
  const capStyles = ['sentence_case', 'title_case', 'all_lower', 'all_caps', 'normal'];
  for (const cap of capStyles) {
    const variants = features.filter(f => f.subject_capitalization === cap);
    const pattern = computePatternStats('subject_capitalization', cap, variants);
    if (pattern) patterns.push(pattern);
  }
  
  // --- Body Copy Patterns ---
  
  // Body length buckets
  const shortBodyVariants = features.filter(f => f.body_word_count && f.body_word_count < 50);
  const shortBodyPattern = computePatternStats('body_length', 'short_<50', shortBodyVariants);
  if (shortBodyPattern) patterns.push(shortBodyPattern);
  
  const optimalBodyVariants = features.filter(f => f.body_word_count && f.body_word_count >= 50 && f.body_word_count <= 100);
  const optimalBodyPattern = computePatternStats('body_length', 'optimal_50-100', optimalBodyVariants);
  if (optimalBodyPattern) patterns.push(optimalBodyPattern);
  
  const longBodyVariants = features.filter(f => f.body_word_count && f.body_word_count > 100);
  const longBodyPattern = computePatternStats('body_length', 'long_>100', longBodyVariants);
  if (longBodyPattern) patterns.push(longBodyPattern);
  
  // CTA type patterns
  const ctaTypes = ['soft', 'direct', 'choice', 'meeting', 'value_first', 'none'];
  for (const ctaType of ctaTypes) {
    const variants = features.filter(f => f.body_cta_type === ctaType);
    const pattern = computePatternStats('body_cta_type', ctaType, variants);
    if (pattern) patterns.push(pattern);
  }
  
  // CTA position patterns
  const ctaPositions = ['early', 'middle', 'end', 'none'];
  for (const pos of ctaPositions) {
    const variants = features.filter(f => f.body_cta_position === pos);
    const pattern = computePatternStats('body_cta_position', pos, variants);
    if (pattern) patterns.push(pattern);
  }
  
  // CTA strength patterns
  const ctaStrengths = ['soft', 'medium', 'strong', 'none'];
  for (const strength of ctaStrengths) {
    const variants = features.filter(f => f.body_cta_strength === strength);
    const pattern = computePatternStats('body_cta_strength', strength, variants);
    if (pattern) patterns.push(pattern);
  }
  
  // Tone patterns
  const tones = ['professional', 'casual', 'formal', 'direct'];
  for (const tone of tones) {
    const variants = features.filter(f => f.tone === tone);
    const pattern = computePatternStats('body_tone', tone, variants);
    if (pattern) patterns.push(pattern);
  }
  
  // Calendar link
  const calendarVariants = features.filter(f => f.body_has_calendar_link === true);
  const calendarPattern = computePatternStats('body_element', 'has_calendar_link', calendarVariants);
  if (calendarPattern) patterns.push(calendarPattern);
  
  // Has bullets
  const bulletVariants = features.filter(f => f.body_has_bullets === true);
  const bulletPattern = computePatternStats('body_element', 'has_bullets', bulletVariants);
  if (bulletPattern) patterns.push(bulletPattern);
  
  // Opening line type
  const openingTypes = ['greeting', 'question', 'observation', 'compliment', 'direct_intro', 'personalized', 'other'];
  for (const openType of openingTypes) {
    const variants = features.filter(f => f.opening_line_type === openType);
    const pattern = computePatternStats('opening_line_type', openType, variants);
    if (pattern) patterns.push(pattern);
  }
  
  // Question count in body
  const noQuestionVariants = features.filter(f => !f.body_question_count || f.body_question_count === 0);
  const noQPattern = computePatternStats('body_questions', 'none', noQuestionVariants);
  if (noQPattern) patterns.push(noQPattern);
  
  const oneQuestionVariants = features.filter(f => f.body_question_count === 1);
  const oneQPattern = computePatternStats('body_questions', 'one', oneQuestionVariants);
  if (oneQPattern) patterns.push(oneQPattern);
  
  const multiQuestionVariants = features.filter(f => f.body_question_count && f.body_question_count >= 2);
  const multiQPattern = computePatternStats('body_questions', 'multiple', multiQuestionVariants);
  if (multiQPattern) patterns.push(multiQPattern);
  
  return patterns.sort((a, b) => b.avg_reply_rate - a.avg_reply_rate);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { engagement_id } = await req.json();
    
    if (!engagement_id) {
      return new Response(
        JSON.stringify({ error: "engagement_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Computing patterns for engagement: ${engagement_id}`);

    // Fetch features from unified table
    const { data: features, error: featuresError } = await supabase
      .from('campaign_variant_features')
      .select('*')
      .eq('engagement_id', engagement_id);
    
    if (featuresError) {
      console.error('Error fetching features:', featuresError);
      throw new Error(`Failed to fetch features: ${featuresError.message}`);
    }

    console.log(`Found ${features?.length || 0} variant features`);

    if (!features || features.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No variant features to analyze. Run backfill-features first.',
          patterns_computed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get variant IDs to fetch metrics - batch to avoid URL too long error
    const variantIds = features.map(f => f.variant_id);
    const batchSize = 100;
    const variantMetrics = new Map<string, { sent_count: number; opened_count: number; replied_count: number; positive_count: number }>();

    // Fetch variant metrics in batches
    for (let i = 0; i < variantIds.length; i += batchSize) {
      const batchIds = variantIds.slice(i, i + batchSize);
      const { data: variants, error: variantsError } = await supabase
        .from('campaign_variants')
        .select('id, total_sent, total_opened, total_replied, positive_replies')
        .in('id', batchIds);
      
      if (variantsError) {
        console.error('Error fetching variant metrics batch:', variantsError);
        continue;
      }

      (variants || []).forEach(v => {
        variantMetrics.set(v.id, {
          sent_count: v.total_sent || 0,
          opened_count: v.total_opened || 0,
          replied_count: v.total_replied || 0,
          positive_count: v.positive_replies || 0,
        });
      });
    }

    console.log(`Fetched metrics for ${variantMetrics.size} variants`);

    // Combine features with metrics
    const featuresWithMetrics: FeatureWithMetrics[] = features
      .map(f => {
        const metrics = variantMetrics.get(f.variant_id) || {
          sent_count: 0, opened_count: 0, replied_count: 0, positive_count: 0
        };
        return {
          ...f,
          ...metrics,
        };
      })
      .filter(f => f.sent_count > 0); // Only include variants with metrics

    console.log(`${featuresWithMetrics.length} variants have both features and metrics`);

    if (featuresWithMetrics.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No variants with both features and metrics found',
          patterns_computed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate baseline metrics
    const totalSent = featuresWithMetrics.reduce((sum, f) => sum + f.sent_count, 0);
    const totalReplied = featuresWithMetrics.reduce((sum, f) => sum + f.replied_count, 0);
    const baselineReplyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

    console.log(`Baseline: ${totalSent} sent, ${totalReplied} replied, ${baselineReplyRate.toFixed(2)}% reply rate`);

    // Compute patterns
    const patterns = computePatterns(featuresWithMetrics, baselineReplyRate, totalSent);

    console.log(`Computed ${patterns.length} patterns`);

    // Delete existing patterns for this engagement
    const { error: deleteError } = await supabase
      .from('copy_patterns')
      .delete()
      .eq('engagement_id', engagement_id);
    
    if (deleteError) {
      console.error('Error deleting existing patterns:', deleteError);
    }

    // Insert new patterns
    if (patterns.length > 0) {
      const patternsToInsert = patterns.map(p => ({
        engagement_id,
        pattern_type: p.pattern_type,
        pattern_value: p.pattern_value,
        total_sent: p.total_sent,
        total_replied: p.total_replied,
        total_variants: p.total_variants,
        avg_reply_rate: p.avg_reply_rate,
        baseline_reply_rate: p.baseline_reply_rate,
        lift_vs_baseline: p.lift_vs_baseline,
        p_value: p.p_value,
        reply_rate_ci_lower: p.reply_rate_ci_lower,
        reply_rate_ci_upper: p.reply_rate_ci_upper,
        is_significant: p.is_significant,
        computed_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from('copy_patterns')
        .insert(patternsToInsert);

      if (insertError) {
        console.error('Error inserting patterns:', insertError);
        throw new Error(`Failed to insert patterns: ${insertError.message}`);
      }
    }

    // Get top patterns for response
    const topPatterns = patterns
      .filter(p => p.is_significant)
      .slice(0, 5)
      .map(p => ({
        type: p.pattern_type,
        value: p.pattern_value,
        reply_rate: `${p.avg_reply_rate.toFixed(1)}%`,
        lift: `${p.lift_vs_baseline > 0 ? '+' : ''}${p.lift_vs_baseline.toFixed(1)}%`,
      }));

    return new Response(
      JSON.stringify({
        success: true,
        patterns_computed: patterns.length,
        validated_patterns: patterns.filter(p => p.is_significant).length,
        baseline_reply_rate: `${baselineReplyRate.toFixed(2)}%`,
        total_variants_analyzed: featuresWithMetrics.length,
        total_sent: totalSent,
        top_performing_patterns: topPatterns,
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
