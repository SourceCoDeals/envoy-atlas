import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  SeniorityLevel,
  DepartmentType,
  CompanySizeCategory,
  classifySeniority,
  classifyDepartment,
  classifyCompanySize,
  classifyEmailType,
  extractEmailDomain,
  getSeniorityLabel,
  getDepartmentLabel,
  getCompanySizeLabel,
  SENIORITY_ORDER,
} from '@/lib/segmentClassification';

// ========== TYPES ==========
export interface SegmentPerformance {
  segment: string;
  segmentKey: string;
  segmentType: 'seniority' | 'department' | 'industry' | 'company_size' | 'email_type';
  totalLeads: number;
  contacted: number;
  replied: number;
  positiveReplies: number;
  meetings: number;
  replyRate: number;
  positiveRate: number;
  vsAverage: number;
  confidenceLevel: 'low' | 'medium' | 'high' | 'insufficient';
}

export interface SegmentCopyInteraction {
  segment: string;
  segmentType: 'seniority' | 'department' | 'industry';
  pattern: string;
  patternType: string;
  replyRate: number;
  segmentAvgReplyRate: number;
  patternAvgReplyRate: number;
  sampleSize: number;
  liftVsSegment: number;
  liftVsPattern: number;
  isSignificant: boolean;
}

export interface DataQuality {
  totalLeads: number;
  enrichedLeads: number;
  enrichmentPercent: number;
  hasEnoughData: boolean;
  uniqueTitles: number;
  uniqueIndustries: number;
  uniqueSeniorityLevels: number;
  issues: string[];
}

export interface AudienceAnalyticsData {
  // Performance by segment type
  seniorityPerformance: SegmentPerformance[];
  departmentPerformance: SegmentPerformance[];
  industryPerformance: SegmentPerformance[];
  companySizePerformance: SegmentPerformance[];
  emailTypePerformance: SegmentPerformance[];
  
  // Segment x Copy matrix data
  segmentCopyInteractions: SegmentCopyInteraction[];
  
  // Summary stats
  totalLeads: number;
  totalContacted: number;
  totalReplied: number;
  avgReplyRate: number;
  avgPositiveRate: number;
  
  // Best/worst segments
  bestSegment: SegmentPerformance | null;
  worstSegment: SegmentPerformance | null;
  
  // Data quality info
  dataQuality: DataQuality;
  
  // State
  loading: boolean;
  error: string | null;
  refetch: () => void;
  triggerEnrichment: () => Promise<void>;
}

function getConfidenceLevel(sampleSize: number): 'low' | 'medium' | 'high' | 'insufficient' {
  if (sampleSize >= 500) return 'high';
  if (sampleSize >= 200) return 'medium';
  if (sampleSize >= 50) return 'low';
  return 'insufficient';
}

function calculatePValue(rate1: number, n1: number, rate2: number, n2: number): number {
  // Simplified z-test for proportions
  if (n1 < 30 || n2 < 30) return 1;
  
  const p1 = rate1 / 100;
  const p2 = rate2 / 100;
  const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
  
  if (se === 0) return 1;
  
  const z = Math.abs(p1 - p2) / se;
  // Approximate p-value from z-score
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

export function useAudienceAnalytics(): AudienceAnalyticsData {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [variantFeatures, setVariantFeatures] = useState<any[]>([]);

  const fetchData = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch leads with enrichment data
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, email, email_type, email_domain, company, title, industry, company_size, location, lead_source, seniority_level, department, company_size_category, enriched_at')
        .eq('workspace_id', currentWorkspace.id);

      if (leadsError) throw leadsError;

      // Fetch events with variant info
      const { data: eventsData, error: eventsError } = await supabase
        .from('message_events')
        .select('lead_id, event_type, variant_id, reply_sentiment')
        .eq('workspace_id', currentWorkspace.id);

      if (eventsError) throw eventsError;

      // Fetch variant features for copy pattern analysis
      const { data: featuresData, error: featuresError } = await supabase
        .from('campaign_variant_features')
        .select('variant_id, subject_first_word_type, subject_is_question, body_cta_type, body_personalization_types')
        .eq('workspace_id', currentWorkspace.id);

      if (!featuresError) {
        setVariantFeatures(featuresData || []);
      }

      setLeads(leadsData || []);
      setEvents(eventsData || []);
    } catch (err) {
      console.error('Error fetching audience data:', err);
      setError('Failed to load audience analytics');
    } finally {
      setLoading(false);
    }
  };

  const triggerEnrichment = async () => {
    if (!currentWorkspace?.id) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('enrich-leads', {
        body: { workspace_id: currentWorkspace.id, batch_size: 1000 }
      });
      
      if (error) throw error;
      console.log('Enrichment result:', data);
      
      // Refetch data after enrichment
      await fetchData();
    } catch (err) {
      console.error('Enrichment error:', err);
    }
  };

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchData();
    }
  }, [currentWorkspace?.id]);

  // Calculate data quality metrics
  const dataQuality = useMemo((): DataQuality => {
    const enrichedCount = leads.filter(l => l.enriched_at || l.seniority_level).length;
    const uniqueTitles = new Set(leads.map(l => l.title).filter(Boolean)).size;
    const uniqueIndustries = new Set(leads.map(l => l.industry).filter(Boolean)).size;
    
    // Count unique seniority levels (from enriched data or derived)
    const seniorityLevels = new Set(
      leads.map(l => l.seniority_level || classifySeniority(l.title)).filter(s => s !== 'unknown')
    );
    
    const issues: string[] = [];
    if (uniqueTitles === 0) issues.push('No job title data available');
    if (uniqueIndustries === 0) issues.push('No industry data available');
    if (enrichedCount < leads.length * 0.5) issues.push(`Only ${Math.round(enrichedCount / leads.length * 100)}% of leads are enriched`);
    if (leads.length < 100) issues.push('Limited sample size - need more leads for reliable insights');
    
    return {
      totalLeads: leads.length,
      enrichedLeads: enrichedCount,
      enrichmentPercent: leads.length > 0 ? (enrichedCount / leads.length) * 100 : 0,
      hasEnoughData: leads.length >= 100 && (uniqueTitles > 1 || seniorityLevels.size > 1),
      uniqueTitles,
      uniqueIndustries,
      uniqueSeniorityLevels: seniorityLevels.size,
      issues,
    };
  }, [leads]);

  // Build event lookup for performance
  const eventsByLead = useMemo(() => {
    const map = new Map<string, any[]>();
    events.forEach(e => {
      const existing = map.get(e.lead_id) || [];
      existing.push(e);
      map.set(e.lead_id, existing);
    });
    return map;
  }, [events]);

  // Helper to calculate segment performance
  const calculateSegmentPerformance = (
    segmentKey: string,
    segmentLabel: string,
    segmentType: SegmentPerformance['segmentType'],
    segmentLeads: any[],
    avgReplyRate: number
  ): SegmentPerformance => {
    let contacted = 0;
    let replied = 0;
    let positiveReplies = 0;
    let meetings = 0;

    segmentLeads.forEach(lead => {
      const leadEvents = eventsByLead.get(lead.id) || [];
      const wasSent = leadEvents.some(e => e.event_type === 'sent');
      const hasReply = leadEvents.some(e => ['reply', 'replied', 'positive_reply', 'negative_reply'].includes(e.event_type));
      const hasPositive = leadEvents.some(e => e.event_type === 'positive_reply' || e.reply_sentiment === 'positive' || e.reply_sentiment === 'interested');
      const hasMeeting = leadEvents.some(e => e.event_type === 'meeting_booked' || e.reply_sentiment === 'meeting');

      if (wasSent) contacted++;
      if (hasReply) replied++;
      if (hasPositive) positiveReplies++;
      if (hasMeeting) meetings++;
    });

    const replyRate = contacted > 0 ? (replied / contacted) * 100 : 0;
    const positiveRate = contacted > 0 ? (positiveReplies / contacted) * 100 : 0;
    const vsAverage = avgReplyRate > 0 ? ((replyRate - avgReplyRate) / avgReplyRate) * 100 : 0;

    return {
      segment: segmentLabel,
      segmentKey,
      segmentType,
      totalLeads: segmentLeads.length,
      contacted,
      replied,
      positiveReplies,
      meetings,
      replyRate,
      positiveRate,
      vsAverage,
      confidenceLevel: getConfidenceLevel(contacted),
    };
  };

  // Calculate overall metrics first
  const { totalContacted, totalReplied, avgReplyRate, avgPositiveRate } = useMemo(() => {
    let contacted = 0;
    let replied = 0;
    let positive = 0;

    leads.forEach(lead => {
      const leadEvents = eventsByLead.get(lead.id) || [];
      const wasSent = leadEvents.some(e => e.event_type === 'sent');
      const hasReply = leadEvents.some(e => ['reply', 'replied', 'positive_reply', 'negative_reply'].includes(e.event_type));
      const hasPositive = leadEvents.some(e => e.event_type === 'positive_reply' || e.reply_sentiment === 'positive');

      if (wasSent) contacted++;
      if (hasReply) replied++;
      if (hasPositive) positive++;
    });

    return {
      totalContacted: contacted,
      totalReplied: replied,
      avgReplyRate: contacted > 0 ? (replied / contacted) * 100 : 0,
      avgPositiveRate: contacted > 0 ? (positive / contacted) * 100 : 0,
    };
  }, [leads, eventsByLead]);

  // Calculate seniority performance
  const seniorityPerformance = useMemo((): SegmentPerformance[] => {
    const segmentMap = new Map<SeniorityLevel, any[]>();

    leads.forEach(lead => {
      // Use enriched seniority_level or derive from title
      const seniority = (lead.seniority_level as SeniorityLevel) || classifySeniority(lead.title);
      const existing = segmentMap.get(seniority) || [];
      existing.push(lead);
      segmentMap.set(seniority, existing);
    });

    return SENIORITY_ORDER
      .filter(level => segmentMap.has(level) && level !== 'unknown')
      .map(level => calculateSegmentPerformance(
        level,
        getSeniorityLabel(level),
        'seniority',
        segmentMap.get(level) || [],
        avgReplyRate
      ))
      .filter(s => s.contacted > 0)
      .sort((a, b) => b.replyRate - a.replyRate);
  }, [leads, eventsByLead, avgReplyRate]);

  // Calculate industry performance
  const industryPerformance = useMemo((): SegmentPerformance[] => {
    const segmentMap = new Map<string, any[]>();

    leads.forEach(lead => {
      const industry = lead.industry || 'Unknown';
      if (industry === 'Unknown') return;
      
      const existing = segmentMap.get(industry) || [];
      existing.push(lead);
      segmentMap.set(industry, existing);
    });

    return Array.from(segmentMap.entries())
      .map(([industry, segmentLeads]) => calculateSegmentPerformance(
        industry,
        industry,
        'industry',
        segmentLeads,
        avgReplyRate
      ))
      .filter(s => s.contacted >= 10) // Minimum threshold
      .sort((a, b) => b.replyRate - a.replyRate)
      .slice(0, 15);
  }, [leads, eventsByLead, avgReplyRate]);

  // Calculate department performance
  const departmentPerformance = useMemo((): SegmentPerformance[] => {
    const segmentMap = new Map<DepartmentType, any[]>();

    leads.forEach(lead => {
      const dept = (lead.department as DepartmentType) || classifyDepartment(lead.title);
      if (dept === 'other') return;
      
      const existing = segmentMap.get(dept) || [];
      existing.push(lead);
      segmentMap.set(dept, existing);
    });

    return Array.from(segmentMap.entries())
      .map(([dept, segmentLeads]) => calculateSegmentPerformance(
        dept,
        getDepartmentLabel(dept),
        'department',
        segmentLeads,
        avgReplyRate
      ))
      .filter(s => s.contacted >= 10)
      .sort((a, b) => b.replyRate - a.replyRate);
  }, [leads, eventsByLead, avgReplyRate]);

  // Calculate company size performance
  const companySizePerformance = useMemo((): SegmentPerformance[] => {
    const segmentMap = new Map<CompanySizeCategory, any[]>();

    leads.forEach(lead => {
      const size = (lead.company_size_category as CompanySizeCategory) || classifyCompanySize(lead.company_size);
      if (size === 'unknown') return;
      
      const existing = segmentMap.get(size) || [];
      existing.push(lead);
      segmentMap.set(size, existing);
    });

    return Array.from(segmentMap.entries())
      .map(([size, segmentLeads]) => calculateSegmentPerformance(
        size,
        getCompanySizeLabel(size),
        'company_size',
        segmentLeads,
        avgReplyRate
      ))
      .filter(s => s.contacted >= 10)
      .sort((a, b) => b.replyRate - a.replyRate);
  }, [leads, eventsByLead, avgReplyRate]);

  // Calculate email type performance
  const emailTypePerformance = useMemo((): SegmentPerformance[] => {
    const segmentMap = new Map<string, any[]>();

    leads.forEach(lead => {
      const emailType = lead.email_type || classifyEmailType(lead.email);
      if (emailType === 'unknown') return;
      
      const existing = segmentMap.get(emailType) || [];
      existing.push(lead);
      segmentMap.set(emailType, existing);
    });

    return Array.from(segmentMap.entries())
      .map(([type, segmentLeads]) => calculateSegmentPerformance(
        type,
        type === 'work' ? 'Work Email' : 'Personal Email',
        'email_type',
        segmentLeads,
        avgReplyRate
      ))
      .filter(s => s.contacted >= 10)
      .sort((a, b) => b.replyRate - a.replyRate);
  }, [leads, eventsByLead, avgReplyRate]);

  // Calculate segment x copy interactions
  const segmentCopyInteractions = useMemo((): SegmentCopyInteraction[] => {
    if (variantFeatures.length === 0 || seniorityPerformance.length === 0) return [];

    const interactions: SegmentCopyInteraction[] = [];
    
    // Build variant -> pattern mapping
    const variantPatterns = new Map<string, string>();
    variantFeatures.forEach(vf => {
      // Determine primary pattern from features
      let pattern = 'other';
      if (vf.subject_is_question) pattern = 'question_subject';
      else if (vf.body_personalization_types?.length > 0) pattern = 'personalized_open';
      else if (vf.body_cta_type === 'soft') pattern = 'soft_cta';
      else if (vf.body_cta_type === 'direct') pattern = 'direct_cta';
      else if (vf.subject_first_word_type === 'verb') pattern = 'value_first';
      
      variantPatterns.set(vf.variant_id, pattern);
    });

    // Build performance by segment x pattern
    const matrixData = new Map<string, { sent: number; replied: number }>();

    leads.forEach(lead => {
      const seniority = (lead.seniority_level as SeniorityLevel) || classifySeniority(lead.title);
      if (seniority === 'unknown') return;

      const leadEvents = eventsByLead.get(lead.id) || [];
      
      leadEvents.forEach(event => {
        if (event.event_type === 'sent' && event.variant_id) {
          const pattern = variantPatterns.get(event.variant_id);
          if (!pattern || pattern === 'other') return;

          const key = `${seniority}::${pattern}`;
          const existing = matrixData.get(key) || { sent: 0, replied: 0 };
          existing.sent++;
          
          // Check if this lead replied
          if (leadEvents.some(e => ['reply', 'replied', 'positive_reply'].includes(e.event_type))) {
            existing.replied++;
          }
          
          matrixData.set(key, existing);
        }
      });
    });

    // Convert to interactions with lift calculations
    const patternAvgs = new Map<string, { sent: number; replied: number }>();
    const segmentAvgs = new Map<string, { sent: number; replied: number }>();

    matrixData.forEach((data, key) => {
      const [segment, pattern] = key.split('::');
      
      // Pattern average
      const patternData = patternAvgs.get(pattern) || { sent: 0, replied: 0 };
      patternData.sent += data.sent;
      patternData.replied += data.replied;
      patternAvgs.set(pattern, patternData);

      // Segment average
      const segmentData = segmentAvgs.get(segment) || { sent: 0, replied: 0 };
      segmentData.sent += data.sent;
      segmentData.replied += data.replied;
      segmentAvgs.set(segment, segmentData);
    });

    matrixData.forEach((data, key) => {
      const [segment, pattern] = key.split('::');
      if (data.sent < 30) return; // Minimum sample size

      const replyRate = (data.replied / data.sent) * 100;
      
      const segmentAvg = segmentAvgs.get(segment);
      const patternAvg = patternAvgs.get(pattern);
      
      const segmentAvgRate = segmentAvg ? (segmentAvg.replied / segmentAvg.sent) * 100 : avgReplyRate;
      const patternAvgRate = patternAvg ? (patternAvg.replied / patternAvg.sent) * 100 : avgReplyRate;

      const liftVsSegment = segmentAvgRate > 0 ? ((replyRate - segmentAvgRate) / segmentAvgRate) * 100 : 0;
      const liftVsPattern = patternAvgRate > 0 ? ((replyRate - patternAvgRate) / patternAvgRate) * 100 : 0;

      // Calculate statistical significance
      const pValue = calculatePValue(replyRate, data.sent, segmentAvgRate, segmentAvg?.sent || 100);
      const isSignificant = pValue < 0.05 && Math.abs(liftVsSegment) > 10;

      interactions.push({
        segment: getSeniorityLabel(segment as SeniorityLevel),
        segmentType: 'seniority',
        pattern,
        patternType: 'combined',
        replyRate,
        segmentAvgReplyRate: segmentAvgRate,
        patternAvgReplyRate: patternAvgRate,
        sampleSize: data.sent,
        liftVsSegment,
        liftVsPattern,
        isSignificant,
      });
    });

    return interactions.sort((a, b) => Math.abs(b.liftVsSegment) - Math.abs(a.liftVsSegment));
  }, [leads, events, eventsByLead, variantFeatures, seniorityPerformance, avgReplyRate]);

  // Find best/worst segments
  const { bestSegment, worstSegment } = useMemo(() => {
    const allSegments = [...seniorityPerformance, ...industryPerformance].filter(
      s => s.confidenceLevel !== 'insufficient' && s.contacted >= 50
    );

    if (allSegments.length === 0) return { bestSegment: null, worstSegment: null };

    const sorted = [...allSegments].sort((a, b) => b.replyRate - a.replyRate);
    return {
      bestSegment: sorted[0] || null,
      worstSegment: sorted[sorted.length - 1] || null,
    };
  }, [seniorityPerformance, industryPerformance]);

  return {
    seniorityPerformance,
    departmentPerformance,
    industryPerformance,
    companySizePerformance,
    emailTypePerformance,
    segmentCopyInteractions,
    totalLeads: leads.length,
    totalContacted,
    totalReplied,
    avgReplyRate,
    avgPositiveRate,
    bestSegment,
    worstSegment,
    dataQuality,
    loading,
    error,
    refetch: fetchData,
    triggerEnrichment,
  };
}
