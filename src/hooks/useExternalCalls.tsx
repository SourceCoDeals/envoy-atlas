import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';

export type DateRangeOption = 'today' | 'last_week' | 'last_2_weeks' | 'last_month' | 'all_time';

export const DATE_RANGE_OPTIONS: { value: DateRangeOption; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last_week', label: 'Last 7 Days' },
  { value: 'last_2_weeks', label: 'Last 14 Days' },
  { value: 'last_month', label: 'Last 30 Days' },
  { value: 'all_time', label: 'All Time' },
];

export interface ExternalCall {
  id: string;
  workspace_id: string;
  call_title: string | null;
  date_time: string | null;
  call_date: string | null;
  contact_name: string | null;
  company_name: string | null;
  host_email: string | null;
  rep_name: string | null;
  engagement_name: string | null;
  call_category: string | null;
  composite_score: number | null;
  seller_interest_score: number | null;
  objection_handling_score: number | null;
  rapport_building_score: number | null;
  value_proposition_score: number | null;
  engagement_score: number | null;
  next_step_clarity_score: number | null;
  gatekeeper_handling_score: number | null;
  quality_of_conversation_score: number | null;
  opening_type: string | null;
  call_summary: string | null;
  transcript_text: string | null;
  duration: number | null;
  key_concerns: string[] | null;
  target_pain_points: string | null;
  phoneburner_recording_url: string | null;
  fireflies_url: string | null;
  salesforce_url: string | null;
  import_status: string | null;
}

interface UseExternalCallsOptions {
  requireScores?: boolean;
  columns?: string;
}

const BATCH_SIZE = 1000;

/**
 * Hook to fetch ALL external_calls with proper pagination (overcoming the 1000 row limit).
 * Returns calls, unique analysts, loading state, and a refresh function.
 */
export function useExternalCalls(options: UseExternalCallsOptions = {}) {
  const { currentWorkspace } = useWorkspace();
  const [allCalls, setAllCalls] = useState<ExternalCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllCalls = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setAllCalls([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const allData: ExternalCall[] = [];
      let offset = 0;
      let hasMore = true;

      // Fetch in batches to overcome the 1000 row limit
      while (hasMore) {
        let query = supabase
          .from('external_calls')
          .select(options.columns || '*')
          .eq('workspace_id', currentWorkspace.id)
          .range(offset, offset + BATCH_SIZE - 1)
          .order('date_time', { ascending: false, nullsFirst: false });

        if (options.requireScores) {
          query = query.not('composite_score', 'is', null);
        }

        const { data, error: queryError } = await query;

        if (queryError) throw queryError;

        if (data && data.length > 0) {
          allData.push(...(data as unknown as ExternalCall[]));
          offset += BATCH_SIZE;
          hasMore = data.length === BATCH_SIZE;
        } else {
          hasMore = false;
        }
      }

      setAllCalls(allData);
    } catch (err) {
      console.error('Error fetching external calls:', err);
      setError(err instanceof Error ? err.message : 'Failed to load calls');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id, options.columns, options.requireScores]);

  useEffect(() => {
    fetchAllCalls();
  }, [fetchAllCalls]);

  // Extract unique analysts from the data
  const analysts = useMemo(() => {
    const uniqueAnalysts = new Set<string>();
    allCalls.forEach(c => {
      const analyst = c.rep_name || c.host_email;
      if (analyst) {
        uniqueAnalysts.add(analyst);
      }
    });
    return Array.from(uniqueAnalysts).sort();
  }, [allCalls]);

  return { 
    calls: allCalls, 
    analysts, 
    loading, 
    error, 
    refresh: fetchAllCalls,
    totalCount: allCalls.length
  };
}

/**
 * Get the start date for a given date range option
 */
export function getDateRangeStart(range: DateRangeOption): Date | null {
  const now = new Date();
  switch (range) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'last_week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo;
    case 'last_2_weeks':
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      return twoWeeksAgo;
    case 'last_month':
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return monthAgo;
    case 'all_time':
      return null;
  }
}

/**
 * Filter calls by date range and analyst
 */
export function filterCalls(
  calls: ExternalCall[],
  dateRange: DateRangeOption,
  selectedAnalyst: string
): ExternalCall[] {
  const rangeStart = getDateRangeStart(dateRange);

  return calls.filter(call => {
    // Date filter
    if (rangeStart) {
      const callDate = call.date_time 
        ? new Date(call.date_time) 
        : call.call_date 
          ? new Date(call.call_date) 
          : null;
      if (!callDate || callDate < rangeStart) return false;
    }

    // Analyst filter
    if (selectedAnalyst !== 'all') {
      const analyst = call.rep_name || call.host_email || '';
      if (analyst !== selectedAnalyst) return false;
    }

    return true;
  });
}

/**
 * Determine if a call is a "connection" based on category or score
 */
export function isConnection(call: ExternalCall): boolean {
  const category = (call.call_category || '').toLowerCase();
  return (
    category === 'connection' ||
    category.includes('interested') ||
    (call.seller_interest_score || 0) >= 3
  );
}

/**
 * Determine if a call resulted in a meeting (high interest)
 */
export function isMeeting(call: ExternalCall): boolean {
  return (call.seller_interest_score || 0) >= 7;
}

/**
 * Determine if a call is a quality conversation
 */
export function isQualityConversation(call: ExternalCall): boolean {
  const category = (call.call_category || '').toLowerCase();
  return (
    (call.composite_score || 0) >= 5 ||
    ['conversation', 'interested', 'meeting'].includes(category)
  );
}

/**
 * Determine if a call was a voicemail
 */
export function isVoicemail(call: ExternalCall): boolean {
  const category = (call.call_category || '').toLowerCase();
  return (
    category.includes('voicemail') ||
    category.includes('vm') ||
    ((call.seller_interest_score || 0) < 2 && !call.transcript_text)
  );
}
