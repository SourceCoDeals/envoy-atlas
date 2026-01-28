import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { calculateRate, calculateWoWChange } from '@/lib/metrics';
import { logger } from '@/lib/logger';

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
  platform: string;
  
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
  
  // Analysis
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
  
  confidence_level: 'low' | 'medium' | 'high';
}

export interface BodyCopyAnalysis {
  variant_id: string;
  campaign_name: string;
  subject_line: string;
  body_preview: string;
  email_body: string | null;
  platform: string;
  
  // Metrics
  sent_count: number;
  reply_count: number;
  positive_count: number;
  reply_rate: number;
  positive_rate: number;
  
  // Body analysis
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
  bullet_count: number;
  
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

// Helper functions for analysis
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
  subject_length: number | null;
  subject_word_count: number | null;
  subject_has_personalization: boolean | null;
  subject_has_number: boolean | null;
  subject_has_emoji: boolean | null;
  subject_capitalization: string | null;
  subject_punctuation: string | null;
  body_word_count: number | null;
  body_sentence_count: number | null;
  body_paragraph_count: number | null;
  body_question_count: number | null;
  body_bullet_count: number | null;
  body_has_bullets: boolean | null;
  body_link_count: number | null;
  body_cta_type: string | null;
  body_cta_position: string | null;
  tone: string | null;
  body_reading_grade: number | null;
  body_personalization_count: number | null;
  body_has_calendar_link: boolean | null;
}

// Unified variant interface for processing
interface UnifiedVariant {
  id: string;
  name: string;
  subject_line: string | null;
  body_preview: string | null;
  body_plain: string | null;
  campaign_id: string;
  campaign_name: string;
  total_sent: number;
  total_opened: number;
  total_replied: number;
  positive_replies: number;
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
      // Get engagements for this workspace
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);
      if (engagementIds.length === 0) {
        setSubjectLines([]);
        setBodyCopy([]);
        setDiscoveredPatterns([]);
        setLoading(false);
        return;
      }

      // Fetch campaigns for these engagements
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .in('engagement_id', engagementIds);

      const campaignIds = (campaigns || []).map(c => c.id);
      const campaignMap = new Map<string, string>();
      (campaigns || []).forEach(c => campaignMap.set(c.id, c.name));

      if (campaignIds.length === 0) {
        setSubjectLines([]);
        setBodyCopy([]);
        setDiscoveredPatterns([]);
        setLoading(false);
        return;
      }

      // Fetch variants for these campaigns
      const { data: variantsData } = await supabase
        .from('campaign_variants')
        .select('*')
        .in('campaign_id', campaignIds);

      const variants: UnifiedVariant[] = (variantsData || []).map(v => ({
        id: v.id,
        name: v.subject_line || 'Variant',
        subject_line: v.subject_line,
        body_preview: v.body_preview,
        body_plain: v.body_plain,
        campaign_id: v.campaign_id,
        campaign_name: campaignMap.get(v.campaign_id) || 'Unknown',
        total_sent: v.total_sent || 0,
        total_opened: v.total_opened || 0,
        total_replied: v.total_replied || 0,
        positive_replies: v.positive_replies || 0,
      }));

      // Fetch extracted features
      const variantIds = variants.map(v => v.id);
      const { data: featuresData } = await supabase
        .from('campaign_variant_features')
        .select('*')
        .in('variant_id', variantIds);

      const featuresMap = new Map<string, VariantFeatures>();
      (featuresData || []).forEach(f => {
        featuresMap.set(f.variant_id, f as VariantFeatures);
      });

      // Fetch discovered patterns
      const { data: dbPatterns } = await supabase
        .from('copy_patterns')
        .select('*')
        .in('engagement_id', engagementIds)
        .order('avg_reply_rate', { ascending: false });

      // Transform DB patterns to PatternAnalysis
      const discovered: PatternAnalysis[] = (dbPatterns || []).map(p => ({
        pattern: p.pattern_type,
        description: p.pattern_value || '',
        sample_size: p.total_sent || 0,
        avg_reply_rate: p.avg_reply_rate || 0,
        avg_positive_rate: 0,
        significance: p.is_significant ? 'high' : 'low',
        comparison_to_baseline: p.lift_vs_baseline || 0,
        p_value: p.p_value || undefined,
        confidence_interval_lower: p.reply_rate_ci_lower || undefined,
        confidence_interval_upper: p.reply_rate_ci_upper || undefined,
        is_validated: p.is_significant || false,
      }));
      setDiscoveredPatterns(discovered);

      // Process subject lines
      const subjectAnalysis: SubjectLineAnalysis[] = variants
        .filter(v => v.subject_line)
        .map(v => {
          const subjectLine = v.subject_line || '';
          const feat = featuresMap.get(v.id);
          
          const charCount = feat?.subject_length ?? subjectLine.length;
          const wordCount = feat?.subject_word_count ?? subjectLine.split(/\s+/).filter(Boolean).length;
          const hasQuestion = subjectLine.includes('?');
          const hasNumber = feat?.subject_has_number ?? /\d/.test(subjectLine);
          const hasEmoji = feat?.subject_has_emoji ?? /[\u{1F600}-\u{1F64F}]/u.test(subjectLine);
          const capStyle = feat?.subject_capitalization ?? 'normal';
          
          const persType = detectPersonalizationType(subjectLine);
          
          // Use delivered as denominator for engagement rates
          const delivered = v.total_sent; // No bounced data per variant available here
          
          return {
            variant_id: v.id,
            campaign_id: v.campaign_id,
            campaign_name: v.campaign_name,
            variant_name: v.name,
            subject_line: subjectLine,
            platform: 'email',
            
            sent_count: v.total_sent,
            open_count: v.total_opened,
            reply_count: v.total_replied,
            positive_count: v.positive_replies,
            meeting_count: 0,
            
            open_rate: calculateRate(v.total_opened, delivered),
            reply_rate: calculateRate(v.total_replied, delivered),
            positive_rate: calculateRate(v.positive_replies, delivered),
            
            personalization_type: persType,
            format_type: detectFormatType(subjectLine),
            length_category: getLengthCategory(charCount),
            char_count: charCount,
            word_count: wordCount,
            has_question: hasQuestion,
            has_number: hasNumber,
            has_emoji: hasEmoji,
            spam_score: 0,
            capitalization_style: capStyle,
            
            confidence_level: getConfidenceLevel(v.total_sent),
          };
        })
        .sort((a, b) => b.reply_rate - a.reply_rate);

      setSubjectLines(subjectAnalysis);

      // Process body copy
      const bodyAnalysis: BodyCopyAnalysis[] = variants
        .filter(v => v.body_plain || v.body_preview)
        .map(v => {
          const body = v.body_plain || v.body_preview || '';
          const feat = featuresMap.get(v.id);
          
          const wordCount = feat?.body_word_count ?? body.split(/\s+/).filter(Boolean).length;
          const sentenceCount = feat?.body_sentence_count ?? (body.match(/[.!?]+/g) || []).length;
          const paragraphCount = feat?.body_paragraph_count ?? (body.split(/\n\n+/).length);
          const bulletCount = feat?.body_bullet_count ?? 0;
          const hasLink = (feat?.body_link_count ?? 0) > 0 || body.includes('http');
          const hasQuestion = (feat?.body_question_count ?? 0) > 0 || body.includes('?');
          const ctaType = (feat?.body_cta_type as any) ?? detectCTAType(body);
          const ctaPosition = feat?.body_cta_position ?? 'end';
          const tone = feat?.tone ?? 'professional';
          const readingGrade = feat?.body_reading_grade ?? 8;
          
          // Use delivered as denominator for engagement rates
          const delivered = v.total_sent; // No bounced data per variant available here
          
          return {
            variant_id: v.id,
            campaign_name: v.campaign_name,
            subject_line: v.subject_line || '',
            body_preview: v.body_preview || '',
            email_body: v.body_plain,
            platform: 'email',
            
            sent_count: v.total_sent,
            reply_count: v.total_replied,
            positive_count: v.positive_replies,
            reply_rate: calculateRate(v.total_replied, delivered),
            positive_rate: calculateRate(v.positive_replies, delivered),
            
            word_count: wordCount,
            personalization_depth: detectPersonalizationDepth([]),
            personalization_vars: [],
            has_link: hasLink,
            has_question: hasQuestion,
            has_cta: ctaType !== 'none',
            cta_type: ctaType,
            cta_position: ctaPosition,
            body_tone: tone,
            reading_grade: readingGrade,
            sentence_count: sentenceCount,
            paragraph_count: paragraphCount,
            bullet_count: bulletCount,
            
            confidence_level: getConfidenceLevel(v.total_sent),
          };
        })
        .sort((a, b) => b.reply_rate - a.reply_rate);

      setBodyCopy(bodyAnalysis);
    } catch (err) {
      logger.error('Error fetching copy analytics', err);
      setError(err instanceof Error ? err.message : 'Failed to load copy analytics');
    } finally {
      setLoading(false);
    }
  };

  // Compute patterns from data
  const patterns = useMemo(() => {
    const patternMap = new Map<string, { 
      samples: SubjectLineAnalysis[]; 
      description: string;
    }>();

    // Group by personalization type
    subjectLines.forEach(sl => {
      const key = `personalization_${sl.personalization_type}`;
      if (!patternMap.has(key)) {
        patternMap.set(key, { samples: [], description: `Personalization: ${sl.personalization_type}` });
      }
      patternMap.get(key)!.samples.push(sl);
    });

    // Group by format type
    subjectLines.forEach(sl => {
      const key = `format_${sl.format_type}`;
      if (!patternMap.has(key)) {
        patternMap.set(key, { samples: [], description: `Format: ${sl.format_type}` });
      }
      patternMap.get(key)!.samples.push(sl);
    });

    // Group by length category
    subjectLines.forEach(sl => {
      const key = `length_${sl.length_category}`;
      if (!patternMap.has(key)) {
        patternMap.set(key, { samples: [], description: `Length: ${sl.length_category}` });
      }
      patternMap.get(key)!.samples.push(sl);
    });

    const baselineReplyRate = subjectLines.length > 0
      ? subjectLines.reduce((sum, sl) => sum + sl.reply_rate, 0) / subjectLines.length
      : 0;

    return Array.from(patternMap.entries())
      .map(([pattern, { samples, description }]) => {
        const totalSent = samples.reduce((sum, s) => sum + s.sent_count, 0);
        const avgReplyRate = samples.length > 0
          ? samples.reduce((sum, s) => sum + s.reply_rate, 0) / samples.length
          : 0;
        const avgPositiveRate = samples.length > 0
          ? samples.reduce((sum, s) => sum + s.positive_rate, 0) / samples.length
          : 0;

        return {
          pattern,
          description,
          sample_size: totalSent,
          avg_reply_rate: avgReplyRate,
          avg_positive_rate: avgPositiveRate,
          significance: getConfidenceLevel(totalSent),
          comparison_to_baseline: calculateWoWChange(avgReplyRate, baselineReplyRate),
        };
      })
      .filter(p => p.sample_size > 0)
      .sort((a, b) => b.avg_reply_rate - a.avg_reply_rate);
  }, [subjectLines]);

  // Top performers
  const topPerformers = useMemo(() => {
    return subjectLines
      .filter(sl => sl.sent_count >= 100)
      .slice(0, 10);
  }, [subjectLines]);

  // Generate recommendations
  const recommendations = useMemo(() => {
    const recs: string[] = [];
    
    if (subjectLines.length === 0) {
      return ['No email variants found. Connect your email platform to get copy insights.'];
    }

    // Find best performing patterns
    const topPattern = patterns[0];
    if (topPattern && topPattern.comparison_to_baseline > 10) {
      recs.push(`"${topPattern.description}" is outperforming baseline by ${topPattern.comparison_to_baseline.toFixed(1)}%`);
    }

    // Check personalization impact
    const personalized = subjectLines.filter(sl => sl.personalization_type !== 'none');
    const nonPersonalized = subjectLines.filter(sl => sl.personalization_type === 'none');
    if (personalized.length > 0 && nonPersonalized.length > 0) {
      const persReplyRate = personalized.reduce((sum, s) => sum + s.reply_rate, 0) / personalized.length;
      const nonPersReplyRate = nonPersonalized.reduce((sum, s) => sum + s.reply_rate, 0) / nonPersonalized.length;
      if (persReplyRate > nonPersReplyRate * 1.1) {
        const improvement = calculateWoWChange(persReplyRate, nonPersReplyRate);
        recs.push(`Personalized subject lines are getting ${improvement.toFixed(0)}% higher reply rates`);
      }
    }

    // Check question format
    const questions = subjectLines.filter(sl => sl.has_question);
    if (questions.length > 0) {
      const avgQuestionReply = questions.reduce((sum, s) => sum + s.reply_rate, 0) / questions.length;
      const avgNonQuestionReply = subjectLines.filter(s => !s.has_question).length > 0
        ? subjectLines.filter(s => !s.has_question).reduce((sum, s) => sum + s.reply_rate, 0) / subjectLines.filter(s => !s.has_question).length
        : 0;
      if (avgQuestionReply > avgNonQuestionReply * 1.1) {
        recs.push('Subject lines with questions tend to get higher reply rates');
      }
    }

    if (recs.length === 0) {
      recs.push('Continue testing different subject line formats and personalization strategies');
    }

    return recs;
  }, [subjectLines, patterns]);

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

// Hook for copy insights with AI chat
export function useCopyInsightsData() {
  const analytics = useCopyAnalytics();
  
  return {
    ...analytics,
    hasData: analytics.subjectLines.length > 0 || analytics.bodyCopy.length > 0,
  };
}
