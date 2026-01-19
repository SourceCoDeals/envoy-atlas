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

// Normalize category by removing "- X seconds" patterns and consolidating similar categories
function normalizeCategory(category: string | null): string {
  if (!category) return 'Unknown';
  
  // First, strip any "- X seconds" or similar duration suffixes
  const secondsPattern = /\s*-\s*\d+\s*(seconds?|secs?|s)?\s*$/i;
  let normalized = category.replace(secondsPattern, '').trim();
  
  // Lowercase for comparison
  const lower = normalized.toLowerCase();
  
  // Consolidate common patterns into simplified categories
  if (lower.includes('hung up') || lower === 'hangup' || lower === 'hang up') {
    return 'Hung Up';
  }
  if (lower.includes('no answer') || lower === 'noanswer') {
    return 'No Answer';
  }
  if (lower.includes('voicemail') || lower === 'vm') {
    return 'Voicemail';
  }
  if (lower.includes('busy') || lower === 'busy signal') {
    return 'Busy';
  }
  if (lower.includes('wrong number') || lower === 'wrongnumber') {
    return 'Wrong Number';
  }
  if (lower.includes('disconnected') || lower === 'not in service' || lower.includes('not in service')) {
    return 'Disconnected';
  }
  if (lower.includes('gatekeeper') || lower.includes('receptionist') || lower.includes('assistant')) {
    if (lower.includes('voicemail') || lower.includes('vm')) {
      return 'Gatekeeper Voicemail';
    }
    return 'Gatekeeper';
  }
  if (lower.includes('callback') || lower.includes('call back')) {
    return 'Callback Scheduled';
  }
  if (lower.includes('connected') || lower.includes('conversation') || lower.includes('talked')) {
    return 'Connected';
  }
  if (lower.includes('left message') || lower.includes('left vm')) {
    return 'Left Message';
  }
  if (lower.includes('meeting') || lower.includes('appointment') || lower.includes('scheduled')) {
    return 'Meeting Scheduled';
  }
  if (lower.includes('not interested') || lower.includes('dnc') || lower.includes('do not call')) {
    return 'Not Interested';
  }
  
  return normalized || 'Unknown';
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

  // Fetch all calls from unified calls table
  const { data: allCalls = [], isLoading } = useQuery({
    queryKey: ['calls', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let allData: CallData[] = [];
      let offset = 0;
      const limit = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('calls')
          .select('id, analyst, category, primary_opportunity, duration_seconds, called_at, contact_company, contact_name, composite_score, seller_interest_score')
          .eq('workspace_id', currentWorkspace.id)
          .range(offset, offset + limit - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...(data as unknown as CallData[])];
        if (data.length < limit) break;
        offset += limit;
      }
      
      return allData;
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Get unique filter options (using normalized categories for the dropdown)
  const filterOptions = useMemo(() => {
    const analysts = [...new Set(allCalls.map(c => c.analyst).filter(Boolean))].sort();
    const categories = [...new Set(allCalls.map(c => normalizeCategory(c.category)))].filter(c => c !== 'Unknown').sort();
    const opportunities = [...new Set(allCalls.map(c => c.primary_opportunity).filter(Boolean))].sort();
    
    return { analysts, categories, opportunities };
  }, [allCalls]);

  // Apply filters (using called_at for all date-based filtering)
  const filteredCalls = useMemo(() => {
    let result = allCalls;

    // Date filter
    if (filters.dateRange !== 'all') {
      const daysMap = { '7d': 7, '14d': 14, '30d': 30 };
      const cutoffDate = startOfDay(subDays(new Date(), daysMap[filters.dateRange]));
      result = result.filter(call => {
        if (!call.called_at) return false;
        return parseISO(call.called_at) >= cutoffDate;
      });
    }

    // Analyst filter
    if (filters.analyst !== 'all') {
      result = result.filter(call => call.analyst === filters.analyst);
    }

    // Category filter (compare normalized categories)
    if (filters.category !== 'all') {
      result = result.filter(call => normalizeCategory(call.category) === filters.category);
    }

    // Primary opportunity filter
    if (filters.primaryOpportunity !== 'all') {
      result = result.filter(call => call.primary_opportunity === filters.primaryOpportunity);
    }

    // Duration range filter
    if (filters.durationRange !== 'all') {
      result = result.filter(call => {
        const duration = call.duration_seconds || 0;
        switch (filters.durationRange) {
          case '0-30': return duration <= 30;
          case '30-60': return duration > 30 && duration <= 60;
          case '60-120': return duration > 60 && duration <= 120;
          case '120+': return duration > 120;
          default: return true;
        }
      });
    }

    return result;
  }, [allCalls, filters]);

  // Calculate summary metrics
  const summary = useMemo(() => {
    const totalCalls = filteredCalls.length;
    const callsWithDuration = filteredCalls.filter(c => c.duration_seconds != null);
    const avgDuration = callsWithDuration.length > 0
      ? callsWithDuration.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / callsWithDuration.length
      : 0;
    const totalDuration = callsWithDuration.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);

    return { totalCalls, avgDuration, totalDuration };
  }, [filteredCalls]);

  // Category breakdown with normalized categories
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filteredCalls.forEach(call => {
      const cat = normalizeCategory(call.category);
      breakdown[cat] = (breakdown[cat] || 0) + 1;
    });
    return Object.entries(breakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredCalls]);

  // Get the date range for charts
  const dateRangeForCharts = useMemo(() => {
    if (filters.dateRange === 'all') {
      const dates = filteredCalls
        .filter(c => c.called_at)
        .map(c => parseISO(c.called_at!));
      if (dates.length === 0) return [];
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      return eachDayOfInterval({ start: startOfDay(minDate), end: startOfDay(maxDate) });
    }
    
    const daysMap = { '7d': 7, '14d': 14, '30d': 30 };
    const days = daysMap[filters.dateRange];
    const endDate = new Date();
    const startDate = subDays(endDate, days - 1);
    return eachDayOfInterval({ start: startOfDay(startDate), end: startOfDay(endDate) });
  }, [filters.dateRange, filteredCalls]);

  // Calls by analyst over time
  const callsByAnalystOverTime = useMemo(() => {
    const dataMap: Record<string, Record<string, number>> = {};
    const analysts = [...new Set(filteredCalls.map(c => c.analyst).filter(Boolean))] as string[];

    filteredCalls.forEach(call => {
      if (!call.called_at || !call.analyst) return;
      const date = format(parseISO(call.called_at), 'yyyy-MM-dd');
      
      if (!dataMap[call.analyst]) dataMap[call.analyst] = {};
      dataMap[call.analyst][date] = (dataMap[call.analyst][date] || 0) + 1;
    });

    return dateRangeForCharts.map(dateObj => {
      const date = format(dateObj, 'yyyy-MM-dd');
      const entry: Record<string, any> = { date };
      analysts.forEach(analyst => {
        entry[analyst] = dataMap[analyst]?.[date] || 0;
      });
      return entry;
    });
  }, [filteredCalls, dateRangeForCharts]);

  // Get unique analysts for chart legend
  const uniqueAnalysts = useMemo(() => {
    return [...new Set(filteredCalls.map(c => c.analyst).filter(Boolean))] as string[];
  }, [filteredCalls]);

  // Scatter plot data: time of day vs date
  const scatterData = useMemo(() => {
    let dateCutoff: Date | null = null;
    if (filters.dateRange !== 'all') {
      const daysMap = { '7d': 7, '14d': 14, '30d': 30 };
      dateCutoff = startOfDay(subDays(new Date(), daysMap[filters.dateRange]));
    }

    return filteredCalls
      .filter(call => call.called_at)
      .map(call => {
        const dateObj = parseISO(call.called_at!);
        const hour = getHours(dateObj);
        
        return {
          date: format(dateObj, 'yyyy-MM-dd'),
          hour,
          analyst: call.analyst || 'Unknown',
          adjustedDate: dateObj,
        };
      })
      .filter(item => {
        if (!dateCutoff) return true;
        return item.adjustedDate >= dateCutoff;
      })
      .map(({ date, hour, analyst }) => ({ date, hour, analyst }));
  }, [filteredCalls, filters.dateRange]);

  // Calls by primary opportunity
  const callsByOpportunity = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filteredCalls.forEach(call => {
      const opp = call.primary_opportunity || 'Unknown';
      breakdown[opp] = (breakdown[opp] || 0) + 1;
    });
    return Object.entries(breakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [filteredCalls]);

  // Duration distribution for pie chart
  const durationDistribution = useMemo(() => {
    const ranges = [
      { name: '0-30s', min: 0, max: 30 },
      { name: '30-60s', min: 30, max: 60 },
      { name: '1-2m', min: 60, max: 120 },
      { name: '2-5m', min: 120, max: 300 },
      { name: '5m+', min: 300, max: Infinity },
    ];

    return ranges.map(range => ({
      name: range.name,
      value: filteredCalls.filter(c => {
        const d = c.duration_seconds || 0;
        return d > range.min && d <= range.max;
      }).length,
    })).filter(r => r.value > 0);
  }, [filteredCalls]);

  // Daily duration trends
  const durationTrends = useMemo(() => {
    const dataMap: Record<string, { total: number; count: number }> = {};

    filteredCalls.forEach(call => {
      if (!call.called_at) return;
      const date = format(parseISO(call.called_at), 'yyyy-MM-dd');
      
      if (!dataMap[date]) dataMap[date] = { total: 0, count: 0 };
      if (call.duration_seconds != null) {
        dataMap[date].total += call.duration_seconds;
        dataMap[date].count += 1;
      }
    });

    return dateRangeForCharts.map(dateObj => {
      const date = format(dateObj, 'yyyy-MM-dd');
      const data = dataMap[date] || { total: 0, count: 0 };
      return {
        date,
        totalDuration: Math.round(data.total / 60),
        avgDuration: data.count > 0 ? Math.round(data.total / data.count) : 0,
        callCount: data.count,
      };
    });
  }, [filteredCalls, dateRangeForCharts]);

  return {
    filters,
    setFilters,
    filterOptions,
    filteredCalls,
    summary,
    categoryBreakdown,
    callsByAnalystOverTime,
    uniqueAnalysts,
    scatterData,
    callsByOpportunity,
    durationDistribution,
    durationTrends,
    isLoading,
  };
}
