import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

// Segmentation types based on the framework
export type SeniorityLevel = 'executive' | 'vp' | 'director' | 'manager' | 'individual';
export type CompanySize = 'smb' | 'lower_mid' | 'upper_mid' | 'enterprise' | 'large_enterprise' | 'unknown';

export interface SegmentPerformance {
  segment: string;
  segment_type: 'title' | 'company_size' | 'industry' | 'email_type' | 'lead_source' | 'location';
  total_leads: number;
  contacted: number;
  opened: number;
  replied: number;
  positive_replies: number;
  reply_rate: number;
  positive_rate: number;
  open_rate: number;
  confidence_level: 'low' | 'medium' | 'high';
}

export interface TitlePerformance {
  title: string;
  seniority: SeniorityLevel;
  total: number;
  contacted: number;
  replied: number;
  positive: number;
  reply_rate: number;
  positive_rate: number;
  confidence_level: 'low' | 'medium' | 'high';
}

export interface IndustryPerformance {
  industry: string;
  total: number;
  contacted: number;
  replied: number;
  positive: number;
  reply_rate: number;
  positive_rate: number;
  confidence_level: 'low' | 'medium' | 'high';
}

export interface CompanySizePerformance {
  size_category: CompanySize;
  label: string;
  total: number;
  contacted: number;
  replied: number;
  positive: number;
  reply_rate: number;
  positive_rate: number;
  confidence_level: 'low' | 'medium' | 'high';
}

export interface DomainPerformance {
  domain: string;
  email_type: 'work' | 'personal';
  total: number;
  replied: number;
  positive: number;
  reply_rate: number;
  positive_rate: number;
}

export interface ICPInsight {
  dimension: string;
  finding: string;
  recommendation: string;
  confidence: 'hypothesis_confirmed' | 'hypothesis_refined' | 'hypothesis_challenged';
  data_point: string;
}

export interface AudienceAnalyticsData {
  segments: SegmentPerformance[];
  titles: TitlePerformance[];
  industries: IndustryPerformance[];
  companySizes: CompanySizePerformance[];
  domains: DomainPerformance[];
  icpInsights: ICPInsight[];
  totalLeads: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Helper functions
function getSeniorityLevel(title: string): SeniorityLevel {
  const lower = title.toLowerCase();
  if (lower.includes('ceo') || lower.includes('cfo') || lower.includes('cto') || lower.includes('coo') || 
      lower.includes('chief') || lower.includes('president') || lower.includes('owner') || lower.includes('founder')) {
    return 'executive';
  }
  if (lower.includes('vp ') || lower.includes('vice president')) {
    return 'vp';
  }
  if (lower.includes('director') || lower.includes('head of')) {
    return 'director';
  }
  if (lower.includes('manager') || lower.includes('lead') || lower.includes('supervisor')) {
    return 'manager';
  }
  return 'individual';
}

function getCompanySizeCategory(size: string | null): CompanySize {
  if (!size) return 'unknown';
  const lower = size.toLowerCase();
  
  // Try to parse as number range
  const match = lower.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    if (num <= 50) return 'smb';
    if (num <= 200) return 'lower_mid';
    if (num <= 1000) return 'upper_mid';
    if (num <= 5000) return 'enterprise';
    return 'large_enterprise';
  }
  
  // Text-based matching
  if (lower.includes('small') || lower.includes('startup') || lower.includes('1-')) return 'smb';
  if (lower.includes('mid') || lower.includes('medium')) return 'upper_mid';
  if (lower.includes('enterprise') || lower.includes('large')) return 'enterprise';
  
  return 'unknown';
}

function getCompanySizeLabel(size: CompanySize): string {
  switch (size) {
    case 'smb': return 'SMB (1-50)';
    case 'lower_mid': return 'Lower Mid-Market (51-200)';
    case 'upper_mid': return 'Upper Mid-Market (201-1000)';
    case 'enterprise': return 'Enterprise (1001-5000)';
    case 'large_enterprise': return 'Large Enterprise (5000+)';
    default: return 'Unknown';
  }
}

function getConfidenceLevel(sampleSize: number): 'low' | 'medium' | 'high' {
  if (sampleSize < 50) return 'low';
  if (sampleSize < 200) return 'medium';
  return 'high';
}

export function useAudienceAnalytics(): AudienceAnalyticsData {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const fetchData = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch leads with attributes
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, email, email_type, email_domain, company, title, industry, company_size, location, lead_source')
        .eq('workspace_id', currentWorkspace.id);

      if (leadsError) throw leadsError;

      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('message_events')
        .select('lead_id, event_type')
        .eq('workspace_id', currentWorkspace.id);

      if (eventsError) throw eventsError;

      setLeads(leadsData || []);
      setEvents(eventsData || []);
    } catch (err) {
      console.error('Error fetching audience data:', err);
      setError('Failed to load audience analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchData();
    }
  }, [currentWorkspace?.id]);

  // Process title performance
  const titles = useMemo((): TitlePerformance[] => {
    if (leads.length === 0) return [];

    const titleMap = new Map<string, TitlePerformance>();

    leads.forEach(lead => {
      const title = lead.title || 'Unknown';
      const seniority = getSeniorityLevel(title);
      
      if (!titleMap.has(title)) {
        titleMap.set(title, {
          title,
          seniority,
          total: 0,
          contacted: 0,
          replied: 0,
          positive: 0,
          reply_rate: 0,
          positive_rate: 0,
          confidence_level: 'low',
        });
      }

      const stats = titleMap.get(title)!;
      stats.total++;

      const leadEvents = events.filter(e => e.lead_id === lead.id);
      if (leadEvents.some(e => e.event_type === 'sent')) stats.contacted++;
      if (leadEvents.some(e => ['reply', 'replied', 'positive_reply', 'negative_reply'].includes(e.event_type))) stats.replied++;
      if (leadEvents.some(e => ['positive_reply', 'interested'].includes(e.event_type))) stats.positive++;
    });

    return Array.from(titleMap.values())
      .map(t => ({
        ...t,
        reply_rate: t.contacted > 0 ? (t.replied / t.contacted) * 100 : 0,
        positive_rate: t.contacted > 0 ? (t.positive / t.contacted) * 100 : 0,
        confidence_level: getConfidenceLevel(t.contacted),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }, [leads, events]);

  // Process industry performance
  const industries = useMemo((): IndustryPerformance[] => {
    if (leads.length === 0) return [];

    const industryMap = new Map<string, IndustryPerformance>();

    leads.forEach(lead => {
      const industry = lead.industry || 'Unknown';
      
      if (!industryMap.has(industry)) {
        industryMap.set(industry, {
          industry,
          total: 0,
          contacted: 0,
          replied: 0,
          positive: 0,
          reply_rate: 0,
          positive_rate: 0,
          confidence_level: 'low',
        });
      }

      const stats = industryMap.get(industry)!;
      stats.total++;

      const leadEvents = events.filter(e => e.lead_id === lead.id);
      if (leadEvents.some(e => e.event_type === 'sent')) stats.contacted++;
      if (leadEvents.some(e => ['reply', 'replied', 'positive_reply', 'negative_reply'].includes(e.event_type))) stats.replied++;
      if (leadEvents.some(e => ['positive_reply', 'interested'].includes(e.event_type))) stats.positive++;
    });

    return Array.from(industryMap.values())
      .map(t => ({
        ...t,
        reply_rate: t.contacted > 0 ? (t.replied / t.contacted) * 100 : 0,
        positive_rate: t.contacted > 0 ? (t.positive / t.contacted) * 100 : 0,
        confidence_level: getConfidenceLevel(t.contacted),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [leads, events]);

  // Process company size performance
  const companySizes = useMemo((): CompanySizePerformance[] => {
    if (leads.length === 0) return [];

    const sizeMap = new Map<CompanySize, CompanySizePerformance>();

    leads.forEach(lead => {
      const sizeCategory = getCompanySizeCategory(lead.company_size);
      
      if (!sizeMap.has(sizeCategory)) {
        sizeMap.set(sizeCategory, {
          size_category: sizeCategory,
          label: getCompanySizeLabel(sizeCategory),
          total: 0,
          contacted: 0,
          replied: 0,
          positive: 0,
          reply_rate: 0,
          positive_rate: 0,
          confidence_level: 'low',
        });
      }

      const stats = sizeMap.get(sizeCategory)!;
      stats.total++;

      const leadEvents = events.filter(e => e.lead_id === lead.id);
      if (leadEvents.some(e => e.event_type === 'sent')) stats.contacted++;
      if (leadEvents.some(e => ['reply', 'replied', 'positive_reply', 'negative_reply'].includes(e.event_type))) stats.replied++;
      if (leadEvents.some(e => ['positive_reply', 'interested'].includes(e.event_type))) stats.positive++;
    });

    return Array.from(sizeMap.values())
      .map(t => ({
        ...t,
        reply_rate: t.contacted > 0 ? (t.replied / t.contacted) * 100 : 0,
        positive_rate: t.contacted > 0 ? (t.positive / t.contacted) * 100 : 0,
        confidence_level: getConfidenceLevel(t.contacted),
      }))
      .sort((a, b) => b.total - a.total);
  }, [leads, events]);

  // Process domain performance
  const domains = useMemo((): DomainPerformance[] => {
    if (leads.length === 0) return [];

    const domainMap = new Map<string, DomainPerformance>();

    leads.forEach(lead => {
      const domain = lead.email_domain || 'unknown';
      
      if (!domainMap.has(domain)) {
        domainMap.set(domain, {
          domain,
          email_type: lead.email_type || 'work',
          total: 0,
          replied: 0,
          positive: 0,
          reply_rate: 0,
          positive_rate: 0,
        });
      }

      const stats = domainMap.get(domain)!;
      stats.total++;

      const leadEvents = events.filter(e => e.lead_id === lead.id);
      if (leadEvents.some(e => ['reply', 'replied', 'positive_reply', 'negative_reply'].includes(e.event_type))) stats.replied++;
      if (leadEvents.some(e => ['positive_reply', 'interested'].includes(e.event_type))) stats.positive++;
    });

    return Array.from(domainMap.values())
      .map(t => ({
        ...t,
        reply_rate: t.total > 0 ? (t.replied / t.total) * 100 : 0,
        positive_rate: t.total > 0 ? (t.positive / t.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 30);
  }, [leads, events]);

  // Create segments for overview
  const segments = useMemo((): SegmentPerformance[] => {
    const segs: SegmentPerformance[] = [];

    // Email type segments
    const emailTypes = new Map<string, SegmentPerformance>();
    leads.forEach(lead => {
      const type = lead.email_type || 'unknown';
      if (!emailTypes.has(type)) {
        emailTypes.set(type, {
          segment: type,
          segment_type: 'email_type',
          total_leads: 0,
          contacted: 0,
          opened: 0,
          replied: 0,
          positive_replies: 0,
          reply_rate: 0,
          positive_rate: 0,
          open_rate: 0,
          confidence_level: 'low',
        });
      }
      const s = emailTypes.get(type)!;
      s.total_leads++;
      const leadEvents = events.filter(e => e.lead_id === lead.id);
      if (leadEvents.some(e => e.event_type === 'sent')) s.contacted++;
      if (leadEvents.some(e => e.event_type === 'open')) s.opened++;
      if (leadEvents.some(e => ['reply', 'replied', 'positive_reply', 'negative_reply'].includes(e.event_type))) s.replied++;
      if (leadEvents.some(e => ['positive_reply', 'interested'].includes(e.event_type))) s.positive_replies++;
    });

    emailTypes.forEach(s => {
      s.reply_rate = s.contacted > 0 ? (s.replied / s.contacted) * 100 : 0;
      s.positive_rate = s.contacted > 0 ? (s.positive_replies / s.contacted) * 100 : 0;
      s.open_rate = s.contacted > 0 ? (s.opened / s.contacted) * 100 : 0;
      s.confidence_level = getConfidenceLevel(s.contacted);
      segs.push(s);
    });

    return segs;
  }, [leads, events]);

  // Generate ICP insights
  const icpInsights = useMemo((): ICPInsight[] => {
    const insights: ICPInsight[] = [];

    // Find best performing title
    const highConfidenceTitles = titles.filter(t => t.confidence_level !== 'low');
    if (highConfidenceTitles.length > 0) {
      const best = highConfidenceTitles.sort((a, b) => b.positive_rate - a.positive_rate)[0];
      if (best.positive_rate > 3) {
        insights.push({
          dimension: 'Job Title',
          finding: `${best.title} has ${best.positive_rate.toFixed(1)}% positive reply rate`,
          recommendation: `Consider focusing more outreach on ${best.seniority} level roles`,
          confidence: 'hypothesis_confirmed',
          data_point: `${best.contacted} contacted, ${best.positive} positive replies`,
        });
      }
    }

    // Find best industry
    const highConfidenceIndustries = industries.filter(i => i.confidence_level !== 'low');
    if (highConfidenceIndustries.length > 0) {
      const best = highConfidenceIndustries.sort((a, b) => b.positive_rate - a.positive_rate)[0];
      if (best.positive_rate > 3) {
        insights.push({
          dimension: 'Industry',
          finding: `${best.industry} shows ${best.positive_rate.toFixed(1)}% positive rate`,
          recommendation: `Increase targeting in ${best.industry} vertical`,
          confidence: 'hypothesis_confirmed',
          data_point: `${best.contacted} contacted, ${best.replied} replies`,
        });
      }
    }

    // Email type insight
    const workEmails = segments.find(s => s.segment === 'work');
    const personalEmails = segments.find(s => s.segment === 'personal');
    if (workEmails && personalEmails && workEmails.contacted >= 50 && personalEmails.contacted >= 50) {
      const diff = workEmails.reply_rate - personalEmails.reply_rate;
      insights.push({
        dimension: 'Email Type',
        finding: `Work emails have ${Math.abs(diff).toFixed(1)}% ${diff > 0 ? 'higher' : 'lower'} reply rate than personal`,
        recommendation: diff > 0 ? 'Prioritize work email addresses' : 'Personal emails may be worth testing more',
        confidence: Math.abs(diff) > 2 ? 'hypothesis_confirmed' : 'hypothesis_refined',
        data_point: `Work: ${workEmails.reply_rate.toFixed(1)}%, Personal: ${personalEmails.reply_rate.toFixed(1)}%`,
      });
    }

    return insights;
  }, [titles, industries, segments]);

  return {
    segments,
    titles,
    industries,
    companySizes,
    domains,
    icpInsights,
    totalLeads: leads.length,
    loading,
    error,
    refetch: fetchData,
  };
}
