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
  
  // Analysis
  personalization_type: PersonalizationType;
  format_type: FormatType;
  length_category: LengthCategory;
  char_count: number;
  word_count: number;
  has_question: boolean;
  has_number: boolean;
  
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
  
  // Body analysis
  word_count: number;
  personalization_depth: 0 | 1 | 2 | 3 | 4;
  personalization_vars: string[];
  has_link: boolean;
  has_question: boolean;
  has_cta: boolean;
  cta_type: 'soft' | 'meeting' | 'calendar' | 'permission' | 'info' | 'binary' | 'none';
  
  confidence_level: 'low' | 'medium' | 'high';
}

export interface PatternAnalysis {
  pattern: string;
  description: string;
  sample_size: number;
  avg_reply_rate: number;
  avg_positive_rate: number;
  significance: 'low' | 'medium' | 'high';
  comparison_to_baseline: number; // percentage difference
}

export interface CopyAnalyticsData {
  subjectLines: SubjectLineAnalysis[];
  bodyCopy: BodyCopyAnalysis[];
  patterns: PatternAnalysis[];
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
  if (sampleSize < 500) return 'high';
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

export function useCopyAnalytics(): CopyAnalyticsData {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectLines, setSubjectLines] = useState<SubjectLineAnalysis[]>([]);
  const [bodyCopy, setBodyCopy] = useState<BodyCopyAnalysis[]>([]);

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

      // Process subject lines
      const subjectAnalysis: SubjectLineAnalysis[] = (variants || [])
        .filter(v => v.subject_line)
        .map(v => {
          const m = metricsMap.get(v.id) || { sent: 0, opened: 0, replied: 0, positive: 0 };
          const subjectLine = v.subject_line || '';
          
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
            meeting_count: 0, // Would need meeting tracking
            
            open_rate: m.sent > 0 ? (m.opened / m.sent) * 100 : 0,
            reply_rate: m.sent > 0 ? (m.replied / m.sent) * 100 : 0,
            positive_rate: m.sent > 0 ? (m.positive / m.sent) * 100 : 0,
            
            personalization_type: detectPersonalizationType(subjectLine),
            format_type: detectFormatType(subjectLine),
            length_category: getLengthCategory(subjectLine.length),
            char_count: subjectLine.length,
            word_count: subjectLine.split(/\s+/).filter(Boolean).length,
            has_question: subjectLine.includes('?'),
            has_number: /\d/.test(subjectLine),
            
            confidence_level: getConfidenceLevel(m.sent),
          };
        });

      setSubjectLines(subjectAnalysis);

      // Process body copy
      const bodyAnalysis: BodyCopyAnalysis[] = (variants || [])
        .filter(v => v.body_preview || v.email_body)
        .map(v => {
          const m = metricsMap.get(v.id) || { sent: 0, opened: 0, replied: 0, positive: 0 };
          const body = v.email_body || v.body_preview || '';
          const vars = Array.isArray(v.personalization_vars) 
            ? (v.personalization_vars as string[]) 
            : [];
          
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
            
            word_count: v.word_count || body.split(/\s+/).filter(Boolean).length,
            personalization_depth: detectPersonalizationDepth(vars),
            personalization_vars: vars,
            has_link: /https?:\/\/|www\./i.test(body),
            has_question: body.includes('?'),
            has_cta: true, // Assume all have CTA
            cta_type: detectCTAType(body),
            
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

  // Calculate pattern analysis
  const patterns = useMemo((): PatternAnalysis[] => {
    if (subjectLines.length === 0) return [];

    const baseline = subjectLines.reduce((sum, s) => sum + s.reply_rate, 0) / subjectLines.length;
    const patterns: PatternAnalysis[] = [];

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

      patterns.push({
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

      patterns.push({
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

      patterns.push({
        pattern: `Length ${charRange} chars`,
        description: `Subject lines with ${type.replace('_', ' ')} length`,
        sample_size: totalSent,
        avg_reply_rate: avgReply,
        avg_positive_rate: avgPositive,
        significance: totalSent >= 500 ? 'high' : totalSent >= 200 ? 'medium' : 'low',
        comparison_to_baseline: baseline > 0 ? ((avgReply - baseline) / baseline) * 100 : 0,
      });
    });

    return patterns.sort((a, b) => b.avg_reply_rate - a.avg_reply_rate);
  }, [subjectLines]);

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

    return recs;
  }, [patterns]);

  return {
    subjectLines,
    bodyCopy,
    patterns,
    topPerformers,
    recommendations,
    loading,
    error,
  };
}
