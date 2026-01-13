import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { subDays, startOfDay, parseISO, format, getHours, eachDayOfInterval, addDays } from 'date-fns';

export type DateRangeOption = '7d' | '14d' | '30d' | 'all';

export interface PhoneBurnerFilters {
  analyst: string;
  category: string;
  primaryOpportunity: string;
  durationRange: string;
  dateRange: DateRangeOption;
}

export interface ColdCall {
  id: string;
  analyst: string | null;
  category: string | null;
  primary_opportunity: string | null;
  call_duration_sec: number | null;
  called_date: string | null;
  called_date_time: string | null;
  to_company: string | null;
  to_name: string | null;
  composite_score: number | null;
  seller_interest_score: number | null;
}

// Normalize category by removing "- X seconds" patterns
function normalizeCategory(category: string | null): string {
  if (!category) return 'Unknown';
  
  // Pattern: "Category - X seconds" or "Category- X seconds" or "Category -X seconds"
  const secondsPattern = /\s*-\s*\d+\s*seconds?$/i;
  
  if (secondsPattern.test(category)) {
    const baseCategory = category.replace(secondsPattern, '').trim();
    
    // Special handling for certain categories that should become voicemail variants
    const voicemailCategories = ['receptionist', 'gatekeeper', 'assistant'];
    const lowerBase = baseCategory.toLowerCase();
    
    if (voicemailCategories.some(vc => lowerBase.includes(vc))) {
      return `${baseCategory} Voicemail`;
    }
    
    // "No Answer - X seconds" becomes just "No Answer"
    if (lowerBase.includes('no answer')) {
      return 'No Answer';
    }
    
    // For other categories with seconds, keep base name (likely voicemails)
    return baseCategory;
  }
  
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

  // Fetch all cold calls
  const { data: allCalls = [], isLoading } = useQuery({
    queryKey: ['cold-calls', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];

      let allData: ColdCall[] = [];
      let offset = 0;
      const limit = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('cold_calls')
          .select('id, analyst, category, primary_opportunity, call_duration_sec, called_date, called_date_time, to_company, to_name, composite_score, seller_interest_score')
          .eq('workspace_id', currentWorkspace.id)
          .range(offset, offset + limit - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        
        // Cast to ColdCall[] since we know the shape
        allData = [...allData, ...(data as unknown as ColdCall[])];
        if (data.length < limit) break;
        offset += limit;
      }
      
      return allData;
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Get unique filter options
  const filterOptions = useMemo(() => {
    const analysts = [...new Set(allCalls.map(c => c.analyst).filter(Boolean))].sort();
    const categories = [...new Set(allCalls.map(c => c.category).filter(Boolean))].sort();
    const opportunities = [...new Set(allCalls.map(c => c.primary_opportunity).filter(Boolean))].sort();
    
    return { analysts, categories, opportunities };
  }, [allCalls]);

  // Apply filters (using called_date_time for all date-based filtering)
  const filteredCalls = useMemo(() => {
    let result = allCalls;

    // Date filter - use called_date_time for accurate filtering
    if (filters.dateRange !== 'all') {
      const daysMap = { '7d': 7, '14d': 14, '30d': 30 };
      const cutoffDate = startOfDay(subDays(new Date(), daysMap[filters.dateRange]));
      result = result.filter(call => {
        // Prefer called_date_time, fallback to called_date
        const dateStr = call.called_date_time || call.called_date;
        if (!dateStr) return false;
        return parseISO(dateStr) >= cutoffDate;
      });
    }

    // Analyst filter
    if (filters.analyst !== 'all') {
      result = result.filter(call => call.analyst === filters.analyst);
    }

    // Category filter
    if (filters.category !== 'all') {
      result = result.filter(call => call.category === filters.category);
    }

    // Primary opportunity filter
    if (filters.primaryOpportunity !== 'all') {
      result = result.filter(call => call.primary_opportunity === filters.primaryOpportunity);
    }

    // Duration range filter
    if (filters.durationRange !== 'all') {
      result = result.filter(call => {
        const duration = call.call_duration_sec || 0;
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
    const callsWithDuration = filteredCalls.filter(c => c.call_duration_sec != null);
    const avgDuration = callsWithDuration.length > 0
      ? callsWithDuration.reduce((sum, c) => sum + (c.call_duration_sec || 0), 0) / callsWithDuration.length
      : 0;
    const totalDuration = callsWithDuration.reduce((sum, c) => sum + (c.call_duration_sec || 0), 0);

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

  // Get the date range for charts (all days in range, using called_date_time)
  const dateRangeForCharts = useMemo(() => {
    if (filters.dateRange === 'all') {
      // For "all time", use actual data range from called_date_time
      const dates = filteredCalls
        .filter(c => c.called_date_time || c.called_date)
        .map(c => parseISO((c.called_date_time || c.called_date)!));
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

  // Calls by analyst over time (includes all days in range, using called_date_time)
  const callsByAnalystOverTime = useMemo(() => {
    const dataMap: Record<string, Record<string, number>> = {};
    
    // Get all unique analysts first
    const analysts = [...new Set(filteredCalls.map(c => c.analyst).filter(Boolean))] as string[];

    filteredCalls.forEach(call => {
      const dateStr = call.called_date_time || call.called_date;
      if (!dateStr || !call.analyst) return;
      const date = format(parseISO(dateStr), 'yyyy-MM-dd');
      
      if (!dataMap[call.analyst]) dataMap[call.analyst] = {};
      dataMap[call.analyst][date] = (dataMap[call.analyst][date] || 0) + 1;
    });

    // Use all dates in range, not just dates with data
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

  // Scatter plot data: time of day vs date (using called_date_time for accurate timestamps)
  const scatterData = useMemo(() => {
    return filteredCalls
      .filter(call => call.called_date_time)
      .map(call => {
        const dateObj = parseISO(call.called_date_time!);
        // Add 5 hours to adjust for timezone offset (UTC to EST)
        const adjustedHour = (getHours(dateObj) + 5) % 24;
        return {
          date: format(dateObj, 'yyyy-MM-dd'),
          hour: adjustedHour,
          analyst: call.analyst || 'Unknown',
        };
      });
  }, [filteredCalls]);

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
      .slice(0, 15); // Top 15
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
        const d = c.call_duration_sec || 0;
        return d > range.min && d <= range.max;
      }).length,
    })).filter(r => r.value > 0);
  }, [filteredCalls]);

  // Daily duration trends (includes all days in range, using called_date_time)
  const durationTrends = useMemo(() => {
    const dataMap: Record<string, { total: number; count: number }> = {};

    filteredCalls.forEach(call => {
      const dateStr = call.called_date_time || call.called_date;
      if (!dateStr) return;
      const date = format(parseISO(dateStr), 'yyyy-MM-dd');
      
      if (!dataMap[date]) dataMap[date] = { total: 0, count: 0 };
      if (call.call_duration_sec != null) {
        dataMap[date].total += call.call_duration_sec;
        dataMap[date].count += 1;
      }
    });

    // Use all dates in range, not just dates with data
    return dateRangeForCharts.map(dateObj => {
      const date = format(dateObj, 'yyyy-MM-dd');
      const data = dataMap[date] || { total: 0, count: 0 };
      return {
        date,
        totalDuration: Math.round(data.total / 60), // Convert to minutes
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
