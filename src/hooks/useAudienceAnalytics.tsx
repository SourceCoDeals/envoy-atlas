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
  seniorityPerformance: SegmentPerformance[];
  departmentPerformance: SegmentPerformance[];
  industryPerformance: SegmentPerformance[];
  companySizePerformance: SegmentPerformance[];
  emailTypePerformance: SegmentPerformance[];
  segmentCopyInteractions: SegmentCopyInteraction[];
  totalLeads: number;
  totalContacted: number;
  totalReplied: number;
  avgReplyRate: number;
  avgPositiveRate: number;
  bestSegment: SegmentPerformance | null;
  worstSegment: SegmentPerformance | null;
  dataQuality: DataQuality;
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

export function useAudienceAnalytics(): AudienceAnalyticsData {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [emailActivities, setEmailActivities] = useState<any[]>([]);
  const [variantFeatures, setVariantFeatures] = useState<any[]>([]);

  const fetchData = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    setError(null);

    try {
      // Get engagements for this client
      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      if (!engagements || engagements.length === 0) {
        setContacts([]);
        setEmailActivities([]);
        setLoading(false);
        return;
      }

      const engagementIds = engagements.map(e => e.id);

      // Fetch contacts with company info
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select(`
          id, email, title, department, seniority_level, company_size_category,
          companies(name, industry, employee_range)
        `)
        .in('engagement_id', engagementIds);

      if (contactsError) throw contactsError;

      // Fetch email activities for engagement metrics
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('email_activities')
        .select('contact_id, sent, opened, replied, reply_sentiment')
        .in('engagement_id', engagementIds);

      if (activitiesError) throw activitiesError;

      // Fetch variant features for copy pattern analysis
      const { data: featuresData } = await supabase
        .from('campaign_variant_features')
        .select('variant_id, subject_first_word_type, body_cta_type, body_has_personalization')
        .in('engagement_id', engagementIds);

      setContacts(contactsData || []);
      setEmailActivities(activitiesData || []);
      setVariantFeatures(featuresData || []);
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
      const { error } = await supabase.functions.invoke('enrich-leads', {
        body: { client_id: currentWorkspace.id, batch_size: 1000 }
      });
      
      if (error) throw error;
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

  // Build activity lookup by contact
  const activitiesByContact = useMemo(() => {
    const map = new Map<string, any[]>();
    emailActivities.forEach(a => {
      const existing = map.get(a.contact_id) || [];
      existing.push(a);
      map.set(a.contact_id, existing);
    });
    return map;
  }, [emailActivities]);

  // Calculate data quality metrics
  const dataQuality = useMemo((): DataQuality => {
    const enrichedCount = contacts.filter(c => c.seniority_level || c.department).length;
    const uniqueTitles = new Set(contacts.map(c => c.title).filter(Boolean)).size;
    const uniqueIndustries = new Set(contacts.map(c => c.companies?.industry).filter(Boolean)).size;
    const seniorityLevels = new Set(
      contacts.map(c => c.seniority_level || classifySeniority(c.title)).filter(s => s !== 'unknown')
    );
    
    const issues: string[] = [];
    if (uniqueTitles === 0) issues.push('No job title data available');
    if (uniqueIndustries === 0) issues.push('No industry data available');
    if (enrichedCount < contacts.length * 0.5) issues.push(`Only ${Math.round(enrichedCount / contacts.length * 100)}% of contacts are enriched`);
    if (contacts.length < 100) issues.push('Limited sample size - need more contacts for reliable insights');
    
    return {
      totalLeads: contacts.length,
      enrichedLeads: enrichedCount,
      enrichmentPercent: contacts.length > 0 ? (enrichedCount / contacts.length) * 100 : 0,
      hasEnoughData: contacts.length >= 100 && (uniqueTitles > 1 || seniorityLevels.size > 1),
      uniqueTitles,
      uniqueIndustries,
      uniqueSeniorityLevels: seniorityLevels.size,
      issues,
    };
  }, [contacts]);

  // Helper to calculate segment performance
  const calculateSegmentPerformance = (
    segmentKey: string,
    segmentLabel: string,
    segmentType: SegmentPerformance['segmentType'],
    segmentContacts: any[],
    avgReplyRate: number
  ): SegmentPerformance => {
    let contacted = 0;
    let replied = 0;
    let positiveReplies = 0;
    let meetings = 0;

    segmentContacts.forEach(contact => {
      const activities = activitiesByContact.get(contact.id) || [];
      const wasSent = activities.some(a => a.sent);
      const hasReply = activities.some(a => a.replied);
      const hasPositive = activities.some(a => a.reply_sentiment === 'positive' || a.reply_sentiment === 'interested');
      const hasMeeting = activities.some(a => a.reply_sentiment === 'meeting');

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
      totalLeads: segmentContacts.length,
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

  // Calculate overall metrics
  const { totalContacted, totalReplied, avgReplyRate, avgPositiveRate } = useMemo(() => {
    let contacted = 0;
    let replied = 0;
    let positive = 0;

    contacts.forEach(contact => {
      const activities = activitiesByContact.get(contact.id) || [];
      const wasSent = activities.some(a => a.sent);
      const hasReply = activities.some(a => a.replied);
      const hasPositive = activities.some(a => a.reply_sentiment === 'positive');

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
  }, [contacts, activitiesByContact]);

  // Calculate seniority performance
  const seniorityPerformance = useMemo((): SegmentPerformance[] => {
    const segmentMap = new Map<SeniorityLevel, any[]>();

    contacts.forEach(contact => {
      const seniority = (contact.seniority_level as SeniorityLevel) || classifySeniority(contact.title);
      const existing = segmentMap.get(seniority) || [];
      existing.push(contact);
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
  }, [contacts, activitiesByContact, avgReplyRate]);

  // Calculate industry performance
  const industryPerformance = useMemo((): SegmentPerformance[] => {
    const segmentMap = new Map<string, any[]>();

    contacts.forEach(contact => {
      const industry = contact.companies?.industry || 'Unknown';
      if (industry === 'Unknown') return;
      
      const existing = segmentMap.get(industry) || [];
      existing.push(contact);
      segmentMap.set(industry, existing);
    });

    return Array.from(segmentMap.entries())
      .map(([industry, segmentContacts]) => calculateSegmentPerformance(
        industry,
        industry,
        'industry',
        segmentContacts,
        avgReplyRate
      ))
      .filter(s => s.contacted >= 10)
      .sort((a, b) => b.replyRate - a.replyRate)
      .slice(0, 15);
  }, [contacts, activitiesByContact, avgReplyRate]);

  // Calculate department performance
  const departmentPerformance = useMemo((): SegmentPerformance[] => {
    const segmentMap = new Map<DepartmentType, any[]>();

    contacts.forEach(contact => {
      const dept = (contact.department as DepartmentType) || classifyDepartment(contact.title);
      if (dept === 'other') return;
      
      const existing = segmentMap.get(dept) || [];
      existing.push(contact);
      segmentMap.set(dept, existing);
    });

    return Array.from(segmentMap.entries())
      .map(([dept, segmentContacts]) => calculateSegmentPerformance(
        dept,
        getDepartmentLabel(dept),
        'department',
        segmentContacts,
        avgReplyRate
      ))
      .filter(s => s.contacted >= 10)
      .sort((a, b) => b.replyRate - a.replyRate);
  }, [contacts, activitiesByContact, avgReplyRate]);

  // Calculate company size performance
  const companySizePerformance = useMemo((): SegmentPerformance[] => {
    const segmentMap = new Map<CompanySizeCategory, any[]>();

    contacts.forEach(contact => {
      const size = (contact.company_size_category as CompanySizeCategory) || classifyCompanySize(contact.companies?.employee_range);
      if (size === 'unknown') return;
      
      const existing = segmentMap.get(size) || [];
      existing.push(contact);
      segmentMap.set(size, existing);
    });

    return Array.from(segmentMap.entries())
      .map(([size, segmentContacts]) => calculateSegmentPerformance(
        size,
        getCompanySizeLabel(size),
        'company_size',
        segmentContacts,
        avgReplyRate
      ))
      .filter(s => s.contacted >= 10)
      .sort((a, b) => b.replyRate - a.replyRate);
  }, [contacts, activitiesByContact, avgReplyRate]);

  // Calculate email type performance
  const emailTypePerformance = useMemo((): SegmentPerformance[] => {
    const segmentMap = new Map<string, any[]>();

    contacts.forEach(contact => {
      const emailType = classifyEmailType(contact.email);
      if (emailType === 'unknown') return;
      
      const existing = segmentMap.get(emailType) || [];
      existing.push(contact);
      segmentMap.set(emailType, existing);
    });

    return Array.from(segmentMap.entries())
      .map(([type, segmentContacts]) => calculateSegmentPerformance(
        type,
        type === 'work' ? 'Work Email' : 'Personal Email',
        'email_type',
        segmentContacts,
        avgReplyRate
      ))
      .filter(s => s.contacted >= 10)
      .sort((a, b) => b.replyRate - a.replyRate);
  }, [contacts, activitiesByContact, avgReplyRate]);

  // Find best/worst segments
  const allSegments = [...seniorityPerformance, ...industryPerformance, ...departmentPerformance]
    .filter(s => s.confidenceLevel !== 'insufficient');
  
  const bestSegment = allSegments.length > 0 
    ? allSegments.reduce((best, s) => s.replyRate > best.replyRate ? s : best, allSegments[0])
    : null;
    
  const worstSegment = allSegments.length > 0
    ? allSegments.reduce((worst, s) => s.replyRate < worst.replyRate ? s : worst, allSegments[0])
    : null;

  return {
    seniorityPerformance,
    departmentPerformance,
    industryPerformance,
    companySizePerformance,
    emailTypePerformance,
    segmentCopyInteractions: [], // TODO: Implement copy x segment matrix
    totalLeads: contacts.length,
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
