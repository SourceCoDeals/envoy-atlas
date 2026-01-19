import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { subDays, startOfDay, parseISO, format, getHours, eachDayOfInterval } from 'date-fns';

export type DateRangeOption = '7d' | '14d' | '30d' | 'all';

export interface PhoneBurnerFilters {
  analyst: string;
  category: string;
  primaryOpportunity: string;
  durationRange: string;
  dateRange: DateRangeOption;
}

export interface CallData {
  id: string;
  analyst: string | null;
  category: string | null;
  primary_opportunity: string | null;
  duration_seconds: number | null;
  called_at: string | null;
  contact_company: string | null;
  contact_name: string | null;
  composite_score: number | null;
  seller_interest_score: number | null;
}

function normalizeCategory(category: string | null): string {
  if (!category) return 'Unknown';
  const lower = category.toLowerCase();
  if (lower.includes('voicemail')) return 'Voicemail';
  if (lower.includes('no answer')) return 'No Answer';
  if (lower.includes('connected')) return 'Connected';
  if (lower.includes('meeting')) return 'Meeting Scheduled';
  return category;
}

export function usePhoneBurnerData() {
  const { currentWorkspace } = useWorkspace();
  
  const [filters, setFilters] = useState<PhoneBurnerFilters>({
    analyst: 'all',
    category: 'all',
    primaryOpportunity: 'all',
    durationRange: 'all',
    dateRange: '30d',
  });

  // Fetch calls from call_activities table instead
  const { data: allCalls = [], isLoading } = useQuery({
    queryKey: ['call_activities_phoneburner', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      const { data: engagements } = await supabase
        .from('engagements')
        .select('id')
        .eq('client_id', currentWorkspace.id);

      const engagementIds = (engagements || []).map(e => e.id);
      if (engagementIds.length === 0) return [];

      const { data, error } = await supabase
        .from('call_activities')
        .select('id, caller_name, disposition, conversation_outcome, talk_duration, started_at, to_name, notes')
        .in('engagement_id', engagementIds)
        .limit(1000);

      if (error) throw error;
      
      return (data || []).map(c => ({
        id: c.id,
        analyst: c.caller_name,
        category: c.disposition,
        primary_opportunity: c.conversation_outcome,
        duration_seconds: c.talk_duration,
        called_at: c.started_at,
        contact_company: null,
        contact_name: c.to_name,
        composite_score: null,
        seller_interest_score: null,
      })) as CallData[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000,
  });

  const filterOptions = useMemo(() => {
    const analysts = [...new Set(allCalls.map(c => c.analyst).filter(Boolean))].sort();
    const categories = [...new Set(allCalls.map(c => normalizeCategory(c.category)))].filter(c => c !== 'Unknown').sort();
    const opportunities = [...new Set(allCalls.map(c => c.primary_opportunity).filter(Boolean))].sort();
    return { analysts, categories, opportunities };
  }, [allCalls]);

  const filteredCalls = useMemo(() => {
    let result = allCalls;
    if (filters.dateRange !== 'all') {
      const daysMap = { '7d': 7, '14d': 14, '30d': 30 };
      const cutoffDate = startOfDay(subDays(new Date(), daysMap[filters.dateRange]));
      result = result.filter(call => call.called_at && parseISO(call.called_at) >= cutoffDate);
    }
    if (filters.analyst !== 'all') result = result.filter(call => call.analyst === filters.analyst);
    if (filters.category !== 'all') result = result.filter(call => normalizeCategory(call.category) === filters.category);
    return result;
  }, [allCalls, filters]);

  const summary = useMemo(() => {
    const totalCalls = filteredCalls.length;
    const callsWithDuration = filteredCalls.filter(c => c.duration_seconds != null);
    const avgDuration = callsWithDuration.length > 0
      ? callsWithDuration.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / callsWithDuration.length
      : 0;
    const totalDuration = callsWithDuration.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    return { totalCalls, avgDuration, totalDuration };
  }, [filteredCalls]);

  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filteredCalls.forEach(call => {
      const cat = normalizeCategory(call.category);
      breakdown[cat] = (breakdown[cat] || 0) + 1;
    });
    return Object.entries(breakdown).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredCalls]);

  return {
    filters,
    setFilters,
    filterOptions,
    filteredCalls,
    summary,
    categoryBreakdown,
    callsByAnalystOverTime: [],
    uniqueAnalysts: [],
    scatterData: [],
    callsByOpportunity: [],
    durationDistribution: [],
    durationTrends: [],
    isLoading,
  };
}
