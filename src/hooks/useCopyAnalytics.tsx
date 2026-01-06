import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

// Subject line analysis patterns
export type PersonalizationType = 'none' | 'first_name' | 'company' | 'title' | 'industry' | 'trigger';
export type FormatType = 'question' | 'statement' | 'how_to' | 'number' | 'intrigue' | 're_thread' | 'social_proof';
export type LengthCategory = 'very_short' | 'short' | 'medium' | 'long';
export type ToneType = 'formal' | 'professional' | 'casual' | 'direct' | 'intriguing';

export interface SubjectLineAnalysis {
  variant_id: string;
  campaign_id: string;
  campaign_name: string;
  variant_name: string;
  subject_line: string;
  
  // Metrics
  sent_count: number;
  open_count: number;
  reply_count: number;
  positive_count: number;
  meeting_count: number;
  
  // Rates
  open_rate: number;
  reply_rate: number;
  positive_rate: number;
  
  // Analysis (from features table or fallback)
  personalization_type: PersonalizationType;
  format_type: FormatType;
  length_category: LengthCategory;
  char_count: number;
  word_count: number;
  has_question: boolean;
  has_number: boolean;
  has_emoji: boolean;
  spam_score: number;
  capitalization_style: string;
  
  // Statistical
  confidence_level: 'low' | 'medium' | 'high';
}

export interface BodyCopyAnalysis {
  variant_id: string;
  campaign_name: string;
  subject_line: string;
  body_preview: string;
  email_body: string | null;
  
  // Metrics
  sent_count: number;
  reply_count: number;
  positive_count: number;
  reply_rate: number;
  positive_rate: number;
  
  // Body analysis (from features table or fallback)
  word_count: number;
  personalization_depth: 0 | 1 | 2 | 3 | 4;
  personalization_vars: string[];
  has_link: boolean;
  has_question: boolean;
  has_cta: boolean;
  cta_type: 'soft' | 'meeting' | 'calendar' | 'permission' | 'info' | 'binary' | 'none';
  cta_position: string;
  body_tone: string;
  reading_grade: number;
  sentence_count: number;
  paragraph_count: number;
  
  confidence_level: 'low' | 'medium' | 'high';
}

export interface PatternAnalysis {
  pattern: string;
  description: string;
  sample_size: number;
  avg_reply_rate: number;
  avg_positive_rate: number;
  significance: 'low' | 'medium' | 'high';
  comparison_to_baseline: number;
  p_value?: number;
  confidence_interval_lower?: number;
  confidence_interval_upper?: number;
  is_validated?: boolean;
}

export interface CopyAnalyticsData {
  subjectLines: SubjectLineAnalysis[];
  bodyCopy: BodyCopyAnalysis[];
  patterns: PatternAnalysis[];
  discoveredPatterns: PatternAnalysis[];
  topPerformers: SubjectLineAnalysis[];
  recommendations: string[];
  loading: boolean;
  error: string | null;
}

// Helper functions for analysis (fallback when features not extracted)
function detectPersonalizationType(subject: string): PersonalizationType {
  const lower = subject.toLowerCase();
  if (lower.includes('{{company') || lower.includes('{company')) return 'company';
  if (lower.includes('{{trigger') || lower.includes('congrats') || lower.includes('saw your')) return 'trigger';
  if (lower.includes('{{title') || lower.includes('{{role')) return 'title';
  if (lower.includes('{{industry')) return 'industry';
  if (lower.includes('{{first') || lower.includes('{first')) return 'first_name';
  return 'none';
}

function detectFormatType(subject: string): FormatType {
  const lower = subject.toLowerCase();
  if (subject.includes('?')) return 'question';
  if (lower.startsWith('re:') || lower.includes('following up')) return 're_thread';
  if (lower.startsWith('how ') || lower.includes('how to')) return 'how_to';
  if (/^\d/.test(subject) || /\d\s*(ideas?|tips?|ways?)/.test(lower)) return 'number';
  if (lower.includes('thought') || lower.includes('quick') || lower.includes('idea')) return 'intrigue';
  if (lower.includes('like ') && lower.includes(' achieved')) return 'social_proof';
  return 'statement';
}

function getLengthCategory(length: number): LengthCategory {
  if (length <= 20) return 'very_short';
  if (length <= 40) return 'short';
  if (length <= 60) return 'medium';
  return 'long';
}

function getConfidenceLevel(sampleSize: number): 'low' | 'medium' | 'high' {
  if (sampleSize < 200) return 'low';
  if (sampleSize < 500) return 'medium';
  return 'high';
}

function detectPersonalizationDepth(vars: string[]): 0 | 1 | 2 | 3 | 4 {
  const count = vars.length;
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

function detectCTAType(body: string): 'soft' | 'meeting' | 'calendar' | 'permission' | 'info' | 'binary' | 'none' {
  const lower = body.toLowerCase();
  if (lower.includes('tuesday') || lower.includes('thursday') || lower.includes('would ') && lower.includes(' or ')) return 'binary';
  if (lower.includes('calendar') || lower.includes('calendly') || lower.includes('book')) return 'calendar';
  if (lower.includes('15 min') || lower.includes('call') || lower.includes('chat') || lower.includes('meeting')) return 'meeting';
  if (lower.includes('okay if') || lower.includes('would it be okay') || lower.includes('mind if')) return 'permission';
  if (lower.includes('case study') || lower.includes('send over') || lower.includes('more info')) return 'info';
  if (lower.includes('thoughts') || lower.includes('interest') || lower.includes('worth') || body.endsWith('?')) return 'soft';
  return 'none';
}

interface VariantFeatures {
  variant_id: string;
  subject_char_count: number | null;
  subject_word_count: number | null;
  subject_is_question: boolean | null;
  subject_has_number: boolean | null;
  subject_has_emoji: boolean | null;
  subject_personalization_count: number | null;
  subject_spam_score: number | null;
  subject_capitalization_style: string | null;
  subject_first_word_type: string | null;
  body_word_count: number | null;
  body_sentence_count: number | null;
  body_paragraph_count: number | null;
  body_question_count: number | null;
  body_has_link: boolean | null;
  body_link_count: number | null;
  body_cta_type: string | null;
  body_cta_position: string | null;
  body_tone: string | null;
  body_reading_grade: number | null;
  body_personalization_density: number | null;
  body_personalization_types: string[] | null;
  body_has_calendar_link: boolean | null;
  body_has_proof: boolean | null;
}

export function useCopyAnalytics(): CopyAnalyticsData {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectLines, setSubjectLines] = useState<SubjectLineAnalysis[]>([]);
  const [bodyCopy, setBodyCopy] = useState<BodyCopyAnalysis[]>([]);
  const [discoveredPatterns, setDiscoveredPatterns] = useState<PatternAnalysis[]>([]);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchCopyAnalytics();
    }
  }, [currentWorkspace?.id]);

  const fetchCopyAnalytics = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch variants with campaign info
      const { data: variants, error: variantsError } = await supabase
        .from('campaign_variants')
        .select(`
          id,
          campaign_id,
          name,
          subject_line,
          body_preview,
          email_body,
          personalization_vars,
          word_count,
          campaigns!inner (
            name,
            workspace_id
          )
        `)
        .eq('campaigns.workspace_id', currentWorkspace.id);

      if (variantsError) throw variantsError;

      // Fetch extracted features from campaign_variant_features
      const { data: features, error: featuresError } = await supabase
        .from('campaign_variant_features')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (featuresError) {
        console.warn('Features table query failed, using fallback analysis:', featuresError);
      }

      // Create features map
      const featuresMap = new Map<string, VariantFeatures>();
      (features || []).forEach(f => {
        featuresMap.set(f.variant_id, f as VariantFeatures);
      });

      // Fetch discovered patterns from copy_patterns table
      const { data: dbPatterns, error: patternsError } = await supabase
        .from('copy_patterns')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('reply_rate', { ascending: false });

      if (patternsError) {
        console.warn('Patterns table query failed:', patternsError);
      }

      // Transform DB patterns to PatternAnalysis
      const discovered: PatternAnalysis[] = (dbPatterns || []).map(p => ({
        pattern: p.pattern_name,
        description: p.pattern_description || '',
        sample_size: p.sample_size,
        avg_reply_rate: p.reply_rate || 0,
        avg_positive_rate: p.positive_rate || 0,
        significance: (p.confidence_level as 'low' | 'medium' | 'high') || 'low',
        comparison_to_baseline: p.reply_rate_lift || 0,
        p_value: p.p_value || undefined,
        confidence_interval_lower: p.confidence_interval_lower || undefined,
        confidence_interval_upper: p.confidence_interval_upper || undefined,
        is_validated: p.is_validated || false,
      }));
      setDiscoveredPatterns(discovered);

      // Fetch metrics for all variants
      const { data: metrics, error: metricsError } = await supabase
        .from('daily_metrics')
        .select('variant_id, sent_count, opened_count, replied_count, positive_reply_count')
        .eq('workspace_id', currentWorkspace.id)
        .not('variant_id', 'is', null);

      if (metricsError) throw metricsError;

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

      // Process subject lines with extracted features
      const subjectAnalysis: SubjectLineAnalysis[] = (variants || [])
        .filter(v => v.subject_line)
        .map(v => {
          const m = metricsMap.get(v.id) || { sent: 0, opened: 0, replied: 0, positive: 0 };
          const subjectLine = v.subject_line || '';
          const feat = featuresMap.get(v.id);
          
          // Use extracted features if available, otherwise fallback
          const charCount = feat?.subject_char_count ?? subjectLine.length;
          const wordCount = feat?.subject_word_count ?? subjectLine.split(/\s+/).filter(Boolean).length;
          const hasQuestion = feat?.subject_is_question ?? subjectLine.includes('?');
          const hasNumber = feat?.subject_has_number ?? /\d/.test(subjectLine);
          const hasEmoji = feat?.subject_has_emoji ?? /[\u{1F600}-\u{1F64F}]/u.test(subjectLine);
          const spamScore = feat?.subject_spam_score ?? 0;
          const capStyle = feat?.subject_capitalization_style ?? 'normal';
          
          // Detect personalization type from features or fallback
          let persType: PersonalizationType = 'none';
          if (feat?.subject_personalization_count && feat.subject_personalization_count > 0) {
            persType = detectPersonalizationType(subjectLine);
          } else {
            persType = detectPersonalizationType(subjectLine);
          }
          
          return {
            variant_id: v.id,
            campaign_id: v.campaign_id,
            campaign_name: (v.campaigns as any)?.name || 'Unknown',
            variant_name: v.name,
            subject_line: subjectLine,
            
            sent_count: m.sent,
            open_count: m.opened,
            reply_count: m.replied,
            positive_count: m.positive,
            meeting_count: 0,
            
            open_rate: m.sent > 0 ? (m.opened / m.sent) * 100 : 0,
            reply_rate: m.sent > 0 ? (m.replied / m.sent) * 100 : 0,
            positive_rate: m.sent > 0 ? (m.positive / m.sent) * 100 : 0,
            
            personalization_type: persType,
            format_type: detectFormatType(subjectLine),
            length_category: getLengthCategory(charCount),
            char_count: charCount,
            word_count: wordCount,
            has_question: hasQuestion,
            has_number: hasNumber,
            has_emoji: hasEmoji,
            spam_score: spamScore,
            capitalization_style: capStyle,
            
            confidence_level: getConfidenceLevel(m.sent),
          };
        });

      setSubjectLines(subjectAnalysis);

      // Process body copy with extracted features
      const bodyAnalysis: BodyCopyAnalysis[] = (variants || [])
        .filter(v => v.body_preview || v.email_body)
        .map(v => {
          const m = metricsMap.get(v.id) || { sent: 0, opened: 0, replied: 0, positive: 0 };
          const body = v.email_body || v.body_preview || '';
          const vars = Array.isArray(v.personalization_vars) 
            ? (v.personalization_vars as string[]) 
            : [];
          const feat = featuresMap.get(v.id);
          
          // Use extracted features if available
          const wordCount = feat?.body_word_count ?? v.word_count ?? body.split(/\s+/).filter(Boolean).length;
          const sentenceCount = feat?.body_sentence_count ?? 0;
          const paragraphCount = feat?.body_paragraph_count ?? 0;
          const hasLink = feat?.body_has_link ?? /https?:\/\/|www\./i.test(body);
          const hasQuestion = feat?.body_question_count ? feat.body_question_count > 0 : body.includes('?');
          const ctaType = (feat?.body_cta_type as any) ?? detectCTAType(body);
          const ctaPosition = feat?.body_cta_position ?? 'unknown';
          const bodyTone = feat?.body_tone ?? 'professional';
          const readingGrade = feat?.body_reading_grade ?? 0;
          
          // Calculate personalization depth from features or vars
          const persDepth = feat?.body_personalization_density 
            ? Math.min(4, Math.floor(feat.body_personalization_density * 10)) as 0 | 1 | 2 | 3 | 4
            : detectPersonalizationDepth(vars);
          
          return {
            variant_id: v.id,
            campaign_name: (v.campaigns as any)?.name || 'Unknown',
            subject_line: v.subject_line || '',
            body_preview: v.body_preview || body.substring(0, 200),
            email_body: v.email_body,
            
            sent_count: m.sent,
            reply_count: m.replied,
            positive_count: m.positive,
            reply_rate: m.sent > 0 ? (m.replied / m.sent) * 100 : 0,
            positive_rate: m.sent > 0 ? (m.positive / m.sent) * 100 : 0,
            
            word_count: wordCount,
            personalization_depth: persDepth,
            personalization_vars: feat?.body_personalization_types || vars,
            has_link: hasLink,
            has_question: hasQuestion,
            has_cta: ctaType !== 'none',
            cta_type: ctaType,
            cta_position: ctaPosition,
            body_tone: bodyTone,
            reading_grade: readingGrade,
            sentence_count: sentenceCount,
            paragraph_count: paragraphCount,
            
            confidence_level: getConfidenceLevel(m.sent),
          };
        });

      setBodyCopy(bodyAnalysis);
    } catch (err) {
      console.error('Error fetching copy analytics:', err);
      setError('Failed to load copy analytics');
    } finally {
      setLoading(false);
    }
  };

  // Calculate pattern analysis (fallback when no discovered patterns)
  const patterns = useMemo((): PatternAnalysis[] => {
    // If we have discovered patterns from DB, prioritize those
    if (discoveredPatterns.length > 0) {
      return discoveredPatterns;
    }
    
    if (subjectLines.length === 0) return [];

    const baseline = subjectLines.reduce((sum, s) => sum + s.reply_rate, 0) / subjectLines.length;
    const computedPatterns: PatternAnalysis[] = [];

    // Personalization patterns
    const personalizationGroups = subjectLines.reduce((acc, s) => {
      const key = s.personalization_type;
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {} as Record<PersonalizationType, SubjectLineAnalysis[]>);

    Object.entries(personalizationGroups).forEach(([type, items]) => {
      const totalSent = items.reduce((sum, i) => sum + i.sent_count, 0);
      const avgReply = totalSent > 0 
        ? items.reduce((sum, i) => sum + i.reply_rate * i.sent_count, 0) / totalSent 
        : 0;
      const avgPositive = totalSent > 0
        ? items.reduce((sum, i) => sum + i.positive_rate * i.sent_count, 0) / totalSent
        : 0;

      computedPatterns.push({
        pattern: `Contains {{${type}}}`,
        description: `Subject lines with ${type.replace('_', ' ')} personalization`,
        sample_size: totalSent,
        avg_reply_rate: avgReply,
        avg_positive_rate: avgPositive,
        significance: totalSent >= 500 ? 'high' : totalSent >= 200 ? 'medium' : 'low',
        comparison_to_baseline: baseline > 0 ? ((avgReply - baseline) / baseline) * 100 : 0,
      });
    });

    // Format patterns
    const formatGroups = subjectLines.reduce((acc, s) => {
      const key = s.format_type;
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {} as Record<FormatType, SubjectLineAnalysis[]>);

    Object.entries(formatGroups).forEach(([type, items]) => {
      const totalSent = items.reduce((sum, i) => sum + i.sent_count, 0);
      const avgReply = totalSent > 0
        ? items.reduce((sum, i) => sum + i.reply_rate * i.sent_count, 0) / totalSent
        : 0;
      const avgPositive = totalSent > 0
        ? items.reduce((sum, i) => sum + i.positive_rate * i.sent_count, 0) / totalSent
        : 0;

      computedPatterns.push({
        pattern: `${type.replace('_', ' ')} format`,
        description: `Subject lines using ${type.replace('_', ' ')} format`,
        sample_size: totalSent,
        avg_reply_rate: avgReply,
        avg_positive_rate: avgPositive,
        significance: totalSent >= 500 ? 'high' : totalSent >= 200 ? 'medium' : 'low',
        comparison_to_baseline: baseline > 0 ? ((avgReply - baseline) / baseline) * 100 : 0,
      });
    });

    // Length patterns
    const lengthGroups = subjectLines.reduce((acc, s) => {
      const key = s.length_category;
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {} as Record<LengthCategory, SubjectLineAnalysis[]>);

    Object.entries(lengthGroups).forEach(([type, items]) => {
      const totalSent = items.reduce((sum, i) => sum + i.sent_count, 0);
      const avgReply = totalSent > 0
        ? items.reduce((sum, i) => sum + i.reply_rate * i.sent_count, 0) / totalSent
        : 0;
      const avgPositive = totalSent > 0
        ? items.reduce((sum, i) => sum + i.positive_rate * i.sent_count, 0) / totalSent
        : 0;

      const charRange = type === 'very_short' ? '1-20' : type === 'short' ? '21-40' : type === 'medium' ? '41-60' : '61+';

      computedPatterns.push({
        pattern: `Length ${charRange} chars`,
        description: `Subject lines with ${type.replace('_', ' ')} length`,
        sample_size: totalSent,
        avg_reply_rate: avgReply,
        avg_positive_rate: avgPositive,
        significance: totalSent >= 500 ? 'high' : totalSent >= 200 ? 'medium' : 'low',
        comparison_to_baseline: baseline > 0 ? ((avgReply - baseline) / baseline) * 100 : 0,
      });
    });

    return computedPatterns.sort((a, b) => b.avg_reply_rate - a.avg_reply_rate);
  }, [subjectLines, discoveredPatterns]);

  // Top performers
  const topPerformers = useMemo(() => {
    return [...subjectLines]
      .filter(s => s.sent_count >= 100)
      .sort((a, b) => b.reply_rate - a.reply_rate)
      .slice(0, 5);
  }, [subjectLines]);

  // Generate recommendations
  const recommendations = useMemo(() => {
    const recs: string[] = [];
    
    if (patterns.length === 0) return recs;

    // Find best personalization
    const personalizationPatterns = patterns.filter(p => p.pattern.includes('{{'));
    if (personalizationPatterns.length > 0) {
      const best = personalizationPatterns.sort((a, b) => b.avg_reply_rate - a.avg_reply_rate)[0];
      if (best.significance !== 'low') {
        recs.push(`${best.pattern} outperforms other personalization types with ${best.avg_reply_rate.toFixed(1)}% reply rate`);
      }
    }

    // Find best format
    const formatPatterns = patterns.filter(p => p.pattern.includes('format'));
    if (formatPatterns.length > 0) {
      const best = formatPatterns.sort((a, b) => b.avg_reply_rate - a.avg_reply_rate)[0];
      if (best.significance !== 'low') {
        recs.push(`${best.pattern} achieves ${best.comparison_to_baseline > 0 ? '+' : ''}${best.comparison_to_baseline.toFixed(0)}% vs baseline`);
      }
    }

    // Length recommendation
    const lengthPatterns = patterns.filter(p => p.pattern.includes('Length'));
    if (lengthPatterns.length > 0) {
      const best = lengthPatterns.sort((a, b) => b.avg_reply_rate - a.avg_reply_rate)[0];
      if (best.significance !== 'low') {
        recs.push(`${best.pattern} performs best for subject line length`);
      }
    }

    // Add validated pattern recommendations
    const validatedPatterns = discoveredPatterns.filter(p => p.is_validated && p.significance === 'high');
    if (validatedPatterns.length > 0) {
      const top = validatedPatterns[0];
      recs.push(`✓ Validated: "${top.pattern}" shows ${top.avg_reply_rate.toFixed(1)}% reply rate (statistically significant)`);
    }

    return recs;
  }, [patterns, discoveredPatterns]);

  return {
    subjectLines,
    bodyCopy,
    patterns,
    discoveredPatterns,
    topPerformers,
    recommendations,
    loading,
    error,
  };
}
